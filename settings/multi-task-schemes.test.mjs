import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyMultiTaskSchemeSnapshot,
  captureMultiTaskSchemeSnapshot,
} from './multi-task-schemes.js';

test('captures reusable multi-task configuration without temporary or runtime data', () => {
  const snapshot = captureMultiTaskSchemeSnapshot({
    concurrency: 3,
    injectionIntervalSeconds: 2,
    injectionOrder: 'task',
    activeTaskId: 'a',
    tasks: [{
      id: 'a',
      name: '状态栏',
      apiSchemeId: 'api',
      taskSchemeId: 'task',
      presetSchemeId: 'preset',
      worldbookSchemeId: 'worldbook',
      componentSchemeId: 'component',
      injectMode: 'anchor',
      batchEnabled: false,
      extraInstruction: '本次临时要求',
      output: 'generated',
      thinking: [{ content: 'thinking' }],
      status: 'injected',
      target: { chatId: 'chat', messageIndex: 2 },
      injectionRecord: { taskId: 'a' },
      runId: 'run',
      error: { message: 'old' },
    }],
  });

  assert.deepEqual(snapshot, {
    concurrency: 3,
    injectionIntervalSeconds: 2,
    injectionOrder: 'task',
    tasks: [{
      name: '状态栏',
      apiSchemeId: 'api',
      taskSchemeId: 'task',
      presetSchemeId: 'preset',
      worldbookSchemeId: 'worldbook',
      componentSchemeId: 'component',
      injectMode: 'anchor',
      batchEnabled: false,
    }],
  });
});

test('loading a multi-task scheme replaces tasks and creates clean runtime ids', () => {
  let sequence = 0;
  const state = applyMultiTaskSchemeSnapshot({
    concurrency: 1,
    tasks: [{ id: 'old', name: '旧任务', output: 'old result' }],
  }, {
    concurrency: 2,
    injectionIntervalSeconds: 0.5,
    injectionOrder: 'completion',
    tasks: [
      { name: '状态栏', apiSchemeId: 'api-1', componentSchemeId: 'component-1' },
      { name: '小剧场', apiSchemeId: 'api-2', componentSchemeId: 'component-2', batchEnabled: false },
    ],
  }, { createId: () => `loaded-${++sequence}` });

  assert.equal(state.concurrency, 2);
  assert.equal(state.activeTaskId, 'loaded-1');
  assert.deepEqual(state.tasks.map((task) => task.id), ['loaded-1', 'loaded-2']);
  assert.deepEqual(state.tasks.map((task) => task.name), ['状态栏', '小剧场']);
  assert.equal(state.tasks[0].status, 'idle');
  assert.equal(state.tasks[0].output, '');
  assert.equal(state.tasks[0].extraInstruction, '');
  assert.equal(state.tasks[1].batchEnabled, false);
});
