# Remote SSH Workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scan configured SSH workspaces together with local workspaces, display remote projects with clear location/status information, and preserve existing ProjectShelf metadata and filters.

**Architecture:** Add a pure remote-workspace module for normalization, stable IDs, shell-safe path quoting, remote output parsing, and error classification. The TinyJS backend will run fixed read-only SSH commands with `BatchMode=yes`, `StrictHostKeyChecking=yes`, `ConnectTimeout`, and a hard 60-second deadline, aggregate local and remote scans, and expose only normalized results to the frontend. The frontend will add a compact workspace manager, location filters, SSH badges, and remote-aware actions.

**Tech Stack:** TinyJS/txiki.js, JavaScript ES modules, system OpenSSH client, existing Git CLI scanner, HTML/CSS frontend, Node built-in test runner for pure remote helpers.

---

## File map

- Create `src/remote-workspaces.js`: pure validation, stable IDs, command construction, result parsing, timeout/error classification.
- Create `tests/remote-workspaces.test.mjs`: unit tests for the pure remote module.
- Modify `src/main.js`: persist remote workspace preferences, run SSH scans/actions, aggregate scan progress, and keep remote data outside MCP administration.
- Modify `src/frontend/index.html`: add workspace manager dialog and location filter controls.
- Modify `src/frontend/app.js`: render remote cards, workspace dialog, SSH status, location filters, and remote-aware actions.
- Modify `src/frontend/style.css`: compact workspace dialog, SSH badges, location/status indicators, and progress states.
- Modify `README.md`: document SSH aliases, remote workspace setup, timeout behavior, and security boundaries.
- Modify `mcp/server.mjs` only if needed to explicitly reject remote workspace administration tools; no new SSH tool is exposed.

## Task 1: Pure remote workspace contracts

**Files:**
- Create: `src/remote-workspaces.js`
- Create: `tests/remote-workspaces.test.mjs`

- [ ] **Step 1: Write failing validation and ID tests.**

Cover these exact inputs:

```js
normalizeRemoteWorkspace({ alias: 'dev-vm', path: '/home/alessandro/workspace', name: 'Dev VM' })
// { id: 'remote-dev-vm-home-alessandro-workspace', alias: 'dev-vm', path: '/home/alessandro/workspace', name: 'Dev VM', enabled: true }

normalizeRemoteWorkspace({ alias: 'dev-vm', path: 'relative/path' })
// throws INVALID_REMOTE_PATH

remoteProjectKey('dev-vm', '/home/alessandro/workspace/app')
// 'ssh://dev-vm/home/alessandro/workspace/app'
```

Also test that aliases cannot contain whitespace, shell separators, or empty values; names are trimmed and capped; duplicate workspace IDs are rejected; and `enabled` defaults to `true`.

- [ ] **Step 2: Run the focused tests and verify they fail.**

Run:

```bash
/Users/alessandro/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/remote-workspaces.test.mjs
```

Expected: module/function-not-found failures.

- [ ] **Step 3: Implement normalization and stable IDs.**

Export:

```js
export const normalizeRemoteWorkspace = (input) => workspace;
export const normalizeRemoteWorkspaces = (entries) => workspaces;
export const remoteProjectKey = (alias, projectPath) => key;
export const isAbsoluteRemotePath = (path) => boolean;
```

Use a deterministic ID from alias plus normalized POSIX path. Do not use the display name in the ID. Reject non-absolute paths and aliases containing whitespace, quotes, semicolons, pipes, ampersands, backticks, `$`, parentheses, or slashes.

- [ ] **Step 4: Implement shell-safe quoting and fixed command construction.**

Export:

```js
export const shellQuote = (value) => quotedValue;
export const buildRemoteScanCommand = (workspace) => command;
export const buildRemoteProjectStatusCommand = (project) => command;
```

`buildRemoteScanCommand()` must produce a fixed command containing only the quoted workspace path and the read-only scan script. It must never accept a caller-provided command string. The command must emit one JSON record per repository with path, name, branch, commit timestamp, dirty count, remote URL, unpushed count, stack, and size.

- [ ] **Step 5: Add parser and error classification tests.**

Test valid newline-delimited JSON, malformed lines, missing required fields, `ssh` exit codes for authentication/path errors, and timeout classification. A single malformed repository record must be discarded without discarding valid records from the same workspace.

- [ ] **Step 6: Implement parsing and error classification.**

Export:

```js
export const parseRemoteScanOutput = (stdout, workspace) => workspaceResult;
export const classifyRemoteFailure = ({ code, stderr, timedOut }) => errorState;
```

