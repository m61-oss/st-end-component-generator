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

test('workspace keeps the existing single-task DOM and adds an isolated multi-task host', () => {
  assert.match(indexSource, /st-esg-single-task-workspace/);
  assert.match(indexSource, /multiHost\.id = 'st-esg-multi-task-host'/);
  assert.match(indexSource, /renderMultiTaskFramework/);
});

test('multi-task framework wires mode, add, select, rename, delete, settings, and extra instruction actions', () => {
  for (const action of ['add', 'settings', 'rename', 'delete']) {
    assert.match(indexSource, new RegExp(`action === '${action}'`));
  }
  assert.match(indexSource, /data-generation-mode/);
  assert.match(indexSource, /data-multi-task-id/);
  assert.match(indexSource, /data-multi-task-extra/);
  assert.match(indexSource, /new targetWindow\.FormData\(event\.currentTarget\)/);
});
