# API Additional Parameters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SillyTavern-style validated YAML request customization and restore editable temperature and maximum-token settings.

**Architecture:** Put YAML shape validation, numeric validation, and request merging in a small pure module. `index.js` supplies SillyTavern's exported `yaml` parser, owns the modal UI, and applies the pure module to generation and model-list requests. API scheme snapshots remain responsible for persistence.

**Tech Stack:** JavaScript ES modules, SillyTavern `yaml` export, native `<dialog>`, jQuery event bindings, Node built-in `assert`.

## Global Constraints

- Temperature defaults to `1` and must be a finite number.
- Maximum tokens defaults to `65535` and must be a positive integer.
- The dialog contains body inclusion, body exclusion, and header inclusion YAML.
- Invalid YAML or invalid top-level shapes prevent saving and show section plus line/column details.
- Dialog edits are drafts until Save; Cancel discards them.
- Included body values override base request values, then excluded keys are removed.
- Included headers override base headers and apply to generation and model-list requests.
- Custom header values must never appear in prompt logs.
- All five API values are stored in API scheme snapshots.

---

### Task 1: Pure API request parameter helpers

**Files:**
- Create: `api-request-parameters.js`
- Create: `tests/api-request-parameters.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: a parser with `parse(source: string): unknown`, compatible with SillyTavern's `yaml` export.
- Produces: `parseApiNumericSettings(settings)`, `parseApiAdditionalParameters(settings, yamlParser)`, `buildApiRequestParts(baseBody, baseHeaders, parsed)`, and `ApiParameterValidationError`.

- [ ] **Step 1: Write failing tests for numeric validation**

```js
import assert from 'node:assert/strict';
import {
  ApiParameterValidationError,
  buildApiRequestParts,
  parseApiAdditionalParameters,
  parseApiNumericSettings,
} from '../api-request-parameters.js';

assert.deepEqual(
  parseApiNumericSettings({ maxTokens: '65535', temperature: '1' }),
  { maxTokens: 65535, temperature: 1 },
);
assert.throws(
  () => parseApiNumericSettings({ maxTokens: '12.5', temperature: '1' }),
  (error) => error instanceof ApiParameterValidationError && error.field === '最大 Token',
);
assert.throws(
  () => parseApiNumericSettings({ maxTokens: '10', temperature: 'NaN' }),
  (error) => error instanceof ApiParameterValidationError && error.field === '温度',
);
```

- [ ] **Step 2: Write failing tests for YAML shapes and parser locations**

Use a test parser whose `parse` method returns JSON values, since JSON is a valid
YAML subset, and whose `broken` input throws an error with
`linePos: [{ line: 3, col: 5 }]`.

```js
const yamlParser = {
  parse(source) {
    if (source === 'broken') {
      const error = new Error('Unexpected scalar');
      error.linePos = [{ line: 3, col: 5 }];
      throw error;
    }
    return JSON.parse(source);
  },
};

assert.deepEqual(parseApiAdditionalParameters({
  additionalBodyYaml: '{"top_k":20}',
  excludedBodyYaml: '["frequency_penalty"]',
  additionalHeadersYaml: '{"X-Test":"yes"}',
}, yamlParser), {
  additionalBody: { top_k: 20 },
  excludedBodyKeys: ['frequency_penalty'],
  additionalHeaders: { 'X-Test': 'yes' },
});

assert.throws(
  () => parseApiAdditionalParameters({
    additionalBodyYaml: 'broken',
    excludedBodyYaml: '',
    additionalHeadersYaml: '',
  }, yamlParser),
  (error) => error.field === '追加请求体参数' && error.line === 3 && error.column === 5,
);
```

- [ ] **Step 3: Write failing tests for merge precedence**

```js
assert.deepEqual(buildApiRequestParts(
  { model: 'base', max_tokens: 65535, temperature: 1 },
  { 'Content-Type': 'application/json', Authorization: 'Bearer base' },
  {
    additionalBody: { temperature: 0.4, top_k: 20 },
    excludedBodyKeys: ['max_tokens'],
    additionalHeaders: { Authorization: 'Bearer custom', 'X-Test': 'yes' },
  },
), {
  body: { model: 'base', temperature: 0.4, top_k: 20 },
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer custom',
    'X-Test': 'yes',
  },
});
```

- [ ] **Step 4: Run the new test and verify RED**

Run: `node tests/api-request-parameters.test.mjs`

Expected: failure because `api-request-parameters.js` does not exist.

- [ ] **Step 5: Implement the pure helper**

Implement:

```js
export class ApiParameterValidationError extends Error {
  constructor(field, message, { line = null, column = null } = {}) {
    super(`${field}：${message}${line ? `（第 ${line} 行${column ? `，第 ${column} 列` : ''}）` : ''}`);
    this.name = 'ApiParameterValidationError';
    this.field = field;
    this.line = line;
    this.column = column;
  }
}

