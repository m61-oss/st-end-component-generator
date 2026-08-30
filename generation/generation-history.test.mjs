import assert from 'node:assert/strict';
import test from 'node:test';

import {
  loadGenerationHistory,
  recordGenerationResult,
  updateGenerationHistoryEntry,
} from './generation-history.js';

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
}

test('records and loads structured anchor generation results', () => {
  const storage = createStorage();
  const result = {
    kind: 'anchor',
    anchorItems: [
      { position: 'end', content: '尾部组件' },
      { position: 'after', anchor: '原文', content: '旁边组件' },
    ],
    warnings: ['第 3 项未匹配'],
  };

  const recorded = recordGenerationResult(storage, 'history', result, 123);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].kind, 'anchor');
  assert.deepEqual(recorded[0].anchorItems, result.anchorItems);
  assert.deepEqual(recorded[0].warnings, result.warnings);

  assert.deepEqual(loadGenerationHistory(storage, 'history'), recorded);
});

test('updates an anchor history entry after the user edits its anchor', () => {
  const storage = createStorage();
  const recorded = recordGenerationResult(storage, 'history', {
    kind: 'anchor',
    anchorItems: [{ position: 'after', anchor: '旧锚点', content: '内容' }],
  }, 123);
  const updated = updateGenerationHistoryEntry(storage, 'history', recorded[0].id, {
    anchorItems: [{ position: 'after', anchor: '新锚点', content: '内容' }],
  });

  assert.equal(updated[0].anchorItems[0].anchor, '新锚点');
  assert.equal(loadGenerationHistory(storage, 'history')[0].anchorItems[0].anchor, '新锚点');
});

test('keeps legacy text history entries readable', () => {
  const storage = createStorage();
  storage.setItem('history', JSON.stringify([{ id: 'legacy', generatedAt: 1, content: '旧内容' }]));
  const [entry] = loadGenerationHistory(storage, 'history');
  assert.equal(entry.kind, 'text');
  assert.equal(entry.content, '旧内容');
});

test('keeps the five most recent generation results by default', () => {
  const storage = createStorage();
  let recorded = [];
  for (let index = 1; index <= 6; index += 1) {
    recorded = recordGenerationResult(storage, 'history', `结果 ${index}`, index);
  }

  assert.equal(recorded.length, 5);
  assert.deepEqual(recorded.map((entry) => entry.content), ['结果 6', '结果 5', '结果 4', '结果 3', '结果 2']);
  assert.equal(loadGenerationHistory(storage, 'history').length, 5);
});
