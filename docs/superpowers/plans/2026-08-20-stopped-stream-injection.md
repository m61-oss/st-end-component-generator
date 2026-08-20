# Stopped Stream Injection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve and expose injectable partial results only after streaming has ended, while making every in-progress anchor item visible incrementally.

**Architecture:** Extend the focused anchor protocol parser to recover the trailing partial array item alongside completed items. Keep request lifecycle and button state separate: `index.js` finalizes any retained raw stream, then derives READY versus IDLE/ERROR from the normalized saved result.

**Tech Stack:** JavaScript ES modules, Node test runner, SillyTavern extension DOM integration.

## Global Constraints

- Injection never stops an active request.
- Active generation continues to expose only the stop action.
- Existing anchor matching and injection semantics remain unchanged.

---

### Task 1: Recover every streamed anchor item

**Files:**
- Modify: `generation/anchor-output-protocol.js`
- Test: `generation/stream-output-preview.test.mjs`
- Test: `generation/anchor-output-protocol.test.mjs`

**Interfaces:**
- Consumes: `parseAnchorOutput(rawText)`.
- Produces: completed items plus at most one valid trailing partial item in source order.

- [ ] Add failing tests containing one or more complete items followed by a truncated item.
- [ ] Run the focused parser tests and confirm the trailing partial content is missing.
- [ ] Implement trailing-item recovery without changing strict JSON parsing.
- [ ] Run the focused parser tests and confirm they pass.

### Task 2: Finalize stopped/error streams into floor-panel state

**Files:**
- Modify: `ui/message-floor-panel.js`
- Modify: `index.js`
- Test: `ui/message-floor-panel.test.mjs`
- Test: `ui/message-floor-panel-ui.test.mjs`

**Interfaces:**
- Consumes: normalized saved standard output or anchor items after a request has ended.
- Produces: READY only when a stopped request has a usable retained result; otherwise IDLE or ERROR without an inject action.

- [ ] Add failing state and integration-source tests for stopped streams with and without usable results.
- [ ] Run focused floor-panel tests and confirm failure.
- [ ] Add a shared usability predicate and finalize retained stream data before rendering the ended state.
- [ ] Run focused floor-panel tests and confirm generation still exposes only stop while ended usable output exposes inject.

### Task 3: Regression verification and delivery

**Files:**
- Verify all tracked `*.test.mjs` suites and syntax checks.

- [ ] Run parser, floor-panel, and full tests.
- [ ] Run `node --check index.js` and `git diff --check`.
- [ ] Commit the scoped changes.
- [ ] Push `codex/message-floor-panel` and verify local and remote commit hashes match.
