import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeGeneratedResult } from './output-result.js';

test('normalizes JSON thinking and then applies legacy configured block extraction', () => {
  const result = normalizeGeneratedResult(JSON.stringify({
    thinking: 'Phase.0\nPhase.1',
    content: '<thinking>legacy thinking</thinking>正文',
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
  const result = normalizeGeneratedResult('{"thinking":"Phase.0","content":"正文"');

  assert.equal(result.content, '正文');
  assert.deepEqual(result.thinking, ['Phase.0']);
  assert.equal(result.mode, 'loose-json');
  assert.equal(result.complete, false);
  assert.equal(result.usable, true);
});

test('does not mark a protocol-like object without content as injectable output', () => {
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

test('returns an empty unusable result for an empty response', () => {
  assert.deepEqual(normalizeGeneratedResult(''), {
    content: '',
    thinking: [],
    mode: 'empty',
    complete: false,
    usable: false,
  });
});
