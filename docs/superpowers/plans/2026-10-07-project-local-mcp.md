# ProjectShelf Local MCP Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a loopback-only, token-protected Streamable HTTP MCP service that lets Codex inspect and update ProjectShelf metadata, with an in-app panel that generates copyable connection settings and an installation prompt.

**Architecture:** A Node sidecar owns a normalized JSON metadata file and serves both `/mcp` and a private app bridge. ProjectShelf starts and monitors the sidecar, migrates its existing TinyJS store into the shared metadata file, and refreshes the board after sidecar mutations. The MCP layer exposes only bounded project metadata and Todo operations; it never exposes filesystem, shell, Git mutation, or deletion capabilities.

**Tech Stack:** TinyJS/txiki.js frontend and backend, Node.js ESM sidecar, `@modelcontextprotocol/sdk` v1.29.0, Zod, Node built-in HTTP and test runner, Streamable HTTP transport.

---

## File map

- Create `package.json` and `package-lock.json`: pin the MCP SDK and Zod runtime dependencies and provide sidecar/test scripts.
- Create `mcp/validation.mjs`: pure normalization and validation for colors, ratings, links, tags, projects, and Todos.
- Create `mcp/store.mjs`: normalized JSON persistence, one-time TinyJS-store migration input, serialized writes, atomic replacement, and malformed-file backup recovery.
- Create `mcp/server.mjs`: loopback HTTP server, bearer-token middleware, private app bridge, MCP server registration, tool annotations, and lifecycle messages.
- Create `mcp/test.mjs`: Node test-runner coverage for validation, migration, authentication, tool schemas, mutation behavior, and atomic persistence.
- Modify `src/main.js`: expose MCP lifecycle/status/migration APIs and keep existing UI validation behavior aligned with the sidecar.
- Modify `src/frontend/index.html`: add the compact MCP panel/modal and copyable configuration/prompt fields.
- Modify `src/frontend/app.js`: load MCP state, open/close the panel, start/stop/retry/regenerate, copy generated values, and refresh metadata after sidecar changes.
- Modify `src/frontend/style.css`: style the panel as a compact utility box matching existing dialogs, without adding a new visual navigation layer.
- Modify `README.md`: document local MCP setup, security scope, Codex configuration, and the available tools.
- Modify `.gitignore` if needed: exclude only local runtime metadata or test temporary files; do not exclude source, lockfiles, or generated user instructions.

### Task 1: Add the sidecar runtime and pure validation layer

**Files:**
- Create: `package.json`
- Create: `mcp/validation.mjs`

- [ ] **Step 1: Add the pinned dependency manifest.**

Create `package.json` with this contract:

```json
{
  "name": "projectshelf",
  "private": true,
  "type": "module",
  "scripts": {
    "mcp": "node mcp/server.mjs",
    "test:mcp": "node --test mcp/test.mjs"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "1.29.0",
    "zod": "3.25.76"
  }
}
```

- [ ] **Step 2: Install the lockfile and verify the runtime.**

Run:

```bash
npm install
node --version
node -e "import('@modelcontextprotocol/sdk/server/mcp.js').then(() => console.log('mcp sdk ok'))"
```

Expected: a `package-lock.json`, a Node version that supports ESM, and `mcp sdk ok`.

- [ ] **Step 3: Write validation tests before implementation.**

In `mcp/test.mjs`, initially add tests for these exact cases: accepted colors are `blue`, `green`, `yellow`, `orange`, `red`, `purple`; ratings accept integers 0–5 and reject decimals, negatives, and values above 5; tags trim, deduplicate case-insensitively, and cap at 12 items/50 characters; Notion links accept only `http:`/`https:`; Obsidian links accept only `obsidian:`; Todo text is required and project paths are deduplicated.

- [ ] **Step 4: Implement `mcp/validation.mjs` to make those tests pass.**

Export these stable functions:

```js
export const normalizeProjectMetadata = (input) => ({ color, rating, tags, notion, obsidian });
export const normalizeTodo = (input, knownProjectPaths) => ({ id, text, done, projectPaths });
export const validateProjectPath = (path, knownProjectPaths) => path;
export const isAllowedLink = (value, provider) => boolean;
```

All functions must throw an `McpValidationError` with a stable `code` and human-readable message on invalid input. They must never silently coerce an invalid field into a different valid field.

- [ ] **Step 5: Run the validation tests.**

Run `npm run test:mcp -- --test-name-pattern=validation`.

Expected: all validation tests pass.

- [ ] **Step 6: Commit the runtime foundation.**

```bash
git add package.json package-lock.json mcp/validation.mjs mcp/test.mjs
git commit -m "Add MCP runtime and metadata validation"
```

### Task 2: Implement normalized persistence and migration

**Files:**
- Create: `mcp/store.mjs`
- Modify: `mcp/test.mjs`

- [ ] **Step 1: Define the persisted document and store API in tests.**

