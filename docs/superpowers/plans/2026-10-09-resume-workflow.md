# ProjectShelf Resume Workflow Implementation Plan

**Goal:** Apply the user-approved 9 October assessment, then install the updated app without losing metadata.

**Architecture:** Retain the TinyJS API and existing store. Add a shared normalization module for context, discovery and backup; expose only context metadata through the MCP. Package the server and its Node runtime in app resources, independent of cwd.

**Tech Stack:** TinyJS, plain JavaScript/HTML/CSS, Node MCP SDK 1.29.0, Git/OpenSSH CLI.

## Approved scope

The supplied assessment is the design authority: global keyboard search, context fields, resume action, daily/recent/favorite views, linked tasks, backup, worktree/unknown-date/persistence/MCP fixes. Calendar and reminders remain future work, as the assessment recommends. Existing SSH, tags, stars, colors and links must stay available. Import fills missing entries and does not overwrite existing metadata. No remote Git writes or repository deletion.

## Implementation checklist

- [x] `src/project-context.js`, `src/main.js`, `src/remote-workspaces.js`: normalize contexts; discover `.git` files; reject unknown timestamps; propagate failed store writes; bound process waits to 60 seconds.
- [x] `src/frontend/app.js`, `index.html`, `style.css`: daily grid, search (`⌘K`/`/`), context dialog, preferred environments, favorites/recent sorting, project-specific tasks, backup controls and retry feedback. Preserve incumbent visual tokens.
- [x] `mcp/validation.mjs`, `mcp/server.mjs`: preserve contexts; partial context mutation through `update_project`; app-managed lastOpened; no new shell/file authority.
- [x] `scripts/build.mjs`, `package.json`: package server, dependencies and Node; sign and verify bundle.
- [x] Verification: 26 tests pass, including a real worktree, missing timestamp, failed persistence, bounded timeout, import preservation, resume dispatch/session handling and authenticated MCP client mutations on fake data.
- [x] Build: standalone Node bundled; packaged and installed MCP verified from an arbitrary temporary working directory with isolated state. UI search/context/Todo preselection/menu inspected; MCP start/stop confirmed in the installed app.
- [x] Deployment: previous bundle retained at `/private/tmp/projectshelf-preupdate.co2ygp/ProjectShelf.app`; installed exactly `/Applications/ProjectShelf.app`. Signature verified, CFBundleVersion 0.2.0 confirmed, installed source matches the workspace. Final app reopened on Da continuare with 40 repositories and 4 existing open Todo items.

## Verification boundaries

UI review was performed in-thread without a separate reviewer tool. The automatic design detector ran once in degraded regex mode; it does not certify contrast/accessibility. Its incumbent color-border/progress-animation findings were retained because card colors are an existing requested feature. The new warning border was removed. No full VoiceOver certification or live external-editor/Notion/Obsidian end-to-end test was performed; resume dispatch, failed-open behavior and session persistence are tested with mocks. Calendar/reminders are not implemented in this release.

No unrelated `.DS_Store`, `.claude/` or existing working-tree changes are removed. No remote publication is part of this request.
