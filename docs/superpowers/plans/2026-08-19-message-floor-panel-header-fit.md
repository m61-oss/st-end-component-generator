# Message Floor Panel Header Fit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the floor panel inside the assistant bubble while preserving visible actions and filling the compact header with adaptive status symbols.

**Architecture:** Extend the existing DOM measurement step to synchronize both inline offset and exact border-box width. Replace the compact flex row with a three-column grid and split the status stage into two flexible ornament tracks around a fixed core.

**Tech Stack:** Vanilla JavaScript, CSS Grid/Flexbox, Node test runner.

## Global Constraints

- Keep the panel outside `.mes_text` so it never becomes chat content.
- Keep action buttons clickable without toggling panel expansion.
- Do not merge this test branch into `main`.

---

### Task 1: Lock the corrected layout contract

**Files:**
- Modify: `ui/message-floor-panel-ui.test.mjs`

**Interfaces:**
- Consumes: current `index.js` panel markup and `style.css` selectors.
- Produces: regression assertions for exact bounds, header structure, and adaptive tracks.

- [ ] **Step 1: Write failing assertions**

Assert that bounds synchronization sets `margin-left`, exact width, and `box-sizing` with important priority; no `data-floor-expand` exists; the stage contains left/right tracks and a fixed core; action group cannot shrink.

- [ ] **Step 2: Verify the assertions fail**

Run `node ui/message-floor-panel-ui.test.mjs` and confirm failures identify the old width-only sync, expand button, and single flex stage.

### Task 2: Implement exact bounds and the adaptive header

**Files:**
- Modify: `index.js`
- Modify: `style.css`

**Interfaces:**
- Consumes: `getFloorPanelStatusStage(status)` and the existing compact-header click delegation.
- Produces: measured sibling alignment and three-column compact header markup.

- [ ] **Step 1: Synchronize exact horizontal bounds**

Measure the target and containing block rectangles, derive the target's content-relative left offset, and set important inline `width`, `max-width`, `margin-left`, and `box-sizing` values.

- [ ] **Step 2: Remove the dedicated expand control**

Delete its markup and specific click branch; retain whole-header click and keyboard toggling.

- [ ] **Step 3: Add adaptive ornament tracks**

Render left track, fixed text/face core, and right track. Use CSS grid for the header, reserve the action column, repeat symbols inside the tracks, and reduce vertical padding without reducing mobile type.

- [ ] **Step 4: Verify focused tests pass**

Run `node ui/message-floor-panel-ui.test.mjs` and `node ui/message-floor-panel.test.mjs`.

### Task 3: Verify and publish

**Files:**
- Verify all modified files.

**Interfaces:**
- Consumes: completed Tasks 1–2.
- Produces: a pushed commit on `codex/message-floor-panel`.

- [ ] **Step 1: Run repository verification**

Run all tracked `*.test.mjs` files, `node --check index.js`, `git diff --check`, and the Impeccable detector.

- [ ] **Step 2: Commit and push**

Commit only the intended implementation, tests, spec, and plan; push `codex/message-floor-panel` and verify local HEAD equals the remote tracking ref.