export function parseApiNumericSettings({ maxTokens, temperature }) {
  const parsedMaxTokens = Number(maxTokens);
  const parsedTemperature = Number(temperature);
  if (!Number.isInteger(parsedMaxTokens) || parsedMaxTokens <= 0) {
    throw new ApiParameterValidationError('最大 Token', '必须填写大于 0 的整数');
  }
  if (!Number.isFinite(parsedTemperature)) {
    throw new ApiParameterValidationError('温度', '必须填写有效数字');
  }
  return { maxTokens: parsedMaxTokens, temperature: parsedTemperature };
}
```

Add internal helpers that:

- treat blank YAML as empty;
- merge a mapping or list of mappings for body/header inclusion;
- accept a string, list, or object keys for exclusions;
- wrap parser errors with `field`, `line`, and `column`;
- reject every other top-level shape.

Implement `buildApiRequestParts` with:

```js
const body = { ...baseBody, ...parsed.additionalBody };
for (const key of parsed.excludedBodyKeys) delete body[key];
const headers = { ...baseHeaders, ...parsed.additionalHeaders };
return { body, headers };
```

- [ ] **Step 6: Run the focused test and verify GREEN**

Run: `node tests/api-request-parameters.test.mjs`

Expected: `api-request-parameters tests passed`.

- [ ] **Step 7: Add the test to `npm test`**

Insert `node tests/api-request-parameters.test.mjs` after
`node tests/api-utils.test.mjs`.

- [ ] **Step 8: Commit the helper**

```powershell
git add api-request-parameters.js tests/api-request-parameters.test.mjs package.json
git commit -m "feat: validate API request parameters"
```

### Task 2: Defaults, API schemes, and editable numeric settings

**Files:**
- Modify: `index.js`
- Modify: `scheme-utils.js`
- Modify: `tests/scheme-utils.test.mjs`
- Modify: `tests/component-toggle-markup.test.mjs`

**Interfaces:**
- Consumes: setting keys `additionalBodyYaml`, `excludedBodyYaml`, and `additionalHeadersYaml`.
- Produces: defaults and API scheme snapshots containing temperature, maximum tokens, and all three YAML strings.

- [ ] **Step 1: Add failing default and markup assertions**

Add assertions that `DEFAULT_SETTINGS` contains:

```js
maxTokens: '65535',
temperature: '1',
additionalBodyYaml: '',
excludedBodyYaml: '',
additionalHeadersYaml: '',
```

Assert that `renderPluginPanel` no longer removes the
`#st-esg-max-tokens` label and that temperature precedes maximum tokens in the
rendered API group.

- [ ] **Step 2: Add failing API scheme snapshot assertions**

Extend the fixture in `tests/scheme-utils.test.mjs`:

```js
additionalBodyYaml: 'top_k: 20',
excludedBodyYaml: '- frequency_penalty',
additionalHeadersYaml: 'X-Test: yes',
```

Assert `captureSchemeSnapshot('api', settings)` preserves all three strings,
`maxTokens`, and `temperature`.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```powershell
node tests/scheme-utils.test.mjs
node tests/component-toggle-markup.test.mjs
```

Expected: failures for missing defaults, missing snapshot fields, and the removed
maximum-token control.

- [ ] **Step 4: Update defaults and rendering**

In `index.js`:

- replace the old `200000` default with `65535`;
- set temperature to `'1'`;
- add the three YAML strings to `DEFAULT_SETTINGS`;
- stop deleting the maximum-token label;
- move the temperature label before the maximum-token label;
- render both saved numeric values in `renderPluginPanel`;
- bind input handlers for both values and mark the API scheme dirty.

- [ ] **Step 5: Update API scheme capture and apply**

In `scheme-utils.js`, add the three YAML strings to the `api` snapshot.

In `applyApiScheme` restore:

