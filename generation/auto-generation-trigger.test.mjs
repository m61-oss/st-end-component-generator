import test from 'node:test';
import assert from 'node:assert/strict';

import * as automaticTrigger from './auto-generation-trigger.js';

test('matches a configured automatic-generation trigger as an exact literal substring', () => {
  assert.equal(typeof automaticTrigger.matchesAutomaticGenerationTrigger, 'function');
  const matches = automaticTrigger.matchesAutomaticGenerationTrigger;

  assert.equal(matches('任意正文', ''), true);
  assert.equal(matches('正文\n</content>\n状态', '</content>'), true);
  assert.equal(matches('正文\n</Content>\n状态', '</content>'), false);
  assert.equal(matches('正文\n</content >\n状态', '</content>'), false);
  assert.equal(matches('正文\n</content>\n状态', '</content>\n状'), true);
  assert.equal(matches('正文\n</content>\n状态', '</content>\r\n状'), false);
});
