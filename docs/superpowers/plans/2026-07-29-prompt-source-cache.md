# Prompt Source Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse unchanged preset and worldbook source data so generation reaches the external API faster.

**Architecture:** Keep cache invalidation state in a small pure helper and retain the existing `importGroups` as the in-memory data cache. SillyTavern events mark either the source structure or one worldbook dirty; generation refreshes only dirty data and loads independent worldbooks concurrently.

**Tech Stack:** Browser JavaScript ES modules, SillyTavern event source, Node assertion tests.

## Global Constraints

- Do not add a user-facing refresh button.
- Preserve source ordering and current prompt-selection behavior.
- Cache is memory-only.

---

### Task 1: Cache invalidation state

**Files:**
- Create: `prompt-source-cache.js`
- Create: `tests/prompt-source-cache.test.mjs`

**Interfaces:**
- Produces: `createPromptSourceCacheState()`, `markPromptSourceStructureDirty(state)`, `markWorldbookSourceDirty(state, name)`, `takeDirtyWorldbookSources(state)`.

- [ ] Write tests for initial dirty state, structure invalidation, exact worldbook invalidation, and consuming dirty names.
- [ ] Run `node tests/prompt-source-cache.test.mjs` and verify it fails because the module is missing.
- [ ] Implement the four pure helpers.
- [ ] Run the focused test and verify it passes.

### Task 2: Cached and parallel generation preparation

**Files:**
- Modify: `index.js`
- Create: `tests/prompt-source-cache-integration.test.mjs`

**Interfaces:**
- Consumes: cache-state helpers from Task 1.
- Produces: generation preparation that rescans only when structurally dirty and reloads dirty active worldbooks with `Promise.all`.

- [ ] Write source integration assertions for no unconditional generation rescan, `Promise.all`, order-preserving assignment, and exact dirty-worldbook handling.
- [ ] Run the integration test and verify it fails.
- [ ] Update `ensurePromptSourceItemsForGeneration()` and scanning state transitions.
- [ ] Run focused tests and verify they pass.

### Task 3: Automatic SillyTavern event invalidation

**Files:**
- Modify: `index.js`
- Modify: `tests/prompt-source-cache-integration.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `context.eventSource` and guarded keys from `context.eventTypes`.
- Produces: listeners for worldbook, preset, chat, group, and character changes.

- [ ] Add failing assertions for guarded event registration and targeted worldbook invalidation.
- [ ] Register available events during `init()` without requiring every event to exist.
- [ ] Add focused tests to the full test command.
- [ ] Run `npm.cmd test`, `npm.cmd run check`, and `git diff --check`.
