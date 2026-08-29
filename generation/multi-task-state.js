export const MULTI_TASK_MAX_COUNT = 5;

export const MULTI_TASK_STATUS = Object.freeze({
  IDLE: 'idle',
  QUEUED: 'queued',
  GENERATING: 'generating',
  READY: 'ready',
  PENDING_INJECTION: 'pending-injection',
  INJECTED: 'injected',
  UNDONE: 'undone',
  ERROR: 'error',
});

const VALID_STATUSES = new Set(Object.values(MULTI_TASK_STATUS));
const textOf = (value) => String(value ?? '').trim();

function clampConcurrency(value) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return 2;
  return Math.min(MULTI_TASK_MAX_COUNT, Math.max(1, parsed));
}

function normalizeInjectMode(value) {
  return value === 'anchor' ? 'anchor' : 'append';
}

function normalizeTask(value) {
  const source = value && typeof value === 'object' ? value : {};
  const id = textOf(source.id);
  const name = textOf(source.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    apiSchemeId: textOf(source.apiSchemeId),
    taskSchemeId: textOf(source.taskSchemeId),
    presetSchemeId: textOf(source.presetSchemeId),
    worldbookSchemeId: textOf(source.worldbookSchemeId),
    componentSchemeId: textOf(source.componentSchemeId),
    injectMode: normalizeInjectMode(source.injectMode),
    extraInstruction: String(source.extraInstruction ?? ''),
    status: VALID_STATUSES.has(source.status) ? source.status : MULTI_TASK_STATUS.IDLE,
    output: String(source.output ?? ''),
    thinking: Array.isArray(source.thinking) ? source.thinking : [],
    error: source.error && typeof source.error === 'object' ? { ...source.error } : null,
  };
}

export function normalizeMultiTaskSettings(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const ids = new Set();
  const names = new Set();
  const tasks = [];
  for (const rawTask of Array.isArray(source.tasks) ? source.tasks : []) {
    if (tasks.length >= MULTI_TASK_MAX_COUNT) break;
    const task = normalizeTask(rawTask);
    const nameKey = task?.name.toLocaleLowerCase();
    if (!task || ids.has(task.id) || names.has(nameKey)) continue;
    ids.add(task.id);
    names.add(nameKey);
    tasks.push(task);
  }
  const requestedActiveId = textOf(source.activeTaskId);
  return {
    concurrency: clampConcurrency(source.concurrency),
    autoInject: source.autoInject === true,
    rollbackBeforeGeneration: source.rollbackBeforeGeneration === true,
    activeTaskId: tasks.some((task) => task.id === requestedActiveId) ? requestedActiveId : (tasks[0]?.id || ''),
    tasks,
  };
}

function createTaskId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return `task-${globalThis.crypto.randomUUID()}`;
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createMultiTask(value, name, defaults = {}) {
  const state = normalizeMultiTaskSettings(value);
  const cleanName = textOf(name);
  if (!cleanName) return { state, task: null, error: 'empty-name' };
  if (state.tasks.some((task) => task.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) {
    return { state, task: null, error: 'duplicate-name' };
  }
  if (state.tasks.length >= MULTI_TASK_MAX_COUNT) return { state, task: null, error: 'max-count' };
  let id = textOf(defaults.id) || createTaskId();
  while (state.tasks.some((task) => task.id === id)) id = createTaskId();
  const task = normalizeTask({ ...defaults, id, name: cleanName });
  return {
    state: { ...state, activeTaskId: task.id, tasks: [...state.tasks, task] },
    task,
    error: '',
  };
}

export function renameMultiTask(value, id, name) {
  const state = normalizeMultiTaskSettings(value);
  const taskId = textOf(id);
  const cleanName = textOf(name);
  if (!cleanName) return { state, task: null, error: 'empty-name' };
  const index = state.tasks.findIndex((task) => task.id === taskId);
  if (index < 0) return { state, task: null, error: 'missing-task' };
  if (state.tasks.some((task) => task.id !== taskId && task.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) {
    return { state, task: null, error: 'duplicate-name' };
  }
  const task = { ...state.tasks[index], name: cleanName };
  const tasks = [...state.tasks];
  tasks[index] = task;
  return { state: { ...state, tasks }, task, error: '' };
}

export function deleteMultiTask(value, id) {
  const state = normalizeMultiTaskSettings(value);
  const taskId = textOf(id);
  const index = state.tasks.findIndex((task) => task.id === taskId);
  if (index < 0) return { state, removed: null, error: 'missing-task' };
  const removed = state.tasks[index];
  const tasks = state.tasks.filter((task) => task.id !== taskId);
  const activeTaskId = state.activeTaskId === taskId
    ? (tasks[Math.min(index, tasks.length - 1)]?.id || '')
    : state.activeTaskId;
  return { state: { ...state, activeTaskId, tasks }, removed, error: '' };
}

export function selectMultiTask(value, id) {
  const state = normalizeMultiTaskSettings(value);
  const taskId = textOf(id);
  return state.tasks.some((task) => task.id === taskId) ? { ...state, activeTaskId: taskId } : state;
}