Return `connectionState: 'online' | 'timeout' | 'error'`, `errorKind`, `errorMessage`, `projects`, and workspace identity. Each project must include `location: 'remote'`, `sshAlias`, `workspacePath`, and a stable `path` key.

- [ ] **Step 7: Run the tests and commit the pure module.**

Run the Node test command again; expected: all focused tests pass.

```bash
git add src/remote-workspaces.js tests/remote-workspaces.test.mjs
git commit -m "Add remote workspace contracts and SSH command safety"
```

## Task 2: Persist remote workspaces and aggregate SSH scanning

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Add preference validation tests to the pure test file.**

Test that malformed stored entries are removed, duplicate IDs collapse to the first entry, disabled entries remain persisted but are skipped by scanning, and existing local preference maps remain unchanged.

- [ ] **Step 2: Add `remoteWorkspaces` to `loadPrefs` and `savePrefs`.**

Use `normalizeRemoteWorkspaces()` for both reads and writes. Preserve the existing `workspace`, `ignored`, language, colors, ratings, tags, knowledge links, and Todo values exactly as they work today.

- [ ] **Step 3: Implement bounded SSH process execution.**

Add a backend helper:

```js
async function runRemote(workspace, command, timeoutMs = 60000) {
  // spawn ssh with fixed options, collect stdout/stderr, terminate at deadline
  // and return { code, out, err, timedOut }
}
```

The spawned argv must include:

```text
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 -o ConnectionAttempts=1 <alias> <fixed-command>
```

Use the existing txiki stream reader pattern, a 60-second `Abort`/timer equivalent, and terminate the child on timeout. Never pass `shell: true` or concatenate the alias into a local shell command. OpenSSH `BatchMode` avoids prompts and `ConnectTimeout` bounds connection establishment.

- [ ] **Step 4: Implement remote workspace scanning.**

Add `scanRemoteWorkspace(workspace)` that runs the fixed scan command, parses records, maps them through the existing classification logic, and returns workspace status plus projects. Keep the previous successful result in a backend cache when a later scan fails.

- [ ] **Step 5: Run local and remote scans together.**

Update `api.scan` to create local scan work and enabled remote scan work, await them concurrently, flatten successful project results, and retain remote error records for the frontend. Emit progress events with `workspaceId`, `kind`, `done`, and `total`. The local scan behavior and existing result fields must remain unchanged.

- [ ] **Step 6: Test aggregation with fake process results.**

Add tests for one local plus two remote workspaces where one is online and one times out. Assert that the online projects are returned, the timeout state is present, and the complete call finishes without waiting longer than the configured deadline in the fake runner.

- [ ] **Step 7: Build and commit backend scanning.**

Run:

```bash
tinyjs build
/Users/alessandro/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/remote-workspaces.test.mjs
```

Expected: build succeeds and all remote helper/aggregation tests pass.

```bash
git add src/main.js src/remote-workspaces.js tests/remote-workspaces.test.mjs
git commit -m "Scan configured SSH workspaces with bounded timeouts"
```

## Task 3: Add workspace manager and location filters

**Files:**
- Modify: `src/frontend/index.html`
- Modify: `src/frontend/app.js`
- Modify: `src/frontend/style.css`

- [ ] **Step 1: Add bilingual labels and the Workspace dialog.**

Add labels for Workspace, Local, SSH, alias, remote path, display name, enabled, test connection, save, remove, timeout, authentication error, missing path, unavailable host, and malformed response. Add a header button and a dialog containing a list of configured workspaces plus add/edit form fields.

- [ ] **Step 2: Implement workspace CRUD actions.**

Load `prefs.remoteWorkspaces`, render each entry, and call `savePrefs({ remoteWorkspaces })` after add/edit/toggle/remove. Validate the alias and absolute path client-side for immediate feedback; keep backend validation authoritative. Add a test button that calls `testRemoteWorkspace` and renders the returned status without changing saved configuration.

- [ ] **Step 3: Add location filters.**

Extend the existing filter state with `location:local` and `location:remote`. The visible-project predicate must treat local projects as `location !== 'remote'` and remote projects as `location === 'remote'`. Preserve all current status, rating, tag, and Git filters.

- [ ] **Step 4: Render SSH identity and connection states on cards.**

For remote cards render `SSH · <alias>`, the remote workspace path, and a state tag. Keep the current card metadata and controls. For timeout/error workspace results render a compact non-project status card in a workspace status area so errors do not look like repositories.

- [ ] **Step 5: Update scan progress rendering.**

Use the progress event’s workspace identity to show which local or remote workspace is being scanned. Keep the existing progress bar and avoid adding a large dashboard.

- [ ] **Step 6: Build and manually verify the UI.**

