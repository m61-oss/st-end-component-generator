# Assistant Message Auto Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trigger automatic status-bar generation only after a SillyTavern generation cycle produces or updates a real assistant message.

**Architecture:** Add a pure event-cycle tracker under `generation/` that correlates generation start, assistant render, stop, and end events. Integrate it into `index.js`, pass the confirmed assistant message index through generation and optional injection, and retain latest-assistant fallback for manual and Quick Reply entry points.

**Tech Stack:** Browser-native ES modules, SillyTavern event source, Node.js ES module tests.

## Global Constraints

- Normal, regenerate, swipe, and continue assistant generations must trigger automatic generation.
- Quiet generation, impersonation, user messages, system messages, stopped cycles, empty cycles, and duplicate end notifications must not trigger.
- Manual generation and Quick Reply behavior must remain unchanged.
- Automatic injection must target the same assistant message that caused automatic generation.
- No new dependency or build step may be added.

---

### Task 1: Add the automatic generation cycle tracker

**Files:**
- Create: `generation/auto-generation-trigger.js`
- Create: `tests/auto-generation-trigger.test.mjs`
- Modify: `tests/repository-layout.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `createAutoGenerationTracker()`.
- The returned tracker provides `start(type, dryRun)`, `recordAssistantMessage(messageId, message)`, `stop()`, and `finish()`.
- `finish()` returns a non-negative integer assistant message index or `null`, then consumes the cycle.

- [ ] **Step 1: Write failing tracker tests**

Test normal, regenerate, swipe, continue, quiet, impersonate, dry-run, user, system, stopped, no-message, invalid-index, and duplicate-finish cases.

- [ ] **Step 2: Verify the tests fail**

Run:

```powershell
node tests/auto-generation-trigger.test.mjs
```

Expected: failure because `generation/auto-generation-trigger.js` does not exist.

- [ ] **Step 3: Implement the tracker**

Implement a closure-backed state object. `start()` resets the cycle; `recordAssistantMessage()` accepts only active, eligible cycles and messages where `is_user !== true`, `is_system !== true`, and `mes` contains text; `stop()` marks the cycle stopped; `finish()` returns and consumes only a valid unstopped target.

- [ ] **Step 4: Register the test and classified module**

Add the new source path to `tests/repository-layout.test.mjs` and the new test command to `package.json`.

- [ ] **Step 5: Verify tracker tests pass**

Run:

```powershell
node tests/auto-generation-trigger.test.mjs
node tests/repository-layout.test.mjs
node tests/package-scripts.test.mjs
```

Expected: all commands exit with code 0.

### Task 2: Correlate SillyTavern events and use the exact assistant message

**Files:**
- Modify: `index.js`
- Create: `tests/auto-generation-trigger-integration.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `createAutoGenerationTracker()`.
- `generateStatusbar(entryType = 'manual', targetMessageIndex = null)` accepts an optional exact target.
- `injectGeneratedStatusbar(targetMessageIndex = null)` accepts the same optional exact target.

- [ ] **Step 1: Write failing integration tests**

Assert that `index.js`:

- Imports and creates the tracker.
- Handles `GENERATION_STARTED`, `CHARACTER_MESSAGE_RENDERED`, `GENERATION_STOPPED`, and `GENERATION_ENDED`.
- Defers end handling by one event-loop turn before consuming the tracker.
- Calls `generateStatusbar('automatic', targetMessageIndex)`.
- Resolves an explicitly indexed assistant message for generation.
- Passes the same index to automatic injection.

- [ ] **Step 2: Verify the integration test fails**

Run:

```powershell
node tests/auto-generation-trigger-integration.test.mjs
```

Expected: failure because the tracker is not integrated.

- [ ] **Step 3: Integrate event correlation**

Import and instantiate the tracker. Add handlers for start, assistant render, stop, and end. On end, wait with `targetWindow.setTimeout(..., 0)`, consume the tracker, and generate only when a target index is returned.

- [ ] **Step 4: Thread the target index through generation and injection**

Add indexed assistant lookup without changing latest-assistant fallback. Use the indexed message for API prompt construction and pass its index into automatic injection.

- [ ] **Step 5: Verify focused tests**

Run:

```powershell
node tests/auto-generation-trigger.test.mjs
node tests/auto-generation-trigger-integration.test.mjs
node tests/auto-injection.test.mjs
node tests/generation-entry.test.mjs
```

Expected: all commands exit with code 0.

### Task 3: Full verification and delivery

**Files:**
- Modify: only files already listed in Tasks 1 and 2.

**Interfaces:**
- Produces: a tested, backward-compatible assistant-only automatic generation flow.

- [ ] **Step 1: Run complete verification**

Run:

```powershell
npm.cmd test
npm.cmd run check
git diff --check
```

Expected: all commands exit with code 0.

- [ ] **Step 2: Review the diff**

Confirm no file outside the approved plan is modified and `.codex-remote-attachments/` remains untracked.

- [ ] **Step 3: Commit and push**

Commit message:

```text
fix: trigger auto generation only for assistant messages
```

Push the commit and the preceding approved design commit to `origin/main`.
