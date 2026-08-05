import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const renderStart = source.indexOf('function renderPluginPanel()');
const renderEnd = source.indexOf('\nfunction ', renderStart + 10);
const renderFunction = source.slice(renderStart, renderEnd);

assert.match(renderFunction, /\.st-esg-title-text'[\s\S]*?st-esg-version-badge">v\$\{EXTENSION_VERSION\}<\/span>/, 'the panel header should display the existing extension version');
assert.match(renderFunction, /\[data-tab="debug"\] span'\)\?\.replaceChildren\('调试信息'\)/);
assert.match(
  renderFunction,
  /const debugPanel = dialog\.querySelector\('\[data-tab-panel="debug"\]'\);[\s\S]*?debugPanel\?\.insertAdjacentHTML\('afterbegin', '[^']*id="st-esg-generation-log"[^']*'\);/,
  'the generation log should be placed before the existing prompt viewer in the debug panel',
);
assert.doesNotMatch(renderFunction, /workspace\?\.insertAdjacentHTML\('beforeend', '[^']*st-esg-generation-log/);
assert.equal((renderFunction.match(/id="st-esg-generation-log"/g) || []).length, 1);
assert.match(styles, /\.st-esg-version-badge\s*\{/);

console.log('debug UI tests passed');
