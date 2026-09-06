import { MULTI_TASK_STATUS, normalizeMultiTaskSettings } from '../generation/multi-task-state.js';

const textOf = (value) => String(value ?? '').trim();

function createTaskId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return `task-${globalThis.crypto.randomUUID()}`;
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function captureTask(task = {}) {
  return {
    name: textOf(task.name),
    apiSchemeId: textOf(task.apiSchemeId),
    taskSchemeId: textOf(task.taskSchemeId),
    presetSchemeId: textOf(task.presetSchemeId),
    worldbookSchemeId: textOf(task.worldbookSchemeId),
    componentSchemeId: textOf(task.componentSchemeId),
    injectMode: task.injectMode === 'anchor' ? 'anchor' : 'append',
    batchEnabled: task.batchEnabled !== false,
  };
}

export function captureMultiTaskSchemeSnapshot(value = {}) {
  const state = normalizeMultiTaskSettings(value);
  return {
    concurrency: state.concurrency,
    injectionIntervalSeconds: state.injectionIntervalSeconds,
    injectionOrder: state.injectionOrder,
    tasks: state.tasks.map(captureTask),
  };
}

export function applyMultiTaskSchemeSnapshot(current = {}, snapshot = {}, options = {}) {
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const createId = typeof options.createId === 'function' ? options.createId : createTaskId;
  const tasks = (Array.isArray(source.tasks) ? source.tasks : []).map((task) => ({
    ...captureTask(task),
    id: textOf(createId()),
    extraInstruction: '',
    status: MULTI_TASK_STATUS.IDLE,
    output: '',
    thinking: [],
    resultMode: 'standard',
    anchorItems: [],
    warnings: [],
    target: null,
    injectionRecord: null,
    runId: '',
    error: null,
  }));
  return normalizeMultiTaskSettings({
    ...current,
    concurrency: source.concurrency,
    injectionIntervalSeconds: source.injectionIntervalSeconds,
    injectionOrder: source.injectionOrder,
    activeTaskId: tasks[0]?.id || '',
    tasks,
  });
}
