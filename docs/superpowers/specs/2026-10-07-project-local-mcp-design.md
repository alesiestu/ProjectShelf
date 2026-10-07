# ProjectShelf Local MCP Service — Design Specification

## Goal

Add a local MCP service that lets an LLM inspect ProjectShelf projects and update only their organizational metadata. The service must be usable by Codex and other compatible clients through a copyable local configuration, while keeping repository contents and Git operations outside its authority.

## Scope

The first version exposes these mutable resources:

- project color;
- project rating from zero to five stars;
- free-form project tags;
- Notion and Obsidian links;
- Todo items, including links from one Todo to multiple projects.

The service exposes no filesystem editing, shell execution, Git mutation, repository deletion, URL opening, workspace configuration, or project scanning controls.

## Architecture

ProjectShelf starts a small local service on loopback. The service has two interfaces:

1. an MCP endpoint for external LLM clients;
2. a private application API used by the ProjectShelf UI.

The service owns a dedicated JSON metadata file. On first start it imports the existing TinyJS store values for colors, ratings, knowledge links, tags, and Todo items. Subsequent UI and MCP changes use the service as the shared source of truth. Writes are serialized and persisted by writing a temporary file followed by an atomic replacement.

The service binds only to `127.0.0.1`, uses a random persisted bearer token, and rejects requests without a valid token. Regenerating the token invalidates the previous token. The token is never written to logs.

The app starts the service when needed and reports its state in the MCP panel. A startup failure does not prevent the project board from opening; the panel shows the failure and offers a retry.

## MCP tools

### `list_projects`

Returns the scanned projects and their current metadata. Each project includes its absolute path, name, repository state summary, color, rating, tags, Notion link, Obsidian link, and linked Todo identifiers.

### `update_project`

Updates one or more metadata fields for an existing project identified by its absolute path. Supported fields are color, rating, tags, Notion link, and Obsidian link. Omitted fields remain unchanged. Values are validated by the same rules as the UI.

### `list_todos`

Returns all Todo items, including completion state, text, and linked project paths.

### `create_todo`

Creates one Todo with text, optional completion state, and zero or more existing project paths.

### `update_todo`

Updates an existing Todo by identifier. It can change text, completion state, and linked project paths.

### `delete_todo`

Deletes one Todo by identifier. It does not modify or delete any project.

Tool errors are structured and explicit: unknown project paths, unknown Todo identifiers, invalid links, invalid ratings, invalid colors, oversized text, and malformed tags are rejected without a partial update.

## Application panel

Add a compact MCP section opened by one click. It shows:

- running/stopped/error state;
- local endpoint and port;
- current token with a hide/show control;
- a copyable client configuration;
- a copyable installation prompt describing the endpoint, authentication, available tools, allowed scope, and safety rules;
- start/retry, stop, regenerate-token, and copy actions.

The configuration and prompt are generated from the active endpoint and token so they cannot become stale after a restart or token regeneration. The panel does not send credentials to an external service.

## Compatibility and migration

Existing metadata keys remain readable during migration. The new service imports them once into its normalized JSON format, preserving current values and supporting both Notion and Obsidian links. The UI continues to use the existing validation limits: maximum five stars, six supported colors, maximum twelve tags per project, maximum fifty characters per tag, and the existing Todo/link constraints.

The exact MCP HTTP transport and client configuration shape will be selected from the current official MCP SDK/protocol documentation during implementation. The public contract remains a loopback endpoint protected by the generated token.

## Error handling and lifecycle

- Service startup is idempotent; opening the panel does not create duplicate servers.
- The app detects a stopped or unreachable service and can restart it.
- The service shuts down with the app when it is owned by the app.
- A malformed metadata file is preserved as a backup and replaced with a valid normalized file containing recoverable defaults.
- A failed write leaves the previous valid metadata file untouched.
- All mutation responses return the resulting normalized object so the UI and client can refresh without guessing.

## Verification

Implementation must include:

- validation tests for each mutation schema and rejection case;
- migration tests for existing TinyJS metadata, including both knowledge-link providers;
- service smoke tests for authentication, loopback binding, tool discovery, and each mutation;
- atomic-write and malformed-file recovery tests;
- a TinyJS build and app bundle verification;
- manual verification of the MCP panel copy actions and a real local client connection.

## Out of scope

The first version does not expose project creation/deletion, repository files, Git status mutation, shell commands, arbitrary HTTP requests, remote hosting, multi-user authentication, or cloud synchronization.
