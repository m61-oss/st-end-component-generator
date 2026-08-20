# Custom Output Protocol Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a test-only task-page editor that independently overrides the standard and anchor output-protocol prompt and message role.

**Architecture:** Keep protocol defaults and message construction in `generation/output-protocol.js`, thread the selected override through `generation/prompt-builder.js`, and store/edit the four values through the existing `index.js` settings lifecycle. The response parsers and task-scheme snapshots remain unchanged.

**Tech Stack:** JavaScript ES modules, SillyTavern extension DOM/jQuery integration, CSS, Node built-in test runner.

## Global Constraints

- This is a testing control, not a formal versioned protocol system.
- Standard and anchor modes keep independent prompt text and roles.
- Allowed roles are exactly `system`, `user`, and `assistant`; invalid stored values fall back to `system`.
- Custom protocol text replaces the built-in protocol and remains the final API message.
- Settings persist in plugin settings only and must not enter task-scheme snapshots.
- Existing output parsers and their failure behavior remain unchanged.
- Reset affects only the currently selected protocol mode and restores its built-in text plus `system` role.

---

### Task 1: Protocol Message Override Interface

**Files:**
- Modify: `generation/output-protocol.js`
- Test: `generation/output-protocol.test.mjs`

**Interfaces:**
- Consumes: `{ mode?: 'standard' | 'anchor', content?: unknown, role?: unknown }`
- Produces: `buildOutputProtocolMessage(options): { role: 'system' | 'user' | 'assistant', content: string }`

- [ ] **Step 1: Write failing role/content override tests**

```js
test('uses a custom protocol and accepted role verbatim', () => {
  assert.deepEqual(
    buildOutputProtocolMessage({ mode: 'anchor', content: 'CUSTOM', role: 'assistant' }),
    { role: 'assistant', content: 'CUSTOM' },
  );
});

test('falls back to system role and built-in text for invalid overrides', () => {
  assert.deepEqual(buildOutputProtocolMessage({ mode: 'anchor', role: 'tool' }), {
    role: 'system',
    content: ANCHOR_OUTPUT_PROTOCOL_SYSTEM_PROMPT,
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test generation/output-protocol.test.mjs`

Expected: FAIL because `buildOutputProtocolMessage` ignores `content` and `role`.

- [ ] **Step 3: Implement minimal override normalization**

```js
const OUTPUT_PROTOCOL_ROLES = new Set(['system', 'user', 'assistant']);

export function buildOutputProtocolMessage({ mode = 'standard', content, role = 'system' } = {}) {
  const defaultContent = mode === 'anchor'
    ? ANCHOR_OUTPUT_PROTOCOL_SYSTEM_PROMPT
    : OUTPUT_PROTOCOL_SYSTEM_PROMPT;
  return {
    role: OUTPUT_PROTOCOL_ROLES.has(role) ? role : 'system',
    content: typeof content === 'string' ? content : defaultContent,
  };
}
```

- [ ] **Step 4: Run the focused test and verify success**

Run: `node --test generation/output-protocol.test.mjs`

Expected: all output-protocol tests PASS.

- [ ] **Step 5: Commit the protocol interface**

```bash
git add generation/output-protocol.js generation/output-protocol.test.mjs
git commit -m "support custom output protocol messages"
```

### Task 2: Prompt Builder Plumbing

**Files:**
- Modify: `generation/prompt-builder.js`
- Test: `generation/prompt-builder.test.mjs`

**Interfaces:**
- Consumes: `outputProtocol?: { content?: string, role?: 'system' | 'user' | 'assistant' }`
- Produces: final message from `buildOutputProtocolMessage({ mode: outputMode, ...outputProtocol })`

- [ ] **Step 1: Write failing final-message tests**

```js
test('places a custom standard protocol and role at the message-list end', async () => {
  const messages = await build({
    outputProtocol: { content: 'STANDARD CUSTOM', role: 'assistant' },
  });
  assert.deepEqual(messages.at(-1), { role: 'assistant', content: 'STANDARD CUSTOM' });
});

test('places a custom anchor protocol and role at the message-list end', async () => {
  const messages = await build({
    outputMode: 'anchor',
    outputProtocol: { content: 'ANCHOR CUSTOM', role: 'user' },
  });
  assert.deepEqual(messages.at(-1), { role: 'user', content: 'ANCHOR CUSTOM' });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test generation/prompt-builder.test.mjs`

Expected: FAIL because `outputProtocol` is not accepted or forwarded.

- [ ] **Step 3: Thread the override through message construction**

```js
function insertTaskMessage(messages, taskMessage, taskPlacement, outputMode = 'standard', outputProtocol = {}) {
  const protocolMessage = buildOutputProtocolMessage({ mode: outputMode, ...outputProtocol });
}

export async function buildExternalStatusbarMessages({
  outputMode = 'standard',
  outputProtocol = {},
}) {
  return insertTaskMessage(messages, taskMessage, taskPlacement, outputMode, outputProtocol);
}
```

- [ ] **Step 4: Run protocol and prompt-builder tests**

Run: `node --test generation/output-protocol.test.mjs generation/prompt-builder.test.mjs`

Expected: all tests PASS and the protocol remains final.

- [ ] **Step 5: Commit prompt plumbing**

```bash
git add generation/prompt-builder.js generation/prompt-builder.test.mjs
git commit -m "pass custom output protocols into prompts"
```

### Task 3: Task-Page Testing Controls and Persistence

