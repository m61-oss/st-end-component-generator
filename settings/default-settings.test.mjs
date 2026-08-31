import assert from 'node:assert/strict';
import test from 'node:test';

import { ANCHOR_OUTPUT_PROTOCOL_SYSTEM_PROMPT, OUTPUT_PROTOCOL_SYSTEM_PROMPT } from '../generation/output-protocol.js';
import { CHAT_HISTORY_RANGE_VISIBLE } from '../generation/chat-history-range.js';
import { TASK_PLACEMENT_AFTER_CHAT_HISTORY } from './task-placement.js';
import {
  MAX_OUTPUT_TOKENS,
  SOURCE_MODE_IMPORT,
  SOURCE_MODE_PROMPT,
  createDefaultSettings,
} from './default-settings.js';

test('default settings preserve the existing generation and source behavior', () => {
  const settings = createDefaultSettings();

  assert.equal(settings.generationMode, 'single');
  assert.deepEqual(settings.multiTaskSettings, {
    concurrency: 1,
    injectionIntervalSeconds: 1,
    injectionOrder: 'completion',
    activeTaskId: '',
    tasks: [],
  });
  assert.equal(settings.standardOutputProtocol, OUTPUT_PROTOCOL_SYSTEM_PROMPT);
  assert.equal(settings.anchorOutputProtocol, ANCHOR_OUTPUT_PROTOCOL_SYSTEM_PROMPT);
  assert.equal(settings.maxTokens, String(MAX_OUTPUT_TOKENS));
  assert.equal(settings.historyRangeMode, CHAT_HISTORY_RANGE_VISIBLE);
  assert.equal(settings.taskPlacementAfterSourceId, TASK_PLACEMENT_AFTER_CHAT_HISTORY);
  assert.equal(settings.sourceMode, SOURCE_MODE_PROMPT);
  assert.deepEqual(settings.sourceModes, { preset: SOURCE_MODE_PROMPT, worldbook: SOURCE_MODE_PROMPT });
  assert.equal(SOURCE_MODE_IMPORT, 'import');
});

test('each default settings instance owns its mutable collections', () => {
  const first = createDefaultSettings();
  const second = createDefaultSettings();

  first.multiTaskSettings.tasks.push({ id: 'task-a' });
  first.components.push({ id: 'component-a' });
  first.sourceModes.preset = SOURCE_MODE_IMPORT;

  assert.deepEqual(second.multiTaskSettings.tasks, []);
  assert.deepEqual(second.components, []);
  assert.equal(second.sourceModes.preset, SOURCE_MODE_PROMPT);
});
