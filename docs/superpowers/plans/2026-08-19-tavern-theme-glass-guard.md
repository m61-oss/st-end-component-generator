# Tavern Theme Glass Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the Tavern-following theme readable when host background colors are transparent and replace its ambiguous icon with a palette plus synchronization badge.

**Architecture:** Extend the existing theme presentation object with an optional badge icon, then render the header glyph from that presentation. Add Tavern-only glass tokens and apply them only to extension-owned top-level shells; keep inner cards on the existing color tokens and avoid observers or repeated rendering.

**Tech Stack:** JavaScript ES modules, CSS custom properties, Font Awesome, Node.js test runner.

## Global Constraints

- Only the `tavern` theme receives the new glass guard; dark and light remain unchanged.
- Use a `16px` backdrop blur and a low-opacity guard derived from `--SmartThemeBodyColor`.
- Do not add MutationObserver, timers, or theme polling.
- Keep the theme cycle and persisted values unchanged.

---

### Task 1: Guard transparent host themes and clarify the theme glyph

**Files:**
- Modify: `ui/theme-mode.test.mjs`
- Modify: `ui/theme-mode.js`
- Modify: `index.js`
- Modify: `style.css`

**Interfaces:**
- Consumes: `getThemePresentation(theme: string)` and existing `.st-esg-theme-tavern` classes.
- Produces: `getThemePresentation('tavern') -> { icon: 'fa-palette', badgeIcon: 'fa-arrows-rotate', label: '跟随酒馆' }` and Tavern-only glass CSS tokens.

- [x] **Step 1: Write the failing tests**

Update the Tavern presentation assertion to require `fa-palette` and `fa-arrows-rotate`. Add static assertions for `--esg-tavern-glass-guard`, `--esg-tavern-backdrop-filter: blur(16px)`, `.st-esg-theme-glyph-badge`, Tavern top-level shell selectors, and a guarded floating-ball bottom surface.

- [x] **Step 2: Run the focused test and verify RED**

Run: `node --test ui/theme-mode.test.mjs`

Expected: FAIL because the presentation still returns `fa-circle-half-stroke` and the glass selectors do not exist.

- [x] **Step 3: Implement the presentation and icon rendering**

Return the compound Tavern presentation from `ui/theme-mode.js`. In `applyTheme()`, replace the toggle contents with a `.st-esg-theme-glyph` containing the main icon and optional `.st-esg-theme-glyph-badge`. Update the initial toggle markup to use the same glyph wrapper.

- [x] **Step 4: Implement the Tavern-only glass guard**

Define:

```css
--esg-tavern-glass-guard: color-mix(in srgb, var(--SmartThemeBodyColor, #E0E0E0) 12%, transparent);
--esg-tavern-backdrop-filter: blur(16px) saturate(1.05);
```

Layer the guard over the existing background on `.st-esg-shell`, `.st-esg-data-dialog-shell`, `.st-esg-anchor-preview-dialog`, `.st-esg-scheme-name-dialog`, and `.st-esg-api-additional-dialog` only in Tavern mode. Apply the backdrop filter to those top-level surfaces. Make both Tavern floating-ball surface colors mix an opaque body-color share into the host surface.

- [x] **Step 5: Run focused and complete verification**

Run:

```powershell
node --test ui/theme-mode.test.mjs
$testFiles = @(rg --files -g '*.test.mjs' -g '!database-source-temp/**' -g '!database-source-temp2/**' -g '!.superpowers/**' -g '!.codex-remote-attachments/**'); node --test $testFiles
node --check index.js
git diff --check
```

Expected: all tests pass, syntax check exits `0`, and Git reports no whitespace errors.

- [x] **Step 6: Commit and push**

Stage only `index.js`, `style.css`, `ui/theme-mode.js`, `ui/theme-mode.test.mjs`, the approved design, and this plan. Commit with `Harden Tavern-following theme` and push `codex/theater-group-random`.
