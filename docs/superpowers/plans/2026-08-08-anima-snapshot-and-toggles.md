# Anima snapshot and memory toggles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Anima worldbook memory available across re-rolls while reading message-scoped status variables live, formatting full status as Anima-compatible YAML, and exposing independent worldbook/status-variable switches.

**Architecture:** The Anima adapter remains responsible for identifying existing entries, merging non-empty worldbook snapshots, resolving the latest available message-scoped `anima_data`, and formatting values. The prompt builder receives the filtered Anima entries plus the live status object, while `index.js` owns per-chat snapshot lifetime and UI/settings migration. No missing Anima entry is synthesized.

**Tech Stack:** Vanilla JavaScript ES modules, Node `assert` regression tests, SillyTavern `TavernHelper` APIs, optional global `jsyaml` formatter.

## Global Constraints

- Keep `main` untouched; work only on `codex/anima-memory-integration`.
- Preserve existing Anima worldbook selection, enabled state, keyword, lamp, and ordering behavior.
- Empty Anima capture results must never erase a non-empty worldbook snapshot.
- Status variables are never cached as a fixed snapshot; read the nearest non-empty assistant `anima_data` for each prompt build.
- Do not create a missing `[anima_status]`, `[ANIMA_Chat_History_Container]`, or `[ANIMA_Knowledge_Container]` entry.

### Task 1: Define snapshot merge, filtering, live status, and YAML behavior

**Files:**
- Modify: `sources/anima-memory.js`
- Test: `tests/anima-memory.test.mjs`

**Interfaces:**
- Produce `mergeAnimaWorldbookSnapshots(previous, incoming)` that updates only entries with new non-empty content.
- Produce `filterAnimaWorldbookEntries(entries, { includeWorldbook, includeStatus })` so status and history/knowledge toggles are independent.
- Keep `readLatestAnimaStatus({ targetWindow, chat })` as a live backward lookup, skipping user/system messages.
- Make `replaceAnimaStatusMacros(content, status, options)` serialize complete objects with Anima-style YAML and retain scalar/path behavior.

- [ ] **Step 1: Write failing tests** for non-empty snapshot preservation, independent entry filtering, YAML full-object output, JSON `get_` output, and live fallback to a previous assistant floor.
- [ ] **Step 2: Run `node tests/anima-memory.test.mjs` and confirm the new assertions fail.**
- [ ] **Step 3: Implement the pure adapter helpers and optional `jsyaml.dump(value, { lineWidth: -1, noRefs: true })` formatting with a deterministic YAML fallback for Node tests.
- [ ] **Step 4: Run the focused test again and confirm it passes.

### Task 2: Keep worldbook snapshots across re-rolls and gate Anima sources independently

**Files:**
- Modify: `index.js`
- Modify: `generation/prompt-builder.js`
- Test: `tests/anima-prompt-builder.test.mjs`

**Interfaces:**
- Add `animaWorldbookEnabled` and `animaStatusVariableEnabled` settings with migration from the old `animaMemoryEnabled` flag.
- `captureAnimaWorldbookSnapshot()` merges non-empty captures instead of replacing with `[]`.
- `getAnimaStatusForPrompt()` performs a live lookup only when the status switch is enabled.
- Pass the filtered Anima worldbook entries and live status through prompt construction without changing normal source selection.

- [ ] **Step 1: Add failing prompt-builder assertions** proving YAML status replacement and that worldbook/status switches can independently provide or omit Anima content.
- [ ] **Step 2: Run `node tests/anima-prompt-builder.test.mjs` and confirm the assertions fail.
- [ ] **Step 3: Update snapshot lifetime, settings normalization, chat-change clearing, and prompt-builder arguments.
- [ ] **Step 4: Run focused Anima tests and confirm they pass.

### Task 3: Split the Anima settings UI and preserve backward compatibility

**Files:**
- Modify: `index.js`
- Modify: `style.css` only if the two rows need spacing/stacking adjustments.
- Test: `tests/anima-memory-ui.test.mjs`

**Interfaces:**
- Render two checkboxes under the Anima memory mode: `st-esg-anima-worldbook-enabled` and `st-esg-anima-status-enabled`.
- Keep the memory source radio group and existing BaiBai options unchanged.
- When Anima is disabled or both switches are off, clear only the worldbook snapshot; status remains uncached by design.

- [ ] **Step 1: Add failing UI source assertions** for both checkbox IDs and explanatory text.
- [ ] **Step 2: Run `node tests/anima-memory-ui.test.mjs` and confirm it fails.
- [ ] **Step 3: Update markup, render bindings, event handlers, migration, and descriptions.
- [ ] **Step 4: Run the focused UI test and confirm it passes.

### Task 4: Full verification and commit

**Files:**
- Test: all existing `tests/*.test.mjs` via `npm.cmd test`.

- [ ] **Step 1: Run `node --check index.js`, `node --check sources/anima-memory.js`, and `node --check generation/prompt-builder.js`.
- [ ] **Step 2: Run `npm.cmd test` and confirm exit code 0.
- [ ] **Step 3: Run `git diff --check`.
- [ ] **Step 4: Commit only the implementation, tests, and this plan; leave unrelated untracked files untouched.
