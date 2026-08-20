import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { FLOOR_PANEL_STATUS, getFloorPanelStatusStage } from './message-floor-panel.js';

const [indexSource, styleSource, manifestText, readmeSource] = await Promise.all([
  readFile(new URL('../index.js', import.meta.url), 'utf8'),
  readFile(new URL('../style.css', import.meta.url), 'utf8'),
  readFile(new URL('../manifest.json', import.meta.url), 'utf8'),
  readFile(new URL('../README.md', import.meta.url), 'utf8'),
]);

test('the injected status uses the requested copy', () => {
  assert.equal(getFloorPanelStatusStage(FLOOR_PANEL_STATUS.INJECTED).text, '内容注入好啦');
});

test('anchor fields grow from one to three lines and leave the remaining card space to content', () => {
  assert.match(indexSource, /function resizeMessageFloorAnchorTextarea\(/);
  assert.match(indexSource, /querySelectorAll\('\[data-floor-anchor-field="anchor"\]'\)\.forEach\(resizeMessageFloorAnchorTextarea\)/);
  assert.match(indexSource, /resizeMessageFloorAnchorTextarea\(field\)/);
  assert.match(
    styleSource,
    /data-floor-anchor-position="before"[^}]*\.st-esg-floor-anchor-fields,[\s\S]*data-floor-anchor-position="after"[^}]*\.st-esg-floor-anchor-fields\s*\{[^}]*grid-template-rows:\s*auto minmax\(0,\s*1fr\)/,
  );
  assert.match(styleSource, /\[data-floor-anchor-field="anchor"\]\s*\{[^}]*min-height:\s*31px[^}]*max-height:\s*72px/s);
});

test('every status moves its copy without horizontal stretching', () => {
  for (const motion of ['dozing', 'weaving', 'ready', 'embedded', 'tangled']) {
    assert.match(
      styleSource,
      new RegExp(`data-floor-stage-motion="${motion}"\\] \\.st-esg-floor-stage-text\\s*\\{[^}]*animation:`),
    );
  }
  assert.doesNotMatch(styleSource, /@keyframes st-esg-floor-copy-[^{]+\{[^}]*scaleX/s);
});

test('status glints and copy glow use floor theme colors at subdued opacity', () => {
  assert.match(styleSource, /\.st-esg-floor-stage::before,\s*\.st-esg-floor-stage::after\s*\{[^}]*background:\s*currentColor[^}]*box-shadow:[^}]*var\(--floor-accent\)[^}]*opacity:\s*0/s);
  assert.match(styleSource, /\.st-esg-floor-stage-text\s*\{[^}]*text-shadow:[^}]*var\(--floor-accent\)/s);
  assert.match(styleSource, /prefers-reduced-motion:[\s\S]*\.st-esg-floor-stage::before,[\s\S]*\.st-esg-floor-stage::after/);
});

test('public runtime copy no longer describes the product as end-only', () => {
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.display_name, '织幕·组件生成器');
  assert.doesNotMatch(indexSource, /文尾/);
  assert.doesNotMatch(manifestText, /文尾/);
  assert.doesNotMatch(readmeSource, /文尾/);
});
