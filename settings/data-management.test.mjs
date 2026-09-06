import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

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

test('component and multi-task schemes participate in scheme totals and scheme clearing', () => {
  const settings = {
    apiSchemes: [{ id: 'api' }],
    componentSchemes: [{ id: 'component' }],
    multiTaskSchemes: [{ id: 'multi' }],
    selectedComponentSchemeId: 'component',
    selectedMultiTaskSchemeId: 'multi',
  };

  assert.equal(buildDataManagementModel(settings).counts.schemes, 3);
  clearSettingsDataCategory(settings, 'schemes');
  assert.deepEqual(settings.componentSchemes, []);
  assert.equal(settings.selectedComponentSchemeId, '');
  assert.deepEqual(settings.multiTaskSchemes, []);
  assert.equal(settings.selectedMultiTaskSchemeId, '');
});

test('clearing bindings cancels worldbook and multi-task chat bindings', () => {
  const settings = {
    chatWorldbookBindings: [{ chatId: 'chat-1', schemeId: 'worldbook' }],
    chatMultiTaskBindings: [{ chatId: 'chat-1', schemeId: 'multi' }],
  };

  clearSettingsDataCategory(settings, 'bindings', 123);
  assert.deepEqual(settings.chatWorldbookBindings, [{ chatId: 'chat-1', cancelled: true, updatedAt: 123 }]);
  assert.deepEqual(settings.chatMultiTaskBindings, [{ chatId: 'chat-1', cancelled: true, updatedAt: 123 }]);
});

test('data management counts and exposes worldbook and multi-task chat bindings separately', () => {
  const model = buildDataManagementModel({
    worldbookSchemes: [{ id: 'worldbook' }],
    multiTaskSchemes: [{ id: 'multi' }],
    chatWorldbookBindings: [{ chatId: 'chat-1', schemeId: 'worldbook' }],
    chatMultiTaskBindings: [
      { chatId: 'chat-1', schemeId: 'multi' },
      { chatId: 'chat-2', schemeId: 'missing' },
    ],
  });

  assert.equal(model.counts.bindings, 3);
  assert.equal(model.chatWorldbookBindings.length, 1);
  assert.equal(model.chatMultiTaskBindings.length, 2);
  assert.deepEqual(model.orphanMultiTaskBindingChatIds, ['chat-2']);
  assert.ok(model.storage.bindings > 0);
});

test('data management UI provides separate multi-task binding management', async () => {
  const source = await readFile(new URL('../index.js', import.meta.url), 'utf8');
  assert.match(source, /聊天多任务绑定/);
  assert.match(source, /model\.chatMultiTaskBindings/);
  assert.match(source, /data-binding-type="multiTask"/);
  assert.match(source, /setChatMultiTaskSchemeId\(metadata, ''\)/);
});
