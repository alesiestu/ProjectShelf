# Project Todos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact persistent Todo section with multi-project links and basic complete/edit/delete actions.

**Architecture:** Store a validated todo array in TinyJS preferences. Render a collapsible section and a reusable modal form in the frontend; resolve linked project names from the current scan while preserving paths for persistence.

**Tech Stack:** TinyJS backend store, vanilla JavaScript, HTML, CSS.

---

### Task 1: Persist todos in the backend

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Load todos**

Return `todos` from `app.store`, defaulting to an empty array.

- [ ] **Step 2: Validate and save todos**

Accept objects with string `id` and `text`, boolean `done`, and string `projectPaths`; trim text, remove duplicate paths, and discard empty tasks.

### Task 2: Add Todo section and modal

**Files:**
- Modify: `src/frontend/index.html`
- Modify: `src/frontend/app.js`

- [ ] **Step 1: Add bilingual labels**

Translate Todo title, add/edit/save/cancel/delete labels, empty state, and project selection text.

- [ ] **Step 2: Render a collapsible Todo section**

Show open count in the heading, compact rows, completion checkbox, project chips, and edit/delete buttons without changing the board markup.

- [ ] **Step 3: Add the Todo dialog**

Provide a text input and checkbox list of currently scanned projects, with add/edit state and validation for non-empty text.

- [ ] **Step 4: Handle Todo actions**

Delegate events for toggle, edit, delete, dialog save, and cancel; persist each mutation through `savePrefs` and rerender.

### Task 3: Style the compact section

**Files:**
- Modify: `src/frontend/style.css`

- [ ] **Step 1: Style the collapsible section and rows**

Use existing panels, compact spacing, muted project chips, and clear completed-task styling.

- [ ] **Step 2: Style the multi-project dialog**

Keep the project list scrollable and the modal consistent with the existing Notion dialog.

### Task 4: Verify and publish

**Files:**
- Test: `src/main.js`, `src/frontend/index.html`, `src/frontend/app.js`, `src/frontend/style.css`

- [ ] **Step 1: Build and verify signing**

Run `tinyjs build` and `codesign --verify --deep --strict dist/ProjectShelf.app`; expect successful build and exit code 0.

- [ ] **Step 2: Manually verify Todo behavior**

Create an unlinked todo, create one linked to multiple projects, complete it, edit it, delete it, collapse the section, switch language, rescan, and restart.

- [ ] **Step 3: Commit and push**

```bash
git add src/main.js src/frontend/index.html src/frontend/app.js src/frontend/style.css docs/superpowers/plans/2026-10-07-project-todos.md
git commit -m "Add project todos"
git push
```
