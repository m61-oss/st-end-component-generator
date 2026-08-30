import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDataManagementModel, clearSettingsDataCategory } from './data-management.js';

test('data management exposes worldbook scheme snapshot diagnostics', () => {
  const model = buildDataManagementModel({
    worldbookSchemes: [
      {
        id: 'scheme-1',
        name: '有数据',
        snapshot: {
          worldbookSources: ['book-a'],
          promptSelections: { 'worldbook-v2::book-a::世界书::1': true },
        },
      },
      { id: 'scheme-2', name: '空方案', snapshot: {} },
    ],
  });

  assert.deepEqual(model.worldbookSchemes.map(({ id, sourceCount, entryCount, hasData }) => ({ id, sourceCount, entryCount, hasData })), [
    { id: 'scheme-1', sourceCount: 1, entryCount: 1, hasData: true },
    { id: 'scheme-2', sourceCount: 0, entryCount: 0, hasData: false },
  ]);
});

test('component schemes participate in scheme totals and scheme clearing', () => {
  const settings = {
    apiSchemes: [{ id: 'api' }],
    componentSchemes: [{ id: 'component' }],
    selectedComponentSchemeId: 'component',
  };

  assert.equal(buildDataManagementModel(settings).counts.schemes, 2);
  clearSettingsDataCategory(settings, 'schemes');
  assert.deepEqual(settings.componentSchemes, []);
  assert.equal(settings.selectedComponentSchemeId, '');
});
