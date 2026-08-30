import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveMultiTaskRuntimeSettings } from './multi-task-runtime.js';

const base = () => ({
  apiMode: 'custom',
  apiUrl: 'live-url',
  apiModel: 'live-model',
  taskPrompt: 'global task',
  promptSelections: { leaked: true },
  sourceContentOverrides: { leaked: 'current editor value' },
  components: [{ id: 'c1', enabled: true, content: 'latest content' }],
  componentGroups: [],
  defaultGroupEnabled: {},
  theaterComponents: [],
  theaterGroups: [],
  theaterDefaultGroupEnabled: true,
  theaterRandomScope: 'global',
  theaterRandomMode: 'off',
  theaterRandomCount: 1,
  theaterGroupedFallbackMode: 'off',
  theaterGroupedFallbackCount: 1,
  theaterGroupRandomOverrides: [],
});

const schemes = () => ({
  apiSchemes: [{ id: 'api-1', name: 'API', snapshot: { apiMode: 'custom', apiUrl: 'saved-url', apiModel: 'saved-model' } }],
  presetSchemes: [{ id: 'preset-1', name: 'Preset', snapshot: { activeSourcePreset: 'Saved preset', promptSelections: { p1: true } } }],
  worldbookSchemes: [{ id: 'wb-1', name: 'WB', snapshot: { worldbookSources: ['Book'], promptSelections: { w1: true } } }],
  componentSchemes: [{ id: 'component-1', name: 'Components', snapshot: { componentEnabled: { c1: false } } }],
});

test('task runtime resolves every selected scheme and keeps current component content', () => {
  const runtime = resolveMultiTaskRuntimeSettings(base(), {
    id: 'task-1',
    apiSchemeId: 'api-1',
    presetSchemeId: 'preset-1',
    worldbookSchemeId: 'wb-1',
    componentSchemeId: 'component-1',
    injectMode: 'anchor',
    extraInstruction: 'extra',
  }, schemes());

  assert.equal(runtime.apiUrl, 'saved-url');
  assert.equal(runtime.apiModel, 'saved-model');
  assert.equal(runtime.activeSourcePreset, 'Saved preset');
  assert.deepEqual(runtime.worldbookDraftSources, ['Book']);
  assert.equal(runtime.components[0].enabled, false);
  assert.equal(runtime.components[0].content, 'latest content');
  assert.equal(runtime.injectMode, 'anchor');
  assert.equal(runtime.extraInstruction, 'extra');
  assert.equal(runtime.presetRuntimeMode, 'scheme');
  assert.equal(runtime.worldbookRuntimeMode, 'scheme');
  assert.equal(Object.hasOwn(runtime.promptSelections, 'leaked'), false);
  assert.equal(Object.hasOwn(runtime.sourceContentOverrides, 'leaked'), false);
});

test('empty preset and worldbook selections use Tavern defaults', () => {
  const runtime = resolveMultiTaskRuntimeSettings(base(), {
    id: 'task-1',
    apiSchemeId: 'api-1',
    presetSchemeId: '',
    worldbookSchemeId: '',
    componentSchemeId: 'component-1',
  }, schemes());

  assert.equal(runtime.presetRuntimeMode, 'tavern');
  assert.equal(runtime.worldbookRuntimeMode, 'tavern');
  assert.deepEqual(runtime.promptSelections, {});
  assert.deepEqual(runtime.worldbookDraftSources, []);
});

test('API and component schemes are required and stale ids fail before queue dispatch', () => {
  assert.throws(
    () => resolveMultiTaskRuntimeSettings(base(), { id: 'a', componentSchemeId: 'component-1' }, schemes()),
    (error) => error.code === 'missing-api-scheme',
  );
  assert.throws(
    () => resolveMultiTaskRuntimeSettings(base(), { id: 'a', apiSchemeId: 'api-1' }, schemes()),
    (error) => error.code === 'missing-component-scheme',
  );
  assert.throws(
    () => resolveMultiTaskRuntimeSettings(base(), { id: 'a', apiSchemeId: 'stale', componentSchemeId: 'component-1' }, schemes()),
    (error) => error.code === 'unknown-api-scheme',
  );
  assert.throws(
    () => resolveMultiTaskRuntimeSettings(base(), { id: 'a', apiSchemeId: 'api-1', componentSchemeId: 'component-1', presetSchemeId: 'stale' }, schemes()),
    (error) => error.code === 'unknown-preset-scheme',
  );
});
