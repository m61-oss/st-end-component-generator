import { MULTI_TASK_STATUS, normalizeMultiTaskSettings } from '../generation/multi-task-state.js';

const TRANSIENT_GENERATION_SETTING_KEYS = Object.freeze([
  'lastGenerated',
  'lastGeneratedAnchorItems',
  'lastGeneratedAnchorWarnings',
  'lastGeneratedResultMode',
  'lastGeneratedAnchorTargetIndex',
  'lastGeneratedStatusPlaceholderPresent',
  'lastGeneratedThinking',
  'lastGenerationError',
]);

export function resetTransientGenerationState(target = {}) {
  target.lastGenerated = '';
  target.lastGeneratedAnchorItems = [];
  target.lastGeneratedAnchorWarnings = [];
  target.lastGeneratedResultMode = 'standard';
  target.lastGeneratedAnchorTargetIndex = null;
  target.lastGeneratedStatusPlaceholderPresent = false;
  target.lastGeneratedThinking = [];
  target.lastGenerationError = null;
  return target;
}

export function removeTransientGenerationSettings(store = {}) {
  let changed = false;
  for (const key of TRANSIENT_GENERATION_SETTING_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(store, key)) continue;
    delete store[key];
    changed = true;
  }
  return changed;
}

export function createPersistedMultiTaskSettings(value = {}) {
  const state = normalizeMultiTaskSettings(value);
  return {
    concurrency: state.concurrency,
    injectionIntervalSeconds: state.injectionIntervalSeconds,
    injectionOrder: state.injectionOrder,
    activeTaskId: state.activeTaskId,
    tasks: state.tasks.map((task) => ({
      id: task.id,
      name: task.name,
      apiSchemeId: task.apiSchemeId,
      taskSchemeId: task.taskSchemeId,
      presetSchemeId: task.presetSchemeId,
      worldbookSchemeId: task.worldbookSchemeId,
      componentSchemeId: task.componentSchemeId,
      injectMode: task.injectMode,
      extraInstruction: task.extraInstruction,
      status: MULTI_TASK_STATUS.IDLE,
    })),
  };
}
