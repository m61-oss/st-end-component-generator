import assert from 'node:assert/strict';
import { loadGenerationHistory, recordGenerationResult } from '../generation/generation-history.js';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

const key = 'recent-history';
const storage = createStorage();
recordGenerationResult(storage, key, '第一条', 1000);
recordGenerationResult(storage, key, '第二条', 2000);
const latest = recordGenerationResult(storage, key, '第三条', 3000);

assert.deepEqual(latest.map((entry) => entry.content), ['第三条', '第二条', '第一条']);
assert.deepEqual(latest.map((entry) => entry.generatedAt), [3000, 2000, 1000]);
assert.equal(latest.every((entry) => typeof entry.id === 'string' && entry.id), true);

const trimmed = recordGenerationResult(storage, key, '第四条', 4000);
assert.deepEqual(trimmed.map((entry) => entry.content), ['第四条', '第三条', '第二条']);
assert.deepEqual(loadGenerationHistory(storage, key).map((entry) => entry.content), ['第四条', '第三条', '第二条']);

assert.deepEqual(recordGenerationResult(storage, key, '   ', 5000), trimmed, 'blank results must not create history entries');
assert.deepEqual(loadGenerationHistory(createStorage({ [key]: '{broken json' }), key), []);
assert.deepEqual(loadGenerationHistory(createStorage({ [key]: JSON.stringify([{ content: '' }, null, { content: '有效', generatedAt: 8, id: 'saved' }]) }), key), [
  { id: 'saved', generatedAt: 8, content: '有效' },
]);

const throwingStorage = {
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('blocked'); },
};
assert.deepEqual(loadGenerationHistory(throwingStorage, key), []);
assert.equal(recordGenerationResult(throwingStorage, key, '仍可返回', 6000)[0].content, '仍可返回');

console.log('generation-history tests passed');
