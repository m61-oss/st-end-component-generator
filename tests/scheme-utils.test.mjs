import assert from 'node:assert/strict';
import * as schemeUtils from '../settings/scheme-utils.js';
import {
  captureSchemeSnapshot,
  deleteScheme,
  findScheme,
  getWorldbookSchemeSourceNames,
  normalizeSchemeList,
  saveScheme,
} from '../settings/scheme-utils.js';

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
  worldbookKeywordOverrides: {
    world_a: ['坂田银时', '/<content>[\\s\\S]*?银时<\\/content>/i'],
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
  worldbookKeywordOverrides: { world_a: ['坂田银时', '/<content>[\\s\\S]*?银时<\\/content>/i'] },
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

const lazyBookEntry = '世界书：Lazy Book::Lazy Book::世界书::Entry A::content-a';
const unloadedWorldbookSnapshot = captureSchemeSnapshot('worldbook', {
  ...settings,
  worldbookDraftSources: ['Lazy Book'],
  sourceModes: { ...settings.sourceModes, worldbook: 'prompt' },
  promptSelections: { [lazyBookEntry]: true },
  importSelections: { [lazyBookEntry]: false },
  sourceContentOverrides: { [lazyBookEntry]: 'edited while previously loaded' },
  worldbookActivationOverrides: { [lazyBookEntry]: 'blue' },
  worldbookKeywordOverrides: { [lazyBookEntry]: ['lazy-keyword'] },
}, [
  { scope: 'world', source: 'Lazy Book', category: 'inactive', loaded: false, items: [] },
], { isWorldbookGroup: (group) => group.scope === 'world' });
assert.deepEqual(unloadedWorldbookSnapshot, {
  worldbookSources: ['Lazy Book'],
  sourceMode: 'prompt',
  promptSelections: { [lazyBookEntry]: true },
  importSelections: { [lazyBookEntry]: false },
  sourceContentOverrides: { [lazyBookEntry]: 'edited while previously loaded' },
  worldbookActivationOverrides: { [lazyBookEntry]: 'blue' },
  worldbookKeywordOverrides: { [lazyBookEntry]: ['lazy-keyword'] },
}, 'an unloaded worldbook must inherit its existing entry records when a scheme is saved');

const currentLoadedEntry = '世界书：Loaded Book::Loaded Book::世界书::Current::current-content';
const staleLoadedEntry = '世界书：Loaded Book::Loaded Book::世界书::Stale::stale-content';
const loadedWorldbookSnapshot = captureSchemeSnapshot('worldbook', {
  ...settings,
  worldbookDraftSources: ['Loaded Book'],
  sourceModes: { ...settings.sourceModes, worldbook: 'prompt' },
  promptSelections: { [currentLoadedEntry]: true, [staleLoadedEntry]: true },
  importSelections: {},
  sourceContentOverrides: { [staleLoadedEntry]: 'obsolete override' },
  worldbookActivationOverrides: {},
  worldbookKeywordOverrides: {},
}, [
  { scope: 'world', source: 'Loaded Book', category: 'inactive', loaded: true, items: [{ key: currentLoadedEntry }] },
], { isWorldbookGroup: (group) => group.scope === 'world' });
assert.deepEqual(loadedWorldbookSnapshot.promptSelections, { [currentLoadedEntry]: true });
assert.deepEqual(loadedWorldbookSnapshot.sourceContentOverrides, {}, 'loaded sources must not retain stale entry records');

assert.equal(typeof schemeUtils.getWorldbookEntryKeyPrefix, 'function');
assert.equal(typeof schemeUtils.hasEnabledWorldbookSource, 'function');
assert.equal(schemeUtils.getWorldbookEntryKeyPrefix(' Lazy Book '), '世界书：Lazy Book::Lazy Book::世界书::');
assert.equal(schemeUtils.hasEnabledWorldbookSource({ [lazyBookEntry]: true }, 'Lazy Book'), true);
assert.equal(schemeUtils.hasEnabledWorldbookSource({ [lazyBookEntry]: false }, 'Lazy Book'), false);
assert.equal(schemeUtils.hasEnabledWorldbookSource({ [lazyBookEntry]: true }, 'Other Book'), false);

assert.equal(typeof schemeUtils.hydrateTavernWorldbookSelections, 'function');
const loadedTavernEntry = '世界书：Loaded Tavern::Loaded Tavern::世界书::Loaded::loaded';
const unloadedTavernEnabled = '世界书：Unloaded Tavern::Unloaded Tavern::世界书::Enabled::enabled';
const unloadedTavernDisabled = '世界书：Unloaded Tavern::Unloaded Tavern::世界书::Disabled::disabled';
const inactiveTavernEntry = '世界书：Inactive Tavern::Inactive Tavern::世界书::Ignored::ignored';
const hydratedSources = [];
const hydratedTavernSelections = await schemeUtils.hydrateTavernWorldbookSelections([
  {
    scope: '世界书', source: 'Loaded Tavern', category: 'global', loaded: true,
    items: [{ key: loadedTavernEntry, enabled: true }],
  },
  { scope: '世界书', source: 'Unloaded Tavern', category: 'character', loaded: false, items: [] },
  { scope: '世界书', source: 'Inactive Tavern', category: 'inactive', loaded: false, items: [] },
], { unrelated: true }, async (group) => {
  hydratedSources.push(group.source);
  if (group.source === 'Unloaded Tavern') {
    return [
      { key: unloadedTavernEnabled, enabled: true },
      { key: unloadedTavernDisabled, enabled: false },
    ];
  }
  return [{ key: inactiveTavernEntry, enabled: true }];
});
assert.deepEqual(hydratedSources, ['Unloaded Tavern'], 'only active unloaded Tavern books should be read before saving');
assert.deepEqual(hydratedTavernSelections, {
  unrelated: true,
  [loadedTavernEntry]: true,
  [unloadedTavernEnabled]: true,
  [unloadedTavernDisabled]: false,
}, 'Tavern-default hydration should materialize a complete static selection snapshot');

assert.deepEqual(getWorldbookSchemeSourceNames({
  worldbookSources: ['A', 'B', 'C'],
  promptSelections: {
    '世界书：B::B::世界书::Entry::content': true,
  },
}), ['A', 'B', 'C']);

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
