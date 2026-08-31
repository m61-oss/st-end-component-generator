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

test('floor panel retry regenerates only failed multi-task items', () => {
  const actionSource = indexSource.slice(
    indexSource.indexOf('async function runMessageFloorPanelAction'),
    indexSource.indexOf('function bindMessageFloorPanel'),
  );

  assert.match(actionSource, /MULTI_TASK_STATUS\.ERROR/);
  assert.match(actionSource, /const failedTaskIds = scoped\.tasks/);
  assert.match(actionSource, /action === 'retry'[\s\S]*generateMultiTasks\(failedTaskIds\)/);
  assert.match(actionSource, /action === 'generate'[\s\S]*generateMultiTasks\(allTaskIds\)/);
});

test('floor panel total generation always includes every configured task after a partial run', () => {
  const actionSource = indexSource.slice(
    indexSource.indexOf('async function runMessageFloorPanelAction'),
    indexSource.indexOf('function bindMessageFloorPanel'),
  );

  assert.match(actionSource, /const allTaskIds = allTasks\.map\(\(task\) => task\.id\)/);
  assert.match(actionSource, /action === 'generate'[\s\S]*generateMultiTasks\(allTaskIds\)/);
  assert.doesNotMatch(actionSource, /generationTaskIds = floorTaskIds\.length/);
});

test('multi-task stream updates the floor panel without replacing its expanded structure', () => {
  assert.match(indexSource, /function updateMessageFloorPanelMultiTaskStream/);
  assert.match(indexSource, /updateMultiTaskStream[\s\S]*updateMessageFloorPanelMultiTaskStream\(taskId/);
  assert.match(indexSource, /thinkingWasOpen[\s\S]*\.st-esg-floor-thinking[\s\S]*\.open = true/);
});

test('editing generated text synchronizes the existing floor field without rebuilding the panel', () => {
  const previewInputSource = indexSource.slice(
    indexSource.indexOf("$t('#st-esg-preview').on('input'"),
    indexSource.indexOf("$t('#st-esg-api-url').on('input'"),
  );

  assert.match(previewInputSource, /refreshMessageFloorPanelStreamContent\(\)/);
  assert.doesNotMatch(previewInputSource, /renderMessageFloorPanel\(\{ force: true \}\)/);
  assert.equal((previewInputSource.match(/saveSettings\(\)/g) || []).length, 0);
});

test('editing an anchor synchronizes only the matching floor card without rebuilding the panel', () => {
  const anchorInputSource = indexSource.slice(
    indexSource.indexOf("off('input.stEsgAnchor change.stEsgAnchor')"),
    indexSource.indexOf("$t('.st-esg-scheme-select').on('change'"),
  );

  assert.match(indexSource, /function refreshMessageFloorPanelAnchorItem\(index\)/);
  assert.match(anchorInputSource, /refreshMessageFloorPanelAnchorItem\(index\)/);
  assert.doesNotMatch(anchorInputSource, /renderMessageFloorPanel\(\{ force: true \}\)/);
});

test('editing a floor result does not persist transient output on every keystroke', () => {
  const floorInputSource = indexSource.slice(
    indexSource.indexOf("panel.addEventListener('input'"),
    indexSource.indexOf("panel.addEventListener('click'", indexSource.indexOf("panel.addEventListener('input'")),
  );

  assert.doesNotMatch(floorInputSource, /saveSettings\(\)/);
  assert.match(floorInputSource, /scheduleAnchorEditPersistence\(\)/);
});
