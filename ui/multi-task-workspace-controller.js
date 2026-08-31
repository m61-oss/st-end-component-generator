import { MULTI_TASK_STATUS, mergeMultiTaskWorkspaceView, normalizeMultiTaskSettings, selectMultiTask } from '../generation/multi-task-state.js';

const defaultTextOf = (value) => String(value ?? '').trim();

export function createMultiTaskWorkspaceController(deps = {}) {
  const {
    getSettings,
    setMultiTaskSettings,
    normalizeSettings = normalizeMultiTaskSettings,
    selectTask = selectMultiTask,
    mergeWorkspaceView = mergeMultiTaskWorkspaceView,
    status = MULTI_TASK_STATUS,
    textOf = defaultTextOf,
    captureWorkspaceView = () => ({}),
    applyWorkspaceView = () => {},
    replaceTask = () => {},
    getSettingsStore = () => ({}),
    saveSettingsDebounced = () => {},
    getDialog = () => null,
    renderWorkspace = () => '',
    renderModeSwitch = () => '',
    getSingleGenerationRunning = () => false,
    syncFloorSelection = () => {},
    syncFloorState = () => {},
    requestFrame,
    defer = (callback) => setTimeout(callback, 0),
  } = deps;
  let renderScheduled = false;

  const readSettings = () => getSettings();
  const readState = () => normalizeSettings(readSettings().multiTaskSettings);
  const getActiveTask = () => {
    const state = readState();
    return state.tasks.find((task) => task.id === state.activeTaskId) || state.tasks[0] || null;
  };

  function captureActiveTaskView() {
    if (readSettings().generationMode !== 'multi') return;
    const task = getActiveTask();
    if (!task) return;
    replaceTask(task.id, mergeWorkspaceView(task, captureWorkspaceView()));
  }

  function hydrateActiveTaskView() {
    applyWorkspaceView(getActiveTask() || {});
  }

  function persistActiveTaskSelection() {
    const store = getSettingsStore();
    const persisted = store.multiTaskSettings && typeof store.multiTaskSettings === 'object'
      ? store.multiTaskSettings
      : {};
    store.multiTaskSettings = { ...persisted, activeTaskId: readState().activeTaskId };
    saveSettingsDebounced();
  }

  function defaultRenderActiveViews() {
    const settings = readSettings();
    const multiHost = getDialog()?.querySelector('#st-esg-multi-task-host');
    if (multiHost) multiHost.innerHTML = renderWorkspace(settings.multiTaskSettings);
    hydrateActiveTaskView();
    if (settings.messageFloorPanelEnabled) syncFloorSelection();
  }
  const renderActiveViews = deps.renderActiveViews || defaultRenderActiveViews;

  function selectActiveTask(taskId) {
    const state = readState();
    const nextTaskId = textOf(taskId);
    if (!nextTaskId || nextTaskId === state.activeTaskId || !state.tasks.some((task) => task.id === nextTaskId)) return;
    captureActiveTaskView();
    setMultiTaskSettings(selectTask(state, nextTaskId));
    persistActiveTaskSelection();
    renderActiveViews();
  }

  function updateActionState(dialog, multiState = readState()) {
    const hasTasks = multiState.tasks.length > 0;
    const hasResult = multiState.tasks.some((task) => (
      [status.READY, status.UNDONE].includes(task.status)
      && (String(task.output || '').trim() || task.anchorItems?.length)
    ));
    const hasUndo = multiState.tasks.some((task) => task.injectionRecord);
    const running = multiState.tasks.some((task) => [status.QUEUED, status.GENERATING].includes(task.status));
    const generate = dialog?.querySelector('#st-esg-generate');
    generate?.toggleAttribute('disabled', !hasTasks);
    generate?.classList.toggle('disabled', !hasTasks);
    generate?.classList.toggle('st-esg-action-running', running);
    generate?.querySelector('i')?.setAttribute('class', running ? 'fa-solid fa-stop' : 'fa-solid fa-wand-magic-sparkles');
    generate?.querySelector('span')?.replaceChildren(running ? '停止全部' : '生成全部');
    const inject = dialog?.querySelector('#st-esg-inject');
    inject?.toggleAttribute('disabled', !hasResult || running);
    inject?.classList.toggle('disabled', !hasResult || running);
    const undo = dialog?.querySelector('#st-esg-undo-injection');
    undo?.toggleAttribute('disabled', !hasUndo);
    undo?.classList.toggle('disabled', !hasUndo);
    undo?.classList.toggle('st-esg-hidden', !hasUndo);
  }

  function renderModeSwitchControl(dialog = getDialog()) {
    const modeHost = dialog?.querySelector('#st-esg-generation-mode-host');
    if (!modeHost) return;
    const mode = readSettings().generationMode === 'multi' ? 'multi' : 'single';
    modeHost.innerHTML = renderModeSwitch(mode, { switchingDisabled: isAnyGenerationRunning() });
  }

  function renderRuntimeState() {
    const settings = readSettings();
    if (settings.generationMode !== 'multi') return;
    const dialog = getDialog();
    const multiState = readState();
    renderModeSwitchControl(dialog);
    const multiHost = dialog?.querySelector('#st-esg-multi-task-host');
    if (multiHost) multiHost.innerHTML = renderWorkspace(multiState);
    updateActionState(dialog, multiState);
    hydrateActiveTaskView();
    if (settings.messageFloorPanelEnabled) syncFloorState();
  }

  function isAnyGenerationRunning() {
    if (getSingleGenerationRunning()) return true;
    return readState().tasks.some((task) => [status.QUEUED, status.GENERATING].includes(task.status));
  }

  function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    const flush = () => {
      renderScheduled = false;
      renderRuntimeState();
    };
    if (typeof requestFrame === 'function') requestFrame(flush);
    else defer(flush);
  }

  return {
    getActiveTask,
    captureActiveTaskView,
    hydrateActiveTaskView,
    persistActiveTaskSelection,
    renderActiveViews,
    selectActiveTask,
    updateActionState,
    renderRuntimeState,
    isAnyGenerationRunning,
    renderModeSwitchControl,
    scheduleRender,
  };
}
