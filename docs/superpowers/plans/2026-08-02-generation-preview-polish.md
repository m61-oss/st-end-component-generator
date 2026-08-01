# Generation Preview Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove duplicate keyword display, clear stale thinking at generation start, and make streamed preview content grow and scroll smoothly.

**Architecture:** Keep worldbook keyword rendering inside the existing source editor renderer so only one representation is mounted per mode. Add pure preview sizing helpers for height clamping and bottom-follow decisions, then call them only from the already-throttled stream preview callback and final rendering path.

**Tech Stack:** JavaScript ES modules, jQuery, CSS, Node.js assertion tests.

## Global Constraints

- Keep the 80ms streaming throttle.
- Do not parse thinking tags during streaming.
- Do not add settings or bump version `0.1.2`.
- Work only on `codex/streaming-defaults-worldbook-keywords`.

---

### Task 1: Render one primary-keyword field

**Files:**
- Modify: `index.js`
- Test: `tests/component-toggle-markup.test.mjs`

**Interfaces:**
- Consumes: `renderSourceContentEditor(item, groupIndex, itemIndex)`.
- Produces: one editable keyword textarea in prompt mode or one read-only keyword line in import mode.

- [ ] Add a failing source-rendering regression test that rejects the separate `worldbookMeta` block.
- [ ] Run `node tests/component-toggle-markup.test.mjs` and confirm failure.
- [ ] Move the read-only keyword representation into the import-mode branch and remove the outer duplicate.
- [ ] Re-run the focused test and confirm success.

### Task 2: Clear stale thinking at generation start

**Files:**
- Modify: `index.js`
- Test: `tests/api-request-integration.test.mjs`

**Interfaces:**
- Consumes: `renderGeneratedThinking(blocks)` and `generateStatusbar(...)`.
- Produces: `clearGeneratedThinking()` called once after a valid assistant target is found and before the API request starts.

- [ ] Add a failing test proving the generation start clears persisted and visible thinking before `callExternalApi`.
- [ ] Run `node tests/api-request-integration.test.mjs` and confirm failure.
- [ ] Implement the clear helper without parsing streamed chunks.
- [ ] Re-run the focused test and confirm success.

### Task 3: Grow and scroll the streamed preview

**Files:**
- Modify: `ui/preview-sizing.js`
- Modify: `index.js`
- Modify: `style.css`
- Test: `tests/preview-sizing.test.mjs`
- Test: `tests/api-request-integration.test.mjs`

**Interfaces:**
- Produces: `getPreviewLayout(scrollHeight, minHeight, maxHeight)` returning `{ height, overflowY }`.
- Produces: `isPreviewNearBottom({ scrollTop, clientHeight, scrollHeight }, threshold)` returning boolean.
- Consumes: helpers from `resizeGeneratedPreview({ followBottom })` and the throttled `onPreview` callback.

- [ ] Add failing pure tests for clamped height, overflow mode, and bottom-follow threshold plus an integration assertion for throttled resizing.
- [ ] Run the two focused tests and confirm failure.
- [ ] Implement pure helpers, replace forced unlimited/hidden sizing, and resize after each throttled preview update.
- [ ] Preserve scroll position unless the viewer was already near the bottom.
- [ ] Re-run focused tests and then `npm.cmd test`.

### Task 4: Verify and publish the test branch

**Files:**
- Verify all modified files.

- [ ] Run `node --check index.js`.
- [ ] Run `git diff --check`.
- [ ] Run `npm.cmd test`.
- [ ] Commit the changes and push `codex/streaming-defaults-worldbook-keywords`.
