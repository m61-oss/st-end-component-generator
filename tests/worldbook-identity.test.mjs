import assert from 'node:assert/strict';
import {
  createWorldbookEntryKey,
  getWorldbookEntryKeyPrefixes,
  getWorldbookRawName,
  getWorldbookGenerationIssue,
  isWorldbookEntryKeyForSource,
  reconcileWorldbookEntryRecords,
  removeWorldbookEntryRecord,
  removeWorldbookSourceRecords,
} from '../sources/worldbook-identity.js';

assert.equal(getWorldbookRawName('她眼中的潮汐 '), '她眼中的潮汐 ');
assert.equal(getWorldbookRawName('　踏月寻仙　'), '　踏月寻仙　');
assert.equal(getWorldbookRawName(null), '');

const first = createWorldbookEntryKey('她眼中的潮汐 ', 42);
const same = createWorldbookEntryKey('她眼中的潮汐 ', 42);
const renamedBook = createWorldbookEntryKey('她眼中的潮汐', 42);
const otherEntry = createWorldbookEntryKey('她眼中的潮汐 ', 43);

assert.equal(first, same);
assert.notEqual(first, renamedBook, 'worldbook identifiers must preserve trailing whitespace');
assert.notEqual(first, otherEntry, 'entry UID must participate in the stable key');
assert.equal(isWorldbookEntryKeyForSource(first, '她眼中的潮汐 '), true);
assert.equal(isWorldbookEntryKeyForSource(first, '她眼中的潮汐'), false);

const prefixes = getWorldbookEntryKeyPrefixes('她眼中的潮汐 ');
assert.equal(prefixes.length, 2, 'new and legacy keys must both be recognized during migration');
assert.ok(first.startsWith(prefixes[0]));

const legacyCurrent = '世界书：她眼中的潮汐::她眼中的潮汐::世界书::规则::原内容';
const legacyDeleted = '世界书：她眼中的潮汐::她眼中的潮汐::世界书::已删除::旧内容';
const unrelated = 'preset::entry';
const reconciled = reconcileWorldbookEntryRecords({
  promptSelections: { [legacyCurrent]: true, [legacyDeleted]: true, [unrelated]: true },
  sourceContentOverrides: { [legacyCurrent]: '插件修改内容', [legacyDeleted]: '无效修改' },
  worldbookActivationOverrides: { [legacyCurrent]: 'blue' },
  worldbookKeywordOverrides: { [legacyCurrent]: ['关键词'] },
}, '她眼中的潮汐 ', [{ key: first, legacyKey: legacyCurrent }]);
assert.equal(reconciled.changed, true);
assert.equal(reconciled.staleEnabledCount, 1);
assert.deepEqual(reconciled.stores.promptSelections, { [first]: true, [legacyDeleted]: true, [unrelated]: true });
assert.deepEqual(reconciled.stores.sourceContentOverrides, { [first]: '插件修改内容', [legacyDeleted]: '无效修改' });
assert.deepEqual(reconciled.stores.worldbookActivationOverrides, { [first]: 'blue' });
assert.deepEqual(reconciled.stores.worldbookKeywordOverrides, { [first]: ['关键词'] });
assert.equal(reconciled.unmatchedRecords.length, 1);
assert.equal(reconciled.unmatchedRecords[0].key, legacyDeleted);
assert.equal(reconciled.unmatchedRecords[0].name, '已删除');
assert.equal(reconciled.unmatchedRecords[0].enabled, true);

const removed = removeWorldbookSourceRecords({
  promptSelections: { [first]: true, [unrelated]: true },
  sourceContentOverrides: { [legacyCurrent]: '插件修改内容', [unrelated]: '保留' },
}, '她眼中的潮汐 ');
assert.deepEqual(removed.stores.promptSelections, { [unrelated]: true });
assert.deepEqual(removed.stores.sourceContentOverrides, { [unrelated]: '保留' });
assert.equal(removed.removedCount, 2);

