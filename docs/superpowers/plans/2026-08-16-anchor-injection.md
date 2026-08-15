# 自定义锚点插入功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变现有文尾追加和同名标签覆盖行为的前提下，新增支持多点、任意字符位置、默认独占一行的自定义锚点插入模式，并把撤回选项从注入方式中独立出来。

**Architecture:** 旧字符串输出协议继续服务追加/覆盖模式；锚点模式使用同一外层 JSON，但 `output` 为插入项数组。锚点解析、原文定位和换行插入分别放在独立模块，主页面只负责选择模式、展示结果和调用注入器。撤回设置单独保存为布尔值，生成开始时执行一次。

**Tech Stack:** 原生 JavaScript ES modules、Node `node:test`、SillyTavern DOM/jQuery 事件、现有消息保存和撤回快照接口。

## Global Constraints

- 旧 `append`、`replace` 模式的结果格式和注入行为保持兼容。
- 旧 `rollbackAppend`、`rollbackReplace` 配置必须迁移为“撤回开关 + 追加/覆盖方式”。
- 锚点只允许定位本次目标 assistant 回复；无法唯一定位的项目单独跳过。
- 锚点插入内容默认独占一行，使用目标正文现有的换行风格。
- 不引入第三方依赖，不修改主分支，不把工作区未跟踪资料加入提交。

---

### Task 1: 锚点输出协议与数据验证

**Files:**
- Create: `generation/anchor-output-protocol.js`
- Test: `generation/anchor-output-protocol.test.mjs`
- Modify: `generation/output-protocol.js` only when extracting the shared outer envelope is required

**Interfaces:**
- `parseAnchorOutput(rawText) -> { mode: 'anchor-json', items, thinking, complete, warnings } | null`
- `isAnchorInsertionItem(value) -> boolean`
- `normalizeAnchorInsertionItem(value) -> { position, anchor, content } | null`

- [ ] **Step 1: Write failing tests** for strict arrays, empty arrays, invalid positions, missing fields, duplicate items, malformed final item, and preserved item order.
- [ ] **Step 2: Run `node --test generation/anchor-output-protocol.test.mjs`** and confirm the new tests fail because the module does not exist.
- [ ] **Step 3: Implement strict parsing first.** Accept only an outer object whose `thinking` is a string and whose `output` is an array. Accept only `position` values `before` and `after`; trim only anchor boundary whitespace and reject empty anchors/content.
- [ ] **Step 4: Add conservative recovery.** Recover only complete array objects with the required fields; mark an incomplete final object as skipped and add a warning instead of guessing its boundary.
- [ ] **Step 5: Run the focused tests again** and require all protocol tests to pass.
- [ ] **Step 6: Run existing output protocol tests** to prove string `output` parsing remains unchanged.

### Task 2: Pure anchor locator and block-line insertion

**Files:**
- Create: `injection/anchor-insertion.js`
- Test: `injection/anchor-insertion.test.mjs`

**Interfaces:**
- `locateAnchorInsertions(messageText, items) -> { resolved, skipped }`
- `applyAnchorInsertions(messageText, items, options) -> { text, applied, skipped }`

- [ ] **Step 1: Write failing tests** for unique `before`, unique `after`, duplicate anchors, missing anchors, middle-of-sentence insertion, paragraph-boundary insertion, CRLF text, multiple locations, same-location ordering, and overlapping locations.
- [ ] **Step 2: Run the focused test file** and verify failure before implementation.
- [ ] **Step 3: Implement exact matching against the original message.** `before` inserts at the anchor start; `after` inserts at the anchor end. Require exactly one occurrence per item.
- [ ] **Step 4: Implement newline normalization.** Detect the first existing line ending, trim only outer line breaks from inserted content, and add a line boundary before and after the content while preserving existing following paragraph breaks.
- [ ] **Step 5: Resolve every operation before mutating text.** Sort by descending offset; for equal offsets sort by reverse item index so the final document keeps the model’s array order. Skip overlapping ranges and report reasons.
- [ ] **Step 6: Run focused insertion tests and then `node --test injection/*.test.mjs`**.

### Task 3: Separate rollback setting and migrate old modes

**Files:**
- Modify: `index.js` settings defaults, normalization, generation entry, injection settings markup, and event handlers
- Test: `generation/injection-settings.test.mjs` if the existing settings helpers can be isolated; otherwise add pure migration helpers to `generation/injection-settings.js` and test them there

