# Generation Entry Guards Implementation Plan

> **For Codex:** Execute task-by-task with test-driven development. Do not change
> injection behavior.

**Goal:** Correct worldbook green-light activation, floating-ball defaults,
generation conflict handling, and API settings field order.

**Architecture:** Keep the existing `generationAbortController` as the single
active-generation state. Add small pure helpers for entry-conflict decisions and
floating-ball coordinates so behavior is testable without loading the SillyTavern
runtime. Keep the API field IDs and persistence bindings unchanged.

**Tech Stack:** JavaScript ES modules, Node's built-in `assert`, existing
source-contract tests, vanilla DOM/CSS.

---

## Task 1: Use activation keywords from imported worldbook candidates

**Files:**

- Modify: `tests/worldbook-scan.test.mjs`
- Modify: `worldbook-scan.js`

1. Add a regression case shaped like a real imported candidate with an internal
   identity `key` and multiple `worldbookKeys`; assert that matching either
   activation keyword returns true.
2. Run `node tests/worldbook-scan.test.mjs` and confirm the new assertion fails.
3. Change green-light matching to prefer `worldbookKeys` when present and fall
   back to `key`.
4. Run the focused test and confirm it passes.

## Task 2: Centralize generation conflict decisions

**Files:**

- Create: `generation-entry.js`
- Create: `tests/generation-entry.test.mjs`
- Modify: `index.js`
- Modify: `package.json`
- Modify: `tests/quick-reply-shortcuts.test.mjs`
- Modify: `tests/auto-injection.test.mjs`

1. Add pure behavior tests for active manual, Quick Reply, and automatic entries,
   plus the inactive start path.
2. Add source-contract assertions that QR and automatic callers pass explicit
   entry types and that injection code remains unchanged.
3. Run the focused tests and confirm they fail for the missing behavior.
4. Implement the pure decision helper.
5. Route `generateStatusbar(entryType)` through the helper:
   manual aborts, Quick Reply warns `已在生成中`, automatic returns silently.
6. Pass `quickReply` from the QR action and `automatic` from the generation-ended
   handler; keep the main button and injection call on the existing manual default.
7. Add the new test to `npm test`, then run the focused tests until green.

## Task 3: Default an unsaved floating ball to the bottom-right

**Files:**

- Create: `floating-ball-position.js`
- Create: `tests/floating-ball-position.test.mjs`
- Modify: `index.js`
- Modify: `package.json`
- Modify: `tests/component-toggle-markup.test.mjs`

1. Add behavior tests proving null, undefined, empty, and invalid coordinates use
   bottom-right defaults while finite saved coordinates are retained and clamped.
2. Run the new test and confirm failure.
3. Implement the pure coordinate resolver and use it from the existing render
   path.
4. Add the new test to `npm test` and run focused tests until green.

## Task 4: Reorder API settings in a single-column task flow

**Files:**

- Modify: `tests/component-toggle-markup.test.mjs`
- Modify: `index.js`
- Modify: `style.css`

1. Add a source-contract test asserting the runtime API controls appear in DOM
   order: URL, Key, model, remaining parameters.
2. Assert the API field group uses a dedicated class with a single-column layout.
3. Run the focused test and confirm failure.
4. Move the Key label into the API field group between URL and model, add the
   dedicated class, and preserve IDs and event bindings.
5. Load Impeccable's craft floor immediately before the UI edit.
6. Run the focused test and the Impeccable detector once.

## Task 5: Full verification

**Files:** all changed production and test files.

1. Run `npm test`.
2. Run `npm run check`.
3. Run `git diff --check`.
4. Review `git diff` to verify injection code was not altered and all changes
   match the approved design.
