# Message Floor Panel Adaptive Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the floor panel compact for short content, constrain it to the assistant bubble, and replace the separate status label and line animation with a text-plus-kaomoji-plus-symbol state stage.

**Architecture:** Keep state semantics in `ui/message-floor-panel.js`, including a render model for each visible state. Keep DOM composition and textarea resizing in `index.js`. Keep all visual choreography and responsive behavior in `style.css`, with static source assertions covering integration-sensitive UI rules.

**Tech Stack:** Browser JavaScript ES modules, CSS, Node.js built-in test runner.

## Global Constraints

- Preserve all existing floor panel generation, injection, undo, and anchor-editing behavior.
- Use no new runtime dependency.
- Keep the status stage on one line and retain readable static state under `prefers-reduced-motion: reduce`.
- Visible controls may shrink, but their pointer target remains at least 28px.
- The panel must never exceed the latest assistant message text width.

---

### Task 1: Status Stage Models

**Files:**
- Modify: `ui/message-floor-panel.js`
- Modify: `ui/message-floor-panel.test.mjs`

**Interfaces:**
- Produces: `getFloorPanelStatusStage(status)` returning `{ label, text, face, lead, tail, motion }`.
- Consumes: existing `FLOOR_PANEL_STATUS` normalization.

- [ ] **Step 1: Write the failing model test**

Assert that idle, generating, ready, injected, and error states each return the approved copy, kaomoji, symbols, and unique motion name; assert that injected uses `◇` and `◈` and no checkmark.

- [ ] **Step 2: Run the model test and verify RED**

Run: `node ui/message-floor-panel.test.mjs`

Expected: FAIL because `getFloorPanelStatusStage` is not exported.

- [ ] **Step 3: Implement the status model**

Add immutable status-stage models and export `getFloorPanelStatusStage(status)`.

- [ ] **Step 4: Run the model test and verify GREEN**

Run: `node ui/message-floor-panel.test.mjs`

Expected: PASS.

### Task 2: Adaptive Sizing and Width Constraint

**Files:**
- Modify: `index.js`
- Modify: `style.css`
- Modify: `ui/message-floor-panel-ui.test.mjs`

**Interfaces:**
- Produces: `resizeMessageFloorOutput(textarea)` which clamps the output to CSS min/max height after setting `height: auto`.
- Consumes: current floor output textarea and `ResizeObserver` width synchronization.

- [ ] **Step 1: Write failing source assertions**

Assert that the panel uses border-box, the fixed 220px output height is absent, an adaptive resize helper uses `scrollHeight`, anchor cards use maximum rather than unconditional height, and width synchronization subtracts no hidden overflow outside the measured border box.

- [ ] **Step 2: Run the UI test and verify RED**

Run: `node ui/message-floor-panel-ui.test.mjs`

Expected: FAIL on fixed height and missing adaptive helper.

- [ ] **Step 3: Implement adaptive sizing and strict width**

Add `box-sizing: border-box`, set measured width as a maximum rather than a content-box overflow, clamp textarea height through CSS variables, resize on render/stream/input, and let anchor cards size naturally up to a maximum.

- [ ] **Step 4: Run the UI test and verify GREEN**

Run: `node ui/message-floor-panel-ui.test.mjs`

Expected: PASS.

### Task 3: Animated State Stage and Smaller Controls

**Files:**
- Modify: `index.js`
- Modify: `style.css`
- Modify: `ui/message-floor-panel-ui.test.mjs`

**Interfaces:**
- Consumes: `getFloorPanelStatusStage(status)`.
- Produces: semantic `.st-esg-floor-stage` markup with individually animated lead, shuttle, text, face, and tail spans.

- [ ] **Step 1: Write failing stage integration assertions**

Assert that the old `.st-esg-floor-status` and three empty motion spans are gone, stage parts are present, injected copy has no checkmark, controls keep a 28px target with a smaller icon, and reduced-motion disables all stage animation.

- [ ] **Step 2: Run the UI test and verify RED**

Run: `node ui/message-floor-panel-ui.test.mjs`

Expected: FAIL because the old status and line motion markup remain.

- [ ] **Step 3: Implement stage markup and choreography**

Render approved content from the model, animate the shuttle and symbol trail during generation, provide one-shot ready/injected/error transitions, keep idle motion subtle, compress outer decorations on narrow containers, and retain all copy when motion is reduced.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node ui/message-floor-panel.test.mjs; node ui/message-floor-panel-ui.test.mjs`

Expected: PASS.

### Task 4: Full Verification and Publish

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run syntax and focused tests**

Run: `node --check index.js; node ui/message-floor-panel.test.mjs; node ui/message-floor-panel-ui.test.mjs; node ui/theme-mode.test.mjs; node ui/brand-mark.test.mjs`

Expected: PASS.

- [ ] **Step 2: Run all tracked tests**

Run every `*.test.mjs` returned by `rg --files`, excluding untracked temporary directories.

Expected: PASS.

- [ ] **Step 3: Run design detector and diff checks**

Run: `node C:\Users\61\.codex\skills\impeccable\scripts\detect.mjs --json index.js; git diff --check`

Expected: no findings and no whitespace errors.

- [ ] **Step 4: Commit and push**

Commit only the intended implementation, tests, design, and plan files to `codex/message-floor-panel`, then push that branch.
