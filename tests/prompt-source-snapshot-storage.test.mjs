import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  MISSING_PROMPT_SOURCE_SNAPSHOT_MESSAGE,
  assertPromptSourceSnapshotsAvailable,
  loadAndMigratePromptSourceSnapshots,
  normalizePromptSourceSnapshot,
} from '../sources/prompt-source-snapshot-storage.js';

const createMemoryStore = (initial = {}) => {
  const records = new Map(Object.entries(initial));
  return {
    records,
    async get(type) { return records.get(type) ?? null; },
    async set(type, snapshot) { records.set(type, snapshot); },
    async remove(type) { records.delete(type); },
  };
};

assert.equal(normalizePromptSourceSnapshot({ items: 'wrong' }), null);
assert.deepEqual(normalizePromptSourceSnapshot({ items: [{ key: 'entry' }] }), { items: [{ key: 'entry' }] });

const legacyWorldbook = { items: [{ key: 'legacy-worldbook', content: '完整世界书内容' }] };
const storedPreset = { items: [{ key: 'stored-preset', content: '浏览器内容' }] };
const store = createMemoryStore({ preset: storedPreset });
const migrated = await loadAndMigratePromptSourceSnapshots(store, {
  preset: { items: [{ key: 'legacy-preset' }] },
  worldbook: legacyWorldbook,
});

assert.deepEqual(migrated.preset, storedPreset, 'an existing browser snapshot should win over a stale settings snapshot');
assert.deepEqual(migrated.worldbook, legacyWorldbook, 'a legacy settings snapshot should migrate into browser storage');
assert.deepEqual(store.records.get('worldbook'), legacyWorldbook);

const stalePromptModeStore = createMemoryStore({ worldbook: legacyWorldbook });
const cleaned = await loadAndMigratePromptSourceSnapshots(stalePromptModeStore, {}, {
  sourceModes: { preset: 'prompt', worldbook: 'prompt' },
});
assert.equal(cleaned.worldbook, null, 'prompt mode should not retain a browser source snapshot');
assert.equal(stalePromptModeStore.records.has('worldbook'), false);

assert.doesNotThrow(() => assertPromptSourceSnapshotsAvailable(
  { preset: 'prompt', worldbook: 'prompt' },
  { preset: null, worldbook: null },
));
assert.doesNotThrow(() => assertPromptSourceSnapshotsAvailable(
  { preset: 'import', worldbook: 'prompt' },
  { preset: { items: [] }, worldbook: null },
));
assert.throws(
  () => assertPromptSourceSnapshotsAvailable(
    { preset: 'prompt', worldbook: 'import' },
    { preset: null, worldbook: null },
  ),
  (error) => error?.message === MISSING_PROMPT_SOURCE_SNAPSHOT_MESSAGE,
);

const indexSource = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
assert.match(indexSource, /createIndexedDbPromptSourceSnapshotStore/);
assert.match(indexSource, /loadAndMigratePromptSourceSnapshots/);
assert.match(indexSource, /delete getSettingsStore\(\)\.promptSourceSnapshots/,
  'successful migration should remove the large legacy snapshot from extension settings');
assert.match(indexSource, /await promptSourceSnapshotReady;[\s\S]*?assertPromptSourceSnapshotsAvailable/,
  'generation should wait for browser snapshots and reject a missing import-mode snapshot');
assert.match(indexSource, /await promptSourceSnapshotStore\.set\(sourceType, snapshot\)/,
  'capturing a prompt snapshot should persist it in browser storage');
assert.match(indexSource, /await promptSourceSnapshotStore\.remove\(sourceType\)/,
  'returning to prompt mode should remove the browser snapshot');
assert.doesNotMatch(
  indexSource.match(/const DEFAULT_SETTINGS = \{[\s\S]*?\n\};/)?.[0] || '',
  /promptSourceSnapshots/,
  'full prompt snapshots must not be part of the normal extension settings schema',
);

console.log('prompt source snapshot storage tests passed');
