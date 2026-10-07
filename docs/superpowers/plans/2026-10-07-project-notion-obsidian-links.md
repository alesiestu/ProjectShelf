# Project Notion and Obsidian Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store independent Notion and Obsidian deep links for every project and open each with its appropriate application.

**Architecture:** Replace the single Notion URL map with a validated path-to-links object map. Reuse the existing dialog by passing a provider type, and use one backend `openUrl` boundary that allows web URLs and `obsidian:` URIs.

**Tech Stack:** TinyJS backend store and process runner, vanilla JavaScript, HTML, CSS.

---

### Task 1: Migrate and validate provider links in the backend

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Add provider-aware URL validation**

Accept `http:` and `https:` for Notion and `obsidian:` for Obsidian.

- [ ] **Step 2: Load and save `projectKnowledgeLinks`**

Store `{ notion, obsidian }` objects per project path, keeping only valid values and preserving each provider independently.

- [ ] **Step 3: Migrate existing Notion data**

When `projectKnowledgeLinks` is absent, convert valid entries from the existing `projectNotionLinks` preference so current users keep their links.

- [ ] **Step 4: Update `openUrl`**

Allow only `http:`, `https:`, and `obsidian:` before invoking macOS `open`.

### Task 2: Reuse the dialog for Notion and Obsidian

**Files:**
- Modify: `src/frontend/app.js`
- Modify: `src/frontend/index.html`

- [ ] **Step 1: Add bilingual provider labels**

Add Notion/Obsidian action labels, provider-specific dialog titles, placeholders, and protocol validation messages in both languages.

- [ ] **Step 2: Initialize and render independent links**

Read `projectKnowledgeLinks`, show separate Notion and Obsidian buttons, and keep edit actions independent.

- [ ] **Step 3: Implement provider-aware dialog flow**

Track the current project path and provider, validate the matching URL scheme, save or remove only that provider value, and rerender.

- [ ] **Step 4: Open the correct target**

Use `openUrl` with the Notion URL or Obsidian URI when the corresponding button is already configured.

### Task 3: Style both provider actions

**Files:**
- Modify: `src/frontend/style.css`

- [ ] **Step 1: Give Notion and Obsidian distinct action styles**

Keep both buttons compact and readable while matching the existing card actions.

- [ ] **Step 2: Update dialog affordances**

Keep the existing modal layout and make provider-specific error text visible in both themes.

### Task 4: Verify, commit, and publish

**Files:**
- Test: `src/main.js`, `src/frontend/index.html`, `src/frontend/app.js`, `src/frontend/style.css`

- [ ] **Step 1: Build and verify signing**

Run `tinyjs build` and `codesign --verify --deep --strict dist/ProjectShelf.app`; expect successful build and exit code 0.

- [ ] **Step 2: Verify behavior manually**

Save both links on one project, open each, edit and remove each independently, test invalid protocols, rescan, switch language, and restart.

- [ ] **Step 3: Commit and push**

```bash
git add src/main.js src/frontend/index.html src/frontend/app.js src/frontend/style.css docs/superpowers/plans/2026-10-07-project-notion-obsidian-links.md
git commit -m "Add Obsidian project links"
git push
```
