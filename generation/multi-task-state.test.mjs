import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MULTI_TASK_MAX_COUNT,
  MULTI_TASK_STATUS,
  createMultiTask,
  deleteMultiTask,
  normalizeMultiTaskSettings,
  renameMultiTask,
  selectMultiTask,
} from './multi-task-state.js';

test('normalizes persisted multi-task settings into a safe serializable state', () => {
  const state = normalizeMultiTaskSettings({
    concurrency: 99,
    autoInject: true,
    rollbackBeforeGeneration: true,
    activeTaskId: 'missing',
    tasks: [
      { id: ' a ', name: ' 状态栏 ', injectMode: 'replace', status: 'unknown', extraInstruction: 7 },
      { id: 'a', name: '重复 ID' },
      { id: 'b', name: '状态栏' },
      { id: 'c', name: '小剧场', injectMode: 'anchor', status: 'generating' },
    ],
  });

  assert.equal(state.concurrency, 5);
  assert.equal(state.autoInject, true);
  assert.equal(state.rollbackBeforeGeneration, true);
  assert.equal(state.activeTaskId, 'a');
  assert.deepEqual(state.tasks.map((task) => task.name), ['状态栏', '小剧场']);
  assert.equal(state.tasks[0].injectMode, 'append');
  assert.equal(state.tasks[0].status, MULTI_TASK_STATUS.IDLE);
  assert.equal(state.tasks[0].extraInstruction, '7');
  assert.equal(state.tasks[1].injectMode, 'anchor');
  assert.equal(state.tasks[1].status, MULTI_TASK_STATUS.GENERATING);
});

test('defaults multi-task global injection settings independently from single-task settings', () => {
  const state = normalizeMultiTaskSettings({ tasks: [] });
  assert.equal(state.autoInject, false);
  assert.equal(state.rollbackBeforeGeneration, false);
});

test('creates at most five uniquely named tasks and limits injection to append or anchor', () => {
  let state = normalizeMultiTaskSettings({ concurrency: 2, tasks: [] });
  for (let index = 1; index <= MULTI_TASK_MAX_COUNT; index += 1) {
    const result = createMultiTask(state, `任务 ${index}`, {
      id: `task-${index}`,
      injectMode: index === 2 ? 'anchor' : 'replace',
    });
    assert.equal(result.error, '');
    state = result.state;
  }

  assert.equal(state.tasks.length, 5);
  assert.equal(state.tasks[0].injectMode, 'append');
  assert.equal(state.tasks[1].injectMode, 'anchor');
  assert.equal(createMultiTask(state, '任务 6').error, 'max-count');
  assert.equal(createMultiTask(state, '任务 1').error, 'duplicate-name');
  assert.equal(createMultiTask(state, '   ').error, 'empty-name');
});

test('renames, selects, and deletes tasks while keeping an addressable active task', () => {
  let state = createMultiTask({}, '状态栏', { id: 'status' }).state;
  state = createMultiTask(state, '小剧场', { id: 'theater' }).state;
  state = selectMultiTask(state, 'theater');

  const renamed = renameMultiTask(state, 'theater', '剧情小剧场');
  assert.equal(renamed.error, '');
  assert.equal(renamed.state.tasks[1].name, '剧情小剧场');
  assert.equal(renameMultiTask(renamed.state, 'theater', '状态栏').error, 'duplicate-name');

  const deleted = deleteMultiTask(renamed.state, 'theater');
  assert.equal(deleted.error, '');
  assert.equal(deleted.state.activeTaskId, 'status');
  assert.deepEqual(deleted.state.tasks.map((task) => task.id), ['status']);

  const empty = deleteMultiTask(deleted.state, 'status');
  assert.equal(empty.state.activeTaskId, '');
  assert.deepEqual(empty.state.tasks, []);
});
