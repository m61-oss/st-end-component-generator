# Repository File Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move existing root-level JavaScript modules into responsibility-based folders without changing plugin behavior.

**Architecture:** Keep SillyTavern entry files and project metadata at the repository root. Move helper modules into `api/`, `generation/`, `sources/`, `ui/`, `settings/`, and `injection/`, then update browser imports, module-to-module imports, tests, and source-reading checks.

**Tech Stack:** Browser-native ES modules, Node.js ES module tests, npm scripts, SillyTavern extension manifest.

## Global Constraints

- Keep `index.js`, `style.css`, `manifest.json`, `package.json`, `README.md`, and `LICENSE` at the repository root.
- Do not change business logic, UI behavior, module filenames, dependencies, tests, or documentation content.
- Preserve `?ver=0.1.0` on browser imports in `index.js`.
- Keep `tests/` and `docs/` in their current locations.

---

### Task 1: Define and apply the classified source layout

**Files:**
- Create: `tests/repository-layout.test.mjs`
- Modify: `package.json`
- Modify: `index.js`
- Modify: imports and source-reading paths under `tests/`
- Move: root helper modules into `api/`, `generation/`, `sources/`, `ui/`, `settings/`, and `injection/`

**Interfaces:**
- Consumes: Existing named exports from every helper module.
- Produces: The same named exports at their new classified paths; no runtime API changes.

- [ ] **Step 1: Write the failing layout test**

Create a test that asserts every planned destination exists, every old root-level module path is absent, and all required root entry/configuration files remain.

- [ ] **Step 2: Run the layout test to verify it fails**

Run: `node tests/repository-layout.test.mjs`

Expected: FAIL because files still exist at the repository root and do not yet exist in classified folders.

- [ ] **Step 3: Move modules and update imports**

Move files according to the approved design. Update:

- Browser imports in `index.js`
- Cross-module imports in `generation/prompt-builder.js`
- Test module imports
- Tests that read source files directly
- The `npm test` script to include the layout test

- [ ] **Step 4: Run focused structure and syntax checks**

Run:

```powershell
node tests/repository-layout.test.mjs
npm.cmd run check
```

Expected: both commands exit with code 0.

- [ ] **Step 5: Run full regression verification**

Run:

```powershell
npm.cmd test
git diff --check
```

Expected: all tests pass and `git diff --check` reports no errors.

- [ ] **Step 6: Commit and push**

Stage only the classification changes and plan, excluding `.codex-remote-attachments/`.

Commit message:

```text
refactor: organize source modules by responsibility
```

Push the resulting commit to `origin/main`.
