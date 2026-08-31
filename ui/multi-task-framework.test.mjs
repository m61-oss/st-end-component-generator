import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexSource = await readFile(new URL('../index.js', import.meta.url), 'utf8');

test('panel persists an explicit generation mode and normalized multi-task settings', () => {
  assert.match(indexSource, /generationMode:\s*'single'/);
  assert.match(indexSource, /multiTaskSettings:\s*\{\s*concurrency:\s*1/);
  assert.match(indexSource, /normalizeMultiTaskSettings\(settings\.multiTaskSettings\)/);
  assert.match(indexSource, /renderGenerationModeSwitch\(mode\)/);
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
  assert.match(schedulerSource, /saveSettings\(\);[\s\S]{0,100}renderMultiTaskFramework\(\)/);
  assert.match(transitionSource, /scheduleMultiTaskFrameworkRender\(\)/);
  assert.doesNotMatch(transitionSource, /saveSettings\(\);[\s\S]{0,100}renderMultiTaskFramework\(\)/);
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