The JSON document must use this shape:

```js
{
  "version": 1,
  "projectColors": {},
  "projectRatings": {},
  "projectKnowledgeLinks": {},
  "projectTags": {},
  "todos": [],
  "token": "..."
}
```

Test these exported operations: `loadStore(file, migration)`, `updateStore(file, updater)`, `rotateToken(file)`, and `getStorePath(homeDir)`. A write must be serialized, use a sibling temporary file, and replace the old file only after the complete JSON is written.

- [ ] **Step 2: Implement first-run migration.**

`loadStore()` accepts the current `app.store` values as a plain object, imports both `projectKnowledgeLinks` and legacy `projectNotionLinks`, validates all metadata through `validation.mjs`, and preserves the existing Todo IDs where valid. Migration must be idempotent: loading the same file twice must not duplicate Todo items or regenerate the token.

- [ ] **Step 3: Implement recovery for malformed JSON.**

If parsing fails, rename the malformed file to a timestamped `.bak` sibling, create a normalized empty document with a new token, and return a recovery flag. If writing fails, leave the previous valid document untouched and surface an error with code `STORE_WRITE_FAILED`.

- [ ] **Step 4: Test migration, token persistence, serialization, and recovery.**

Run `npm run test:mcp -- --test-name-pattern="store|migration|token|recovery"`.

Expected: migration keeps both providers, concurrent update promises resolve in order, token rotation changes the token exactly once, and malformed-file recovery creates a backup.

- [ ] **Step 5: Commit persistence.**

```bash
git add mcp/store.mjs mcp/test.mjs
git commit -m "Add MCP metadata persistence and migration"
```

### Task 3: Build the authenticated MCP server and app bridge

**Files:**
- Create: `mcp/server.mjs`
- Modify: `mcp/test.mjs`

- [ ] **Step 1: Define the server configuration and health contract.**

The process accepts `PROJECTSHELF_STATE_PATH`, `PROJECTSHELF_TOKEN`, and `PROJECTSHELF_PORT`; it defaults to a free loopback port when no port is provided. It prints one machine-readable `ready` line containing only the port and endpoint, never the token. `GET /health` returns `{ "ok": true, "mcp": "/mcp" }` only with a valid bearer token.

- [ ] **Step 2: Add bearer-token middleware before MCP or bridge dispatch.**

Accept exactly `Authorization: Bearer <persisted-token>`. Reject missing, malformed, or incorrect credentials with HTTP 401 and `WWW-Authenticate: Bearer`. Do not include the token in errors, structured tool results, or logs.

- [ ] **Step 3: Register the six MCP tools with explicit schemas and annotations.**

Use `McpServer.registerTool()` and Zod schemas. `list_projects` and `list_todos` are `readOnlyHint: true`; all other tools are `readOnlyHint: false`; every tool uses `openWorldHint: false`; `delete_todo` sets `destructiveHint: true`; metadata updates set `destructiveHint: false` because they are bounded and reversible. Return `structuredContent` plus a short text summary.

Each handler must call the store/validation layer and return the normalized resulting record. `list_projects` receives the current scanned project snapshot from the app bridge, not arbitrary filesystem input.

- [ ] **Step 4: Implement the private app bridge.**

Add authenticated JSON routes for `GET /app/state`, `POST /app/state`, and `POST /app/scan-projects`. The bridge is bound to loopback, uses the same token, validates the project snapshot, and is not advertised as an MCP tool. The app bridge must reject project paths not present in the latest scan when a mutation targets a project.

- [ ] **Step 5: Add server smoke tests.**

Test initialization, tool discovery, valid and invalid bearer tokens, every tool, unknown project paths, unknown Todo IDs, and the absence of any file/shell/Git tool. Use the SDK’s Streamable HTTP transport and a temporary state file.

- [ ] **Step 6: Run the sidecar tests and a local server smoke command.**

Run:

```bash
npm run test:mcp
PROJECTSHELF_PORT=0 npm run mcp
```

Expected: all tests pass and the server prints a loopback `/mcp` endpoint without printing the token.

- [ ] **Step 7: Commit the server.**

```bash
git add mcp/server.mjs mcp/test.mjs
git commit -m "Add authenticated ProjectShelf MCP server"
```

### Task 4: Connect TinyJS lifecycle, migration, and refresh behavior

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Add MCP lifecycle API methods.**

Add backend methods `mcpStatus`, `mcpStart`, `mcpStop`, `mcpRotateToken`, `mcpConfig`, and `mcpSync`. They must launch the sidecar with the dedicated state path, read its readiness line, poll `/health`, and return `{ state, endpoint, port, token, error }` without logging credentials.

- [ ] **Step 2: Migrate current TinyJS values at startup.**

Build the migration object from the existing `app.store` keys, including the legacy Notion map, and call the sidecar bridge before the first UI `loadPrefs` response. Existing `savePrefs` calls must update both TinyJS store values and the sidecar state so older app data remains recoverable.

