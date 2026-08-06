# Chat History Range Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add mutually exclusive chat-history range modes so the plugin can either send all unhidden chat messages or send only the latest 10 raw user/assistant messages regardless of hidden state.

**Architecture:** Put selection logic in a small `generation/chat-history-range.js` helper. The prompt builder will use that helper before tag cleanup, while existing worldbook scan depth remains independent. Runtime settings will persist the selected mode and recent-message count and expose them as a radio-card above the existing tag-cleanup card.

**Tech Stack:** ES modules, vanilla DOM/jQuery UI, Node test files with `node:assert`.

## Global Constraints

- Do not bump the extension version.
- Do not change worldbook scan depth or worldbook keyword behavior.
- In recent-message mode, hidden user/assistant messages are included and count toward N.
- System chat entries remain excluded from normal chat history and do not count toward N.
- The default recent-message count is 10.

### Task 1: Add and test chat-history selection helper

**Files:**
- Create: `generation/chat-history-range.js`
- Test: `tests/chat-history-range.test.mjs`
- Modify: `package.json`

- [ ] Write tests for unhidden mode, raw recent mode, role counting, and count normalization.
- [ ] Run the focused test and confirm it fails because the helper is missing.
- [ ] Implement the helper with explicit `visible` and `recent` modes.
- [ ] Run the focused test and confirm it passes.

### Task 2: Thread range settings through prompt construction

**Files:**
- Modify: `generation/prompt-builder.js`
- Test: `tests/prompt-builder.test.mjs`

- [ ] Add tests proving recent mode includes hidden messages, truncates by user/assistant message count, and applies cleanup after truncation.
- [ ] Run the focused tests and confirm the new assertions fail.
- [ ] Pass `historyRangeMode` and `recentMessageCount` through macros, preset prompts, chat-history markers, and the public builder.
- [ ] Run prompt-builder and chat-history tests.

### Task 3: Add persisted settings and mutually exclusive UI

**Files:**
- Modify: `index.js`
- Modify: `style.css`
- Test: `tests/chat-history-range-ui.test.mjs`

- [ ] Add settings defaults and load-time normalization with recent count 10.
- [ ] Add a compact “聊天记录范围” card above “标签清理” with radio inputs and a disabled/enabled count field.
- [ ] Bind changes so exactly one mode is active and settings save immediately.
- [ ] Pass settings into `buildExternalStatusbarMessages`.
- [ ] Add UI/source assertions and run them.

### Task 4: Verify and commit

- [ ] Run `node --check index.js` and `git diff --check`.
- [ ] Run `npm.cmd test`.
- [ ] Commit the branch changes without adding unrelated untracked files.
- [ ] Push `codex/chat-history-range` for user testing.
