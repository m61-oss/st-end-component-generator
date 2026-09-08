import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  THEME_MODE_DARK,
  THEME_MODE_LIGHT,
  THEME_MODE_TAVERN,
  getThemeClassName,
  getThemePresentation,
  nextThemeMode,
  normalizeThemeMode,
} from './theme-mode.js';

test('normalizes all three theme modes without changing existing preferences', () => {
  assert.equal(normalizeThemeMode('dark'), THEME_MODE_DARK);
  assert.equal(normalizeThemeMode('light'), THEME_MODE_LIGHT);
  assert.equal(normalizeThemeMode('tavern'), THEME_MODE_TAVERN);
  assert.equal(normalizeThemeMode('unknown'), THEME_MODE_DARK);
});

test('cycles from dark to light to tavern and back to dark', () => {
  assert.equal(nextThemeMode(THEME_MODE_DARK), THEME_MODE_LIGHT);
  assert.equal(nextThemeMode(THEME_MODE_LIGHT), THEME_MODE_TAVERN);
  assert.equal(nextThemeMode(THEME_MODE_TAVERN), THEME_MODE_DARK);
});

test('provides a class, icon and accessible label for tavern-following mode', () => {
  assert.equal(getThemeClassName(THEME_MODE_TAVERN), 'st-esg-theme-tavern');
  assert.deepEqual(getThemePresentation(THEME_MODE_TAVERN), {
    icon: 'fa-palette',
    badgeIcon: 'fa-arrows-rotate',
    label: '跟随酒馆',
  });
});

