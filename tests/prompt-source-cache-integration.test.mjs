import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');

assert.match(source, /from '\.\/sources\/prompt-source-cache\.js\?ver=0\.1\.6'/);
assert.match(source, /const promptSourceCache = createPromptSourceCacheState\(\)/);

const ensureFunction = source.slice(
  source.indexOf('async function ensurePromptSourceItemsForGeneration('),
  source.indexOf('function renderSourceModeUi('),
);

assert.doesNotMatch(
  ensureFunction,
  /refreshSources\s*=\s*true/,
  'generation must not force a full source scan every time',
);
assert.match(
  ensureFunction,
  /if \(!importGroups\.length \|\| promptSourceCache\.structureDirty\) await scanImportCandidates\(\)/,
);
assert.match(ensureFunction, /await loadWorldbookSourceGroups\(\s*activeWorldbookGroups,/s);
assert.match(ensureFunction, /\(worldbookName\) => collectWorldbookImportCandidates\(targetWindow, worldbookName\)/);
assert.match(ensureFunction, /syncPromptSelectionsFromLoadedGroups\(activeWorldbookGroups\)/);

const scanFunction = source.slice(
  source.indexOf('async function scanImportCandidates('),
  source.indexOf('async function loadImportGroup('),
);
assert.match(scanFunction, /cachedWorldbookGroups/);
assert.match(scanFunction, /promptSourceCache\.dirtyWorldbooks\.has\(group\.source\)/);
assert.match(scanFunction, /promptSourceCache\.structureDirty = false/);
assert.match(scanFunction, /promptSourceCache\.signature = getTavernSourceSignature\(\)/);
assert.match(scanFunction, /explicitWorldbookNames: null/);
assert.doesNotMatch(scanFunction, /collectWorldbookImportCounts\(/);

assert.match(source, /function invalidateWorldbookSourceCache\(worldbookName\)/);
assert.match(source, /markWorldbookSourceDirty\(promptSourceCache, worldbookName\)/);
assert.match(source, /function registerPromptSourceCacheInvalidation\(context\)/);
for (const eventName of [
  'WORLDINFO_UPDATED',
  'WORLDINFO_SETTINGS_UPDATED',
  'PRESET_CHANGED',
  'PRESET_DELETED',
  'PRESET_RENAMED',
  'OAI_PRESET_CHANGED_AFTER',
  'CHAT_CHANGED',
  'GROUP_UPDATED',
  'CHARACTER_EDITED',
]) {
  assert.match(source, new RegExp(`bind\\('${eventName}'`));
}
assert.match(source, /registerPromptSourceCacheInvalidation\(context\)/);
assert.match(
  source,
  /if \(\(nextTab === 'preset' \|\| nextTab === 'worldbook'\) && \(!importGroups\.length \|\| promptSourceCache\.structureDirty\)\) scanImportCandidates\(\)/,
  'opening a source tab should automatically refresh invalidated cache data',
);

console.log('prompt-source-cache integration tests passed');
