import { MULTI_TASK_STATUS, normalizeMultiTaskSettings } from '../generation/multi-task-state.js';

const STATUS_LABELS = Object.freeze({
  [MULTI_TASK_STATUS.IDLE]: '就绪',
  [MULTI_TASK_STATUS.QUEUED]: '排队中',
  [MULTI_TASK_STATUS.GENERATING]: '生成中',
  [MULTI_TASK_STATUS.READY]: '生成完成',
  [MULTI_TASK_STATUS.PENDING_INJECTION]: '等待注入',
  [MULTI_TASK_STATUS.INJECTED]: '已注入',
  [MULTI_TASK_STATUS.UNDONE]: '已撤回',
  [MULTI_TASK_STATUS.ERROR]: '失败',
});

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

export function renderGenerationModeSwitch(mode = 'single') {
  const activeMode = mode === 'multi' ? 'multi' : 'single';
  return `<div class="st-esg-generation-mode-switch">
    <div class="st-esg-generation-mode-tabs" role="group" aria-label="生成模式">
      <button class="st-esg-generation-mode${activeMode === 'single' ? ' active' : ''}" type="button" data-generation-mode="single" aria-pressed="${activeMode === 'single'}">单任务</button>
      <button class="st-esg-generation-mode${activeMode === 'multi' ? ' active' : ''}" type="button" data-generation-mode="multi" aria-pressed="${activeMode === 'multi'}">多任务</button>
    </div>
    <button class="menu_button menu_button_icon st-esg-secondary-action st-esg-generation-mode-settings" type="button" data-generation-mode-settings title="生成设置" aria-label="生成设置"><i class="fa-solid fa-gear" aria-hidden="true"></i></button>
  </div>`;
}

function renderTaskTabs(state) {
  return `<div class="st-esg-multi-task-tabs" role="tablist" aria-label="多任务列表">${state.tasks.map((task) => {
    const selected = task.id === state.activeTaskId;
    const statusLabel = STATUS_LABELS[task.status] || STATUS_LABELS.idle;
    return `<button class="st-esg-multi-task-tab${selected ? ' active' : ''}" type="button" role="tab" data-multi-task-id="${escapeHtml(task.id)}" data-task-status="${escapeHtml(task.status)}" aria-selected="${selected}" aria-label="${escapeHtml(`${task.name}，${statusLabel}`)}" title="${escapeHtml(`${task.name} · ${statusLabel}`)}"><span class="st-esg-task-status-lamp" aria-hidden="true"></span><span class="st-esg-multi-task-tab-name">${escapeHtml(task.name)}</span></button>`;
  }).join('')}</div>`;
}

function renderActiveTask(state) {
  const task = state.tasks.find((item) => item.id === state.activeTaskId) || state.tasks[0];
  const statusLabel = STATUS_LABELS[task.status] || STATUS_LABELS.idle;
  return `<section class="st-esg-multi-task-current" data-active-multi-task-id="${escapeHtml(task.id)}">
    <header class="st-esg-multi-task-head">
      <div class="st-esg-multi-task-current-copy"><strong>${escapeHtml(task.name)}</strong><span>${escapeHtml(statusLabel)}</span></div>
      <div class="st-esg-multi-task-tools" aria-label="当前任务操作">
        <button class="menu_button menu_button_icon st-esg-secondary-action" type="button" data-multi-task-action="history" disabled title="多任务最近生成记录将在后续阶段接入" aria-label="最近生成记录"><i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i></button>
        <button class="menu_button menu_button_icon st-esg-secondary-action" type="button" data-multi-task-action="undo" disabled title="多任务撤回将在后续阶段接入" aria-label="撤回当前任务"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button>
        <button class="menu_button menu_button_icon st-esg-secondary-action" type="button" data-multi-task-action="generate" disabled title="多任务生成将在后续阶段接入" aria-label="生成当前任务"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i></button>
        <button class="menu_button menu_button_icon st-esg-secondary-action" type="button" data-multi-task-action="inject" disabled title="多任务注入将在后续阶段接入" aria-label="注入当前任务"><i class="fa-solid fa-file-import" aria-hidden="true"></i></button>
      </div>
    </header>
  </section>`;
}

export function renderMultiTaskWorkspace(value = {}) {
  const state = normalizeMultiTaskSettings(value);
  if (!state.tasks.length) {
    return `<div class="st-esg-multi-task-workspace"><div class="st-esg-multi-task-empty"><i class="fa-solid fa-layer-group" aria-hidden="true"></i><span>还没有任务，请打开设置添加。</span></div></div>`;
  }
  return `<div class="st-esg-multi-task-workspace">${renderTaskTabs(state)}${renderActiveTask(state)}</div>`;
}
