import test from 'node:test';
import assert from 'node:assert/strict';

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