- [ ] **Step 3: Add controlled refresh.**

Expose `mcpSync` to pull normalized metadata from the sidecar and merge it into the existing app store. Trigger it after a successful scan and when the frontend requests a refresh after a mutation. Keep the board usable if the sidecar is stopped by returning the last valid TinyJS values.

- [ ] **Step 4: Verify backend syntax/build behavior.**

Run the existing TinyJS build after each lifecycle change and use a temporary state path to exercise start, health, stop, and restart. Confirm that no token is present in captured stdout/stderr.

- [ ] **Step 5: Commit TinyJS integration.**

```bash
git add src/main.js
git commit -m "Connect ProjectShelf to local MCP lifecycle"
```

### Task 5: Add the compact MCP panel and generated installation materials

**Files:**
- Modify: `src/frontend/index.html`
- Modify: `src/frontend/app.js`
- Modify: `src/frontend/style.css`

- [ ] **Step 1: Add the panel markup.**

Add one header utility button and one modal with elements for status, endpoint, hidden/revealed token, configuration text, prompt text, copy buttons, start/retry, stop, regenerate token, and close. Use the existing dialog patterns and bilingual labels.

- [ ] **Step 2: Generate the Codex configuration from live server data.**

Render the loopback URL as `http://127.0.0.1:<port>/mcp` and the current bearer token as a header. Use the current Codex URL configuration shape documented by OpenAI; the panel must regenerate this text after restart or token rotation. The prompt must state the server name, endpoint, token header, tool list, allowed metadata scope, and explicit prohibitions on file/Git/shell operations.

- [ ] **Step 3: Implement panel actions.**

Wire open/close, start/retry, stop, token rotation, reveal/hide, and copy-to-clipboard actions. After a successful MCP mutation, call `mcpSync` and rerender the board. Show concise localized errors without exposing credentials.

- [ ] **Step 4: Keep the visual footprint small.**

Use the existing modal width, spacing, buttons, and status tags. The panel must be utility-first: no new sidebar, dashboard, or persistent large card. Long configuration and prompt text use scrollable monospace textareas.

- [ ] **Step 5: Build and manually verify the UI.**

Run `tinyjs build`, open the resulting app, open the MCP box, verify both copy buttons, start/stop/retry, token rotation, and that all existing card features still render. Use a local clipboard paste to confirm the generated text is complete.

- [ ] **Step 6: Commit the panel.**

```bash
git add src/frontend/index.html src/frontend/app.js src/frontend/style.css
git commit -m "Add ProjectShelf MCP setup panel"
```

### Task 6: Documentation, end-to-end verification, and app bundle

**Files:**
- Modify: `README.md`
- Modify: `.gitignore` only if runtime artifacts require exclusion

- [ ] **Step 1: Document local MCP usage.**

Add a short section explaining that the service is local-only, how to open the panel, how to paste the generated Codex configuration and prompt, the six tools, token rotation, and the fact that repository files and Git operations are never exposed. Include the local test command and the `tinyjs build` command.

- [ ] **Step 2: Run the complete verification suite.**

Run:

```bash
npm run test:mcp
tinyjs build
codesign --verify --deep --strict dist/ProjectShelf.app
git status --short
```

Expected: MCP tests pass, the app bundle is regenerated, code signing verification succeeds, and only intentional source/build changes remain. Keep `.DS_Store`, `.build/`, and `.claude/` untracked.

- [ ] **Step 3: Test with MCP Inspector.**

Start the app, start the service from the panel, connect MCP Inspector to the generated `/mcp` URL with the bearer token, verify initialization, inspect all six tools, run representative valid/invalid calls, and confirm that write results appear in the ProjectShelf board after refresh.

- [ ] **Step 4: Commit documentation and final bundle source changes.**

```bash
git add README.md .gitignore
git commit -m "Document local ProjectShelf MCP integration"
```

- [ ] **Step 5: Push the completed implementation.**

```bash
git push origin main
```

Report the final commit, the app path `dist/ProjectShelf.app`, the generated local endpoint shown by the app, and any limitation discovered during the real Codex connection test.

## Plan self-review

- Spec coverage: scope, loopback binding, bearer token, normalized persistence, migration, atomic writes, six tools, panel, generated configuration/prompt, lifecycle, recovery, tests, build, and out-of-scope boundaries are covered by Tasks 1–6.
- Placeholder scan: no `TBD`, `TODO`, `FIXME`, or unspecified “handle appropriately” steps remain.
- Type/contract consistency: `projectKnowledgeLinks`, `projectTags`, `projectRatings`, `projectColors`, `todos`, `/mcp`, `/health`, `/app/state`, `/app/scan-projects`, and the six tool names match the approved design and current ProjectShelf data model.
- Compatibility note: Codex connection syntax is generated from the current official OpenAI documentation and must be tested against the installed Codex client during Task 5/6; the local server contract itself remains stable.
