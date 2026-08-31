import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [indexSource, styleSource] = await Promise.all([
  readFile(new URL('../index.js', import.meta.url), 'utf8'),
  readFile(new URL('../style.css', import.meta.url), 'utf8'),
]);

test('tag cleanup settings expose one horizontal import/export toolbar', () => {
  assert.match(indexSource, /st-esg-tag-cleanup-transfer/);
  assert.match(indexSource, /id="st-esg-tag-cleanup-import-trigger"/);
  assert.match(indexSource, /id="st-esg-tag-cleanup-export"/);
  assert.match(indexSource, /id="st-esg-tag-cleanup-import-file"[^>]+accept="application\/json,\.json"/);
  assert.match(styleSource, /\.st-esg-tag-cleanup-transfer\s*\{[^}]*display:\s*flex/);
});

test('tag cleanup transfer is wired to a versioned helper and refreshes both lists after one save', () => {
  assert.match(indexSource, /from '.\/settings\/tag-cleanup-transfer\.js\?ver=0\.2\.3'/);
  assert.match(indexSource, /createTagCleanupExportPackage\(\{[\s\S]*historyRules:\s*getTagRuleEntries\('history'\)[\s\S]*outputRules:\s*getTagRuleEntries\('output'\)/);
  assert.match(indexSource, /mergeTagCleanupImport\([\s\S]*settings\.historyCleanupRules\s*=\s*merged\.historyRules;[\s\S]*settings\.outputCleanupTags\s*=\s*merged\.outputRules\.join\('\\n'\);[\s\S]*saveSettings\(\);[\s\S]*renderTagRuleManager\('history'\);[\s\S]*renderTagRuleManager\('output'\);/);
  const eventBindings = indexSource.match(/function bindPanelEvents\(\)\s*\{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(eventBindings, /#st-esg-tag-cleanup-import-trigger/);
  assert.match(eventBindings, /#st-esg-tag-cleanup-export/);
  assert.match(eventBindings, /#st-esg-tag-cleanup-import-file/);
  assert.match(indexSource, /notifyStatus\(buildTagCleanupImportSummary\(merged\)\)/);
  assert.doesNotMatch(indexSource, /已合并.*标签清理规则/);
});
