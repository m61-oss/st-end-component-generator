import assert from 'node:assert/strict';
import { resolveFloatingBallPosition } from '../ui/floating-ball-position.js';

const viewport = { viewportWidth: 1000, viewportHeight: 800, ballSize: 38, margin: 16 };

for (const unsaved of [null, undefined, '', '   ', 'not-a-number']) {
  assert.deepEqual(
    resolveFloatingBallPosition({ ...viewport, savedLeft: unsaved, savedTop: unsaved }),
    { left: 946, top: 746 },
    `unsaved coordinate ${String(unsaved)} should use the bottom-right default`,
  );
}

assert.deepEqual(
  resolveFloatingBallPosition({ ...viewport, savedLeft: 120, savedTop: 240 }),
  { left: 120, top: 240 },
  'finite saved coordinates should be retained',
);

assert.deepEqual(
  resolveFloatingBallPosition({ ...viewport, savedLeft: 5000, savedTop: -10 }),
  { left: 962, top: 0 },
  'saved coordinates should remain clamped to the viewport',
);

console.log('floating-ball-position tests passed');
