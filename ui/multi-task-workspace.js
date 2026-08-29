import { MULTI_TASK_MAX_COUNT, MULTI_TASK_STATUS, normalizeMultiTaskSettings } from '../generation/multi-task-state.js';

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
  return `<div class="st-esg-generation-mode-switch" role="group" aria-label="生成模式">
    <button class="st-esg-generation-mode${activeMode === 'single' ? ' active' : ''}" type="button" data-generation-mode="single" aria-pressed="${activeMode === 'single'}">单任务</button>
    <button class="st-esg-generation-mode${activeMode === 'multi' ? ' active' : ''}" type="button" data-generation-mode="multi" aria-pressed="${activeMode === 'multi'}">多任务</button>
  </div>`;
}

function renderTaskTabs(state) {
  return `<div class="st-esg-multi-task-tabs" role="tablist" aria-label="多任务列表">${state.tasks.map((task) => {
    const selected = task.id === state.activeTaskId;
    const statusLabel = STATUS_LABELS[task.status] || STATUS_LABELS.idle;
    return `<button class="st-esg-multi-task-tab${selected ? ' active' : ''}" type="button" role="tab" data-multi-task-id="${escapeHtml(task.id)}" data-task-status="${escapeHtml(task.status)}" aria-selected="${selected}" aria-label="${escapeHtml(`${task.name}，${statusLabel}`)}" title="${escapeHtml(`${task.name} · ${statusLabel}`)}"><span class="st-esg-task-status-lamp" aria-hidden="true"></span><span class="st-esg-multi-task-tab-name">${escapeHtml(task.name)}</span></button>`;
  }).join('')}</div>`;
}

function renderTaskActions() {
  return `<div class="st-esg-multi-task-actions st-esg-multi-task-current-actions" aria-label="当前任务操作">
    <button class="menu_button menu_button_icon st-esg-secondary-action" type="button" data-multi-task-action="undo" disabled title="多任务撤回将在后续阶段接入"><i class="fa-solid fa-rotate-left"></i><span>撤回任务</span></button>
    <button class="menu_button menu_button_icon st-esg-primary-action" type="button" data-multi-task-action="generate" disabled title="多任务生成将在后续阶段接入"><i class="fa-solid fa-sparkles"></i><span>生成任务</span></button>
  </div>`;
}

function renderBatchActions(taskCount) {
  if (taskCount < 2) return '';
  return `<div class="st-esg-multi-task-batch-bar"><span>全部任务</span><div class="st-esg-multi-task-actions" aria-label="全部任务操作">
    <button class="menu_button menu_button_icon st-esg-secondary-action" type="button" data-multi-task-action="undo-all" disabled title="批量撤回将在后续阶段接入"><i class="fa-solid fa-rotate-left"></i><span>撤回全部</span></button>
    <button class="menu_button menu_button_icon st-esg-primary-action" type="button" data-multi-task-action="generate-all" disabled title="并发调度将在后续阶段接入"><i class="fa-solid fa-layer-group"></i><span>生成全部</span></button>
  </div></div>`;
}

function renderActiveTask(state) {
  const task = state.tasks.find((item) => item.id === state.activeTaskId) || state.tasks[0];
  const statusLabel = STATUS_LABELS[task.status] || STATUS_LABELS.idle;
  return `<section class="st-esg-multi-task-surface" data-active-multi-task-id="${escapeHtml(task.id)}">
    <header class="st-esg-multi-task-head">
      <div><strong>${escapeHtml(task.name)}</strong><span>${escapeHtml(statusLabel)}</span></div>
      <div class="st-esg-multi-task-tools">
        <button class="menu_button menu_button_icon st-esg-secondary-action" type="button" data-multi-task-action="history" title="最近生成记录" aria-label="最近生成记录"><i class="fa-solid fa-clock-rotate-left"></i></button>
        <button class="menu_button menu_button_icon st-esg-secondary-action" type="button" data-multi-task-action="settings" title="任务设置" aria-label="任务设置"><i class="fa-solid fa-gear"></i></button>
        <button class="menu_button menu_button_icon st-esg-secondary-action" type="button" data-multi-task-action="rename" title="重命名任务" aria-label="重命名任务"><i class="fa-solid fa-pen"></i></button>
        <button class="menu_button menu_button_icon st-esg-secondary-action st-esg-icon-danger" type="button" data-multi-task-action="delete" title="删除任务" aria-label="删除任务"><i class="fa-solid fa-trash"></i></button>
      </div>
    </header>
    <label class="st-esg-multi-task-extra">额外指令（可选）<input class="text_pole" type="text" data-multi-task-extra autocomplete="off" value="${escapeHtml(task.extraInstruction)}" placeholder="临时追加到这个任务的指令末尾" /></label>
    <div class="st-esg-multi-task-result">
      <div class="st-esg-multi-task-result-tabs" role="tablist" aria-label="生成内容视图"><button class="active" type="button" aria-selected="true">结果</button><button type="button" aria-selected="false" disabled>思考过程</button></div>
      <textarea class="text_pole textarea_compact st-esg-textarea st-esg-multi-task-preview" data-multi-task-preview rows="13" placeholder="当前任务的生成内容会出现在这里。">${escapeHtml(task.output)}</textarea>
    </div>
    ${renderTaskActions()}
  </section>${renderBatchActions(state.tasks.length)}`;
}

export function renderMultiTaskWorkspace(value = {}) {
  const state = normalizeMultiTaskSettings(value);
  const canAdd = state.tasks.length < MULTI_TASK_MAX_COUNT;
  const toolbar = `<div class="st-esg-multi-task-toolbar"><span>并发 ${state.concurrency}</span><button class="menu_button menu_button_icon st-esg-secondary-action" type="button" data-multi-task-action="global-settings"><i class="fa-solid fa-sliders"></i><span>全局设置</span></button><button class="menu_button menu_button_icon st-esg-secondary-action" type="button" data-multi-task-action="add"${canAdd ? '' : ' disabled'}><i class="fa-solid fa-plus"></i><span>${canAdd ? '添加任务' : '已达上限'}</span></button></div>`;
  if (!state.tasks.length) {
    return `<div class="st-esg-multi-task-workspace">${toolbar}<div class="st-esg-multi-task-empty"><i class="fa-solid fa-layer-group" aria-hidden="true"></i><strong>还没有多任务配置</strong><span>添加并命名任务后，可以分别选择方案并并发生成。</span><button class="menu_button menu_button_icon st-esg-primary-action" type="button" data-multi-task-action="add"><i class="fa-solid fa-plus"></i><span>添加第一个任务</span></button></div></div>`;
  }
  return `<div class="st-esg-multi-task-workspace">${toolbar}${renderTaskTabs(state)}${renderActiveTask(state)}</div>`;
}