**Interfaces:**
- `normalizeInjectionSettings(settings) -> settings` with `injectMode: 'append' | 'replace' | 'anchor'` and `rollbackBeforeGeneration: boolean`
- Legacy mapping: `rollbackAppend -> append + true`, `rollbackReplace -> replace + true`, `append/replace -> same mode + false`.

- [ ] **Step 1: Write failing migration tests** for all four legacy values and for new settings.
- [ ] **Step 2: Run the migration tests** and confirm failure.
- [ ] **Step 3: Implement migration and defaults.** Remove `rollbackAppend`/`rollbackReplace` as active choices while accepting them during load.
- [ ] **Step 4: Update the settings markup** to show one checkbox labeled `生成前撤回本楼上次注入` and one select containing `追加到文尾`, `覆盖同名标签`, and `自定义锚点插入`.
- [ ] **Step 5: Keep rollback at generation start only.** Remove the second rollback branch from direct injection; preserve the standalone manual `撤回注入` button.
- [ ] **Step 6: Run all settings and generation tests** and verify old settings load into equivalent behavior.

### Task 4: Integrate anchor generation and injection

**Files:**
- Modify: `index.js` generation result state, `applyGeneratedResult`, `generateStatusbar`, `injectGeneratedStatusbar`, message save path, and undo snapshot path
- Modify: `generation/output-result.js` and its tests to preserve an anchor payload without serializing it into normal content

**Interfaces:**
- Normalized result adds `mode: 'anchor-json'`, `anchorItems`, and `usable` while preserving existing string result fields.
- `injectGeneratedStatusbar` dispatches to `applyAnchorInsertions` only when `settings.injectMode === 'anchor'`.

- [ ] **Step 1: Write failing integration tests** for anchor result normalization, partial item skips, no-op when all items fail, snapshot creation only when an item succeeds, and unchanged append/replace paths.
- [ ] **Step 2: Run tests and verify expected failures.**
- [ ] **Step 3: Preserve structured anchor items** in memory and generation history; keep `settings.lastGenerated` empty for anchor mode so old string injection cannot consume the array.
- [ ] **Step 4: Add mode dispatch.** Existing string modes continue through `injectStatusbarText`; anchor mode uses the new pure insertion executor and then existing placeholder/MVU/save handling.
- [ ] **Step 5: Add result reporting.** Show applied/skipped counts and per-item skip reasons; do not alter the message when no item resolves.
- [ ] **Step 6: Run the integration tests and all existing generation/injection tests.**

### Task 5: Anchor-mode preview and manual editing

**Files:**
- Modify: `index.js` generation markup, render/update functions, generation history loading, and injection button guards
- Modify: `style.css` for compact anchor item cards and status badges

**Interfaces:**
- `renderAnchorItems(items, statuses)` renders one editable card per item.
- `readAnchorItemsFromPanel() -> items` reads user edits before manual injection.

- [ ] **Step 1: Write focused DOM/helper tests where existing test infrastructure permits** for mode switching, empty plans, editable item values, and invalid item disabling.
- [ ] **Step 2: Implement mode-aware preview.** Keep the existing textarea for append/replace; use anchor cards for anchor mode with direction, anchor, content, and status.
- [ ] **Step 3: Preserve array order in the preview** and disable injection when no valid item remains.
- [ ] **Step 4: Make mode switching invalidate incompatible cached generated results** instead of treating an anchor array as plain text.
- [ ] **Step 5: Run syntax checks and the full Node test suite.**

### Task 6: First-pass anchor prompt and final verification

**Files:**
- Modify: `generation/output-protocol.js` or a mode-specific prompt builder location used when `injectMode === 'anchor'`
- Modify: `generation/prompt-builder.js` only to pass the selected output mode and identify the current assistant target
- Test: `generation/prompt-builder.test.mjs` and anchor protocol tests

- [ ] **Step 1: Add the first-pass mode-specific prompt** explaining that `output` is a variable-length insertion plan, that `before`/`after` must be chosen semantically, that anchors come only from the current assistant reply, and that invalid locations should be omitted.
- [ ] **Step 2: Add prompt tests** ensuring anchor mode includes the array schema and normal modes do not receive it.
- [ ] **Step 3: Run `node --test generation/*.test.mjs api/*.test.mjs injection/*.test.mjs`.
- [ ] **Step 4: Run `node --check index.js` and `git diff --check`.
- [ ] **Step 5: Inspect the staged file list, commit only feature files, and push the feature branch.**

