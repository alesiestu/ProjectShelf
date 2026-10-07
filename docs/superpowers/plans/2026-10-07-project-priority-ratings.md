# Project Priority Ratings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent 0–5 star ratings to project cards, threshold filters, and priority ordering.

**Architecture:** Store a validated path-to-rating map in TinyJS preferences. Render accessible star controls in each card, add rating thresholds to the existing filter bar, and sort visible cards by rating before last activity.

**Tech Stack:** TinyJS backend store, vanilla JavaScript, HTML, CSS.

---

### Task 1: Persist project ratings

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Extend `loadPrefs`**

Return `projectRatings` from `app.store`, defaulting to `{}`.

- [ ] **Step 2: Validate `projectRatings` in `savePrefs`**

Keep only string paths whose values are integer ratings from 1 through 5. Save the cleaned map; an absent path means zero stars.

- [ ] **Step 3: Compile the backend**

Run `tinyjs build` and confirm the backend compilation stage succeeds.

### Task 2: Add ratings, labels, filters, and ordering

**Files:**
- Modify: `src/frontend/app.js`

- [ ] **Step 1: Add bilingual labels**

Add labels for `Priority`, `5 stars`, `4+ stars`, `3+ stars`, `1+ star`, and accessible rating actions in English and Italian.

- [ ] **Step 2: Render five interactive stars**

Place the stars beside the card title, use `aria-label` and `aria-pressed`, and expose a second click on the current rating as the reset action.

- [ ] **Step 3: Add rating threshold filters**

Extend the existing filter list with `rating-5`, `rating-4`, `rating-3`, and `rating-1`; show each count and keep the current color/status filters working.

- [ ] **Step 4: Persist star clicks**

Delegate rating events from `#board`, update `prefs.projectRatings`, call `savePrefs`, and rerender without affecting color-picker or card action clicks.

- [ ] **Step 5: Sort by rating then activity**

Filter by the selected threshold and sort each column by rating descending, then by `lastCommitDays` ascending.

### Task 3: Style the rating controls

**Files:**
- Modify: `src/frontend/style.css`

- [ ] **Step 1: Style stars and their focus state**

Use compact buttons with a gold active state, muted inactive state, visible keyboard focus, and no layout disruption to the existing card header.

### Task 4: Verify and commit

**Files:**
- Test: `src/main.js`, `src/frontend/app.js`, `src/frontend/style.css`

- [ ] **Step 1: Build and verify the app**

Run `tinyjs build` and `codesign --verify --deep --strict dist/ProjectShelf.app`; expect successful build and exit code 0.

- [ ] **Step 2: Check behavior manually**

Assign different ratings, click the active rating to reset, test all four threshold filters, switch language, rescan, and restart the app.

- [ ] **Step 3: Commit and publish**

```bash
git add src/main.js src/frontend/app.js src/frontend/style.css docs/superpowers/plans/2026-10-07-project-priority-ratings.md
git commit -m "Add project priority ratings"
git push
```
