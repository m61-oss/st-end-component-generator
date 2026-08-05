# Reroll History and Debug UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the original single injection snapshot workflow, undo rollback-mode injections before generation, retain the three latest successful outputs in browser storage, and consolidate diagnostics under a versioned “调试信息” page.

**Architecture:** A focused `generation/generation-history.js` module owns bounded browser-local history data. `index.js` coordinates pre-generation rollback, successful-result persistence, history loading, and UI placement while continuing to use the existing preview and injection functions. Injection snapshots return to a single before/after message pair; no prompt-only baseline remains.

**Tech Stack:** Vanilla JavaScript ES modules, SillyTavern extension APIs, jQuery-compatible DOM helpers, browser `localStorage`, Node.js assertion tests.

## Global Constraints

- Keep the existing preview textarea as the only editable current result.
- Store at most three completed generation results outside SillyTavern settings.
- Never save failed or user-aborted partial generations to recent history.
- Loading a recent entry changes the preview only and never mutates recent history.
- Rollback modes undo before generation and never automatically undo that undo operation.
- Display the existing `EXTENSION_VERSION`; do not introduce another version source.
- Do not bump the release version in this branch.

---

### Task 1: Browser-local recent generation history

**Files:**
- Create: `generation/generation-history.js`
- Create: `tests/generation-history.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `loadGenerationHistory(storage, key, limit = 3): Array<{ id, generatedAt, content }>`
- Produces: `recordGenerationResult(storage, key, content, generatedAt = Date.now(), limit = 3): Array<{ id, generatedAt, content }>`
- Consumes: a Storage-compatible object with `getItem` and `setItem`.

- [ ] **Step 1: Write the failing history test**

Test successful insertion, newest-first ordering, exact three-entry trimming, malformed-storage fallback, blank-result rejection, and storage exceptions without throwing.

- [ ] **Step 2: Run the test and verify RED**

Run: `node tests/generation-history.test.mjs`

Expected: FAIL because `generation/generation-history.js` does not exist.

- [ ] **Step 3: Implement the history module**

Use JSON storage with normalized string content, finite timestamps, stable IDs derived from timestamp plus a random suffix, and defensive `try/catch` around browser storage access. `recordGenerationResult` must return the updated in-memory list even when persistence is unavailable.

- [ ] **Step 4: Register and run the test**

Add `node tests/generation-history.test.mjs` to the package test chain, then run:

`node tests/generation-history.test.mjs`

Expected: `generation-history tests passed`.

- [ ] **Step 5: Commit**

Commit message: `feat: add recent generation history storage`

### Task 2: Restore single snapshots and undo before rollback-mode generation

**Files:**
- Modify: `injection/injection-undo.js`
- Modify: `index.js`
- Modify: `tests/injection-undo.test.mjs`
- Modify: `tests/auto-injection.test.mjs`

**Interfaces:**
- Keeps: `createInjectionUndoSnapshot(...)` with only the actual pre-injection and post-injection message/Swipe states.
- Removes: `createRollbackPromptView`, `promptBaseText`, and `promptBaseSwipeText`.
- Adds in `index.js`: `restoreLatestInjection({ requireConfirmation = false, saveChat = true } = {}): Promise<boolean>` for shared manual and pre-generation restoration.

- [ ] **Step 1: Replace the prompt-baseline tests with failing pre-generation rollback tests**

Assert that snapshot construction has no prompt-base fields, `buildMessages` uses the live context again, rollback modes call the internal restore before `callExternalApi`, failure/abort paths do not re-inject the old result, and manual undo still asks for confirmation.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node tests/injection-undo.test.mjs` and `node tests/auto-injection.test.mjs`.

Expected: FAIL while prompt-base fields and the virtual prompt builder still exist.

- [ ] **Step 3: Implement shared restoration and pre-generation invocation**

Refactor the exact restoration, Swipe update, MVU rebuild, message event, and chat save code out of `undoLatestInjection`. Call it without confirmation after resolving the target and before starting the external request only when the selected mode is `rollbackAppend` or `rollbackReplace` and the valid snapshot belongs to that target. Do not restore again on API error or abort.

- [ ] **Step 4: Remove virtual prompt state**

Delete `createRollbackPromptView` and its import. Return `buildMessages` and source scanning to `getContext().chat`, because rollback-mode generation now operates on the physically restored live chat. Remove prompt-base fields from newly created snapshots.

- [ ] **Step 5: Run focused tests**

Run: `node tests/injection-undo.test.mjs`, `node tests/auto-injection.test.mjs`, `node tests/prompt-builder.test.mjs`, and `node tests/worldbook-scan.test.mjs`.

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

