import assert from 'node:assert/strict';
import test from 'node:test';

import {
  captureSchemeSnapshot,
  getWorldbookSchemeSourceNames,
  resolveWorldbookPromptSelectionsForLoad,
} from './scheme-utils.js';

const worldbookItem = (key, source = '角色世界书') => ({
  key,
  source,
  scope: '世界书',
});

test('worldbook scheme snapshots stay in prompt-edit mode even if the page is in import mode', () => {
  const snapshot = captureSchemeSnapshot('worldbook', {
    sourceModes: { worldbook: 'import' },
    worldbookDraftSources: ['角色世界书'],
    promptSelections: { 'worldbook-v2::角色世界书::世界书::1': true },
    importSelections: { 'worldbook-v2::角色世界书::世界书::1': true },
  }, [{
    scope: '世界书',
    source: '角色世界书',
    category: 'character',
    loaded: true,
    items: [worldbookItem('worldbook-v2::角色世界书::世界书::1')],
  }], { isWorldbookGroup: (group) => group.scope === '世界书' });

  assert.equal(snapshot.sourceMode, 'prompt');
});

test('worldbook source names fall back to stored selection keys when the source list is absent', () => {
  assert.deepEqual(getWorldbookSchemeSourceNames({
    worldbookSources: [],
    promptSelections: { 'worldbook-v2::角色%20世界书::世界书::1': false },
    importSelections: {},
  }), ['角色 世界书']);
});

test('legacy import-mode snapshots preserve the current prompt selections when no prompt records were saved', () => {
  assert.deepEqual(resolveWorldbookPromptSelectionsForLoad({
    sourceMode: 'import',
    promptSelections: {},
  }, {
    'worldbook-v2::角色世界书::世界书::1': true,
  }), {
    'worldbook-v2::角色世界书::世界书::1': true,
  });
});

test('normal prompt-mode snapshots remain authoritative during load', () => {
  assert.deepEqual(resolveWorldbookPromptSelectionsForLoad({
    sourceMode: 'prompt',
    promptSelections: { 'worldbook-v2::角色世界书::世界书::1': false },
  }, {
    'worldbook-v2::角色世界书::世界书::1': true,
  }), {
    'worldbook-v2::角色世界书::世界书::1': false,
  });
});
