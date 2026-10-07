# Project Card Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow each ProjectShelf card to receive a persistent highlight color without changing scanning, classification, filtering, or safety logic.

**Architecture:** Store a validated path-to-color map in TinyJS app preferences. The frontend renders a compact palette inside each card, applies a color class to the card, and delegates palette events from the board container so rerenders remain safe.

**Tech Stack:** TinyJS backend store, vanilla JavaScript, HTML, CSS.

---

### Task 1: Persist project colors in TinyJS preferences

**Files:**
- Modify: `src/main.js:174-186`

- [ ] **Step 1: Extend `loadPrefs` with a project color map**

Read `projectColors` from `app.store`, defaulting to `{}` and returning it with the existing workspace, ignored, and language preferences.

- [ ] **Step 2: Validate and save colors in `savePrefs`**

Accept only the palette values `blue`, `green`, `yellow`, `orange`, `red`, `purple`, or an empty value that removes the entry. Save the resulting map under `projectColors` without changing existing preference keys.

- [ ] **Step 3: Verify backend syntax with TinyJS**

Run `tinyjs build` and confirm backend compilation succeeds before the UI work.

### Task 2: Add palette rendering and interaction to cards

**Files:**
- Modify: `src/frontend/app.js`

- [ ] **Step 1: Add palette names and localized labels**

Add the six color keys plus `noColor`, `chooseColor`, and `removeColor` to both `I18N.en` and `I18N.it`.

- [ ] **Step 2: Load and retain `projectColors`**

Initialize `prefs.projectColors` to `{}` when absent and use the project path as the lookup key.

- [ ] **Step 3: Render the card color control**

Add a `data-color-path` control near each card title. Render seven palette buttons, with the active color marked using `aria-pressed`; keep the no-color action available.

- [ ] **Step 4: Apply the selected color to the card**

Add `project-color-${color}` to the card only when a valid color exists. Keep all existing card data and actions unchanged.

- [ ] **Step 5: Persist palette clicks**

Delegate clicks from `#board`, update the path-to-color map, call `savePrefs`, and rerender. Stop propagation for palette clicks so they never trigger Finder, Terminal, VS Code, or Copy Path actions.

### Task 3: Style the color picker and highlighted cards

**Files:**
- Modify: `src/frontend/style.css`

- [ ] **Step 1: Add card header and palette layout**

Use a flex header for the project name and color control. Keep palette buttons compact and circular so they do not compete with card content.

- [ ] **Step 2: Add color variants**

Define a left border and subtle background tint for each color variant. Ensure the default card remains unchanged and text contrast is preserved.

- [ ] **Step 3: Add focus and hover states**

Make palette buttons keyboard-visible and distinguish the active swatch with a ring or border.

### Task 4: Verify the complete feature

**Files:**
- Test: `src/main.js`, `src/frontend/app.js`, `src/frontend/style.css`

- [ ] **Step 1: Build the app**

Run `tinyjs build` and expect `==> done` plus `dist/ProjectShelf.app`.

- [ ] **Step 2: Check the generated app signature**

Run `codesign --verify --deep --strict dist/ProjectShelf.app` and expect exit code `0`.

- [ ] **Step 3: Manually verify persistence**

Assign colors to two projects, switch filters, rescan, switch language, restart the app, and confirm the colors remain. Remove one color and confirm that card returns to default styling.

- [ ] **Step 4: Commit the feature**

Run:

```bash
git add src/main.js src/frontend/app.js src/frontend/style.css docs/superpowers/plans/2026-10-07-project-card-colors.md
git commit -m "Add persistent project card colors"
```