const removedEntry = removeWorldbookEntryRecord(reconciled.stores, legacyDeleted);
assert.equal(removedEntry.removedCount, 2);
assert.equal(Object.prototype.hasOwnProperty.call(removedEntry.stores.promptSelections, legacyDeleted), false);
assert.equal(Object.prototype.hasOwnProperty.call(removedEntry.stores.sourceContentOverrides, legacyDeleted), false);

const changedContentLegacy = '世界书：她眼中的潮汐::她眼中的潮汐::世界书::规则::旧版本内容';
const renamedContent = reconcileWorldbookEntryRecords({
  promptSelections: { [changedContentLegacy]: true },
}, '她眼中的潮汐 ', [{ key: first, legacyKey: legacyCurrent, name: '规则' }]);
assert.deepEqual(renamedContent.stores.promptSelections, { [first]: true }, 'a unique legacy entry name should migrate even when its content changed');

assert.match(getWorldbookGenerationIssue([{ source: '坏书 ', loaded: false, error: "doesn't exist" }]), /“坏书 ”/);
assert.match(getWorldbookGenerationIssue([{ source: '旧方案', loaded: true, staleEnabledCount: 2 }]), /2 条/);
assert.equal(getWorldbookGenerationIssue([{ source: '正常', loaded: true, error: '', staleEnabledCount: 0 }]), '');

const positionalLegacyKeys = [
  '世界书：顺序迁移::顺序迁移::世界书::旧名称一::旧内容一',
  '世界书：顺序迁移::顺序迁移::世界书::旧名称二::旧内容二',
  '世界书：顺序迁移::顺序迁移::世界书::旧名称三::旧内容三',
];
const positionalItems = [
  { key: createWorldbookEntryKey('顺序迁移', 10), legacyKey: 'unused-a', name: '新名称一' },
  { key: createWorldbookEntryKey('顺序迁移', 11), legacyKey: 'unused-b', name: '新名称二' },
  { key: createWorldbookEntryKey('顺序迁移', 12), legacyKey: 'unused-c', name: '新名称三' },
];
const positional = reconcileWorldbookEntryRecords({
  promptSelections: {
    [positionalLegacyKeys[0]]: true,
    [positionalLegacyKeys[1]]: false,
    [positionalLegacyKeys[2]]: true,
  },
}, '顺序迁移', positionalItems);
assert.deepEqual(positional.stores.promptSelections, {
  [positionalItems[0].key]: true,
  [positionalItems[1].key]: false,
  [positionalItems[2].key]: true,
}, 'a complete legacy selection snapshot should migrate by entry order when names or content changed');
assert.equal(positional.staleEnabledCount, 0);
assert.deepEqual(positional.unmatchedRecords, []);

const falseOnlyLegacy = '世界书：顺序迁移::顺序迁移::世界书::已失效且关闭::旧内容';
const cleanedFalseOnly = reconcileWorldbookEntryRecords({
  promptSelections: { [falseOnlyLegacy]: false },
}, '顺序迁移', positionalItems);
assert.deepEqual(cleanedFalseOnly.stores.promptSelections, {}, 'an unmatched false-only record carries no scheme state and may be cleaned');
assert.deepEqual(cleanedFalseOnly.unmatchedRecords, []);

const ambiguousLegacy = '世界书：完全重复::完全重复::世界书::相同名称::相同内容';
const duplicateItems = [
  { key: createWorldbookEntryKey('完全重复', 21), legacyKey: ambiguousLegacy, name: '相同名称' },
  { key: createWorldbookEntryKey('完全重复', 22), legacyKey: ambiguousLegacy, name: '相同名称' },
];
const ambiguous = reconcileWorldbookEntryRecords({
  promptSelections: { [ambiguousLegacy]: true },
}, '完全重复', duplicateItems);
assert.equal(Object.prototype.hasOwnProperty.call(ambiguous.stores.promptSelections, duplicateItems[0].key), false);
assert.equal(Object.prototype.hasOwnProperty.call(ambiguous.stores.promptSelections, duplicateItems[1].key), false);
assert.equal(ambiguous.unmatchedRecords.length, 1, 'one legacy record shared by multiple identical UID entries must remain unmatched');
assert.equal(ambiguous.unmatchedRecords[0].key, ambiguousLegacy);

console.log('worldbook identity tests passed');
