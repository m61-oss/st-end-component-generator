import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FLOOR_PANEL_STATUS,
  createFloorPanelState,
  createFloorPanelTarget,
  getFloorPanelActionModel,
  getFloorPanelActionModels,
  getFloorPanelStatusStage,
  getFloorPanelStatusLabel,
  isFloorPanelGenerationCurrent,
  isFloorPanelTargetAddressable,
  isFloorPanelTargetCurrent,
  canEditFloorPanelResult,
  createMultiTaskFloorPanelView,
  scopeMultiTaskFloorPanelSettings,
  nextFloorPanelGeneration,
} from './message-floor-panel.js';

test('multi-task floor hides results and actions that belong to another floor', () => {
  const scoped = scopeMultiTaskFloorPanelSettings({
    activeTaskId: 'old',
    tasks: [
      { id: 'old', name: 'Old', status: 'ready', output: 'old result', target: { chatId: 'chat-a', messageIndex: 3 }, injectionRecord: { chatId: 'chat-a', targetIndex: 3 } },
      { id: 'current', name: 'Current', status: 'ready', output: 'current result', target: { chatId: 'chat-a', messageIndex: 4 } },
    ],
  }, { chatId: 'chat-a', messageIndex: 4 });

  assert.equal(scoped.tasks[0].status, 'idle');
  assert.equal(scoped.tasks[0].output, '');
  assert.equal(scoped.tasks[0].injectionRecord, null);
  assert.equal(scoped.tasks[1].output, 'current result');
});

test('multi-task floor view follows the selected task while aggregating the whole run status', () => {
  const view = createMultiTaskFloorPanelView({
    activeTaskId: 'b',
    tasks: [
      { id: 'a', name: 'A', status: 'generating', output: 'A output', thinking: ['A thought'] },
      { id: 'b', name: 'B', status: 'ready', output: 'B output', thinking: ['B thought'], resultMode: 'standard' },
    ],
  });

  assert.equal(view.mode, 'multi');
  assert.equal(view.status, FLOOR_PANEL_STATUS.GENERATING);
  assert.equal(view.activeTaskId, 'b');
  assert.equal(view.output, 'B output');
  assert.equal(view.thinking, 'B thought');
  assert.equal(view.streaming, false);
});

test('multi-task floor status keeps remaining results actionable after another task was injected', () => {
  const ready = createMultiTaskFloorPanelView({
    tasks: [
      { id: 'a', name: 'A', status: 'injected', output: 'A', injectionRecord: { operations: [] } },
      { id: 'b', name: 'B', status: 'ready', output: 'B' },
    ],
  });
  const injected = createMultiTaskFloorPanelView({
    tasks: [{ id: 'a', name: 'A', status: 'injected', output: 'A', injectionRecord: { operations: [] } }],
  });
  const failed = createMultiTaskFloorPanelView({
    tasks: [{ id: 'a', name: 'A', status: 'error', error: { message: 'failed' } }],
  });

  assert.equal(ready.status, FLOOR_PANEL_STATUS.READY);
  assert.equal(ready.activeTaskId, 'a');
  assert.equal(canEditFloorPanelResult(ready), false);
  assert.equal(canEditFloorPanelResult(createMultiTaskFloorPanelView({ ...ready, activeTaskId: 'b', tasks: [
    { id: 'a', name: 'A', status: 'injected', output: 'A', injectionRecord: { operations: [] } },
    { id: 'b', name: 'B', status: 'ready', output: 'B' },
  ] })), true);
  assert.equal(injected.status, FLOOR_PANEL_STATUS.INJECTED);
  assert.equal(failed.status, FLOOR_PANEL_STATUS.ERROR);
  assert.equal(failed.error, 'failed');
});

test('an undone multi-task result remains editable and actionable as ready', () => {
  const undone = createMultiTaskFloorPanelView({
    activeTaskId: 'a',
    tasks: [{ id: 'a', name: 'A', status: 'undone', output: 'retained output' }],
  });

  assert.equal(undone.status, FLOOR_PANEL_STATUS.READY);
  assert.equal(undone.resultStatus, FLOOR_PANEL_STATUS.READY);
  assert.equal(undone.output, 'retained output');
  assert.equal(canEditFloorPanelResult(undone), true);
  assert.deepEqual(getFloorPanelActionModels(undone.status).map((item) => item.action), ['generate', 'inject']);
});