**Files:**
- Modify: `index.js`
- Modify: `style.css`
- Create: `ui/custom-output-protocol.test.mjs`

**Interfaces:**
- Consumes settings keys `standardOutputProtocol`, `standardOutputProtocolRole`, `anchorOutputProtocol`, `anchorOutputProtocolRole`
- Produces `getActiveOutputProtocolSettings(outputMode): { content: string, role: string }`

- [ ] **Step 1: Write a failing UI/source integration test**

```js
test('task page exposes independent protocol mode, role, editor, and reset controls', () => {
  assert.match(indexSource, /id="st-esg-output-protocol-mode"/);
  assert.match(indexSource, /id="st-esg-output-protocol-role"/);
  assert.match(indexSource, /id="st-esg-output-protocol-text"/);
  assert.match(indexSource, /id="st-esg-reset-output-protocol"/);
});

test('generation passes the active protocol override without adding it to task schemes', () => {
  assert.match(indexSource, /outputProtocol:\s*getActiveOutputProtocolSettings\(outputMode\)/);
  assert.doesNotMatch(schemeSource, /standardOutputProtocol|anchorOutputProtocol/);
});
```

- [ ] **Step 2: Run the UI test and verify failure**

Run: `node --test ui/custom-output-protocol.test.mjs`

Expected: FAIL because the controls and settings do not exist.

- [ ] **Step 3: Add defaults and normalization**

```js
const DEFAULT_SETTINGS = {
  standardOutputProtocol: OUTPUT_PROTOCOL_SYSTEM_PROMPT,
  standardOutputProtocolRole: 'system',
  anchorOutputProtocol: ANCHOR_OUTPUT_PROTOCOL_SYSTEM_PROMPT,
  anchorOutputProtocolRole: 'system',
};

function normalizeOutputProtocolRole(value) {
  return ['system', 'user', 'assistant'].includes(value) ? value : 'system';
}

function getActiveOutputProtocolSettings(outputMode) {
  const anchor = outputMode === 'anchor';
  return {
    content: anchor ? settings.anchorOutputProtocol : settings.standardOutputProtocol,
    role: normalizeOutputProtocolRole(anchor ? settings.anchorOutputProtocolRole : settings.standardOutputProtocolRole),
  };
}
```

- [ ] **Step 4: Add task-page markup and mode rendering**

```html
<div class="st-esg-output-protocol-card">
  <div class="st-esg-segmented" id="st-esg-output-protocol-mode">
    <button type="button" data-output-protocol-mode="standard">普通模式</button>
    <button type="button" data-output-protocol-mode="anchor">锚点模式</button>
  </div>
  <label>消息角色
    <select id="st-esg-output-protocol-role" class="text_pole">
      <option value="system">system</option>
      <option value="user">user</option>
      <option value="assistant">assistant</option>
    </select>
  </label>
  <textarea id="st-esg-output-protocol-text" class="text_pole textarea_compact st-esg-textarea"></textarea>
  <button id="st-esg-reset-output-protocol" type="button">恢复当前内置协议</button>
</div>
```

Implement `renderOutputProtocolEditor()` so switching mode saves the current editor first, loads the other mode without overwriting it, and updates the selected button. Bind `input`, `change`, and reset through the existing panel event setup and call the existing debounced settings saver.

- [ ] **Step 5: Pass the selected override into generation**

```js
const outputMode = getCurrentOutputMode();
const messages = await buildExternalStatusbarMessages({
  outputMode,
  outputProtocol: getActiveOutputProtocolSettings(outputMode),
});
```

- [ ] **Step 6: Add scoped responsive styles**

```css
.st-esg-output-protocol-card { display: grid; gap: 10px; margin-top: 12px; }
.st-esg-output-protocol-toolbar { display: flex; gap: 8px; align-items: end; flex-wrap: wrap; }
.st-esg-output-protocol-toolbar label { flex: 1 1 150px; }
#st-esg-output-protocol-text { min-height: 220px; font-family: var(--mainFontFamily, monospace); }
```

- [ ] **Step 7: Run focused and full tracked tests**

Run: `node --test ui/custom-output-protocol.test.mjs generation/output-protocol.test.mjs generation/prompt-builder.test.mjs settings/scheme-utils.test.mjs`

Expected: all focused tests PASS.

Run: `Get-ChildItem -Recurse -Filter *.test.mjs | Where-Object { $_.FullName -notmatch 'database-source-temp' } | ForEach-Object { node --test $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }`

Expected: all tracked project tests PASS.

- [ ] **Step 8: Commit the testing controls**

```bash
git add index.js style.css ui/custom-output-protocol.test.mjs
git commit -m "add custom output protocol test controls"
```

### Task 4: Final Verification and Branch Publication

**Files:**
- Verify only: all modified files

**Interfaces:**
- Consumes: completed Tasks 1–3
- Produces: a pushed test branch with no parser or task-scheme regression

- [ ] **Step 1: Run syntax and whitespace checks**

Run: `node --check index.js`

Expected: exit code 0.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 2: Inspect the final diff and branch status**

Run: `git diff --stat HEAD~3..HEAD`

Expected: only the planned protocol, prompt-builder, UI, test, CSS, and plan files appear.

Run: `git status --short`

Expected: no tracked uncommitted changes; unrelated pre-existing untracked files may remain.

- [ ] **Step 3: Push the current test branch**

Run: `git push origin codex/message-floor-panel`

Expected: remote branch updates successfully.
