import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const indexSource = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const styleSource = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');

test('floor panel renders the shared multi-task tabs and selected task result', () => {
  assert.match(indexSource, /createMultiTaskFloorPanelView/);
  assert.match(indexSource, /state\.mode === 'multi'[\s\S]*renderMultiTaskWorkspace\(settings\.multiTaskSettings\)/);
  assert.match(styleSource, /\.st-esg-floor-multi-task/);
});

test('floor panel routes global and selected actions through multi-task handlers', () => {
  assert.match(indexSource, /messageFloorPanelState\.mode === 'multi'[\s\S]*generateMultiTasks\(\)/);
  assert.match(indexSource, /messageFloorPanelState\.mode === 'multi'[\s\S]*injectMultiTasks\(\)/);
  assert.match(indexSource, /messageFloorPanelState\.mode === 'multi'[\s\S]*undoMultiTaskInjections/);
  assert.match(indexSource, /data-multi-task-action[\s\S]*handleMultiTaskAction/);
});

test('multi-task stream updates the floor panel without replacing its expanded structure', () => {
  assert.match(indexSource, /function updateMessageFloorPanelMultiTaskStream/);
  assert.match(indexSource, /updateMultiTaskStream[\s\S]*updateMessageFloorPanelMultiTaskStream\(taskId/);
  assert.match(indexSource, /thinkingWasOpen[\s\S]*\.st-esg-floor-thinking[\s\S]*\.open = true/);
});
