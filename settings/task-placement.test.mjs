import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TASK_PLACEMENT_AFTER_CHAT_HISTORY,
  resolveTaskPlacementSelection,
} from './task-placement.js';

const items = [
  { id: 'system-entry', markerType: 'systemPrompt' },
  { id: 'history-entry', markerType: 'chatHistory' },
];

test('defaults an empty placement to chatHistory when it exists', () => {
  assert.deepEqual(resolveTaskPlacementSelection(items, ''), {
    selectedId: 'history-entry',
    storedId: TASK_PLACEMENT_AFTER_CHAT_HISTORY,
  });
});

test('defaults a stale placement to chatHistory when it exists', () => {
  assert.deepEqual(resolveTaskPlacementSelection(items, 'removed-entry'), {
    selectedId: 'history-entry',
    storedId: TASK_PLACEMENT_AFTER_CHAT_HISTORY,
  });
});

test('preserves an existing explicit placement', () => {
  assert.deepEqual(resolveTaskPlacementSelection(items, 'system-entry'), {
    selectedId: 'system-entry',
    storedId: 'system-entry',
  });
});

test('keeps the placement empty when chatHistory does not exist', () => {
  assert.deepEqual(resolveTaskPlacementSelection(items.slice(0, 1), ''), {
    selectedId: '',
    storedId: '',
  });
});