```js
maxTokens: snapshot.maxTokens || '65535',
temperature: snapshot.temperature || '1',
additionalBodyYaml: snapshot.additionalBodyYaml || '',
excludedBodyYaml: snapshot.excludedBodyYaml || '',
additionalHeadersYaml: snapshot.additionalHeadersYaml || '',
```

Then update both numeric inputs after applying the scheme.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```powershell
node tests/scheme-utils.test.mjs
node tests/component-toggle-markup.test.mjs
```

Expected: both pass.

- [ ] **Step 7: Commit settings persistence**

```powershell
git add index.js scheme-utils.js tests/scheme-utils.test.mjs tests/component-toggle-markup.test.mjs
git commit -m "feat: persist editable API limits"
```

### Task 3: Apply additional parameters to network requests

**Files:**
- Modify: `index.js`
- Create: `tests/api-request-integration.test.mjs`
- Modify: `tests/prompt-log.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 1 helpers and Task 2 setting keys.
- Produces: generation/model-list fetch options with validated effective body and headers.

- [ ] **Step 1: Add failing integration source assertions**

Assert that `index.js` imports:

```js
import { yaml } from '../../../lib.js';
import {
  buildApiRequestParts,
  parseApiAdditionalParameters,
  parseApiNumericSettings,
} from './api-request-parameters.js?ver=0.1.0';
```

Assert `callExternalApi`:

- parses numeric and YAML settings before `fetch`;
- builds the base request body from actual `maxTokens` and `temperature`;
- sends `JSON.stringify(body)` and merged `headers`;
- passes actual numeric values to `createPromptLog`.

Assert `fetchApiModels` parses the saved YAML and adds only
`additionalHeaders` to its GET headers.

- [ ] **Step 2: Add a privacy regression assertion**

In `tests/prompt-log.test.mjs`, create a log with a sentinel custom header secret
and assert the serialized log does not contain the sentinel. If the prompt-log
interface remains unchanged, assert that `index.js` never passes
`additionalHeaders` or `additionalHeadersYaml` to `createPromptLog`.

- [ ] **Step 3: Run tests and verify RED**

Run:

```powershell
node tests/api-request-integration.test.mjs
node tests/prompt-log.test.mjs
```

Expected: integration assertions fail because requests still use fixed values and
base headers only.

- [ ] **Step 4: Wire generation requests**

At the beginning of `callExternalApi`:

```js
const numeric = parseApiNumericSettings(settings);
const additional = parseApiAdditionalParameters(settings, yaml);
const { body, headers } = buildApiRequestParts(
  {
    model,
    messages,
    max_tokens: numeric.maxTokens,
    temperature: numeric.temperature,
    stream: Boolean(settings.streamingEnabled),
  },
  {
    'Content-Type': 'application/json',
    ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
  },
  additional,
);
```

Use `numeric` in `createPromptLog`, and use `headers` plus
`JSON.stringify(body)` in `fetch`.

- [ ] **Step 5: Wire model-list requests**

Before the model-list `fetch`, parse additional settings and build:

```js
const headers = {
  'Content-Type': 'application/json',
  ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
  ...parseApiAdditionalParameters(settings, yaml).additionalHeaders,
};
```

Keep the endpoint as GET and do not apply body additions or exclusions.

- [ ] **Step 6: Normalize validation errors**

Allow the existing generation and model-fetch catch blocks to show the
`ApiParameterValidationError.message`. No network request may occur after numeric
or YAML validation fails.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run:

```powershell
node tests/api-request-integration.test.mjs
node tests/prompt-log.test.mjs
node tests/api-request-parameters.test.mjs
```

Expected: all pass.

- [ ] **Step 8: Add integration test to `npm test` and commit**

```powershell
git add index.js tests/api-request-integration.test.mjs tests/prompt-log.test.mjs package.json
git commit -m "feat: apply custom API request parameters"
```

### Task 4: Additional Parameters modal and action button

**Files:**
- Modify: `index.js`
- Modify: `style.css`
- Modify: `tests/component-toggle-markup.test.mjs`
- Create: `tests/api-additional-dialog.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `parseApiAdditionalParameters(settings, yaml)` from Task 1.
- Produces: `showApiAdditionalParametersDialog()` with atomic Save and discard-on-Cancel.

- [ ] **Step 1: Run Impeccable context and load the layout playbook**

Run once from the project root:

```powershell
node C:\Users\61\.codex\skills\impeccable\scripts\context.mjs --target index.js
```

