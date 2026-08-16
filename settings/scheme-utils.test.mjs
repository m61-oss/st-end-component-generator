import assert from 'node:assert/strict';
import test from 'node:test';

import {
  captureSchemeSnapshot,
  getWorldbookSchemeSourceNames,
  isWorldbookSchemeSnapshotUsable,
  resolveWorldbookPromptSelectionsForLoad,
} from './scheme-utils.js';

test('worldbook scheme snapshots report whether they contain recoverable scheme data', () => {
  assert.equal(isWorldbookSchemeSnapshotUsable({}), false);
  assert.equal(isWorldbookSchemeSnapshotUsable({ worldbookSources: ['book-with-no-entry-overrides'] }), true);
  assert.equal(isWorldbookSchemeSnapshotUsable({ promptSelections: { 'worldbook-v2::book::worldbook:1': false } }), true);
  assert.equal(isWorldbookSchemeSnapshotUsable({ importSelections: { 'worldbook-v2::import-only::worldbook:1': true } }), false);
});

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
    importSelections: { 'worldbook-v2::import-only::世界书::2': true },
  }), ['角色 世界书']);
});

test('worldbook source discovery never uses import-only selection keys', () => {
  assert.deepEqual(getWorldbookSchemeSourceNames({
    worldbookSources: [],
    promptSelections: {},
    importSelections: { 'worldbook-v2::import-only::世界书::2': true },
  }), []);
});

test('import-mode snapshot metadata never restores current prompt selections', () => {
  assert.deepEqual(resolveWorldbookPromptSelectionsForLoad({
    sourceMode: 'import',
    promptSelections: {},
  }, {
    'worldbook-v2::角色世界书::世界书::1': true,
  }), {});
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

test('import-mode snapshot metadata never restores a separate temporary snapshot', () => {
  const key = 'worldbook-v2::prompt-book::世界书::7';
  assert.deepEqual(resolveWorldbookPromptSelectionsForLoad({
    sourceMode: 'import',
    promptSelections: {},
    importSelections: { 'worldbook-v2::import-book::世界书::8': true },
  }, {
    [key]: false,
  }, [{
    scope: '世界书',
    source: 'prompt-book',
    key,
  }]), {});
});

test('scheme source discovery preserves the explicit source list without temporary snapshots', () => {
  assert.deepEqual(getWorldbookSchemeSourceNames({
    worldbookSources: ['stale-book'],
    promptSelections: {},
    importSelections: {},
  }), ['stale-book']);
});

test('worldbook scheme source filtering follows prompt selections while import mode is open', () => {
  const promptKey = 'worldbook-v2::prompt-book::世界书::1';
  const importKey = 'worldbook-v2::import-book::世界书::2';
  const snapshot = captureSchemeSnapshot('worldbook', {
    sourceModes: { worldbook: 'import' },
    worldbookDraftSources: [],
    promptSelections: { [promptKey]: true },
    importSelections: { [importKey]: true },
  }, [{
    scope: '世界书',
    source: 'prompt-book',
    category: 'inactive',
    loaded: false,
    items: [],
  }, {
    scope: '世界书',
    source: 'import-book',
    category: 'inactive',
    loaded: false,
    items: [],
  }], { isWorldbookGroup: (group) => group.scope === '世界书' });

  assert.deepEqual(snapshot.worldbookSources, ['prompt-book']);
  assert.equal(Object.prototype.hasOwnProperty.call(snapshot, 'importSelections'), false);
});
