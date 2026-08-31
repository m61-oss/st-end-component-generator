import assert from 'node:assert/strict';
import test from 'node:test';

import { planMultiTaskFloorActions } from './multi-task-floor-state.js';

test('total generation always targets every configured task', () => {
  const plan = planMultiTaskFloorActions({
    allTasks: [
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
    ],
    floorTasks: [
      { id: 'a', status: 'ready', output: 'A' },
      { id: 'b', status: 'idle', output: '' },
      { id: 'c', status: 'idle', output: '' },
    ],
  });

  assert.deepEqual(plan.generateTaskIds, ['a', 'b', 'c']);
});

test('floor-only actions select tasks by their current scoped state', () => {
  const plan = planMultiTaskFloorActions({
    allTasks: [
      { id: 'ready' },
      { id: 'undone' },
      { id: 'injected' },
      { id: 'failed' },
      { id: 'running' },
      { id: 'old-floor' },
    ],
    floorTasks: [
      { id: 'ready', status: 'ready', output: 'ready output' },
      { id: 'undone', status: 'undone', anchorItems: [{ content: 'anchor' }] },
      { id: 'injected', status: 'injected', output: 'done', injectionRecord: { operations: [] } },
      { id: 'failed', status: 'error', error: { message: 'failed' } },
      { id: 'running', status: 'generating' },
      { id: 'old-floor', status: 'idle', output: '', injectionRecord: null },
    ],
  });

  assert.deepEqual(plan.injectTaskIds, ['ready', 'undone']);
  assert.deepEqual(plan.undoTaskIds, ['injected']);
  assert.deepEqual(plan.retryTaskIds, ['failed']);
  assert.deepEqual(plan.runningTaskIds, ['running']);
});

test('tasks without usable output are not offered for floor injection', () => {
  const plan = planMultiTaskFloorActions({
    allTasks: [{ id: 'empty' }, { id: 'pending' }],
    floorTasks: [
      { id: 'empty', status: 'ready', output: '  ', anchorItems: [] },
      { id: 'pending', status: 'pending-injection', output: 'result' },
    ],
  });

  assert.deepEqual(plan.injectTaskIds, []);
});
