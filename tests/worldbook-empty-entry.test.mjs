import assert from 'node:assert/strict';
import { collectWorldbookImportCandidates } from '../sources/component-sources.js';
import { collectSelectedPromptSourceItems } from '../sources/source-selection.js';

const candidates = await collectWorldbookImportCandidates({
  TavernHelper: {
    getWorldbook: async () => [
      { uid: 1, name: 'empty entry', content: '', enabled: true },
      { uid: 2, name: 'filled entry', content: 'content', enabled: true },
    ],
  },
}, 'test-book');

assert.deepEqual(candidates.map((item) => item.name), ['empty entry', 'filled entry']);
assert.equal(candidates[0].content, '');
assert.equal(candidates[0].sourceUid, 1);
const selected = collectSelectedPromptSourceItems([
  { loaded: true, items: candidates },
], Object.fromEntries(candidates.map((item) => [item.key, true])));
assert.equal(selected.length, 2, 'empty worldbook entries remain selectable in prompt sources');

console.log('worldbook empty-entry tests passed');
