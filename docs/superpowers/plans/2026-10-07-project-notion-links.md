# Project Notion Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attach one persistent Notion URL to each project card and open it in the system browser.

**Architecture:** Store a validated path-to-URL map in TinyJS preferences. Render a Notion action in each card, use a lightweight in-page dialog for add/edit/remove, and route opening through a backend URL validation boundary and macOS `open`.

**Tech Stack:** TinyJS backend store and process runner, vanilla JavaScript, HTML, CSS.

---

### Task 1: Persist and open Notion links in the backend

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Extend preferences**

Load `projectNotionLinks` as `{}` and accept a map in `savePrefs`.

- [ ] **Step 2: Validate saved URLs**

Keep only string values whose parsed URL protocol is `http:` or `https:`; discard invalid values.

- [ ] **Step 3: Add `openUrl` API**

Validate the URL again in the backend and run `open <url>` only for `http` or `https` URLs.

### Task 2: Add Notion actions and dialog UI

**Files:**
- Modify: `src/frontend/index.html`
- Modify: `src/frontend/app.js`

- [ ] **Step 1: Add a modal dialog shell**

Add a native HTML dialog with URL input, Save, Cancel, and Remove controls.

- [ ] **Step 2: Add bilingual labels and link state**

Translate Notion actions, URL placeholder, save/cancel/remove labels, and invalid URL messages in English and Italian. Initialize `prefs.projectNotionLinks` to `{}`.

- [ ] **Step 3: Render card actions**

Show `Aggiungi Notion`/`Add Notion` without a link and `Notion` when configured. Add a secondary edit action for configured links.

- [ ] **Step 4: Implement dialog flow**

Open the dialog for add/edit, validate the URL in the frontend, persist the map through `savePrefs`, rerender, and close the dialog. Use the existing configured link to open through `openUrl`.

### Task 3: Style the Notion action and dialog

**Files:**
- Modify: `src/frontend/style.css`

- [ ] **Step 1: Style Notion buttons**

Make the Notion action visually distinct but consistent with the existing card buttons.

- [ ] **Step 2: Style the dialog**

Add a centered panel, URL input, button row, and visible invalid-state text that works in both light and dark themes.

### Task 4: Verify and publish

**Files:**
- Test: `src/main.js`, `src/frontend/index.html`, `src/frontend/app.js`, `src/frontend/style.css`

- [ ] **Step 1: Build and verify signing**

Run `tinyjs build` and `codesign --verify --deep --strict dist/ProjectShelf.app`; expect successful build and exit code 0.

- [ ] **Step 2: Manually verify link behavior**

Add a valid Notion URL, open it, edit it, remove it, try an invalid URL, rescan, change language, and restart the app.

- [ ] **Step 3: Commit and publish**

```bash
git add src/main.js src/frontend/index.html src/frontend/app.js src/frontend/style.css docs/superpowers/plans/2026-10-07-project-notion-links.md
git commit -m "Add project Notion links"
git push
```
