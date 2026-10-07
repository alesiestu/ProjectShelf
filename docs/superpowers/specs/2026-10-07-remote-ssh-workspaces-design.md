# Remote SSH Workspaces — Design Specification

## Goal

Allow ProjectShelf to scan Git repositories inside remote workspaces reachable through the user's existing SSH configuration, while showing clearly where each project lives and preserving the current local board experience.

## Scope

Users can configure multiple remote workspaces with:

- an SSH alias already defined in `~/.ssh/config`;
- an absolute remote workspace path;
- an optional display name;
- an enabled/disabled state.

ProjectShelf stores only these values. It never stores passwords, private keys, or SSH credentials.

The existing `Rescan` action scans all enabled local and remote workspaces. Remote scans are read-only, run with a maximum total timeout of 60 seconds per workspace, and do not block other workspaces from completing.

## Data model

Remote workspace preferences are stored as `remoteWorkspaces`:

```json
[
  {
    "id": "remote-dev-vm-home-alessandro-workspace",
    "alias": "dev-vm",
    "path": "/home/alessandro/workspace",
    "name": "Dev VM",
    "enabled": true
  }
]
```

The ID is normalized from the SSH alias and remote path and remains stable if the display name changes. A remote repository uses a stable project key such as:

```text
ssh://dev-vm/home/alessandro/workspace/project-name
```

Remote project scan results include `location: "remote"`, `sshAlias`, `workspacePath`, and `connectionState` (`online`, `timeout`, or `error`). Local projects retain their current path-based identifiers and metadata.

Existing project metadata maps are extended to accept remote project keys. No migration is needed for local keys; remote metadata is added only when a remote repository is first scanned or configured.

## Remote scanning

For each enabled remote workspace, ProjectShelf invokes the system `ssh` client using the configured alias and read-only, fixed-purpose commands. The connection uses batch mode and a connection timeout so it never waits for an interactive password prompt.

The remote command discovers repositories and returns machine-readable records for repository path, name, branch, latest commit timestamp, dirty-file count, remote URL, unpushed count, stack marker, and size. ProjectShelf parses the result locally and applies the existing classification rules (`active`, `idle`, `stale`, `cleanup`).

The remote path must be absolute. It is validated and safely shell-quoted before being placed in the fixed command. User-provided shell fragments are never accepted.

Each remote workspace has an independent 60-second wall-clock deadline. On timeout, ProjectShelf terminates the SSH process, returns a workspace result with `connectionState: "timeout"`, and continues scanning all other workspaces. Authentication failures, unreachable hosts, missing paths, and malformed remote output are represented as distinct error states.

Local and remote scans run concurrently where the runtime allows it. Progress events include workspace identity so the UI can show which scan is waiting.

## Board and workspace UI

Add a compact Workspace dialog accessible from the header. It supports adding, editing, enabling/disabling, testing, and removing remote workspace entries. The form validates the alias and absolute path before saving.

The board displays local and remote cards together. Each remote card includes:

- an `SSH · <alias>` badge;
- the remote path under the project name;
- online, timeout, or error state;
- the same existing colors, ratings, tags, knowledge links, Todo links, Git status summary, and filters where the operation is supported.

Add a location filter with `All`, `Local`, and `SSH`. Existing status, remote-Git, reclaimable, rating, and tag filters continue to work across both locations.

When opening a remote card in Terminal, ProjectShelf opens an SSH terminal on the configured alias and changes directory to the remote project path. Finder and local VS Code actions are hidden or disabled for remote cards. Notion and Obsidian actions remain available. Remote Git status/diff uses the same read-only SSH bridge and never exposes mutation commands.

If a remote project disappears on a later scan, its metadata remains persisted but the card is not rendered until the project is found again.

## Security boundaries

- Reuse only the system `ssh` executable and existing SSH configuration/agent.
- Set `BatchMode=yes` and a bounded connection timeout.
- Do not save credentials or private key contents.
- Permit only fixed read-only remote commands.
- Quote the configured remote path and reject non-absolute paths.
- Enforce the 60-second process deadline locally.
- Never expose remote workspace configuration or SSH execution as MCP tools in this version.
- MCP may update metadata for remote project cards, but it cannot add hosts, change paths, trigger scans, or execute remote commands.

## Error handling

The workspace dialog shows the last scan state and last error without hiding successful projects. A failed remote workspace must not fail the complete scan. The UI distinguishes:

- host unavailable;
- SSH authentication/configuration failure;
- remote path missing or inaccessible;
- timeout;
- invalid or incomplete remote scan output.

The previous successful project list remains visible while a new scan is in progress. If a scan fails, the previous successful results for that workspace are retained with a stale/error indicator until a later successful scan replaces them.

## Verification

Tests must cover:

- workspace normalization and stable IDs;
- absolute-path validation and safe shell quoting;
- command construction with no user-controlled command fragments;
- parsing valid and malformed remote records;
- online, timeout, authentication, missing-path, and malformed-output states;
- termination at 60 seconds;
- parallel local/remote scan aggregation;
- remote card rendering and location filtering;
- persistence and reappearance of remote project metadata;
- remote Terminal action and disabled local-only actions;
- unchanged behavior for existing local workspaces;
- MCP refusal to mutate remote workspace configuration;
- TinyJS build, codesign, and app bundle verification.

## Out of scope

This version does not mount remote filesystems, install agents on VMs, manage SSH keys, support arbitrary SSH commands, edit remote files, perform remote Git writes, or expose remote workspace administration through MCP.
