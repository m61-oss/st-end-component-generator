import test from 'node:test';
import assert from 'node:assert/strict';

import { createMultiTaskInjectionQueue } from './multi-task-injection-queue.js';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

test('injection queue preserves completion order and waits between renders', async () => {
  const first = deferred();
  const events = [];
  const waits = [];
  const queue = createMultiTaskInjectionQueue({
    execute: async (taskId) => {
      events.push(`start:${taskId}`);
      if (taskId === 'first') await first.promise;
      events.push(`end:${taskId}`);
      return taskId;
    },
    wait: async (milliseconds) => { waits.push(milliseconds); },
    now: () => 0,
  });

  const firstResult = queue.enqueue('first', { intervalMs: 1000 });
  const secondResult = queue.enqueue('second', { intervalMs: 1000 });
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(events, ['start:first']);

  first.resolve();
  assert.deepEqual(await Promise.all([firstResult, secondResult]), ['first', 'second']);
  assert.deepEqual(events, ['start:first', 'end:first', 'start:second', 'end:second']);
  assert.deepEqual(waits, [1000]);
});

test('one failed injection does not block the next queued task', async () => {
  const events = [];
  const queue = createMultiTaskInjectionQueue({
    execute: async (taskId) => {
      events.push(taskId);
      if (taskId === 'broken') throw new Error('broken');
      return taskId;
    },
    wait: async () => {},
  });

  const broken = queue.enqueue('broken', { intervalMs: 500 });
  const healthy = queue.enqueue('healthy', { intervalMs: 500 });
  await assert.rejects(broken, /broken/);
  assert.equal(await healthy, 'healthy');
  assert.deepEqual(events, ['broken', 'healthy']);
});

test('cancelled delayed injections do not run after re-enabling', async () => {
  const events = [];
  const waits = [];
  const queue = createMultiTaskInjectionQueue({
    execute: async (taskId) => { events.push(taskId); return taskId; },
    wait: async (milliseconds) => { waits.push(milliseconds); },
    now: () => 0,
  });

  await queue.enqueue('first');
  const stale = queue.enqueue('stale', { intervalMs: 1000 });
  queue.cancel();
  const current = queue.enqueue('current');

  assert.deepEqual(await Promise.all([stale, current]), [[], 'current']);
  assert.deepEqual(events, ['first', 'current']);
  assert.deepEqual(waits, []);
});