Run `tinyjs build`, open the app, add a disabled test workspace, switch location filters, change language, and confirm all existing cards and filters still work. Do not attempt a real SSH connection until Task 4’s read-only actions are complete.

- [ ] **Step 7: Commit the workspace UI.**

```bash
git add src/frontend/index.html src/frontend/app.js src/frontend/style.css
git commit -m "Add remote workspace manager and location filters"
```

## Task 4: Remote terminal, Git status, and MCP boundary

**Files:**
- Modify: `src/main.js`
- Modify: `src/frontend/app.js`
- Modify: `src/frontend/style.css`
- Modify: `mcp/server.mjs`

- [ ] **Step 1: Add remote terminal opening.**

Add `openRemoteTerminal({ alias, path })` that validates the project belongs to a configured workspace and opens Terminal with `ssh <alias> -t 'cd -- <quoted-path> && exec $SHELL'`. The app must use an argv-based launch and safe remote quoting; it must not accept arbitrary command text.

- [ ] **Step 2: Add read-only remote Git status and diff.**

Extend `repoStatus` and `repoDiff` to dispatch to fixed remote commands when `project.location === 'remote'`. Apply the same 60-second deadline and return the same frontend shape used by local Git dialogs. Never expose `git add`, `commit`, `push`, `reset`, or deletion operations.

- [ ] **Step 3: Disable local-only card actions for remote projects.**

Hide or disable Finder and local VS Code buttons on remote cards. Keep Terminal, Notion, Obsidian, color, rating, tags, Todo, status, and diff actions available where supported.

- [ ] **Step 4: Lock the MCP boundary.**

Keep `remoteWorkspaces` out of the MCP state mutation schema. Add a server test that attempts to pass workspace administration fields to `update_project` and confirms they are rejected or ignored without changing workspace preferences. Do not add any SSH or scan tool to the MCP server.

- [ ] **Step 5: Run remote security tests.**

Verify command construction contains no user-provided shell fragment, non-absolute paths fail, remote Terminal uses only configured aliases, and timeout kills the process. Run the MCP test suite and TinyJS build.

- [ ] **Step 6: Commit remote actions and security boundary.**

```bash
git add src/main.js src/frontend/app.js src/frontend/style.css mcp/server.mjs tests/remote-workspaces.test.mjs
git commit -m "Add safe remote terminal and read-only Git actions"
```

## Task 5: Documentation, real SSH verification, bundle, and push

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document remote workspace setup.**

Explain that the user must first configure an SSH alias in `~/.ssh/config`, then add the alias and absolute path in ProjectShelf. Document that `Rescan` updates every enabled workspace, that each remote workspace has a 60-second deadline, that authentication is non-interactive, and that ProjectShelf never stores SSH credentials.

- [ ] **Step 2: Run pure and MCP tests.**

Run:

```bash
/Users/alessandro/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/remote-workspaces.test.mjs
/Users/alessandro/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test mcp/test.mjs
```

Expected: both suites pass.

- [ ] **Step 3: Perform a real read-only SSH scan.**

Configure one known alias and workspace path, start ProjectShelf, add the workspace, run `Rescan`, verify the SSH badge, remote path, location filter, Terminal action, and timeout/error display. Confirm no password prompt appears and no remote file is created or modified.

- [ ] **Step 4: Build and verify the app bundle.**

Run:

```bash
tinyjs build
codesign --verify --deep --strict dist/ProjectShelf.app
```

Expected: the Apple Silicon app is rebuilt and codesign verification succeeds.

- [ ] **Step 5: Update README and commit.**

```bash
git add README.md
git commit -m "Document remote SSH workspaces"
```

- [ ] **Step 6: Push to the public repository.**

```bash
git push origin main
```

Report the final commit, app path, tests, and any limitation discovered with the user's SSH configuration.

## Plan self-review

- Spec coverage: workspace model, SSH-only access, fixed read-only commands, 60-second timeout, aggregation, status/error states, board badges, location filters, remote terminal/Git read-only actions, metadata persistence, MCP boundary, tests, documentation, build, and push are covered by Tasks 1–5.
- Placeholder scan: no `TBD`, `TODO`, `FIXME`, or vague “handle appropriately” steps remain.
- Contract consistency: `remoteWorkspaces`, `remoteProjectKey`, `connectionState`, `sshAlias`, `workspacePath`, `location: 'remote'`, `testRemoteWorkspace`, and the existing `savePrefs`/`scan` APIs are used consistently.
- Security review: all user-controlled remote values are validated/quoted; commands remain fixed; credentials stay in the system SSH configuration; the MCP server cannot administer or invoke remote scans.
