import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexSource = await readFile(new URL('../index.js', import.meta.url), 'utf8');

test('persists multi-task schemes and participation but never temporary instructions', () => {
  assert.match(indexSource, /multiTaskSchemes:\s*\[\]/);
  assert.match(indexSource, /selectedMultiTaskSchemeId:\s*''/);
  const saveStart = indexSource.indexOf('function saveSettings()');
  const saveEnd = indexSource.indexOf('function isAnimaMemoryEnabled', saveStart);
  const saveSource = indexSource.slice(saveStart, saveEnd);
  assert.match(saveSource, /batchEnabled:\s*task\.batchEnabled/);
  assert.doesNotMatch(saveSource, /extraInstruction:\s*task\.extraInstruction/);
});

test('multi-task settings expose scheme management and chat binding', () => {
  assert.match(indexSource, /renderSchemeManager\('multiTask'\)/);
  assert.match(indexSource, /data-bind-multi-task-chat/);
  assert.match(indexSource, /applyMultiTaskSchemeToCurrentChat/);
  assert.match(indexSource, /restoreBoundMultiTaskSchemeForCurrentChat/);
  const managerStart = indexSource.indexOf('function renderSchemeManager(type)');
  const managerEnd = indexSource.indexOf('function renderApiRetrySettings()', managerStart);
  const managerSource = indexSource.slice(managerStart, managerEnd);
  assert.match(managerSource, /type === 'worldbook'/);
  assert.match(managerSource, /type === 'multiTask'/);
  assert.match(managerSource, /st-esg-icon-btn[^"']*st-esg-bind-chat-scheme/);
  assert.match(managerSource, /fa-link/);
  assert.doesNotMatch(indexSource, /st-esg-multi-task-scheme-row/);
  assert.doesNotMatch(indexSource, /st-esg-chat-worldbook-actions/);
});

test('batch toggle is handled without disabling manual per-task actions', () => {
  assert.match(indexSource, /action === 'toggle-batch'/);
  assert.match(indexSource, /setMultiTaskBatchEnabled/);
  assert.match(indexSource, /getMultiTasksForAction/);
});
