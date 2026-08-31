import {
  MULTI_TASK_STATUS,
  createMultiTask,
  deleteMultiTask,
  normalizeMultiTaskSettings,
  renameMultiTask,
} from './multi-task-state.js';

const textOf = (value) => String(value ?? '').trim();

export function getNextMultiTaskName(tasks = []) {
  const names = new Set(tasks.map((task) => task.name));
  let index = 1;
  while (names.has(`任务 ${index}`)) index += 1;
  return `任务 ${index}`;
}

export function createMultiTaskTaskController({
  getSettings,
  setMultiTaskSettings,
  getActiveTask,
  requestTextInput,
  notify,
  confirm,
  saveSettings,
  renderFramework,
  showSettings,
  cancelGeneration,
  generate,
  inject,
  undo,
  followTavernValue = '__follow_tavern__',
} = {}) {
  const reopen = (enabled) => { if (enabled) showSettings('tasks'); };
  const defaultSchemeId = (value) => textOf(value) === followTavernValue ? '' : textOf(value);
  const getNewTaskDefaults = () => {
    const settings = getSettings();
    return {
      apiSchemeId: textOf(settings.selectedApiSchemeId),
      taskSchemeId: textOf(settings.selectedTaskSchemeId),
      presetSchemeId: defaultSchemeId(settings.selectedPresetSchemeId),
      worldbookSchemeId: defaultSchemeId(settings.selectedWorldbookSchemeId),
      componentSchemeId: textOf(settings.selectedComponentSchemeId),
      injectMode: settings.injectMode === 'anchor' ? 'anchor' : 'append',
    };
  };

  async function handle(action, reopenSettings = false, requestedTaskId = '') {
    const settings = getSettings();
    const state = normalizeMultiTaskSettings(settings.multiTaskSettings);
    const activeTask = state.tasks.find((task) => task.id === requestedTaskId) || getActiveTask();
    if (action === 'add') {
      if (state.tasks.length >= 5) {
        notify('最多只能添加五个任务。', 'warning');
        reopen(reopenSettings);
        return;
      }
      const name = await requestTextInput({ title: '添加任务', label: '任务名称', placeholder: '输入便于识别的任务名称', value: getNextMultiTaskName(state.tasks) });
      if (!name) { reopen(reopenSettings); return; }
      const result = createMultiTask(state, name, getNewTaskDefaults());
      if (result.error) {
        notify(result.error === 'duplicate-name' ? '任务名称不能重复。' : '最多只能添加五个任务。', 'warning');
        reopen(reopenSettings);
        return;
      }
      setMultiTaskSettings(result.state);
      saveSettings();
      renderFramework();
      showSettings('tasks');
      return;
    }
    if (action === 'global-settings') { showSettings('tasks'); return; }
    if (!activeTask) return;
    if (action === 'settings') { showSettings('tasks'); return; }
    if (action === 'generate') {
      if ([MULTI_TASK_STATUS.QUEUED, MULTI_TASK_STATUS.GENERATING].includes(activeTask.status)) cancelGeneration([activeTask.id]);
      else await generate([activeTask.id]);
      return;
    }
    if (action === 'inject') { await inject([activeTask.id]); return; }
    if (action === 'undo') { await undo([activeTask.id], { requireConfirmation: true }); return; }
    if (action === 'rename') {
      const name = await requestTextInput({ title: '重命名任务', label: '任务名称', value: activeTask.name });
      if (!name || name === activeTask.name) { reopen(reopenSettings); return; }
      const result = renameMultiTask(state, activeTask.id, name);
      if (result.error) { notify('任务名称不能为空或与其他任务重复。', 'warning'); reopen(reopenSettings); return; }
      setMultiTaskSettings(result.state);
      saveSettings();
      renderFramework();
      reopen(reopenSettings);
      return;
    }
    if (action === 'delete') {
      if (!confirm(`删除任务“${activeTask.name}”？\n\n当前框架中的任务配置和未接入的临时结果会一并删除。`)) { reopen(reopenSettings); return; }
      cancelGeneration([activeTask.id]);
      setMultiTaskSettings(deleteMultiTask(state, activeTask.id).state);
      saveSettings();
      renderFramework();
      reopen(reopenSettings);
    }
  }

  return { handle, getNewTaskDefaults };
}
