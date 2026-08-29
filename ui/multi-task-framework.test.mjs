import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexSource = await readFile(new URL('../index.js', import.meta.url), 'utf8');

test('panel persists an explicit generation mode and normalized multi-task settings', () => {
  assert.match(indexSource, /generationMode:\s*'single'/);
  assert.match(indexSource, /multiTaskSettings:\s*\{/);
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
  assert.match(indexSource, /toggleAttribute\('disabled', mode === 'multi'\)/);
  assert.match(indexSource, /renderMultiTaskFramework/);
});

test('multi-task framework wires mode-specific settings and shared task view persistence', () => {
  for (const action of ['add', 'settings', 'rename', 'delete']) {
    assert.match(indexSource, new RegExp(`action === '${action}'`));
  }
  assert.match(indexSource, /data-generation-mode/);
  assert.match(indexSource, /data-generation-mode-settings/);
  assert.match(indexSource, /data-multi-task-id/);
  assert.match(indexSource, /captureActiveMultiTaskView/);
  assert.match(indexSource, /hydrateActiveMultiTaskView/);
  assert.doesNotMatch(indexSource, /data-multi-task-extra/);
  assert.match(indexSource, /new targetWindow\.FormData\(event\.currentTarget\)/);
});

test('multi-task settings follow the approved task and global tab layout', () => {
  assert.match(indexSource, /data-multi-task-settings-tab="task"/);
  assert.match(indexSource, /data-multi-task-settings-tab="global"/);
  assert.match(indexSource, /data-multi-task-settings-panel="task"/);
  assert.match(indexSource, /data-multi-task-settings-panel="global"/);
  assert.match(indexSource, /data-multi-task-settings-tab.*addEventListener\('click'/s);
  assert.match(indexSource, /componentSchemeId:\s*textOf\(form\.get\('componentSchemeId'\)\)/);
  assert.doesNotMatch(indexSource, /组件方案将在后续阶段接入/);
});
