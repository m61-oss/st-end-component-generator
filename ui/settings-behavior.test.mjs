import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexSource = await readFile(new URL('../index.js', import.meta.url), 'utf8');
const styleSource = await readFile(new URL('../style.css', import.meta.url), 'utf8');

function functionSource(name, nextName) {
  const start = indexSource.indexOf(`function ${name}`);
  const requestedEnd = nextName ? indexSource.indexOf(`function ${nextName}`, start) : -1;
  const end = requestedEnd > start ? requestedEnd : indexSource.length;
  return indexSource.slice(start, end);
}

test('source import uses the edited content shown in the source preview', () => {
  const source = functionSource('importCheckedCandidates', 'createGenerationSettingsDialog');
  assert.match(source, /const content = getSourceContentValue\(item\)/);
  assert.match(source, /importedComponent = \{[^}]*content/s);
  assert.match(source, /theaterComponents\.push\(\{[^}]*content/s);
  assert.doesNotMatch(source, /content:\s*item\.content/);
});

test('source import chooses a valid target group for both component libraries', () => {
  assert.match(indexSource, /st-esg-import-target-group/);
  assert.match(indexSource, /st-esg-worldbook-import-target-group/);
  assert.match(indexSource, /function renderImportTargetGroupOptions/);
  assert.match(indexSource, /#st-esg-import-target-library, #st-esg-worldbook-import-target-library[\s\S]*#st-esg-import-target-scope, #st-esg-worldbook-import-target-scope/);
  const targetSource = functionSource('getImportTarget', 'resetComponentEditMode');
  assert.match(targetSource, /groupId/);
  const importSource = functionSource('importCheckedCandidates', 'buildPluginPanelMarkup');
  assert.match(importSource, /groupId:\s*targetGroupId/);
  assert.match(styleSource, /\.st-esg-import-target-container\s*\{[^}]*flex-wrap:\s*wrap;/s);
});

test('preset deletion confirmation warns that bound components are removed too', () => {
  const source = functionSource('handleSchemeAction', 'loadGenerationHistoryEntry');
  assert.match(source, /boundComponentCount/);
  assert.match(source, /绑定组件/);
  assert.match(source, /一并删除/);
});

test('component editor delegation is cleared before each list rebind', () => {
  const off = indexSource.indexOf("list.off('.stEsgComponentEditor')");
  const on = indexSource.indexOf("list.on('click.stEsgComponentEditor'");
  assert.ok(off >= 0, 'component editor handlers must be cleared');
  assert.ok(on > off, 'component editor handlers must be cleared before rebinding');
});

test('markSchemeDirty callers do not immediately save the same settings twice', () => {
  assert.doesNotMatch(indexSource, /markSchemeDirty\([^\n]+\);\s*\r?\n\s*saveSettings\(\);/);
});

test('preset selection and export controls share one compact row', () => {
  assert.match(indexSource, /st-esg-preset-select-row/);
  assert.match(indexSource, /st-esg-preset-select-field/);
  assert.match(indexSource, /insertAdjacentHTML\('beforeend',[^\n]+id="st-esg-export-current-preset"/);
  assert.match(styleSource, /\.st-esg-preset-select-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;/s);
  assert.match(styleSource, /\.st-esg-preset-select-field\s*\{[^}]*grid-template-columns:\s*auto\s+minmax\(0,\s*1fr\);/s);
});

test('runtime data management entry is a single row without duplicate description', () => {
  assert.match(indexSource, /st-esg-data-entry-card"><strong>数据管理<\/strong><button/);
  assert.doesNotMatch(indexSource, /查看插件占用，清空整类数据，或处理隐藏归属记录。/);
  assert.doesNotMatch(styleSource, /\.st-esg-data-entry-card\s*\{[^}]*flex-direction:\s*column;/s);
});

test('detailed data management content uses compact typography', () => {
  assert.match(styleSource, /\.st-esg-data-details\s*\{[^}]*font-size:\s*12px;/s);
});
