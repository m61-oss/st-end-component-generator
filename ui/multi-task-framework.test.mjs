import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDefaultSettings } from '../settings/default-settings.js';

const indexSource = await readFile(new URL('../index.js', import.meta.url), 'utf8');

test('panel persists an explicit generation mode and normalized multi-task settings', () => {
  const defaults = createDefaultSettings();
  assert.equal(defaults.generationMode, 'single');
  assert.equal(defaults.multiTaskSettings.concurrency, 1);
  assert.match(indexSource, /normalizeMultiTaskSettings\(settings\.multiTaskSettings\)/);
  assert.match(indexSource, /renderGenerationModeSwitch\(mode, \{ switchingDisabled: running \}\)/);
});

test('workspace keeps the original generation DOM mounted and adds only multi-task chrome', () => {
  assert.doesNotMatch(indexSource, /st-esg-single-task-workspace/);
  assert.match(indexSource, /multiHost\.id = 'st-esg-multi-task-host'/);
  assert.match(indexSource, /workspace\.prepend\(modeHost, multiHost\)/);
  assert.doesNotMatch(indexSource, /st-esg-panel-footer'\)\?\.classList\.toggle\('st-esg-hidden'/);
  assert.match(indexSource, /st-esg-temporary-task-instruction/);
  assert.match(indexSource, /st-esg-preview/);
  assert.doesNotMatch(indexSource, /toggleAttribute\('disabled', mode === 'multi'\)/);
  assert.match(indexSource, /generate\?\.toggleAttribute\('disabled', !hasTasks\)/);
  assert.match(indexSource, /renderMultiTaskFramework/);
});

test('multi-task framework wires the shared settings surface and task view persistence', () => {
  for (const action of ['add', 'settings', 'rename', 'delete']) {
    assert.match(indexSource, new RegExp(`action === '${action}'`));
  }
  assert.match(indexSource, /data-generation-mode/);
  assert.match(indexSource, /data-generation-mode-settings/);
  assert.match(indexSource, /data-generation-history-open/);
  assert.match(indexSource, /showGenerationHistoryDialog/);
  assert.match(indexSource, /data-multi-task-id/);
  assert.match(indexSource, /captureActiveMultiTaskView/);
  assert.match(indexSource, /hydrateActiveMultiTaskView/);
  assert.doesNotMatch(indexSource, /data-multi-task-extra/);
});

test('switching to single mode restores an empty single workspace when no snapshot exists', () => {
  assert.match(indexSource, /else applyGenerationWorkspaceView\(singleTaskWorkspaceSnapshot \|\| \{\}\)/);
  assert.match(indexSource, /messageFloorPanelState\.mode === 'multi'[\s\S]{0,500}createFloorPanelState\(\{ enabled: true \}\)/);
});

test('multi-task startup batches synchronous queue transitions into one frame render', () => {
  const schedulerSource = indexSource.slice(
    indexSource.indexOf('function scheduleMultiTaskFrameworkRender'),
    indexSource.indexOf('function renderMultiTaskFramework'),
  );
  const transitionSource = indexSource.slice(
    indexSource.indexOf('onTransition: ({ taskId, status, value, error })'),
    indexSource.indexOf('execute: async (entry)'),
  );

  assert.match(schedulerSource, /multiTaskFrameworkRenderScheduled/);
  assert.match(schedulerSource, /requestAnimationFrame/);
  assert.match(schedulerSource, /renderMultiTaskRuntimeState\(\)/);
  assert.doesNotMatch(schedulerSource, /saveSettings\(\)|renderMultiTaskFramework\(\)/);
  assert.match(transitionSource, /scheduleMultiTaskFrameworkRender\(\)/);
  assert.doesNotMatch(transitionSource, /saveSettings\(\);[\s\S]{0,100}renderMultiTaskFramework\(\)/);
});

test('task switching updates only task views and persists the active id without a full framework render', () => {
  const selectionSource = indexSource.slice(
    indexSource.indexOf('function renderActiveMultiTaskViews'),
    indexSource.indexOf('function scheduleMultiTaskFrameworkRender'),
  );
  const floorTabSource = indexSource.slice(
    indexSource.indexOf("const multiTaskTab = event.target.closest('[data-multi-task-id]')"),
    indexSource.indexOf("const actionButton = event.target.closest('[data-floor-action]')"),
  );
  const workspaceTabSource = indexSource.slice(
    indexSource.indexOf(".on('click.stEsgMultiTask', '[data-multi-task-id]'"),
    indexSource.indexOf(".on('click.stEsgMultiTask', '[data-multi-task-action]'"),
  );

  assert.match(selectionSource, /persistActiveMultiTaskSelection\(\)/);
  assert.match(selectionSource, /renderActiveMultiTaskViews\(\)/);
  assert.match(selectionSource, /syncMessageFloorPanelTaskSelection\(\)/);
  assert.doesNotMatch(selectionSource, /saveSettings\(\)|renderMultiTaskFramework\(\)/);
  assert.match(floorTabSource, /selectActiveMultiTaskView/);
  assert.doesNotMatch(floorTabSource, /saveSettings\(\)|renderMultiTaskFramework\(\)/);
  assert.match(workspaceTabSource, /selectActiveMultiTaskView/);
  assert.doesNotMatch(workspaceTabSource, /saveSettings\(\)|renderMultiTaskFramework\(\)/);
});

test('hydrating a task result does not render anchors or resize the preview twice', () => {
  const applySource = indexSource.slice(
    indexSource.indexOf('function applyGenerationWorkspaceView'),
    indexSource.indexOf('function captureActiveMultiTaskView'),
  );

  assert.match(applySource, /renderGenerationResultPanel\(\)/);
  assert.doesNotMatch(applySource, /renderAnchorInsertionPlan\(/);
  assert.doesNotMatch(applySource, /resizeGeneratedPreview\(\)/);
});

test('transient multi-task actions use runtime refreshes instead of saving and rebuilding the framework', () => {
  const cancelSource = indexSource.slice(
    indexSource.indexOf('function cancelMultiTaskGeneration'),
    indexSource.indexOf('function getMultiTaskSchemeLists'),
  );
  const injectSource = indexSource.slice(
    indexSource.indexOf('async function injectMultiTasks'),
    indexSource.indexOf('async function undoMultiTaskInjections'),
  );
  const undoSource = indexSource.slice(
    indexSource.indexOf('async function undoMultiTaskInjections'),
    indexSource.indexOf('function getNextMultiTaskName'),
  );

  for (const source of [cancelSource, injectSource, undoSource]) {
    assert.match(source, /renderMultiTaskRuntimeState\(\)/);
    assert.doesNotMatch(source, /saveSettings\(\)|renderMultiTaskFramework\(\)/);
  }
});

test('high-frequency text inputs defer expensive full settings persistence', () => {
  assert.match(indexSource, /function scheduleSettingsSave\(\)/);
  for (const [start, end] of [
    ["$t('#st-esg-auto-generate-trigger').on('input'", "$t('#st-esg-auto-inject').on('change'"],
    ["$t('#st-esg-output-protocol-text').on('input'", "$t('#st-esg-output-protocol-role').on('change'"],
    ["$t('#st-esg-temporary-task-instruction').on('input'", "$t('#st-esg-clear-temporary-task-instruction').on('click'"],
    ["$t('#st-esg-api-key').on('input'", "$t('#st-esg-api-model-picker').on('change'"],
    ["$t('#st-esg-ball-size').on('input'", "$t('#st-esg-ball-opacity').on('input'"],
    ["$t('#st-esg-ball-opacity').on('input'", "targetDoc.getElementById('st-esg-ball-animation-enabled')"],
  ]) {
    const source = indexSource.slice(indexSource.indexOf(start), indexSource.indexOf(end));
    assert.match(source, /scheduleSettingsSave\(\)|markSchemeDirtyDeferred\('api'\)/);
    assert.doesNotMatch(source, /saveSettings\(\)/);
  }
});

test('large component and theater searches batch DOM filtering to one animation frame', () => {
  assert.match(indexSource, /function scheduleComponentListFilters\(\)/);
  assert.match(indexSource, /function scheduleTheaterLibraryFilters\(\)/);
  const componentSearch = indexSource.slice(
    indexSource.indexOf("list.find('.st-esg-component-search-input').on('input'"),
    indexSource.indexOf("list.find('.st-esg-component-filter-select').on('change'"),
  );
  const theaterSearch = indexSource.slice(
    indexSource.indexOf("host.find('.st-esg-theater-search-input').on('input'"),
    indexSource.indexOf("host.find('.st-esg-theater-filter-select').on('change'"),
  );
  assert.match(componentSearch, /scheduleComponentListFilters\(\)/);
  assert.doesNotMatch(componentSearch, /applyComponentListFilters\(\)/);
  assert.match(theaterSearch, /scheduleTheaterLibraryFilters\(\)/);
  assert.doesNotMatch(theaterSearch, /applyTheaterLibraryFilters\(\)/);
});

test('generation history is a shared five-entry dialog instead of a workspace card', () => {
  assert.match(indexSource, /st-esg-generation-history-dialog/);
  assert.match(indexSource, /最多保留五条/);
  assert.match(indexSource, /querySelector\('\.st-esg-generation-history-card'\)\?\.remove\(\)/);
});

test('the one settings gear exposes common and task configuration pages regardless of generation mode', () => {
  assert.match(indexSource, /data-generation-settings-card-host/);
  assert.match(indexSource, /data-single-task-injection-host/);
  assert.match(indexSource, /data-generation-settings-page="general"/);
  assert.match(indexSource, /data-generation-settings-page="tasks"/);
  assert.match(indexSource, /data-generation-settings-panel="general"/);
  assert.match(indexSource, /data-generation-settings-panel="tasks"/);
  assert.match(indexSource, />通用设置</);
  assert.match(indexSource, />任务配置</);
  assert.doesNotMatch(indexSource, /data-multi-task-settings-tab=/);
  assert.doesNotMatch(indexSource, /data-multi-task-settings-panel=/);
  assert.match(indexSource, /function showGenerationModeSettingsDialog\(\)\s*\{\s*showMultiTaskSettingsDialog\(\);\s*\}/);
  assert.doesNotMatch(indexSource, /name="autoInject"/);
  assert.doesNotMatch(indexSource, /name="rollbackBeforeGeneration"/);
  assert.doesNotMatch(indexSource, /组件方案将在后续阶段接入/);
});

test('task configuration lists every task with inline management instead of a current-task picker', () => {
  assert.match(indexSource, /state\.tasks\.map\(\(item\)\s*=>/);
  assert.match(indexSource, /data-multi-task-settings-task-id=/);
  assert.match(indexSource, /data-multi-task-task-field="presetSchemeId"/);
  assert.match(indexSource, />多任务<\/strong>[\s\S]*data-multi-task-settings-action="add"/);
  assert.match(indexSource, /data-multi-task-settings-action="rename"[^>]*data-multi-task-task-id=/);
  assert.match(indexSource, /data-multi-task-settings-action="delete"[^>]*data-multi-task-task-id=/);
  assert.match(indexSource, /closest\('\[data-multi-task-settings-task-id\]'\)/);
  assert.doesNotMatch(indexSource, /data-multi-task-settings-select/);
});

test('multi-task controls save immediately without save or cancel actions', () => {
  const settingsDialogSource = indexSource.slice(
    indexSource.indexOf('function showMultiTaskSettingsDialog'),
    indexSource.indexOf('function showGenerationModeSettingsDialog'),
  );
  assert.match(settingsDialogSource, /data-multi-task-task-field.*addEventListener\('change'/s);
  assert.match(settingsDialogSource, /name="concurrency".*addEventListener\('change'/s);
  assert.match(settingsDialogSource, /超出并发数的任务会自动排队/);
  assert.match(settingsDialogSource, /replaceMultiTask\(taskId, \{ \[field\]: value \}\)/);
  assert.doesNotMatch(settingsDialogSource, /type="submit"/);
  assert.doesNotMatch(settingsDialogSource, />保存<|>取消</);
});

test('task creation exposes its five-task limit and blocks before opening the name dialog', () => {
  const settingsDialogSource = indexSource.slice(
    indexSource.indexOf('function showMultiTaskSettingsDialog'),
    indexSource.indexOf('function showGenerationModeSettingsDialog'),
  );
  const addActionSource = indexSource.slice(
    indexSource.indexOf("if (action === 'add')"),
    indexSource.indexOf("if (action === 'global-settings')"),
  );

  assert.match(settingsDialogSource, /添加任务 \$\{state\.tasks\.length\}\/5/);
  assert.match(settingsDialogSource, /action === 'add'[\s\S]*tasks\.length >= 5[\s\S]*notifyStatus\('最多只能添加五个任务。'/);
  assert.ok(addActionSource.indexOf('tasks.length >= 5') < addActionSource.indexOf('requestTextInputDialog'));
});