test('integrates tavern theme tokens with every extension surface', async () => {
  const [indexSource, styleSource] = await Promise.all([
    readFile(new URL('../index.js', import.meta.url), 'utf8'),
    readFile(new URL('../style.css', import.meta.url), 'utf8'),
  ]);

  assert.match(indexSource, /nextThemeMode\(settings\.theme\)/);
  assert.match(indexSource, /getThemeClassName\(settings\.theme\)/);
  assert.doesNotMatch(indexSource, /settings\.theme === 'light' \? 'light' : 'dark'/);
  assert.match(styleSource, /\.st-esg-theme-tavern\s*\{/);
  assert.match(styleSource, /--esg-text-main:\s*var\(--SmartThemeBodyColor/);
  assert.match(styleSource, /--esg-border:\s*var\(--SmartThemeBorderColor/);
  assert.match(styleSource, /--esg-primary:\s*var\(--SmartThemeQuoteColor/);
  assert.match(styleSource, /--esg-tavern-glass-guard:\s*color-mix\(/);
  assert.match(styleSource, /--esg-tavern-backdrop-filter:\s*blur\(16px\) saturate\(1\.05\)/);
  assert.match(styleSource, /\.st-esg-theme-tavern\s+\.st-esg-shell/);
  assert.match(styleSource, /\.st-esg-theme-tavern\.st-esg-anchor-preview-dialog/);
  assert.match(styleSource, /--st-esg-ball-surface-bottom:\s*color-mix\([^;]+--SmartThemeBodyColor/);
  assert.match(styleSource, /\.st-esg-theme-glyph-badge/);
  assert.match(indexSource, /presentation\.badgeIcon/);
});

test('tavern-following dialogs force inherited translucent colors to opaque surfaces', async () => {
  const styleSource = await readFile(new URL('../style.css', import.meta.url), 'utf8');

  assert.match(styleSource, /@supports \(color:\s*rgb\(from #000 r g b \/ 1\)\)/);
  assert.match(styleSource, /--esg-tavern-bg-main-opaque:\s*rgb\(from var\(--esg-bg-main\) r g b \/ 1\)/);
  assert.match(styleSource, /--esg-tavern-bg-card-opaque:\s*rgb\(from var\(--esg-bg-card\) r g b \/ 1\)/);
  assert.match(styleSource, /\.st-esg-theme-tavern \.st-esg-shell,[\s\S]*?\.st-esg-data-management-dialog\.st-esg-theme-tavern \.st-esg-data-dialog-shell[\s\S]*?var\(--esg-tavern-bg-main-opaque\)\s*!important;/);
  assert.match(styleSource, /\.st-esg-theme-tavern\.st-esg-anchor-preview-dialog,[\s\S]*?\.st-esg-theme-tavern\.st-esg-api-additional-dialog[\s\S]*?var\(--esg-tavern-bg-card-opaque\)\s*!important;/);
});

test('extension-owned buttons isolate decorative styles from tavern beautifications', async () => {
  const styleSource = await readFile(new URL('../style.css', import.meta.url), 'utf8');

  assert.match(styleSource, /:is\(#st-esg-dialog,\s*\.st-esg-scheme-name-dialog,\s*\.st-esg-anchor-preview-dialog,\s*\.st-esg-api-additional-dialog,\s*\.st-esg-data-management-dialog,\s*\.st-esg-message-floor-panel\)\s*:where\(button,\s*\.menu_button,\s*\[role="button"\]\)/);
  assert.match(styleSource, /appearance:\s*none\s*!important;/);
  assert.match(styleSource, /background-image:\s*none\s*!important;/);
  assert.match(styleSource, /border-image:\s*none\s*!important;/);
  assert.match(styleSource, /box-shadow:\s*none\s*!important;/);
  assert.match(styleSource, /text-shadow:\s*none\s*!important;/);
  assert.match(styleSource, /(?:-webkit-)?backdrop-filter:\s*none\s*!important;/);
  assert.match(styleSource, /filter:\s*none\s*!important;/);
  assert.match(styleSource, /text-transform:\s*none\s*!important;/);
  assert.match(styleSource, /letter-spacing:\s*normal\s*!important;/);
});

test('magic-wand entry allows external menu cleaners to hide it', async () => {
  const styleSource = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  const menuButtonRule = styleSource.match(/#st-esg-menu-button\s*\{([^}]*)\}/);

  assert.ok(menuButtonRule, 'expected a style rule for the magic-wand entry');
  assert.match(menuButtonRule[1], /display:\s*flex\s*;/);
  assert.doesNotMatch(menuButtonRule[1], /display:\s*flex\s*!important/);
});

test('non-button actions, icons, code hints, and placeholders keep plugin styling', async () => {
  const styleSource = await readFile(new URL('../style.css', import.meta.url), 'utf8');

  assert.match(styleSource, /:where\(button,\s*\.menu_button,\s*\[role="button"\]\)/);
  assert.match(styleSource, /:where\(button,\s*\.menu_button,\s*\[role="button"\]\)\s*>\s*:where\(i,\s*\.fa-solid,\s*\.fa-regular\)/);
  assert.match(styleSource, /\.menu_button::before,[\s\S]*?\.menu_button\s*>\s*:where\(i,\s*\.fa-solid,\s*\.fa-regular\)::before[\s\S]*?background:\s*transparent\s*!important;[\s\S]*?text-shadow:\s*none\s*!important;/);
  assert.match(styleSource, /\.menu_button\s*>\s*span:not\(\.st-esg-worldbook-switch-thumb\)\s*\{[\s\S]*?color:\s*inherit\s*!important;/);
  assert.match(styleSource, /#st-esg-close\s*\{[\s\S]*?color:\s*var\(--esg-text-main\)\s*!important;[\s\S]*?background:\s*transparent\s*!important;/);
  assert.match(styleSource, /#st-esg-dialog\s*:where\(input,\s*textarea\)::placeholder\s*\{[\s\S]*?color:\s*var\(--esg-text-muted\)\s*!important;[\s\S]*?opacity:\s*1\s*!important;/);
  assert.match(styleSource, /\.st-esg-task-components-help\s*\{[\s\S]*?color:\s*var\(--esg-text-muted\)\s*!important;/);
  assert.match(styleSource, /\.st-esg-task-components-help code\s*\{[\s\S]*?color:\s*var\(--esg-text-main\)\s*!important;[\s\S]*?background:\s*transparent\s*!important;[\s\S]*?font-size:\s*inherit\s*!important;/);
  assert.match(styleSource, /\.st-esg-tag-rule-item code\s*\{[\s\S]*?color:\s*var\(--esg-text-muted\)\s*!important;[\s\S]*?background:\s*transparent\s*!important;[\s\S]*?font-size:\s*10px\s*!important;/);
});
