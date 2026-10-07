# Project Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add free-form persistent tags to project cards and expose exact tag filters in the existing filter bar.

**Architecture:** Store a validated path-to-string-array map in TinyJS preferences. Render compact tag pills with an inline add field on each card, delegate tag mutations from the board, and derive the filter list from current project tags.

**Tech Stack:** TinyJS backend store, vanilla JavaScript, HTML, CSS.

---

### Task 1: Persist project tags

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Load `projectTags`**

Return the map from `app.store`, defaulting to `{}`.

- [ ] **Step 2: Validate and save tags**

Keep string paths and up to 12 trimmed tags per project, each limited to 50 characters, with case-insensitive duplicate detection while preserving first-entered spelling.

### Task 2: Add tag controls and filtering

**Files:**
- Modify: `src/frontend/app.js`

- [ ] **Step 1: Add bilingual labels**

Translate add-tag, tag placeholder, remove-tag, and tag-filter labels in English and Italian.

- [ ] **Step 2: Render tag pills and add control**

Show existing tags in each card with remove buttons and provide a compact input that commits on Enter.

- [ ] **Step 3: Persist tag mutations**

Normalize input, ignore empty/duplicate/full lists, update the map, call `savePrefs`, and rerender.

- [ ] **Step 4: Add tag filters**

Derive unique tags from scanned projects, render them in the filter bar, and filter with case-insensitive exact matching while keeping all existing filters intact.

### Task 3: Style tags without visual clutter

**Files:**
- Modify: `src/frontend/style.css`

- [ ] **Step 1: Style tag pills and add input**

Use compact pills and a small inline input that matches existing card tags.

- [ ] **Step 2: Style active tag filters**

Reuse filter button styling and preserve light/dark theme contrast.

### Task 4: Verify and publish

**Files:**
- Test: `src/main.js`, `src/frontend/app.js`, `src/frontend/style.css`, `docs/superpowers/specs/2026-10-07-project-tags-design.md`

- [ ] **Step 1: Build and verify signing**

Run `tinyjs build` and `codesign --verify --deep --strict dist/ProjectShelf.app`.

- [ ] **Step 2: Verify behavior manually**

Add multiple tags, remove one, filter by a tag, rescan, switch language, restart, and test empty, duplicate, and overly long values.

- [ ] **Step 3: Commit and push**

```bash
git add src/main.js src/frontend/app.js src/frontend/style.css docs/superpowers/specs/2026-10-07-project-tags-design.md docs/superpowers/plans/2026-10-07-project-tags.md
git commit -m "Add project tags"
git push
```
