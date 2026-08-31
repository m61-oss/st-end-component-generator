import test from 'node:test';
import assert from 'node:assert/strict';

import { createMultiTaskController } from './multi-task-controller.js';

function createHarness(tasks) {
  let multiTaskSettings = { tasks, activeTaskId: tasks[0]?.id || '', concurrency: 1 };
  const rendered = [];
  const controller = createMultiTaskController({
    getSettings: () => ({ multiTaskSettings }),
    setMultiTaskSettings: (next) => { multiTaskSettings = next; },
    normalizeSettings: (value) => ({ ...value, tasks: Array.isArray(value?.tasks) ? value.tasks : [] }),
    status: {
      IDLE: 'idle',
      QUEUED: 'queued',
      GENERATING: 'generating',
      READY: 'ready',
    },
    renderRuntimeState: () => rendered.push('render'),
    textOf: (value) => String(value ?? '').trim(),
  });
  return { controller, getState: () => multiTaskSettings, rendered };
}

test('replaceTask updates only the requested task', () => {
  const harness = createHarness([
    { id: 'a', status: 'idle', output: '', anchorItems: [] },
    { id: 'b', status: 'idle', output: '', anchorItems: [] },
  ]);

  harness.controller.replaceTask('b', { output: 'result', status: 'ready' });

  assert.equal(harness.getState().tasks[0].output, '');
  assert.equal(harness.getState().tasks[1].output, 'result');
  assert.equal(harness.getState().tasks[1].status, 'ready');
});

test('cancelGeneration resets only queued or generating requested tasks', () => {
  const harness = createHarness([
    { id: 'a', status: 'generating', output: 'partial', anchorItems: [], runId: 'run' },
    { id: 'b', status: 'ready', output: 'done', anchorItems: [], runId: 'old' },
  ]);

  assert.equal(harness.controller.cancelGeneration(['a', 'b']), true);

  assert.equal(harness.getState().tasks[0].status, 'ready');
  assert.equal(harness.getState().tasks[0].runId, '');
  assert.equal(harness.getState().tasks[1].status, 'ready');
  assert.equal(harness.getState().tasks[1].runId, 'old');
  assert.deepEqual(harness.rendered, ['render']);
});
