import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [indexSource, styleSource] = await Promise.all([
  readFile(new URL('../index.js', import.meta.url), 'utf8'),
  readFile(new URL('../style.css', import.meta.url), 'utf8'),
]);

test('initial panel focus lands on the dialog without disabling keyboard focus rings', () => {
  const renderPanel = indexSource.match(/function renderPluginPanel\(\)[\s\S]*?\n\}/)?.[0] || '';
  const togglePanel = indexSource.match(/function togglePanel\(forceOpen\)[\s\S]*?\n\}/)?.[0] || '';

  assert.match(renderPanel, /dialog\.tabIndex = -1/);
  assert.match(togglePanel, /dialog\.show\(\);[\s\S]*dialog\.focus\(\{ preventScroll: true \}\)/);
  assert.match(styleSource, /\.st-esg-dialog:focus\s*\{[^}]*outline:\s*none/s);
  assert.match(styleSource, /\.st-esg-dialog \.st-esg-header-btn:focus-visible[^}]*outline:\s*2px solid/s);
});
