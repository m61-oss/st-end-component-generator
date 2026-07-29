# Auto-generation Session Guards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trigger automatic status-bar generation only for a newly completed assistant reply and never for background generations or manually stopped replies.

**Architecture:** Replace the single flat generation cycle with a stack of session records plus pending completion records. Keep all role, snapshot, stop, nesting, and final-tail validation in `generation/auto-generation-trigger.js`; keep `index.js` limited to event registration, scheduling, and invoking `generateStatusbar`.

**Tech Stack:** Browser JavaScript ES modules, SillyTavern event API, Node.js built-in test runner style with `node:assert/strict`.

## Global Constraints

- Completed normal, regenerate, swipe, and continue replies trigger automatic generation.
- Quiet generation, impersonation, and dry runs never trigger.
- Any manually stopped generation never triggers, regardless of partial content length.
- Background AI calls, rewritten user messages, and unchanged assistant re-renders never trigger.
- No new runtime dependency is introduced.

---

### Task 1: Generation session tracker

**Files:**
- Modify: `generation/auto-generation-trigger.js`
- Modify: `tests/auto-generation-trigger.test.mjs`

**Interfaces:**
- Consumes: SillyTavern generation type, dry-run flag, message ID, message object, and current chat array.
- Produces:
  - `start(type, dryRun, chat): void`
  - `recordAssistantMessage(messageId, message): boolean`
  - `stop(): void`
  - `end(): object | null`
  - `finalize(completion, chat): number | null`

- [x] **Step 1: Write failing session and final-validation tests**

Add test cases equivalent to:

```js
const tracker = createAutoGenerationTracker();
const user = { is_user: true, is_system: false, mes: 'input' };
const partial = { is_user: false, is_system: false, mes: 'partial' };

tracker.start('normal', false, [user]);
tracker.recordAssistantMessage(1, partial);
const stoppedCompletion = tracker.end();
tracker.stop();
assert.equal(tracker.finalize(stoppedCompletion, [user, partial]), null);

tracker.start('normal', false, [user]);
tracker.start('quiet', false, [user]);
assert.equal(tracker.end(), null);
tracker.recordAssistantMessage(1, partial);
const foregroundCompletion = tracker.end();
assert.equal(tracker.finalize(foregroundCompletion, [user, partial]), 1);
```

Also cover stop-before-end, unchanged assistant re-render, user tail, non-tail
assistant candidate, regenerate/continue content changes, and duplicate end
consumption.

- [x] **Step 2: Run the focused test and verify failure**

Run:

```powershell
node tests/auto-generation-trigger.test.mjs
```

Expected: FAIL because the current tracker has no `end()`/`finalize()` session
API and overwrites the foreground cycle when a nested generation starts.

- [x] **Step 3: Implement the session stack and completion records**

Use focused internal records:

```js
function snapshotTail(chat = []) {
  const lastIndex = Array.isArray(chat) ? chat.length - 1 : -1;
  const message = lastIndex >= 0 ? chat[lastIndex] : null;
  return {
    lastIndex,
    isUser: message?.is_user === true,
    isSystem: message?.is_system === true,
    content: String(message?.mes || ''),
  };
}

function isAssistantMessage(message) {
  return Boolean(
    message
    && message.is_user !== true
    && message.is_system !== true
    && String(message.mes || '').trim(),
  );
}
```

`start()` pushes every generation so nested end events are absorbed correctly,
but marks quiet, impersonate, and dry-run sessions ineligible.
`recordAssistantMessage()` records only on the current eligible session.
`end()` pops one session, creates a one-use pending completion only when it is
eligible, and returns that completion token.
`stop()` marks every active and pending record as stopped.
`finalize()` consumes its token once and returns the candidate index only when
the candidate is the current assistant chat tail and is new or changed compared
with the start snapshot.

- [x] **Step 4: Run the focused test and verify success**

Run:

```powershell
node tests/auto-generation-trigger.test.mjs
```

Expected: `auto-generation-trigger tests passed`.

- [x] **Step 5: Commit the tracker**

```powershell
git add generation/auto-generation-trigger.js tests/auto-generation-trigger.test.mjs
git commit -m "fix: track automatic generation sessions"
```

### Task 2: SillyTavern event integration

**Files:**
- Modify: `index.js`
- Test: `tests/auto-generation-trigger.test.mjs`

**Interfaces:**
- Consumes Task 1's `start`, `recordAssistantMessage`, `stop`, `end`, and `finalize`.
- Produces high-priority stop registration and one-shot deferred completion in the extension bootstrap.

- [x] **Step 1: Add an event-order regression test**

Model SillyTavern's real stop order:

```js
tracker.start('normal', false, [user]);
tracker.recordAssistantMessage(1, partial);
const completion = tracker.end(); // GENERATION_ENDED arrives first
tracker.stop();                    // GENERATION_STOPPED arrives second
assert.equal(tracker.finalize(completion, [user, partial]), null);
assert.equal(tracker.finalize(completion, [user, partial]), null);
```

- [x] **Step 2: Run the regression test and confirm the intended contract**

Run:

```powershell
node tests/auto-generation-trigger.test.mjs
```

Expected: PASS after Task 1; this locks the contract used by `index.js`.

- [x] **Step 3: Wire the new tracker API into `index.js`**

Update the handlers to follow this shape:

```js
function handleGenerationStarted(type, _options, dryRun) {
  autoGenerationTracker.start(type, dryRun, getContext().chat);
}

function handleGenerationStopped() {
  autoGenerationTracker.stop();
}

async function handleGenerationEnded() {
  const completion = autoGenerationTracker.end();
  if (!completion) return;
  await new Promise((resolve) => targetWindow.setTimeout(resolve, 0));
  const targetMessageIndex = autoGenerationTracker.finalize(completion, getContext().chat);
  if (!settings.autoGenerate || targetMessageIndex === null) return;
  await generateStatusbar('automatic', targetMessageIndex);
}
```

Register `GENERATION_STOPPED` with
`context.eventSource.makeFirst(...)` when available, falling back to `.on(...)`
for older SillyTavern versions. Keep assistant render registration and all other
listeners unchanged.

- [x] **Step 4: Run syntax and complete verification**

Run:

```powershell
node --check index.js
node --check generation/auto-generation-trigger.js
node tests/auto-generation-trigger.test.mjs
npm.cmd test
git diff --check
```

Expected: both syntax checks succeed, the focused test prints its pass message,
the full suite passes, and `git diff --check` produces no output.

- [x] **Step 5: Commit the integration**

```powershell
git add index.js
git commit -m "fix: suppress stopped and background auto generation"
```
