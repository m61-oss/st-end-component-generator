# JSON Output Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fixed system-level output contract that asks the model for `thinking` and `content` JSON fields, while keeping streamed raw preview, tolerant parsing, and the existing regex cleanup path.

**Architecture:** Add a focused `generation/output-protocol.js` module containing the fixed Chinese protocol prompt and a pure parser. `generation/prompt-builder.js` will insert the protocol system message immediately before the existing task user message at the configured placement. `index.js` will parse the completed response into thinking plus content, then pass content through the existing configured-block extractor so old `<thinking>`/custom regex rules remain compatible.

**Tech Stack:** JavaScript ES modules, Node built-in `node:test` and `node:assert`, SillyTavern message arrays, existing jQuery UI state.

## Global Constraints

- Keep the exact user-approved protocol wording and the exact two-field order: `thinking`, then `content`.
- Do not add a random protocol/request number to the model-facing output.
- Keep streaming preview unchanged: raw chunks remain visible during generation; final parsing happens after the response completes or is manually stopped.
- Keep existing configured regex/tag extraction as a compatibility layer after JSON envelope parsing.
- Do not implement insertion operations or insertion UI in this change; only leave the parser tolerant of future unknown fields.
- Preserve legacy non-JSON responses by falling back to the current configured-block extraction behavior.
- Do not change API request parameters or force native `response_format`/JSON Schema options.

---

### Task 1: Add the pure output protocol and parser

**Files:**
- Create: `generation/output-protocol.js`
- Create: `generation/output-protocol.test.mjs`

**Interfaces:**
- Produces `OUTPUT_PROTOCOL_SYSTEM_PROMPT` containing the exact approved Chinese protocol text.
- Produces `buildOutputProtocolMessage() -> { role: 'system', content: string }`.
- Produces `parseOutputProtocolResponse(rawText) -> { mode: 'json' | 'loose-json' | 'legacy', thinking: string, content: string, complete: boolean } | null`.

- [ ] **Step 1: Write failing tests for the fixed prompt and parser contract**

Cover these exact behaviors:

```js
const strict = parseOutputProtocolResponse(JSON.stringify({ thinking: 'Phase.0\nPhase.1', content: '<draft>摘要</draft>' }));
assert.deepEqual(strict, {
  mode: 'json',
  thinking: 'Phase.0\nPhase.1',
  content: '<draft>摘要</draft>',
  complete: true,
});

const fenced = parseOutputProtocolResponse('```json\n{"thinking":"x","content":"y"}\n```');
assert.equal(fenced.content, 'y');

const missingClosingObject = parseOutputProtocolResponse('{\n  "thinking": "x",\n  "content": "正文"');
assert.equal(missingClosingObject.content, '正文');
assert.equal(missingClosingObject.complete, false);

const legacy = parseOutputProtocolResponse('<thinking>x</thinking><content>正文</content>');
assert.equal(legacy.mode, 'legacy');
assert.equal(legacy.content, legacyInput);

assert.match(OUTPUT_PROTOCOL_SYSTEM_PROMPT, /只包含以下两个字段/);
assert.match(OUTPUT_PROTOCOL_SYSTEM_PROMPT, /"thinking"/);
assert.match(OUTPUT_PROTOCOL_SYSTEM_PROMPT, /"content"/);
```

The loose path must accept `content` as the final field and read through EOF when the final quote or `}` is missing. It must not treat an arbitrary JSON object without a `content` field as a generated result.

- [ ] **Step 2: Run the focused test and verify it fails for the missing module/behavior**

Run: `node generation/output-protocol.test.mjs`

Expected: FAIL because `generation/output-protocol.js` does not yet exist or does not expose the requested parser behavior.

- [ ] **Step 3: Implement the minimum pure parser**

Implement this order:

1. Normalize input to a string and remove only an outer Markdown JSON fence when present.
2. Try strict JSON parsing; accept only an object with string-compatible `thinking` and `content` fields.
3. If strict parsing fails, locate the final top-level-looking line matching `"content"\s*:`. Treat it as the final field, read the remainder to EOF, remove only obvious wrapper characters, and mark `complete: false` when the object/quoted value is incomplete.
4. If no usable `content` field exists, return `mode: 'legacy'` with the original text and empty thinking so the existing tag-rule parser can process it.
5. Never throw for malformed model output.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `node generation/output-protocol.test.mjs`

