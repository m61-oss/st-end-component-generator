import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeStreamOutputPreview } from './stream-output-preview.js';

test('uses decoded output as the live preview for protocol responses', () => {
  const preview = normalizeStreamOutputPreview(String.raw`{"thinking":"thinking-one\nthinking-two","output":"line-one\nline-two`);

  assert.deepEqual(preview, {
    text: 'line-one\nline-two',
    thinking: 'thinking-one\nthinking-two',
    mode: 'loose-json',
    protocol: true,
  });
});

test('keeps legacy streamed text unchanged', () => {
  assert.deepEqual(normalizeStreamOutputPreview('plain\ntext'), {
    text: 'plain\ntext',
    thinking: '',
    mode: 'legacy',
    protocol: false,
  });
});

test('shows anchor contents as the live preview once the plan is complete', () => {
  const preview = normalizeStreamOutputPreview(JSON.stringify({
    thinking: '先定位',
    output: [
      { position: 'after', anchor: 'A', content: 'one' },
      { position: 'before', anchor: 'B', content: 'two' },
    ],
  }));

  assert.deepEqual(preview, {
    text: 'one\n\ntwo',
    thinking: '先定位',
    mode: 'anchor-json',
    protocol: true,
  });
});
