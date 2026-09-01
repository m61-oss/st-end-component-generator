import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeFloatingBallVisualState,
  resolveMultiTaskFloatingBallVisualState,
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

test('summarizes multi-task statuses for the floating ball', () => {
  assert.equal(resolveMultiTaskFloatingBallVisualState([]), 'idle');
  assert.equal(resolveMultiTaskFloatingBallVisualState([{ status: 'injected' }]), 'idle');
  assert.equal(resolveMultiTaskFloatingBallVisualState([{ status: 'ready' }]), 'waiting');
  assert.equal(resolveMultiTaskFloatingBallVisualState([{ status: 'undone' }]), 'waiting');
  assert.equal(resolveMultiTaskFloatingBallVisualState([{ status: 'pending-injection' }]), 'waiting');
  assert.equal(resolveMultiTaskFloatingBallVisualState([{ status: 'error' }]), 'error');
  assert.equal(resolveMultiTaskFloatingBallVisualState([{ status: 'ready' }, { status: 'error' }]), 'error');
  assert.equal(resolveMultiTaskFloatingBallVisualState([{ status: 'error' }, { status: 'queued' }]), 'generating');
  assert.equal(resolveMultiTaskFloatingBallVisualState([{ status: 'error' }, { status: 'generating' }]), 'generating');
});