Expected: PASS for strict JSON, fenced JSON, missing closing object/quote recovery, legacy fallback, unknown extra fields, empty fields, and malformed non-object text.

- [ ] **Step 5: Run syntax validation for the new module**

Run: `node --check generation/output-protocol.js`

Expected: exit code 0.

### Task 2: Insert the protocol at the task-message boundary

**Files:**
- Modify: `generation/prompt-builder.js:1-4,761-771,786-835`
- Create or modify: `generation/prompt-builder.test.mjs`

**Interfaces:**
- Consumes `buildOutputProtocolMessage()` from `generation/output-protocol.js`.
- Keeps `buildExternalStatusbarMessages()` return shape unchanged.

- [ ] **Step 1: Write failing message-order tests**

Assert that the generated message array contains the protocol system message immediately before the task user message when placement is disabled, when placement is after `chatHistory`, and when placement references a specific source item. Assert that `lastUserMessageOverride` still contains only the original task content and that no random ID is present.

- [ ] **Step 2: Run the focused message-builder test and verify the new assertions fail**

Run: `node generation/prompt-builder.test.mjs`

Expected: FAIL because the existing builder inserts only the task user message.

- [ ] **Step 3: Implement protocol insertion beside the existing task insertion**

Update `insertTaskMessage()` so every insertion operation adds:

```js
messages.splice(index, 0, buildOutputProtocolMessage(), taskMessage);
```

Use the same calculated placement index for both messages. Keep all source metadata and `lastUserMessageOverride` behavior unchanged.

- [ ] **Step 4: Run the focused message-builder test and verify it passes**

Run: `node generation/prompt-builder.test.mjs`

Expected: PASS with protocol `system` immediately followed by the existing task `user` message in every placement mode.

### Task 3: Parse final results while preserving streaming and legacy rendering

**Files:**
- Modify: `index.js:42,1055-1066,1414-1422`
- Modify: `generation/output-protocol.js` only if integration-facing normalization is needed.
- Create or modify: `generation/output-result.test.mjs`

**Interfaces:**
- `applyGeneratedResult(rawText)` consumes `parseOutputProtocolResponse()`.
- Existing `extractConfiguredBlocks()` remains the final content cleanup step.

- [ ] **Step 1: Write failing result-rendering tests**

Test the pure integration helper (extracted if necessary) with:

```js
const result = normalizeGeneratedResult(JSON.stringify({
  thinking: 'Phase.0\nPhase.1',
  content: '<thinking>legacy thinking</thinking>正文',
}));

assert.equal(result.content, '正文');
assert.deepEqual(result.thinking, ['Phase.0\nPhase.1', 'legacy thinking']);
```

Also assert legacy non-JSON input still extracts configured tags exactly as before, and malformed JSON with a usable final `content` still produces content while marking the envelope incomplete.

- [ ] **Step 2: Run the focused result test and verify it fails**

Run: `node generation/output-result.test.mjs`

Expected: FAIL because completed responses currently go directly to `extractConfiguredBlocks(rawText, ...)` and treat the whole JSON envelope as body text.

- [ ] **Step 3: Implement final-result normalization**

At completion only:

1. Parse the envelope.
2. Put the parsed `thinking` string into the existing thinking-block list.
3. Run `extractConfiguredBlocks(parsed.content, settings.outputCleanupTags)`.
4. Append any regex-extracted blocks to the thinking list.
5. Store only the cleaned body in `settings.lastGenerated` and the preview textarea.
6. Keep `updateStreamedPreview()` unchanged so raw streaming remains visible.
7. On aborted partial responses, use the same normalization; if no usable `content` exists, preserve the legacy raw behavior and do not inject it automatically.

- [ ] **Step 4: Run focused result tests and the existing tracked tests**

Run:

```powershell
node generation/output-protocol.test.mjs
node generation/prompt-builder.test.mjs
node generation/output-result.test.mjs
node --check index.js
```

Then run every tracked `*.test.mjs` file outside `database-source-temp*` and confirm the pre-existing untracked `.superpowers/brand-ui.test.mjs` failure remains unrelated.

- [ ] **Step 5: Inspect the final diff and commit the implementation**

Run `git diff --check`, inspect `git diff --stat`, and commit only the tracked protocol/parser/builder/index/test files. Do not stage unrelated untracked directories.

