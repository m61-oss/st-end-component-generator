import assert from 'node:assert/strict';
import { clampPreviewHeight } from '../ui/preview-sizing.js';

assert.equal(clampPreviewHeight(72, 180, 420), 180, 'short content keeps the minimum height');
assert.equal(clampPreviewHeight(260, 180, 420), 260, 'medium content uses its natural height');
assert.equal(clampPreviewHeight(640, 180, 420), 420, 'long content is capped at the maximum height');
assert.equal(clampPreviewHeight(Number.NaN, 180, 420), 180, 'invalid measurements fall back to the minimum height');

console.log('preview-sizing tests passed');
