import assert from 'node:assert/strict';
import test from 'node:test';

import { parseAnchorOutput } from './anchor-output-protocol.js';
import { normalizeStreamOutputPreview } from './stream-output-preview.js';

test('keeps streaming the second anchor item after the first item is complete', () => {
  const preview = normalizeStreamOutputPreview(
    '{"thinking":"locate","output":['
      + '{"position":"end","content":"first"},'
      + '{"position":"end","content":"second partial',
  );

  assert.equal(preview.mode, 'anchor-loose-json');
  assert.equal(preview.text, 'first\n\nsecond partial');
});

test('keeps streaming the third anchor item after multiple complete items', () => {
  const preview = normalizeStreamOutputPreview(
    '{"thinking":"locate","output":['
      + '{"position":"start","content":"first"},'
      + '{"position":"end","content":"second"},'
      + '{"position":"after","anchor":"unique target","content":"third partial',
  );

  assert.equal(preview.text, 'first\n\nsecond\n\nthird partial');
});

test('recovers a trailing partial item without dropping completed items', () => {
  const parsed = parseAnchorOutput(
    '{"thinking":"locate","output":['
      + '{"position":"end","content":"complete"},'
      + '{"position":"before","anchor":"unique target","content":"partial',
  );

  assert.deepEqual(parsed.items, [
    { position: 'end', content: 'complete' },
    { position: 'before', anchor: 'unique target', content: 'partial' },
  ]);
});
