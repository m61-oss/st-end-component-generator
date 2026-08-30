import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MULTI_TASK_MAX_COUNT,
  MULTI_TASK_STATUS,
  createMultiTask,
  deleteMultiTask,
  mergeMultiTaskWorkspaceView,
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
  assert.equal('autoInject' in state, false);
  assert.equal('rollbackBeforeGeneration' in state, false);
  assert.equal(state.activeTaskId, 'a');
  assert.deepEqual(state.tasks.map((task) => task.name), ['状态栏', '小剧场']);
  assert.equal(state.tasks[0].injectMode, 'append');
  assert.equal(state.tasks[0].status, MULTI_TASK_STATUS.IDLE);
  assert.equal(state.tasks[0].extraInstruction, '7');
  assert.equal(state.tasks[1].injectMode, 'anchor');
  assert.equal(state.tasks[1].status, MULTI_TASK_STATUS.GENERATING);
});

test('ignores legacy per-mode injection switches because generation flow settings are shared', () => {
  const state = normalizeMultiTaskSettings({ autoInject: true, rollbackBeforeGeneration: true, tasks: [] });
  assert.equal(state.concurrency, 1);
  assert.equal('autoInject' in state, false);
  assert.equal('rollbackBeforeGeneration' in state, false);
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

test('normalizes task-owned generation and injection state without sharing object references', () => {
  const anchorItems = [{ position: 'end', content: 'scene' }];
  const target = { chatId: 'chat-1', messageIndex: 4, messageText: 'floor' };
  const injectionRecord = { taskId: 'task-a', targetIndex: 4, beforeText: 'floor', afterText: 'floor\nscene' };
  const state = normalizeMultiTaskSettings({
    tasks: [{
      id: 'task-a',
      name: 'A',
      resultMode: 'anchor',
      anchorItems,
      warnings: ['one'],
      target,
      injectionRecord,
      runId: 'run-1',
    }],
  });

  anchorItems[0].content = 'changed';
  target.messageText = 'changed';
  injectionRecord.afterText = 'changed';

  assert.equal(state.tasks[0].resultMode, 'anchor');
  assert.equal(state.tasks[0].anchorItems[0].content, 'scene');
  assert.equal(state.tasks[0].target.messageText, 'floor');
  assert.equal(state.tasks[0].injectionRecord.afterText, 'floor\nscene');
  assert.equal(state.tasks[0].runId, 'run-1');
});

test('syncing the shared workspace never drops the frozen injection target', () => {
  const task = normalizeMultiTaskSettings({
    tasks: [{
      id: 'task-a',
      name: 'A',
      target: { chatId: 'chat-1', messageIndex: 4, messageText: 'floor' },
      output: 'old',
    }],
  }).tasks[0];

  const merged = mergeMultiTaskWorkspaceView(task, {
    output: 'edited',
    target: { messageIndex: 4 },
  });

  assert.equal(merged.output, 'edited');
  assert.deepEqual(merged.target, { chatId: 'chat-1', messageIndex: 4, messageText: 'floor' });
});
