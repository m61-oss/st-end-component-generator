import test from 'node:test';
import assert from 'node:assert/strict';

import { createMultiTaskWorkspaceController } from './multi-task-workspace-controller.js';

test('selecting a task captures the old view and persists only the active task id', () => {
  const events = [];
  let settings = {
    generationMode: 'multi',
    multiTaskSettings: {
      activeTaskId: 'a',
      tasks: [{ id: 'a' }, { id: 'b' }],
    },
  };
  const store = { multiTaskSettings: { concurrency: 2 } };
  const controller = createMultiTaskWorkspaceController({
    getSettings: () => settings,
    setMultiTaskSettings: (next) => { settings = { ...settings, multiTaskSettings: next }; },
    normalizeSettings: (value) => value,
    selectTask: (state, id) => ({ ...state, activeTaskId: id }),
    captureWorkspaceView: () => ({ output: 'draft' }),
    mergeWorkspaceView: (task, view) => ({ ...view, id: task.id }),
    replaceTask: (id, patch) => events.push(['replace', id, patch.output]),
    getSettingsStore: () => store,
    saveSettingsDebounced: () => events.push(['persist']),
    renderActiveViews: () => events.push(['render']),
  });

  controller.selectActiveTask('b');

  assert.equal(settings.multiTaskSettings.activeTaskId, 'b');
  assert.deepEqual(store.multiTaskSettings, { concurrency: 2, activeTaskId: 'b' });
  assert.deepEqual(events, [
    ['replace', 'a', 'draft'],
    ['persist'],
    ['render'],
  ]);
});
