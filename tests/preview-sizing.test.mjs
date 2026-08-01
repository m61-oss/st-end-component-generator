import assert from 'node:assert/strict';
import { clampPreviewHeight, getPreviewLayout, isPreviewNearBottom } from '../ui/preview-sizing.js';

assert.equal(clampPreviewHeight(72, 180, 420), 180, 'short content keeps the minimum height');
assert.equal(clampPreviewHeight(260, 180, 420), 260, 'medium content uses its natural height');
assert.equal(clampPreviewHeight(640, 180, 420), 420, 'long content is capped at the maximum height');
assert.equal(clampPreviewHeight(Number.NaN, 180, 420), 180, 'invalid measurements fall back to the minimum height');

assert.deepEqual(getPreviewLayout(260, 180, 420), { height: 260, overflowY: 'hidden' }, 'preview should grow with medium content');
assert.deepEqual(getPreviewLayout(640, 180, 420), { height: 420, overflowY: 'auto' }, 'preview should scroll after reaching its height cap');
assert.equal(isPreviewNearBottom({ scrollTop: 360, clientHeight: 240, scrollHeight: 620 }), true, 'a viewer near the bottom should follow new streamed text');
assert.equal(isPreviewNearBottom({ scrollTop: 120, clientHeight: 240, scrollHeight: 620 }), false, 'a viewer reading older text should keep their scroll position');

console.log('preview-sizing tests passed');
