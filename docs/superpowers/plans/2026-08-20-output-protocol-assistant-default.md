# Output Protocol Assistant Default Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `assistant` the default role for both output-protocol modes, migrate the current test setting once, and keep reset limited to protocol text.

**Architecture:** Keep role defaults and migration in `index.js`, alongside the existing settings normalization. Keep the existing editor event handlers, removing only the reset-time role assignment. Verify behavior with the existing source-level UI test.

**Tech Stack:** JavaScript ES modules, jQuery DOM events, Node built-in test runner.

## Global Constraints

- Both `standardOutputProtocolRole` and `anchorOutputProtocolRole` default to `assistant`.
- Existing test settings are migrated to `assistant` exactly once.
- After migration, manually selected roles remain persistent.
- Reset restores only the active protocol text.

---

### Task 1: Default Role, One-Time Migration, and Text-Only Reset

**Files:**
- Modify: `index.js`
- Test: `ui/custom-output-protocol.test.mjs`

**Interfaces:**
- Consumes: `DEFAULT_SETTINGS`, `storedSettings`, `getOutputProtocolSettingKeys()`
- Produces: `outputProtocolAssistantDefaultApplied: boolean`

- [ ] **Step 1: Write failing source tests**

Add assertions that both default role values are `assistant`, the missing migration marker sets both roles and the marker, and the reset handler contains no `settings[keys.role]` assignment.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test ui/custom-output-protocol.test.mjs`

Expected: FAIL because defaults and reset still use `system` and no migration marker exists.

- [ ] **Step 3: Implement the minimal settings change**

Change both defaults to `assistant`. During `loadSettings()`, when `outputProtocolAssistantDefaultApplied` is absent, set both role settings and the marker in `settings` and `storedSettings`, then include the migration in the existing debounced-save condition. Remove `settings[keys.role] = 'system';` from the reset handler.

- [ ] **Step 4: Run focused and full verification**

Run: `node --test ui/custom-output-protocol.test.mjs`

Run: `node --check index.js`

Run all tracked `.test.mjs` files through `node --test`.

Expected: all commands exit 0.

- [ ] **Step 5: Commit and push**

Commit message: `default output protocol role to assistant`

Push branch: `codex/message-floor-panel`.
