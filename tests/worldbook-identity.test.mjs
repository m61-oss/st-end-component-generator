import assert from 'node:assert/strict';
import {
  createWorldbookEntryKey,
  getWorldbookEntryKeyPrefixes,
  getWorldbookRawName,
  getWorldbookGenerationIssue,
  isWorldbookEntryKeyForSource,
  reconcileWorldbookEntryRecords,
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
assert.deepEqual(reconciled.stores.promptSelections, { [first]: true, [unrelated]: true });
assert.deepEqual(reconciled.stores.sourceContentOverrides, { [first]: '插件修改内容' });
assert.deepEqual(reconciled.stores.worldbookActivationOverrides, { [first]: 'blue' });
assert.deepEqual(reconciled.stores.worldbookKeywordOverrides, { [first]: ['关键词'] });

const removed = removeWorldbookSourceRecords({
  promptSelections: { [first]: true, [unrelated]: true },
  sourceContentOverrides: { [legacyCurrent]: '插件修改内容', [unrelated]: '保留' },
}, '她眼中的潮汐 ');
assert.deepEqual(removed.stores.promptSelections, { [unrelated]: true });
assert.deepEqual(removed.stores.sourceContentOverrides, { [unrelated]: '保留' });
assert.equal(removed.removedCount, 2);

const changedContentLegacy = '世界书：她眼中的潮汐::她眼中的潮汐::世界书::规则::旧版本内容';
const renamedContent = reconcileWorldbookEntryRecords({
  promptSelections: { [changedContentLegacy]: true },
}, '她眼中的潮汐 ', [{ key: first, legacyKey: legacyCurrent, name: '规则' }]);
assert.deepEqual(renamedContent.stores.promptSelections, { [first]: true }, 'a unique legacy entry name should migrate even when its content changed');

assert.match(getWorldbookGenerationIssue([{ source: '坏书 ', loaded: false, error: "doesn't exist" }]), /“坏书 ”/);
assert.match(getWorldbookGenerationIssue([{ source: '旧方案', loaded: true, staleEnabledCount: 2 }]), /2 条/);
assert.equal(getWorldbookGenerationIssue([{ source: '正常', loaded: true, error: '', staleEnabledCount: 0 }]), '');

console.log('worldbook identity tests passed');
