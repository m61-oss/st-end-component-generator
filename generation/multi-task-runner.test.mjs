import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createMultiTaskRunPlan,
  runMultiTaskQueue,
} from './multi-task-runner.js';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

test('run plan freezes task settings, resolved schemes, and target at creation time', () => {
  const tasks = [{ id: 'a', name: 'A', apiSchemeId: 'api', extraInstruction: 'old' }];
  const target = { chatId: 'chat', messageIndex: 8, messageText: 'floor' };
  const runtime = { api: { model: 'old-model' }, components: [{ id: 'c', enabled: true }] };
  const plan = createMultiTaskRunPlan({
    tasks,
    concurrency: 9,
    target,
    runId: 'run-1',
    resolveTask: () => runtime,
  });

  tasks[0].extraInstruction = 'new';
  target.messageText = 'changed';
  runtime.api.model = 'new-model';
  runtime.components[0].enabled = false;

  assert.equal(plan.runId, 'run-1');
  assert.equal(plan.concurrency, 5);
  assert.equal(plan.entries[0].task.extraInstruction, 'old');
  assert.equal(plan.entries[0].target.messageText, 'floor');
  assert.equal(plan.entries[0].runtime.api.model, 'old-model');
  assert.equal(plan.entries[0].runtime.components[0].enabled, true);
});

test('queue respects concurrency while preserving result order', async () => {
  const gates = [deferred(), deferred(), deferred()];
  const started = [];
  let active = 0;
  let peak = 0;
  const plan = createMultiTaskRunPlan({
    tasks: ['a', 'b', 'c'].map((id) => ({ id, name: id })),
    concurrency: 2,
    target: { chatId: 'chat', messageIndex: 1 },
    resolveTask: (task) => ({ id: task.id }),
    runId: 'run-2',
  });

  const running = runMultiTaskQueue(plan, {
    execute: async (entry) => {
      started.push(entry.task.id);
      active += 1;
      peak = Math.max(peak, active);
      await gates[['a', 'b', 'c'].indexOf(entry.task.id)].promise;
      active -= 1;
      return entry.task.id.toUpperCase();
    },
  });
  await Promise.resolve();
  assert.deepEqual(started, ['a', 'b']);
  gates[1].resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(started, ['a', 'b', 'c']);
  gates[0].resolve();
  gates[2].resolve();

  const results = await running;
  assert.equal(peak, 2);
  assert.deepEqual(results.map((item) => item.value), ['A', 'B', 'C']);
  assert.deepEqual(results.map((item) => item.status), ['fulfilled', 'fulfilled', 'fulfilled']);
});

test('one task failure does not prevent queued tasks from completing', async () => {
  const plan = createMultiTaskRunPlan({
    tasks: ['a', 'b', 'c'].map((id) => ({ id, name: id })),
    concurrency: 1,
    target: {},
    resolveTask: () => ({}),
  });
  const transitions = [];
  const results = await runMultiTaskQueue(plan, {
    execute: async (entry) => {
      if (entry.task.id === 'b') throw new Error('broken');
      return entry.task.id;
    },
    onTransition: (event) => transitions.push(`${event.taskId}:${event.status}`),
  });

  assert.deepEqual(results.map((item) => item.status), ['fulfilled', 'rejected', 'fulfilled']);
  assert.ok(transitions.includes('b:error'));
  assert.ok(transitions.includes('c:ready'));
});

test('stale runs stop claiming new queued work', async () => {
  const gate = deferred();
  let current = true;
  const started = [];
  const plan = createMultiTaskRunPlan({
    tasks: ['a', 'b'].map((id) => ({ id, name: id })),
    concurrency: 1,
    target: {},
    resolveTask: () => ({}),
    runId: 'stale',
  });
  const running = runMultiTaskQueue(plan, {
    isCurrent: () => current,
    execute: async (entry) => {
      started.push(entry.task.id);
      await gate.promise;
      return entry.task.id;
    },
  });
  await Promise.resolve();
  current = false;
  gate.resolve();
  const results = await running;

  assert.deepEqual(started, ['a']);
  assert.equal(results[1].status, 'cancelled');
});