test('楼层面板默认折叠且空闲不显示状态文字', () => {
  const state = createFloorPanelState();
  assert.equal(state.expanded, false);
  assert.equal(state.status, FLOOR_PANEL_STATUS.IDLE);
  assert.equal(getFloorPanelStatusLabel(state.status), '');
  assert.equal(state.target, null);
});

test('状态标签只有生成中、待注入、已注入、失败四种可见状态', () => {
  assert.equal(getFloorPanelStatusLabel(FLOOR_PANEL_STATUS.GENERATING), '生成中');
  assert.equal(getFloorPanelStatusLabel(FLOOR_PANEL_STATUS.READY), '生成完成 · 待注入');
  assert.equal(getFloorPanelStatusLabel(FLOOR_PANEL_STATUS.INJECTED), '已注入');
  assert.equal(getFloorPanelStatusLabel(FLOOR_PANEL_STATUS.ERROR), '生成失败');
  assert.equal(getFloorPanelStatusLabel('unknown'), '');
});

test('折叠面板动作随状态变化，但不会自动展开', () => {
  const state = createFloorPanelState();
  assert.deepEqual(getFloorPanelActionModel(FLOOR_PANEL_STATUS.IDLE), { action: 'generate', icon: 'fa-wand-magic-sparkles', label: '生成组件' });
  assert.deepEqual(getFloorPanelActionModel(FLOOR_PANEL_STATUS.GENERATING), { action: 'stop', icon: 'fa-stop', label: '停止生成' });
  assert.deepEqual(getFloorPanelActionModel(FLOOR_PANEL_STATUS.READY), { action: 'inject', icon: 'fa-file-import', label: '注入回复' });
  assert.deepEqual(getFloorPanelActionModel(FLOOR_PANEL_STATUS.INJECTED), { action: 'undo', icon: 'fa-rotate-left', label: '撤回注入' });
  assert.deepEqual(getFloorPanelActionModel(FLOOR_PANEL_STATUS.ERROR), { action: 'retry', icon: 'fa-rotate-right', label: '重试' });
  assert.equal(state.expanded, false);
});

test('顶部折叠栏提供当前状态的全部快捷操作', () => {
  assert.deepEqual(getFloorPanelActionModels(FLOOR_PANEL_STATUS.IDLE).map((item) => item.action), ['generate']);
  assert.deepEqual(getFloorPanelActionModels(FLOOR_PANEL_STATUS.GENERATING).map((item) => item.action), ['stop']);
  assert.deepEqual(getFloorPanelActionModels(FLOOR_PANEL_STATUS.READY).map((item) => item.action), ['generate', 'inject']);
  assert.deepEqual(getFloorPanelActionModels(FLOOR_PANEL_STATUS.INJECTED).map((item) => item.action), ['generate', 'undo']);
  assert.deepEqual(getFloorPanelActionModels(FLOOR_PANEL_STATUS.ERROR).map((item) => item.action), ['retry']);
});