Read `reference/layout.md`, inspect the incumbent dialog CSS, then load
`reference/craft-floor.md` immediately before editing UI.

- [ ] **Step 2: Add failing button-order and dialog markup tests**

Assert the API action row contains:

```html
id="st-esg-fetch-models"
id="st-esg-additional-parameters"
```

in that order.

Assert the dialog contains IDs:

```text
st-esg-api-additional-dialog
st-esg-api-include-body
st-esg-api-exclude-body
st-esg-api-include-headers
st-esg-api-additional-cancel
st-esg-api-additional-save
```

- [ ] **Step 3: Add failing atomic-save source assertions**

Assert `showApiAdditionalParametersDialog()`:

- initializes all textareas from saved settings;
- copies textarea values into a draft object;
- calls `parseApiAdditionalParameters(draft, yaml)` before assigning settings;
- assigns all three settings only after validation succeeds;
- keeps the dialog open and renders the error on failure;
- closes without assigning settings on Cancel.

- [ ] **Step 4: Run focused tests and verify RED**

Run:

```powershell
node tests/api-additional-dialog.test.mjs
node tests/component-toggle-markup.test.mjs
```

Expected: failures because the button and dialog do not exist.

- [ ] **Step 5: Add the action button**

Insert `附加参数` immediately after `拉取模型` in the existing API action row,
using the incumbent secondary button class and a sliders icon. Bind it to
`showApiAdditionalParametersDialog`.

- [ ] **Step 6: Implement the modal**

Create a themed native `<dialog>` with:

- title and short YAML guidance;
- three labeled textareas with SillyTavern-compatible examples;
- one error region per textarea;
- Cancel and Save buttons.

On submit:

```js
const draft = {
  additionalBodyYaml: String(includeBody.value || ''),
  excludedBodyYaml: String(excludeBody.value || ''),
  additionalHeadersYaml: String(includeHeaders.value || ''),
};
try {
  parseApiAdditionalParameters(draft, yaml);
  Object.assign(settings, draft);
  markSchemeDirty('api');
  saveSettings();
  dialog.close('save');
} catch (error) {
  renderApiAdditionalParameterError(dialog, error);
  notifyStatus(error.message, 'error');
}
```

Cancel calls `dialog.close('cancel')`; the close handler removes the temporary
dialog from the document.

- [ ] **Step 7: Style and adapt**

Add a dialog style consistent with `.st-esg-scheme-name-dialog`, with:

- width constrained to viewport;
- three vertically stacked textarea sections;
- scrollable content on short screens;
- 36px minimum action controls;
- visible error copy beside the affected textarea;
- mobile rules that keep the dialog centered and textareas usable.

- [ ] **Step 8: Run focused tests and detector**

Run:

```powershell
node tests/api-additional-dialog.test.mjs
node tests/component-toggle-markup.test.mjs
node C:\Users\61\.codex\skills\impeccable\scripts\detect.mjs --json index.js style.css
```

Expected: tests pass and detector returns no unexplained findings.

- [ ] **Step 9: Add the dialog test to `npm test` and commit**

```powershell
git add index.js style.css tests/api-additional-dialog.test.mjs tests/component-toggle-markup.test.mjs package.json
git commit -m "feat: add API parameters dialog"
```

### Task 5: Full verification and publication

**Files:**
- Review: all files changed by Tasks 1-4

**Interfaces:**
- Consumes: completed implementation.
- Produces: verified commits ready for `main`.

- [ ] **Step 1: Run the complete test suite**

Run: `npm.cmd test`

Expected: exit code `0`, including the new parameter and dialog tests.

- [ ] **Step 2: Run syntax and whitespace checks**

Run:

```powershell
npm.cmd run check
git diff --check
```

Expected: both exit with code `0`.

- [ ] **Step 3: Review effective request and privacy behavior**

Inspect the final diff and confirm:

- no fixed `200000` remains in generation or prompt logging;
- no fallback rewrites a user-entered temperature of `0`;
- additional body merge happens before exclusions;
- header YAML values are absent from prompt logs;
- API schemes restore all new fields;
- invalid dialog drafts never partially assign settings.

- [ ] **Step 4: Commit any final verification-only fixes**

If verification required changes, rerun focused and full tests, then commit only
those changes with a scoped message.

- [ ] **Step 5: Push after user-authorized completion**

Push `main` to `origin` only after all checks pass and the user requests or has
clearly authorized publication.
