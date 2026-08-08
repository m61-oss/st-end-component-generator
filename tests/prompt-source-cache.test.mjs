import assert from 'node:assert/strict';
import {
  createPromptSourceCacheState,
  loadWorldbookSourceGroups,
  markPromptSourceStructureDirty,
  markWorldbookSourceDirty,
  takeDirtyWorldbookSources,
} from '../sources/prompt-source-cache.js';

const state = createPromptSourceCacheState();
assert.equal(state.structureDirty, true);
assert.equal(state.signature, '');
assert.deepEqual(takeDirtyWorldbookSources(state), []);

state.structureDirty = false;
state.signature = 'cached';
markPromptSourceStructureDirty(state);
assert.equal(state.structureDirty, true);
assert.equal(state.signature, '');

state.structureDirty = false;
markWorldbookSourceDirty(state, 'Book A');
markWorldbookSourceDirty(state, ' Book A ');
markWorldbookSourceDirty(state, 'Book B');
assert.equal(state.structureDirty, false);
assert.deepEqual(takeDirtyWorldbookSources(state), ['Book A', ' Book A ', 'Book B']);
assert.deepEqual(takeDirtyWorldbookSources(state), []);

markWorldbookSourceDirty(state, '');
assert.equal(state.structureDirty, true);

const groups = [
  { source: 'Book A', loaded: false, loading: false, items: [] },
  { source: 'Book B', loaded: false, loading: false, items: [] },
  { source: 'Book C', loaded: false, loading: false, items: [] },
];
let activeLoads = 0;
let maximumConcurrentLoads = 0;
await loadWorldbookSourceGroups(groups, async (source) => {
  activeLoads += 1;
  maximumConcurrentLoads = Math.max(maximumConcurrentLoads, activeLoads);
  await new Promise((resolve) => setTimeout(resolve, source === 'Book A' ? 8 : 1));
  activeLoads -= 1;
  return [`${source} item`];
});
assert.equal(maximumConcurrentLoads, 3);
assert.deepEqual(groups.map((group) => group.items[0]), ['Book A item', 'Book B item', 'Book C item']);
assert.ok(groups.every((group) => group.loaded && !group.loading));

const failed = [{ source: 'Broken', loaded: false, loading: false, items: [] }];
await loadWorldbookSourceGroups(failed, async () => {
  throw new Error('read failed');
});
assert.equal(failed[0].loaded, false);
assert.equal(failed[0].loading, false);
assert.equal(failed[0].error, 'read failed');

console.log('prompt-source-cache tests passed');