test('状态舞台用文字、颜文字和符号共同表达五种状态', () => {
  assert.deepEqual(getFloorPanelStatusStage(FLOOR_PANEL_STATUS.IDLE), {
    label: '空闲', lead: '｡･ﾟ', shuttle: '', text: '织幕在打盹', face: '(˘ω˘)', tail: 'ﾟ･｡', motion: 'dozing',
  });
  assert.deepEqual(getFloorPanelStatusStage(FLOOR_PANEL_STATUS.GENERATING), {
    label: '生成中', lead: '✦･ﾟ', shuttle: '⋈', text: '正在编织', face: '(ง •̀ω•́)ง', tail: '･ﾟ✧', motion: 'weaving',
  });
  assert.deepEqual(getFloorPanelStatusStage(FLOOR_PANEL_STATUS.READY), {
    label: '生成完成，待注入', lead: '｡･:*:･ﾟ✦', shuttle: '', text: '织好啦', face: '(｡•̀ᴗ-)✧', tail: 'ﾟ･:*:･｡', motion: 'ready',
  });
  assert.deepEqual(getFloorPanelStatusStage(FLOOR_PANEL_STATUS.INJECTED), {
    label: '已注入', lead: '◇ ･ﾟ', shuttle: '', text: '内容注入好啦', face: '(๑˃ᴗ˂)ﻭ', tail: 'ﾟ･ ◈', motion: 'embedded',
  });
  assert.deepEqual(getFloorPanelStatusStage(FLOOR_PANEL_STATUS.ERROR), {
    label: '生成失败', lead: '⌁ ･ﾟ', shuttle: '', text: '线团打结了', face: '(｡•́︿•̀｡)', tail: 'ﾟ･ ⌁', motion: 'tangled',
  });
  assert.doesNotMatch(JSON.stringify(getFloorPanelStatusStage(FLOOR_PANEL_STATUS.INJECTED)), /✓/);
});

test('目标校验同时要求聊天、assistant 索引和正文指纹一致', () => {
  const target = createFloorPanelTarget({ chatId: 'chat-a', messageIndex: 7, messageText: '第一段\n第二段' });
  assert.equal(isFloorPanelTargetCurrent(target, { chatId: 'chat-a', messageIndex: 7, messageText: '第一段\n第二段' }), true);
  assert.equal(isFloorPanelTargetCurrent(target, { chatId: 'chat-a', messageIndex: 7, messageText: '第一段\n改动' }), false);
  assert.equal(isFloorPanelTargetCurrent(target, { chatId: 'chat-b', messageIndex: 7, messageText: '第一段\n第二段' }), false);
  assert.equal(isFloorPanelTargetCurrent(target, { chatId: 'chat-a', messageIndex: 8, messageText: '第一段\n第二段' }), false);
});

test('注入定址只要求同一聊天与同一楼层，不被正文的非结构性变化误拦截', () => {
  const target = createFloorPanelTarget({ chatId: 'chat-a', messageIndex: 7, messageText: '原文' });
  const changedText = createFloorPanelTarget({ chatId: 'chat-a', messageIndex: 7, messageText: '原文\n<!-- updated -->' });
  const otherFloor = createFloorPanelTarget({ chatId: 'chat-a', messageIndex: 8, messageText: '原文' });

  assert.equal(isFloorPanelTargetAddressable(target, changedText), true);
  assert.equal(isFloorPanelTargetAddressable(target, otherFloor), false);
});

test('只有完成且未注入的结果可编辑', () => {
  assert.equal(canEditFloorPanelResult({ status: FLOOR_PANEL_STATUS.READY, streaming: false }), true);
  assert.equal(canEditFloorPanelResult({ ...createFloorPanelState(), status: FLOOR_PANEL_STATUS.READY }), true);
  assert.equal(canEditFloorPanelResult({ status: FLOOR_PANEL_STATUS.GENERATING, streaming: true }), false);
  assert.equal(canEditFloorPanelResult({ status: FLOOR_PANEL_STATUS.READY, streaming: true }), false);
  assert.equal(canEditFloorPanelResult({ status: FLOOR_PANEL_STATUS.INJECTED, streaming: false }), false);
});

test('新一轮生成会递增世代，迟到响应不能覆盖新目标', () => {
  const firstTarget = createFloorPanelTarget({ chatId: 'chat-a', messageIndex: 1, messageText: 'old' });
  const first = nextFloorPanelGeneration(createFloorPanelState(), firstTarget);
  const secondTarget = createFloorPanelTarget({ chatId: 'chat-a', messageIndex: 2, messageText: 'new' });
  const second = nextFloorPanelGeneration(first, secondTarget);

  assert.equal(second.generation, first.generation + 1);
  assert.equal(isFloorPanelGenerationCurrent(second, first.generation, firstTarget), false);
  assert.equal(isFloorPanelGenerationCurrent(second, second.generation, secondTarget), true);
});
