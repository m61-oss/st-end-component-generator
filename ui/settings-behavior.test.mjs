import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexSource = await readFile(new URL('../index.js', import.meta.url), 'utf8');

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
