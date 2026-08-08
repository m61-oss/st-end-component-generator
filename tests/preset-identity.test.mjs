import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createPresetEntryKey,
  migratePresetPromptSourceSnapshot,
  reconcilePresetEntryRecords,
  reconcilePresetSchemeRecords,
} from '../sources/preset-identity.js';
import { addImportCandidate, SOURCE_PRESET } from '../sources/component-sources.js';

assert.equal(
  createPresetEntryKey('Ako 预设', 'prompt::id'),
  'preset-v2::Ako%20%E9%A2%84%E8%AE%BE::预设::prompt%3A%3Aid',
);

const candidates = [];
addImportCandidate(candidates, '预设：Ako 预设', 'Ako 预设', SOURCE_PRESET, '规则', '完整内容', true, {
  sourceUid: 'prompt-id',
  sourceOrder: 0,
});
assert.equal(candidates[0].key, createPresetEntryKey('Ako 预设', 'prompt-id'));
assert.match(candidates[0].legacyKey, /规则::完整内容$/);

const legacyKey = candidates[0].legacyKey;
const migration = reconcilePresetEntryRecords({
  promptSelections: { [legacyKey]: false },
  importSelections: { [legacyKey]: true },
  sourceContentOverrides: { [legacyKey]: '插件修改后的完整内容' },
}, 'Ako 预设', candidates);

assert.equal(migration.changed, true);
assert.deepEqual(migration.keyMap, { [legacyKey]: candidates[0].key });
assert.deepEqual(migration.stores, {
  promptSelections: { [candidates[0].key]: false },
  importSelections: { [candidates[0].key]: true },
  sourceContentOverrides: { [candidates[0].key]: '插件修改后的完整内容' },
});

const noIdCandidates = [];
addImportCandidate(noIdCandidates, '预设：旧预设', '旧预设', SOURCE_PRESET, '无 ID 条目', '正文', true);
assert.match(noIdCandidates[0].key, /^预设：旧预设::旧预设::预设::无 ID 条目::正文$/);

const duplicateIdCandidates = [];
addImportCandidate(duplicateIdCandidates, '预设：异常预设', '异常预设', SOURCE_PRESET, '条目一', '正文一', true, { sourceUid: 'duplicate' });
addImportCandidate(duplicateIdCandidates, '预设：异常预设', '异常预设', SOURCE_PRESET, '条目二', '正文二', true, { sourceUid: 'duplicate' });
assert.equal(duplicateIdCandidates.length, 2, 'duplicate preset IDs must not collapse distinct entries');
assert.ok(duplicateIdCandidates.every((item) => item.key === item.legacyKey), 'duplicate preset IDs should retain legacy identities');

const unmatchedKey = '预设：Ako 预设::Ako 预设::预设::已经删除的条目::旧正文';
const unmatched = reconcilePresetEntryRecords({ promptSelections: { [unmatchedKey]: true } }, 'Ako 预设', candidates);
assert.deepEqual(unmatched.stores.promptSelections, { [unmatchedKey]: true }, 'unmatched preset records must not be deleted');
assert.deepEqual(
  reconcilePresetEntryRecords({}, 'Ako 预设', candidates).keyMap,
  { [legacyKey]: candidates[0].key },
  'the key map should also migrate related scalar settings when no selection record exists',
);

const browserSnapshotMigration = migratePresetPromptSourceSnapshot({
  items: [{ ...candidates[0], key: legacyKey }, { source: '其他预设', key: 'untouched' }],
}, 'Ako 预设', candidates);
assert.equal(browserSnapshotMigration.changed, true);
assert.equal(browserSnapshotMigration.snapshot.items[0].key, candidates[0].key);
assert.equal(browserSnapshotMigration.snapshot.items[1].key, 'untouched');

const schemesMigration = reconcilePresetSchemeRecords([
  {
    id: 'ako',
    snapshot: {
      activeSourcePreset: 'Ako 预设',
      taskPlacementAfterSourceId: legacyKey,
      promptSelections: { [legacyKey]: true },
      importSelections: {},
      sourceContentOverrides: {},
    },
  },
  { id: 'other', snapshot: { activeSourcePreset: '其他预设', promptSelections: { untouched: true } } },
], 'Ako 预设', candidates);
assert.equal(schemesMigration.changed, true);
assert.deepEqual(schemesMigration.schemes[0].snapshot.promptSelections, { [candidates[0].key]: true });
assert.equal(schemesMigration.schemes[0].snapshot.taskPlacementAfterSourceId, candidates[0].key);
assert.deepEqual(schemesMigration.schemes[1], { id: 'other', snapshot: { activeSourcePreset: '其他预设', promptSelections: { untouched: true } } });

const indexSource = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
assert.match(indexSource, /reconcileLoadedPresetGroups/);
assert.match(
  indexSource,
  /reconcilePresetSchemeRecords\(settings\.presetSchemes, group\.source, group\.items\)/,
  'loaded preset entries should migrate matching records in every saved scheme for that preset',
);
assert.match(
  indexSource,
  /const presetMigrationChanged = reconcileLoadedPresetGroups\(importGroups\)/,
  'source scans should migrate current and saved preset records',
);

console.log('preset identity tests passed');
