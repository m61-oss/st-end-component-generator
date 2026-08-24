import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TAG_CLEANUP_FORMAT,
  TAG_CLEANUP_VERSION,
  buildTagCleanupImportSummary,
  createTagCleanupExportPackage,
  mergeTagCleanupImport,
} from './tag-cleanup-transfer.js';

test('describes imported changes without the ambiguous merged count', () => {
  assert.equal(buildTagCleanupImportSummary({ addedHistoryCount: 1, updatedHistoryCount: 0, addedOutputCount: 0 }), '导入完成：新增 1 条规则。');
  assert.equal(buildTagCleanupImportSummary({ addedHistoryCount: 0, updatedHistoryCount: 1, addedOutputCount: 0 }), '导入完成：更新 1 条历史规则。');
  assert.equal(buildTagCleanupImportSummary({ addedHistoryCount: 1, updatedHistoryCount: 2, addedOutputCount: 3 }), '导入完成：新增 4 条，更新 2 条历史规则。');
  assert.equal(buildTagCleanupImportSummary({ addedHistoryCount: 0, updatedHistoryCount: 0, addedOutputCount: 0 }), '导入完成：没有新增或更新。');
});

test('creates one versioned package containing both cleanup rule types', () => {
  assert.deepEqual(createTagCleanupExportPackage({
    historyRules: [{ rule: ' thinking ', keep: 2.8 }],
    outputRules: [' result ', ''],
  }), {
    format: TAG_CLEANUP_FORMAT,
    version: TAG_CLEANUP_VERSION,
    historyRules: [{ rule: 'thinking', keep: 2 }],
    outputRules: ['result'],
  });
});

test('merges and deduplicates while imported history keep wins', () => {
  const current = {
    historyRules: [{ rule: 'thinking', keep: 1 }, { rule: 'draft', keep: 0 }],
    outputRules: ['thinking', 'answer'],
  };
  const bundle = {
    format: TAG_CLEANUP_FORMAT,
    version: TAG_CLEANUP_VERSION,
    historyRules: [
      { rule: 'thinking', keep: 4 },
      { rule: 'notes', keep: 3 },
      { rule: 'notes', keep: 5 },
    ],
    outputRules: ['answer', 'notes', 'notes'],
  };

  const merged = mergeTagCleanupImport(bundle, current);

  assert.deepEqual(merged.historyRules, [
    { rule: 'thinking', keep: 4 },
    { rule: 'draft', keep: 0 },
    { rule: 'notes', keep: 5 },
  ]);
  assert.deepEqual(merged.outputRules, ['thinking', 'answer', 'notes']);
  assert.deepEqual({
    addedHistoryCount: merged.addedHistoryCount,
    updatedHistoryCount: merged.updatedHistoryCount,
    addedOutputCount: merged.addedOutputCount,
  }, { addedHistoryCount: 1, updatedHistoryCount: 1, addedOutputCount: 1 });
  assert.equal(current.historyRules[0].keep, 1);
  assert.equal(bundle.historyRules[0].keep, 4);
});

test('rejects an invalid package atomically', () => {
  const valid = {
    format: TAG_CLEANUP_FORMAT,
    version: TAG_CLEANUP_VERSION,
    historyRules: [],
    outputRules: [],
  };

  for (const invalid of [
    null,
    { ...valid, format: 'other' },
    { ...valid, version: 2 },
    { ...valid, historyRules: 'thinking' },
    { ...valid, outputRules: [3] },
    { ...valid, historyRules: [{ rule: '', keep: 0 }] },
    { ...valid, historyRules: [{ rule: 'thinking', keep: -1 }] },
  ]) {
    assert.throws(() => mergeTagCleanupImport(invalid, { historyRules: [], outputRules: [] }));
  }
});
