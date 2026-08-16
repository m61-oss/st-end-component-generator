import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { getGenerationInjectionModeHelp, normalizeGenerationInjectionMode } from './generation-settings.js';

test('returns only the explanation for the selected injection mode', () => {
  const replace = getGenerationInjectionModeHelp('replace');
  const append = getGenerationInjectionModeHelp('append');
  const anchor = getGenerationInjectionModeHelp('anchor');

  assert.equal(replace.mode, 'replace');
  assert.match(replace.text, /覆盖模式/);
  assert.doesNotMatch(replace.text, /锚点模式/);
  assert.match(append.text, /追加模式/);
  assert.doesNotMatch(append.text, /覆盖模式|锚点模式/);
  assert.match(anchor.text, /锚点模式/);
  assert.doesNotMatch(anchor.text, /覆盖模式|追加模式/);
});

test('falls back to replace for an unknown injection mode', () => {
  assert.equal(normalizeGenerationInjectionMode('unknown'), 'replace');
  assert.equal(getGenerationInjectionModeHelp('unknown').mode, 'replace');
});

test('renders a persisted automatic-generation trigger input only with automatic generation', async () => {
  const indexSource = await readFile(new URL('../index.js', import.meta.url), 'utf8');

  assert.match(indexSource, /automaticGenerationTriggerText:\s*''/);
  assert.match(indexSource, /id="st-esg-auto-generate-trigger-row"/);
  assert.match(indexSource, /id="st-esg-auto-generate-trigger"/);
  assert.match(indexSource, /#st-esg-auto-generate-trigger-row[^\n]+toggleClass\('st-esg-hidden',\s*!settings\.autoGenerate\)/);
  assert.match(indexSource, /#st-esg-auto-generate-trigger'\)\.on\('input'/);
});
