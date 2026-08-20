# Floor Anchor Card Sizing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make floor-panel anchor cards use stable type-specific heights, grow the panel by card count, and display subdued matching-status labels.

**Architecture:** Keep the existing anchor-plan markup and state model. Extend each card summary with the already computed match label, then make CSS own the two fixed card geometries and remove scrolling from the list container while preserving overflow inside textareas.

**Tech Stack:** Vanilla JavaScript, CSS, Node.js `node:test` source-contract tests.

## Global Constraints

- `start` and `end` cards use the compact fixed size.
- `before` and `after` cards use the larger fixed size.
- The anchor list grows naturally and never becomes an internal scroll container.
- Matching-status labels are visible but subdued.
- Textareas remain editable and scroll internally for long content.

---

### Task 1: Lock the layout contract with a failing test

**Files:**
- Modify: `ui/message-floor-panel-ui.test.mjs`

**Interfaces:**
- Consumes: `.st-esg-floor-anchor-list`, `.st-esg-floor-anchor-item`, `data-floor-anchor-position`.
- Produces: regression assertions for fixed heights, natural list growth, textarea overflow, and status-label styling.

- [ ] **Step 1: Write assertions that require the list to have no max-height/internal scrolling and require separate fixed heights for boundary and anchored cards.**
- [ ] **Step 2: Require a `.st-esg-floor-anchor-match` element with low opacity in both markup and CSS.**
- [ ] **Step 3: Run `node ui/message-floor-panel-ui.test.mjs` and confirm the new assertions fail because the existing list still has `max-height` and the markup lacks the label.**

### Task 2: Implement card sizing and status labels

**Files:**
- Modify: `index.js:983-995`
- Modify: `style.css:1414-1424`

**Interfaces:**
- Consumes: `resolveAnchorPlanForDisplay(items)`, `describeAnchorMatch(item, match, skipped, hasTarget)`, and each item's `position`.
- Produces: `.st-esg-floor-anchor-match` in each summary and type-specific CSS sizing.

- [ ] **Step 1: Resolve the current target text and render `describeAnchorMatch(...)` beside the card position without changing editable fields or injection toggles.**
- [ ] **Step 2: Remove list-level `max-height` and `overflow: auto`; set `overflow: visible`.**
- [ ] **Step 3: Give `start/end` and `before/after` cards distinct fixed heights and make their field grids consume the available card body.**
- [ ] **Step 4: Stop auto-growing anchor textareas, make each textarea fill its grid track, and use internal `overflow-y: auto` when content exceeds the fixed field region.**
- [ ] **Step 5: Style the match label with inherited theme color and low opacity.**
- [ ] **Step 6: Run `node ui/message-floor-panel-ui.test.mjs` and `node ui/message-floor-panel.test.mjs`; confirm both pass.**

### Task 3: Verify and publish

**Files:**
- Verify: `index.js`, `style.css`, `ui/message-floor-panel-ui.test.mjs`

**Interfaces:**
- Consumes: completed layout implementation.
- Produces: tested branch commit on `origin/codex/message-floor-panel`.

- [ ] **Step 1: Run `node --check index.js`.**
- [ ] **Step 2: Run every tracked `*.test.mjs` outside temporary database-source directories.**
- [ ] **Step 3: Run the Impeccable detector once on `style.css` and classify any unrelated incumbent warnings.**
- [ ] **Step 4: Run `git diff --check`, review the final diff, commit only intended files, and push `codex/message-floor-panel`.**