Commit message: `fix: undo rollback injections before generation`

### Task 3: Integrate recent results with the existing preview

**Files:**
- Modify: `index.js`
- Modify: `style.css`
- Create: `tests/generation-history-ui.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `loadGenerationHistory` and `recordGenerationResult` from Task 1.
- Adds: `renderGenerationHistory()` and `loadGenerationHistoryEntry(id)` in `index.js`.
- Uses local-storage key: `${EXTENSION_ID}.recentGenerationHistory`.

- [ ] **Step 1: Write the failing UI integration test**

Assert that the generation page contains a “最近生成记录” card, successful `applyGeneratedResult(result)` is followed by `recordGenerationResult`, failure/abort returns occur before history persistence, and a history load updates `settings.lastGenerated`, placeholder state, the preview textarea, thinking display, and preview sizing without writing history.

- [ ] **Step 2: Run the test and verify RED**

Run: `node tests/generation-history-ui.test.mjs`

Expected: FAIL because the card and integration functions do not exist.

- [ ] **Step 3: Implement successful-result persistence**

After a complete API result is applied to the preview, add the exact `settings.lastGenerated` value to local history and render it. Do not call the history writer from streaming chunk updates, abort handling, preview input events, or history load handlers.

- [ ] **Step 4: Implement the history card and load behavior**

Render up to three entries newest-first with time, character count, an expandable readonly content preview, and a “载入” button. Loading clears stale thinking blocks, updates the existing preview/state, and leaves storage untouched.

- [ ] **Step 5: Add compact desktop/mobile styling**

Place the history card under the current generation-content card. Keep content scrollable and buttons usable on narrow screens without increasing the fixed footer height.

- [ ] **Step 6: Register and run tests**

Add the new test to `package.json`, run `node tests/generation-history-ui.test.mjs` and `node tests/preview-sizing.test.mjs`.

Expected: both exit 0.

- [ ] **Step 7: Commit**

Commit message: `feat: add loadable recent generation records`

### Task 4: Version badge and consolidated debug page

**Files:**
- Modify: `index.js`
- Modify: `style.css`
- Create: `tests/debug-ui.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: existing `EXTENSION_VERSION`, generation-log element ID, and prompt-viewer rendering.
- Produces: a header badge with `v${EXTENSION_VERSION}` and a tab labeled `调试信息`.

- [ ] **Step 1: Write the failing UI structure test**

Assert that the header renders the existing version constant, the tab label is “调试信息”, the generation log is absent from the workspace panel, and the debug panel contains the generation log before the prompt viewer.

- [ ] **Step 2: Run the test and verify RED**

Run: `node tests/debug-ui.test.mjs`

Expected: FAIL because the version badge and consolidated page are not present.

- [ ] **Step 3: Move and rename UI elements**

Insert the generation-log card at the beginning of the debug panel, rename its tab and accessible text to “调试信息”, keep the prompt-viewer card below it, and render `v${EXTENSION_VERSION}` beside the title.

- [ ] **Step 4: Style and verify log updates**

Add a compact muted version badge and debug-card spacing. Confirm the existing log functions still target `#st-esg-generation-log`, so logging continues regardless of active tab.

- [ ] **Step 5: Register and run tests**

Add the test to `package.json`, then run `node tests/debug-ui.test.mjs`, `node tests/prompt-log.test.mjs`, and `node tests/font-isolation.test.mjs`.

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

Commit message: `feat: consolidate generation diagnostics`

### Task 5: Full regression verification

**Files:**
- Verify only; modify files only if a failing test exposes a scoped regression.

**Interfaces:**
- Consumes all preceding tasks.
- Produces a pushed test branch ready for manual SillyTavern validation.

- [ ] **Step 1: Run syntax and whitespace checks**

Run: `node --check index.js`, `node --check generation/generation-history.js`, `node --check injection/injection-undo.js`, and `git diff --check`.

Expected: exit 0 with no syntax or whitespace errors.

- [ ] **Step 2: Run the full suite**

Run: `npm.cmd test`.

Expected: exit 0 with all existing and new tests passing.

- [ ] **Step 3: Review the final diff against the design**

Confirm: single snapshots only; rollback before generation; no automatic reversal; history only on successful completion; load does not mutate history; version badge uses `EXTENSION_VERSION`; generation log exists only under “调试信息”.

- [ ] **Step 4: Push the branch**

Push `codex/rollback-prompt-snapshot` to origin without merging or changing the release version.
