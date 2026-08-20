# Floor Panel Motion and Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make anchor cards space-efficient, replace rigid status motion with themed authored animation, and remove obsolete end-of-message wording.

**Architecture:** Keep fixed card shells and resize only anchor textareas within one-to-three-line bounds. Express status identity through scoped CSS keyframes and theme tokens, while retaining the existing state model and reduced-motion path. Update user-facing copy without changing stable technical identifiers.

**Tech Stack:** JavaScript ES modules, CSS keyframes and custom properties, Node test runner.

## Global Constraints

- Do not change generation, parsing, matching, or injection behavior.
- Keep before/after card outer height fixed at 216px.
- Use existing floor theme tokens for all glow color.
- Preserve `prefers-reduced-motion` support.

---

### Task 1: Write failing UI contract tests

**Files:**
- Modify: `ui/message-floor-panel-ui.test.mjs`
- Modify: `ui/message-floor-panel.test.mjs`
- Modify: `ui/version-consistency.test.mjs`

- [ ] Assert compact one-to-three-line anchor sizing and content-area remainder layout.
- [ ] Assert every status text has motion and the stage owns theme-colored glints.
- [ ] Assert the injected copy is “内容注入好啦” and public product copy contains no obsolete wording.
- [ ] Run focused tests and confirm failure on the current implementation.

### Task 2: Implement anchor sizing and motion

**Files:**
- Modify: `index.js`
- Modify: `style.css`
- Modify: `ui/message-floor-panel.js`

- [ ] Add bounded anchor textarea resizing on render and edit.
- [ ] Change before/after field tracks to compact anchor plus flexible content.
- [ ] Replace horizontal-heavy keyframes with state-specific text movement and bounded glints.
- [ ] Extend reduced-motion rules to stage pseudo-elements.
- [ ] Run focused tests and confirm they pass.

### Task 3: Update product copy

**Files:**
- Modify: `index.js`
- Modify: `manifest.json`
- Modify: `README.md`
- Modify: affected tests.

- [ ] Replace product-level “文尾” terms with “组件”, “注入回复”, or semantic “文末”.
- [ ] Keep extension IDs, repository paths and protocol field names unchanged.
- [ ] Run copy and version consistency tests.

### Task 4: Verify and deliver

**Files:**
- Verify all tracked test files plus new tests.

- [ ] Run all tests, syntax checks, `git diff --check`, and the Impeccable detector.
- [ ] Commit only scoped files.
- [ ] Push `codex/message-floor-panel` and verify the remote hash.
