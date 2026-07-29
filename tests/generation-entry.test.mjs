import assert from 'node:assert/strict';
import { getGenerationConflictAction } from '../generation-entry.js';

assert.equal(getGenerationConflictAction(false, 'manual'), 'start');
assert.equal(getGenerationConflictAction(false, 'quickReply'), 'start');
assert.equal(getGenerationConflictAction(false, 'automatic'), 'start');
assert.equal(getGenerationConflictAction(true, 'manual'), 'abort');
assert.equal(getGenerationConflictAction(true, 'quickReply'), 'notify');
assert.equal(getGenerationConflictAction(true, 'automatic'), 'ignore');
assert.equal(getGenerationConflictAction(true, 'unknown'), 'abort', 'unknown callers should retain the manual stop behavior');

console.log('generation-entry tests passed');
