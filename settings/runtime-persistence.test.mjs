import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPersistedMultiTaskSettings,
  removeTransientGenerationSettings,
  resetTransientGenerationState,
} from './runtime-persistence.js';

test('transient generation results are removed without touching persistent settings', () => {
  const store = {
    theme: 'dark',
    lastGenerated: 'temporary output',
    lastGeneratedAnchorItems: [{ content: 'temporary anchor' }],
    lastGeneratedThinking: ['temporary thinking'],
    lastGenerationError: { message: 'temporary error' },
  };

  assert.equal(removeTransientGenerationSettings(store), true);
  assert.deepEqual(store, { theme: 'dark' });
  assert.equal(removeTransientGenerationSettings(store), false);
});

test('runtime generation fields reset to an empty workspace without replacing the settings object', () => {
  const settings = {
    theme: 'light',
    lastGenerated: 'output',
    lastGeneratedAnchorItems: [{ content: 'anchor' }],
    lastGeneratedAnchorWarnings: ['warning'],
    lastGeneratedResultMode: 'anchor',
    lastGeneratedAnchorTargetIndex: 9,
    lastGeneratedStatusPlaceholderPresent: true,
    lastGeneratedThinking: ['thinking'],
    lastGenerationError: { message: 'error' },
  };

  const result = resetTransientGenerationState(settings);

  assert.equal(result, settings);
  assert.deepEqual(settings, {
    theme: 'light',
    lastGenerated: '',
    lastGeneratedAnchorItems: [],
    lastGeneratedAnchorWarnings: [],
    lastGeneratedResultMode: 'standard',
    lastGeneratedAnchorTargetIndex: null,
    lastGeneratedStatusPlaceholderPresent: false,
    lastGeneratedThinking: [],
    lastGenerationError: null,
  });
});

test('persisted multi-task settings contain configuration but discard runtime results and targets', () => {
  const persisted = createPersistedMultiTaskSettings({
    concurrency: 3,
    injectionIntervalSeconds: 2,
    injectionOrder: 'task',
    activeTaskId: 'task-a',
    tasks: [{
      id: 'task-a',
      name: 'Task A',
      apiSchemeId: 'api-a',
      taskSchemeId: 'instruction-a',
      presetSchemeId: 'preset-a',
      worldbookSchemeId: 'world-a',
      componentSchemeId: 'component-a',
      injectMode: 'anchor',
      extraInstruction: 'extra',
      status: 'injected',
      output: 'runtime output',
      thinking: ['runtime thinking'],
      target: { chatId: 'chat-a', messageIndex: 7 },
      injectionRecord: { chatId: 'chat-a', targetIndex: 7 },
      runId: 'runtime-run',
      error: { message: 'runtime error' },
    }],
  });

  assert.deepEqual(persisted, {
    concurrency: 3,
    injectionIntervalSeconds: 2,
    injectionOrder: 'task',
    activeTaskId: 'task-a',
    tasks: [{
      id: 'task-a',
      name: 'Task A',
      apiSchemeId: 'api-a',
      taskSchemeId: 'instruction-a',
      presetSchemeId: 'preset-a',
      worldbookSchemeId: 'world-a',
      componentSchemeId: 'component-a',
      injectMode: 'anchor',
      extraInstruction: 'extra',
      status: 'idle',
    }],
  });
});
