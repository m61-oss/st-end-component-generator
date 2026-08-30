import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [indexSource, styleSource] = await Promise.all([
  readFile(new URL('../index.js', import.meta.url), 'utf8'),
  readFile(new URL('../style.css', import.meta.url), 'utf8'),
]);

test('memory settings present BaiBai Book and Anima as independent grouped checkboxes', () => {
  const memoryMarkup = indexSource.match(/memorySettings\.innerHTML = ([\s\S]*?);\r?\n/)?.[0] || '';

  assert.match(memoryMarkup, /st-esg-memory-source-group/);
  assert.match(memoryMarkup, />柏宝书</);
  assert.match(memoryMarkup, />Anima</);
  assert.doesNotMatch(memoryMarkup, /type="radio"|st-esg-memory-source-none|name="st-esg-memory-source"/);
  assert.match(styleSource, /\.st-esg-memory-source-group\s*\{/);
});

test('legacy mutually exclusive settings migrate once without activating hidden choices', () => {
  assert.match(indexSource, /combinedMemorySourcesMigrated:\s*false/);
  assert.match(indexSource, /if \(settings\.combinedMemorySourcesMigrated !== true\)/);
  assert.match(indexSource, /settings\.memorySource !== 'baibai'[\s\S]*baiBaiBookHistoryEnabled = false[\s\S]*baiBaiBookStateEnabled = false/);
  assert.match(indexSource, /settings\.memorySource !== 'anima'[\s\S]*animaWorldbookEnabled = false[\s\S]*animaStatusVariableEnabled = false/);
  assert.match(indexSource, /settings\.combinedMemorySourcesMigrated = true/);
  assert.match(indexSource, /Object\.assign\(storedSettings, \{[\s\S]*combinedMemorySourcesMigrated: true[\s\S]*\}\)/);
});

test('generation includes every checked memory capability without a source-mode gate', () => {
  assert.match(indexSource, /function isAnimaMemoryEnabled\(\)\s*\{\s*return settings\.animaWorldbookEnabled \|\| settings\.animaStatusVariableEnabled;/);
  assert.match(indexSource, /function isAnimaWorldbookEnabled\(\)\s*\{\s*return settings\.animaWorldbookEnabled === true;/);
  assert.match(indexSource, /function isAnimaStatusVariableEnabled\(\)\s*\{\s*return settings\.animaStatusVariableEnabled === true;/);
  assert.match(indexSource, /baiBaiBook:\s*sourceSettings\.baiBaiBookHistoryEnabled \|\| sourceSettings\.baiBaiBookStateEnabled \?\s*\{/);
  assert.doesNotMatch(indexSource, /settings\.memorySource === 'baibai' \?/);
});

test('disabling Anima worldbook capture immediately clears its snapshot', () => {
  const handler = indexSource.match(/\$t\('#st-esg-anima-worldbook-enabled'\)\.on\('change',[\s\S]*?\n\s*\}\);/)?.[0] || '';

  assert.match(handler, /if \(!settings\.animaWorldbookEnabled\) clearAnimaWorldbookSnapshot\(\)/);
  assert.doesNotMatch(handler, /&& !settings\.animaStatusVariableEnabled/);
});
