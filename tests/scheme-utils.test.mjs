import assert from 'node:assert/strict';
import {
  captureSchemeSnapshot,
  deleteScheme,
  findScheme,
  getWorldbookSchemeSourceNames,
  normalizeSchemeList,
  saveScheme,
} from '../scheme-utils.js';

const settings = {
  apiUrl: 'https://api.example.com/v1',
  apiKey: 'secret',
  apiModel: 'model-a',
  apiModelOptions: ['model-a', 'model-b'],
  maxTokens: '1200',
  temperature: '0.4',
  additionalBodyYaml: 'top_k: 20',
  excludedBodyYaml: '- frequency_penalty',
  additionalHeadersYaml: 'X-Test: yes',
  streamingEnabled: true,
  taskPrompt: 'Task text',
  activeSourcePreset: 'Ako Preset',
  sourceModes: { preset: 'prompt', worldbook: 'import' },
  taskPlacementEnabled: true,
  taskPlacementAfterSourceId: 'preset-b',
  replaceLastUserMessageWithTask: true,
  omitOriginalUserMessages: true,
  promptSelections: {
    preset_a: true,
    world_a: false,
  },
  importSelections: {
    preset_a: false,
    world_a: true,
  },
  sourceContentOverrides: {
    preset_a: 'Edited preset',
    world_a: 'Edited world',
  },
  worldbookActivationOverrides: {
    world_a: 'blue',
  },
};

const groups = [
  { scope: 'preset', source: 'Ako Preset', loaded: true, items: [{ key: 'preset_a', name: 'Preset A' }] },
  { scope: 'world', source: 'World A', loaded: true, items: [{ key: 'world_a', name: 'World A Entry' }] },
];

const apiSnapshot = captureSchemeSnapshot('api', settings, groups, { isWorldbookGroup: (group) => group.scope === 'world' });
assert.deepEqual(apiSnapshot, {
  apiUrl: 'https://api.example.com/v1',
  apiKey: 'secret',
  apiModel: 'model-a',
  apiModelOptions: ['model-a', 'model-b'],
  maxTokens: '1200',
  temperature: '0.4',
  additionalBodyYaml: 'top_k: 20',
  excludedBodyYaml: '- frequency_penalty',
  additionalHeadersYaml: 'X-Test: yes',
  streamingEnabled: true,
});

assert.deepEqual(captureSchemeSnapshot('task', settings, groups).taskPrompt, 'Task text');

const presetSnapshot = captureSchemeSnapshot('preset', settings, groups, { isWorldbookGroup: (group) => group.scope === 'world' });
assert.deepEqual(presetSnapshot, {
  activeSourcePreset: 'Ako Preset',
  sourceMode: 'prompt',
  taskPlacementEnabled: true,
  taskPlacementAfterSourceId: 'preset-b',
  replaceLastUserMessageWithTask: true,
  omitOriginalUserMessages: true,
  promptSelections: { preset_a: true },
  importSelections: { preset_a: false },
  sourceContentOverrides: { preset_a: 'Edited preset' },
});

const worldbookSnapshot = captureSchemeSnapshot('worldbook', settings, groups, { isWorldbookGroup: (group) => group.scope === 'world' });
assert.deepEqual(worldbookSnapshot, {
  worldbookSources: ['World A'],
  sourceMode: 'import',
  promptSelections: { world_a: false },
  importSelections: { world_a: true },
  sourceContentOverrides: { world_a: 'Edited world' },
  worldbookActivationOverrides: { world_a: 'blue' },
});

const worldbookSnapshotWithInactiveBooks = captureSchemeSnapshot('worldbook', {
  ...settings,
  sourceModes: { ...settings.sourceModes, worldbook: 'prompt' },
  promptSelections: { active_entry: true, selected_inactive_entry: true },
}, [
  { scope: 'world', source: 'Active Book', category: 'global', loaded: false, items: [] },
  { scope: 'world', source: 'Selected Inactive Book', category: 'inactive', loaded: true, items: [{ key: 'selected_inactive_entry' }] },
  { scope: 'world', source: 'Ignored Inactive Book', category: 'inactive', loaded: true, items: [{ key: 'ignored_inactive_entry' }] },
], { isWorldbookGroup: (group) => group.scope === 'world' });
assert.deepEqual(worldbookSnapshotWithInactiveBooks.worldbookSources, ['Active Book', 'Selected Inactive Book']);

assert.deepEqual(getWorldbookSchemeSourceNames({
  worldbookSources: ['A', 'B', 'C'],
  promptSelections: {
    '世界书：B::B::世界书::Entry::content': true,
  },
}), ['B']);

const firstSave = saveScheme([], 'Daily', apiSnapshot);
assert.equal(firstSave.length, 1);
assert.equal(firstSave[0].name, 'Daily');
assert.ok(firstSave[0].id);

const overwritten = saveScheme(firstSave, 'Daily v2', { apiUrl: 'next' }, firstSave[0].id);
assert.equal(overwritten.length, 1);
assert.equal(findScheme(overwritten, firstSave[0].id).snapshot.apiUrl, 'next');
assert.equal(findScheme(overwritten, firstSave[0].id).name, 'Daily v2');

assert.deepEqual(deleteScheme(overwritten, firstSave[0].id), []);
assert.deepEqual(normalizeSchemeList(null), []);
