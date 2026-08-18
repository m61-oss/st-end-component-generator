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
