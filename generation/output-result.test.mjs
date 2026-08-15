import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeGeneratedResult } from './output-result.js';

test('normalizes JSON thinking and then applies legacy configured block extraction', () => {
  const result = normalizeGeneratedResult(JSON.stringify({
    thinking: 'Phase.0\nPhase.1',
    output: '<thinking>legacy thinking</thinking>正文',
  }), 'thinking');

  assert.equal(result.content, '正文');
  assert.deepEqual(result.thinking, ['Phase.0\nPhase.1', 'legacy thinking']);
  assert.equal(result.mode, 'json');
  assert.equal(result.complete, true);
  assert.equal(result.usable, true);
});

test('keeps legacy non-JSON output compatible with configured tags', () => {
  const result = normalizeGeneratedResult('<thinking>legacy</thinking>正文', 'thinking');

  assert.equal(result.content, '正文');
  assert.deepEqual(result.thinking, ['legacy']);
  assert.equal(result.mode, 'legacy');
  assert.equal(result.usable, true);
});

test('recovers truncated JSON content and marks the envelope incomplete', () => {
  const result = normalizeGeneratedResult('{"thinking":"Phase.0","output":"正文"');

  assert.equal(result.content, '正文');
  assert.deepEqual(result.thinking, ['Phase.0']);
  assert.equal(result.mode, 'loose-json');
  assert.equal(result.complete, false);
  assert.equal(result.usable, true);
});

test('does not mark a protocol-like object without output as injectable output', () => {
  const raw = '{"thinking":"Phase.0","other":"value"}';
  const result = normalizeGeneratedResult(raw);

  assert.equal(result.content, '');
  assert.deepEqual(result.thinking, []);
  assert.equal(result.mode, 'legacy');
  assert.equal(result.usable, false);

  const arbitrary = normalizeGeneratedResult('{"other":"value"}');
  assert.equal(arbitrary.usable, false);
  assert.equal(arbitrary.content, '');
});

test('does not treat the retired content field as the output protocol', () => {
  const result = normalizeGeneratedResult('{"thinking":"Phase.0","content":"旧格式正文"}');

  assert.equal(result.content, '');
  assert.deepEqual(result.thinking, []);
  assert.equal(result.mode, 'legacy');
  assert.equal(result.usable, false);
});

test('returns an empty unusable result for an empty response', () => {
  assert.deepEqual(normalizeGeneratedResult(''), {
    content: '',
    thinking: [],
    mode: 'empty',
    complete: false,
    usable: false,
  });
});

test('does not inject an envelope whose field boundary is ambiguous', () => {
  const result = normalizeGeneratedResult(
    '{"thinking":"thinking mentions, "output":"example", then continues","output":"actual"}',
  );

  assert.equal(result.mode, 'ambiguous-json');
  assert.equal(result.usable, false);
  assert.equal(result.content, '');
});

test('normalizes an anchor insertion plan as structured output', () => {
  const result = normalizeGeneratedResult(JSON.stringify({
    thinking: '先检查正文锚点',
    output: [{ position: 'after', anchor: '原文。', content: '<component>内容</component>' }],
  }));

  assert.equal(result.mode, 'anchor-json');
  assert.equal(result.content, '');
  assert.deepEqual(result.anchorItems, [
    { position: 'after', anchor: '原文。', content: '<component>内容</component>' },
  ]);
  assert.deepEqual(result.thinking, ['先检查正文锚点']);
  assert.equal(result.usable, true);
});

test('keeps recovered loose anchor plans injectable', () => {
  const result = normalizeGeneratedResult('{"thinking":"先定位","output":[{"position":"after","anchor":"原文。","content":"<b style="color:red">内容</b>"}]');

  assert.equal(result.mode, 'anchor-loose-json');
  assert.equal(result.complete, false);
  assert.equal(result.usable, true);
  assert.deepEqual(result.anchorItems, [
    { position: 'after', anchor: '原文。', content: '<b style="color:red">内容</b>' },
  ]);
});
