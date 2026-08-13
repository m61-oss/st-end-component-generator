import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeFloatingBallVisualState,
  resolveFloatingBallRenderedState,
} from './floating-ball-state.js';

test('normalizes the supported floating-ball states', () => {
  assert.equal(normalizeFloatingBallVisualState('generating'), 'generating');
  assert.equal(normalizeFloatingBallVisualState('waiting'), 'waiting');
  assert.equal(normalizeFloatingBallVisualState('error'), 'error');
  assert.equal(normalizeFloatingBallVisualState('unknown'), 'idle');
});

test('keeps the error state visible when state animation is disabled', () => {
  assert.equal(resolveFloatingBallRenderedState('error', false), 'error');
  assert.equal(resolveFloatingBallRenderedState('generating', false), 'idle');
  assert.equal(resolveFloatingBallRenderedState('waiting', false), 'idle');
});

test('renders animated states when state animation is enabled', () => {
  assert.equal(resolveFloatingBallRenderedState('generating', true), 'generating');
  assert.equal(resolveFloatingBallRenderedState('waiting', true), 'waiting');
});
