# Project Git Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only repository status dialog with file-level lazy diffs.

**Architecture:** The backend exposes `repoStatus` and `repoDiff` APIs that call Git with argument arrays only. The frontend turns the modified-file tag into an accessible button, renders a compact status dialog, and fetches a file diff only when requested.

**Tech Stack:** TinyJS process runner, vanilla JavaScript, HTML, CSS.

---

### Task 1: Add read-only Git APIs

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Implement `repoStatus`**

Return branch, remote, latest commit summary, and parsed `git status --short` entries.

- [ ] **Step 2: Implement `repoDiff`**

Return unstaged and staged diff output for a requested file path, preserving untracked files as “no diff available”.

- [ ] **Step 3: Keep inputs safe**

Pass repository and file paths as separate Git arguments after `--`; never interpolate them into a shell command.

### Task 2: Add status dialog to the frontend

**Files:**
- Modify: `src/frontend/index.html`
- Modify: `src/frontend/app.js`

- [ ] **Step 1: Add bilingual status labels**

Translate status title, branch, remote, latest commit, diff, terminal, no diff, and Git error text.

- [ ] **Step 2: Make modified tags clickable**

Render the modified count as a button only when changes exist and delegate its click from the board.

- [ ] **Step 3: Render the compact summary**

Load `repoStatus`, show file states, and keep the dialog read-only.

- [ ] **Step 4: Add lazy diff actions**

Request `repoDiff` on file click and render escaped output in a collapsible preformatted area.

### Task 3: Style and verify

**Files:**
- Modify: `src/frontend/style.css`

- [ ] **Step 1: Style status button and dialog**

Keep the modified tag recognizable, use compact rows, and preserve light/dark theme readability.

- [ ] **Step 2: Build and verify signing**

Run `tinyjs build` and `codesign --verify --deep --strict dist/ProjectShelf.app`.

- [ ] **Step 3: Commit and publish**

```bash
git add src/main.js src/frontend/index.html src/frontend/app.js src/frontend/style.css docs/superpowers/plans/2026-10-07-project-git-status.md
git commit -m "Add repository status dialog"
git push
```
