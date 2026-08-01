# Streaming Defaults and Worldbook Keywords Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve streaming responsiveness, set safe first-install task defaults, and add scheme-local SillyTavern-compatible primary keyword editing for worldbook entries.

**Architecture:** Keep UI orchestration in `index.js`, extract reusable stream throttling and native keyword parsing/matching into focused modules, and persist keyword overrides beside existing worldbook content and activation overrides. Represent the default Chat History placement with a semantic sentinel resolved by the prompt builder so it survives preset changes.

**Tech Stack:** Browser JavaScript ES modules, jQuery-based SillyTavern extension UI, Node.js `assert` tests.

## Global Constraints

- Work only on `codex/streaming-defaults-worldbook-keywords`; do not merge `main` or bump the release version.
- Existing users' saved task prompt and placement settings must not be overwritten.
- Do not add ST-Prompt-Template/EJS keyword handling, secondary keyword logic, or injection performance changes.
- Use test-driven development and preserve all current tests.

---

### Task 1: First-install defaults and semantic Chat History placement

**Files:**
- Modify: `index.js`
- Modify: `generation/prompt-builder.js`
- Modify: `settings/scheme-utils.js`
- Test: `tests/prompt-builder.test.mjs`
- Test: `tests/component-toggle-markup.test.mjs`
- Test: `tests/scheme-utils.test.mjs`

**Interfaces:**
- Produce `TASK_PLACEMENT_AFTER_CHAT_HISTORY`, a stable sentinel accepted by `insertTaskMessage`.
- Preserve concrete `taskPlacementAfterSourceId` values selected by existing users.

- [ ] Add failing tests proving the semantic sentinel inserts after the final message produced by the Chat History marker and falls back to the tail when no marker exists.
- [ ] Run the focused tests and confirm failure because semantic marker placement is unsupported.
- [ ] Implement the sentinel, new task text, and fresh-install-only default booleans without migrating stored settings.
- [ ] Run the focused tests and confirm they pass.
- [ ] Commit the independently working default-setting change.

### Task 2: Lightweight throttled streaming preview

**Files:**
- Create: `ui/stream-preview.js`
- Modify: `index.js`
- Test: `tests/stream-preview.test.mjs`
- Test: `tests/api-request-integration.test.mjs`
- Test: `tests/generation-button-state.test.mjs`

**Interfaces:**
- Produce `createStreamPreviewController({ intervalMs, now, schedule, cancel, onPreview })` with `push(fullText)`, `flush()`, `getText()`, and `dispose()`.
- `index.js` uses the controller only for raw preview updates; `applyGeneratedResult` remains the sole finalizer.

- [ ] Add failing tests proving multiple chunks within 80ms coalesce, `flush` emits the newest text, and disposal cancels pending work.
- [ ] Run the focused tests and confirm failure because the controller does not exist.
- [ ] Implement the minimal controller and integrate it without `switchTab`, tag cleanup, resize, render, or save calls per chunk.
- [ ] Add integration assertions that streaming finalizes once, saves once, never changes tabs, and retains partial text on abort without auto-injection.
- [ ] Run focused streaming and generation tests and confirm they pass.
- [ ] Commit the independently working streaming optimization.

### Task 3: SillyTavern-compatible primary keyword parsing and matching

**Files:**
- Modify: `sources/worldbook-scan.js`
- Modify: `sources/component-sources.js`
- Test: `tests/worldbook-scan.test.mjs`
- Test: `tests/component-sources.test.mjs`

**Interfaces:**
- Produce `splitWorldbookKeywords(input): string[]`.
- Produce `parseWorldbookRegex(input): RegExp|null`.
- Extend filtering options with `substituteKeyword(keyword): string`.
- Import `caseSensitive` and `matchWholeWords` metadata from native entries.

- [ ] Add failing tests for comma-separated text, commas inside valid regex, escaped delimiters, invalid-regex-as-text, flags, standard macro substitution, case sensitivity, whole-word matching, and any-primary-key activation.
- [ ] Run the focused tests and confirm failure under substring-only matching.
- [ ] Implement the native parser and matcher and pass a safe SillyTavern macro substitution callback from `index.js`.
- [ ] Run focused source and scan tests and confirm they pass.
- [ ] Commit the independently working native keyword scanner.

### Task 4: Inline keyword editing and scheme persistence

**Files:**
- Modify: `index.js`
- Modify: `settings/scheme-utils.js`
- Modify: `sources/source-selection.js` if override projection requires it
- Modify: `style.css` only if the existing row layout needs a keyword input selector
- Test: `tests/component-toggle-markup.test.mjs`
- Test: `tests/scheme-utils.test.mjs`
- Test: `tests/source-selection.test.mjs`

**Interfaces:**
- Add `settings.worldbookKeywordOverrides`, keyed by the same stable worldbook item key as content overrides.
- Scheme snapshots capture and restore keyword overrides for worldbook scope.
- Selected prompt items expose overridden `worldbookKeys` to the scanner without changing native source objects.

- [ ] Add failing tests for edit-mode markup, save/cancel/restore wiring, modified filtering, override projection, and worldbook scheme snapshot round-trips.
- [ ] Run focused tests and confirm failure because keyword overrides are absent.
- [ ] Add the inline input to the existing editor and persist it through the same confirmation lifecycle as content.
- [ ] Include keyword overrides in scheme capture/apply/reset and remove both content and keyword overrides on restore.
- [ ] Run focused UI, selection, scheme, and scanner tests and confirm they pass.
- [ ] Commit the independently working keyword editor.

### Task 5: Full verification and branch publication

**Files:**
- Modify tests only if verification reveals a genuine missing regression case; do not broaden production scope.

- [ ] Run `npm.cmd test` and require zero failures.
- [ ] Run `git diff --check` and require no whitespace errors.
- [ ] Inspect `git status --short` and the complete branch diff for unrelated files or accidental version changes.
- [ ] Commit any final test-only correction after observing its failure first.
- [ ] Push `codex/streaming-defaults-worldbook-keywords` and report the branch name and tested behaviors to the user.
