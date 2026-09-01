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

test('describes an automatic-generation trigger mismatch without hiding whitespace characters', () => {
  assert.equal(typeof automaticTrigger.describeAutomaticGenerationTriggerMismatch, 'function');

  const details = automaticTrigger.describeAutomaticGenerationTriggerMismatch(
    '正文\r\n</content>\r\n<bbs_end>时间</bbs_end>',
    ' </content>\n',
  );

  assert.match(details, /触发值=" <\/content>\\n"/);
  assert.match(details, /触发长度=12/);
  assert.match(details, /正文长度=37/);
  assert.match(details, /正文末尾="正文\\r\\n<\/content>\\r\\n<bbs_end>时间<\/bbs_end>"/);
});

test('keeps waiting for a configured trigger while the rendered message is still settling', () => {
  assert.equal(typeof automaticTrigger.resolveAutomaticGenerationTriggerState, 'function');
  const resolveState = automaticTrigger.resolveAutomaticGenerationTriggerState;

  assert.equal(resolveState('尚未写完', '</content>', 0, 400), 'waiting');
  assert.equal(resolveState('尚未写完', '</content>', 399, 400), 'waiting');
  assert.equal(resolveState('最终正文\n</content>', '</content>', 10, 400), 'matched');
  assert.equal(resolveState('最终正文仍无标签', '</content>', 400, 400), 'missing');
  assert.equal(resolveState('任意正文', '', 0, 400), 'matched');
});
