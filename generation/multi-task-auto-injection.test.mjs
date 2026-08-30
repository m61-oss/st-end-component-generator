import assert from 'node:assert/strict';
import test from 'node:test';

import { canEnqueueTaskAutoInjection, createTaskOrderInjectionCoordinator } from './multi-task-auto-injection.js';

test('task-order injection waits for earlier tasks and releases consecutive ready results in task order', () => {
  const injected = [];
  const coordinator = createTaskOrderInjectionCoordinator(['a', 'b', 'c'], {
    enqueue: (taskId) => { injected.push(taskId); return Promise.resolve(taskId); },
  });

  coordinator.ready('b');
  assert.deepEqual(injected, []);
  coordinator.ready('a');
  assert.deepEqual(injected, ['a', 'b']);
  coordinator.ready('c');
  assert.deepEqual(injected, ['a', 'b', 'c']);
});

test('task-order injection skips a failed or cancelled task and continues with later ready results', () => {
  const injected = [];
  const coordinator = createTaskOrderInjectionCoordinator(['a', 'b', 'c'], {
    enqueue: (taskId) => { injected.push(taskId); return Promise.resolve(taskId); },
  });

  coordinator.ready('b');
  coordinator.skip('a');
  assert.deepEqual(injected, ['b']);
  coordinator.skip('c');
  assert.deepEqual(injected, ['b']);
});

test('task-order injection exposes every queued promise for the generation run to settle', async () => {
  const coordinator = createTaskOrderInjectionCoordinator(['a', 'b'], {
    enqueue: async (taskId) => `injected:${taskId}`,
  });

  coordinator.ready('b');
  coordinator.ready('a');
  assert.deepEqual(await coordinator.settle(), ['injected:a', 'injected:b']);
});

test('deferred automatic injection only accepts a still-ready result from the same run', () => {
  assert.equal(canEnqueueTaskAutoInjection({ runId: 'run-1', status: 'ready' }, 'run-1'), true);
  assert.equal(canEnqueueTaskAutoInjection({ runId: 'run-1', status: 'injected' }, 'run-1'), false);
  assert.equal(canEnqueueTaskAutoInjection({ runId: 'run-1', status: 'undone' }, 'run-1'), false);
  assert.equal(canEnqueueTaskAutoInjection({ runId: 'run-2', status: 'ready' }, 'run-1'), false);
  assert.equal(canEnqueueTaskAutoInjection(null, 'run-1'), false);
});
