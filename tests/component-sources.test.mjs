import assert from 'node:assert/strict';
import {
  SOURCE_WORLDBOOK,
  collectComponentImportCandidates,
  collectPresetImportGroups,
  collectWorldbookImportCandidates,
  collectWorldbookImportGroups,
  createComponentId,
  getActiveComponentsForContext,
  getComponentBindingName,
  getComponentLibraryFolders,
  getPresetNamesSafe,
  getWorldbookNamesSafe,
  getWorldbookEntryKeys,
  getWorldbookImportDisplayCategory,
  isWorldbookEntryConstant,
  normalizeComponent,
  normalizeComponentIds,
  migrateLegacyComponentGroups,
  getCurrentCharacterNameSafe,
} from '../sources/component-sources.js';

const generatedIds = ['uuid-for-duplicate', 'uuid-for-missing'];
const normalizedComponentIds = normalizeComponentIds([
  { id: 'kept-id', name: '保留' },
  { id: 'kept-id', name: '重复' },
  { name: '缺失' },
], { randomUUID: () => generatedIds.shift() });
assert.deepEqual(normalizedComponentIds.map((item) => item.id), ['kept-id', 'uuid-for-duplicate', 'uuid-for-missing']);

const fallbackComponentId = createComponentId(new Set(['duplicate-uuid']), { randomUUID: () => 'duplicate-uuid' });
assert.notEqual(fallbackComponentId, 'duplicate-uuid');
assert.ok(fallbackComponentId);

let worldbookReadCount = 0;
const targetWindow = {
  getPresetManager: () => ({ getSelectedPresetName: () => 'Ako 预设' }),
  TavernHelper: {
    getPresetNames: () => ['Ako 预设', '不应扫描的旧预设'],
    getPreset: (name) => name === 'Ako 预设' ? {
      prompt_order: [{ character_id: 100001, order: [
        { identifier: 'worldInfoBefore', enabled: true },
        { identifier: 'statusbar-format', enabled: false },
        { identifier: 'empty', enabled: true },
      ] }],
      prompts: [
        { identifier: 'worldInfoBefore', name: 'World Info (before)', marker: true, content: '' },
        { id: 'statusbar-format', name: '状态栏格式', content: '<status>HP: {{value}}</status>' },
        { id: 'empty', name: '空条目', content: '' },
      ],
    } : { prompts: [{ id: 'wrong', name: '错误预设条目', content: '<wrong />' }] },
    getWorldbookNames: () => ['状态栏世界书', '角色绑定世界书', '聊天绑定世界书', '未启用世界书'],
    getGlobalWorldbookNames: () => ['状态栏世界书'],
    getCharWorldbookNames: () => ({ primary: '角色绑定世界书', additional: [] }),
    getChatWorldbookName: () => '聊天绑定世界书',
    getWorldbook: (name) => {
      worldbookReadCount += 1;
      return name === '状态栏世界书' ? {
        1: { uid: 1, comment: '背包组件', key: ['背包'], content: '<bag>空</bag>', disable: true },
      } : {
        2: { uid: 2, comment: '错误世界书条目', content: '<wrong />' },
      };
    },
  },
};

const context = {
  characterId: 0,
  characters: [{ name: '当前角色', data: { description: '角色卡内容' } }],
  extensionPrompts: { injected: { value: '注入内容' } },
  getWorldInfoNames: () => [],
};

assert.equal(getCurrentCharacterNameSafe({ name1: '用户', name2: '当前角色' }), '当前角色');
assert.equal(getComponentBindingName('角色', targetWindow, { name1: '用户', name2: '当前角色' }), '当前角色');
assert.equal(getCurrentCharacterNameSafe({ characterId: '1', characters: [{ name: '其他角色' }, { name: '当前卡片角色' }], name2: 'SillyTavern System' }), '当前卡片角色');
assert.equal(getCurrentCharacterNameSafe({ name1: '用户', name2: 'SillyTavern System' }), '');

assert.deepEqual(getPresetNamesSafe(targetWindow, context), ['Ako 预设', '不应扫描的旧预设']);
assert.deepEqual(getWorldbookNamesSafe(targetWindow, context), ['状态栏世界书', '角色绑定世界书', '聊天绑定世界书', '未启用世界书']);

worldbookReadCount = 0;
const presetGroups = collectPresetImportGroups({ targetWindow, context });
const worldbookGroups = collectWorldbookImportGroups({ targetWindow, context });
assert.equal(worldbookReadCount, 0);
assert.equal(presetGroups[0].loaded, true);
assert.equal(presetGroups[0].items[0].name, 'World Info (before)');
assert.equal(presetGroups[0].items[0].markerType, 'worldInfoBefore');
assert.equal(presetGroups[0].items[0].locked, true);
assert.equal(presetGroups[0].items[0].content, '');
assert.equal(presetGroups[0].items[1].enabled, false);
assert.deepEqual(presetGroups.map((group) => group.source), ['Ako 预设']);
assert.equal(presetGroups.length, 1);
assert.deepEqual(collectPresetImportGroups({ targetWindow, context, presetName: '不应扫描的旧预设' }).map((group) => group.source), ['不应扫描的旧预设']);
assert.equal(worldbookGroups[0].loaded, false);
assert.deepEqual(worldbookGroups.map((group) => group.source), ['状态栏世界书', '角色绑定世界书', '聊天绑定世界书', '未启用世界书']);
assert.deepEqual(worldbookGroups.map((group) => group.categoryLabel), ['全局世界书', '角色世界书', '聊天世界书', '未启用世界书']);
assert.ok(worldbookGroups.every((group) => group.group === group.source));

assert.equal(
  getWorldbookImportDisplayCategory({ category: 'inactive' }, { pluginEnabledCount: 14, followingTavern: true }),
  'inactive',
);
assert.equal(
  getWorldbookImportDisplayCategory({ category: 'inactive' }, { pluginEnabledCount: 14, followingTavern: false }),
  'plugin',
);
assert.equal(
  getWorldbookImportDisplayCategory({ category: 'character' }, { pluginEnabledCount: 14, followingTavern: true }),
  'character',
);

const inUsePresetGroups = collectPresetImportGroups({
  targetWindow: {
    getPreset: (name) => name === 'in_use' ? {
      prompts: [
        { id: 'style-start', name: 'Style start', content: '<style>' },
        { id: 'worldInfoBefore', name: 'World Info (before)', content: '' },
        { id: 'charDescription', name: 'Char Description', content: '' },
        { id: 'style-end', name: 'Style end', content: '</style>', enabled: false },
      ],
    } : null,
    isPresetPlaceholderPrompt: (prompt) => ['worldInfoBefore', 'charDescription'].includes(prompt?.id),
    getPresetManager: () => ({ getSelectedPresetName: () => 'In Use Preset' }),
    TavernHelper: {
      getPresetNames: () => ['In Use Preset'],
      getPreset: () => null,
    },
  },
  context,
});
assert.deepEqual(inUsePresetGroups[0].items.map((item) => item.name), ['Style start', 'World Info (before)', 'Char Description', 'Style end']);
assert.deepEqual(inUsePresetGroups[0].items.map((item) => Boolean(item.locked)), [false, true, true, false]);
assert.deepEqual(inUsePresetGroups[0].items.map((item) => item.markerType || ''), ['', 'worldInfoBefore', 'charDescription', '']);
assert.equal(inUsePresetGroups[0].items[3].enabled, false);

const inUseMarkerTrueGroups = collectPresetImportGroups({
  targetWindow: {
    getPreset: (name) => name === 'in_use' ? {
      prompt_order: [{ character_id: 100001, order: [
        { identifier: 'worldInfoBefore', enabled: true },
        { identifier: 'charDescription', enabled: true },
        { identifier: 'chatHistory', enabled: true },
      ] }],
      prompts: [
        { identifier: 'worldInfoBefore', name: 'World Info (before)', system_prompt: true, marker: true },
        { identifier: 'charDescription', name: 'Char Description', system_prompt: true, marker: true },
        { identifier: 'chatHistory', name: 'Chat History', system_prompt: true, marker: true },
      ],
    } : null,
    getPresetManager: () => ({ getSelectedPresetName: () => 'In Use Marker True Preset' }),
    TavernHelper: {
      getPresetNames: () => ['In Use Marker True Preset'],
      getPreset: () => null,
    },
  },
  context,
});
assert.deepEqual(
  inUseMarkerTrueGroups[0].items.map((item) => item.markerType || ''),
  ['worldInfoBefore', 'charDescription', 'chatHistory'],
);
assert.ok(inUseMarkerTrueGroups[0].items.every((item) => item.locked));

const dualPromptOrderGroups = collectPresetImportGroups({
  targetWindow: {
    getPresetManager: () => ({ getSelectedPresetName: () => 'Dual Order Preset' }),
    TavernHelper: {
      getPresetNames: () => ['Dual Order Preset'],
      getPreset: () => ({
        prompt_order: [{ character_id: 100000, order: [
          { identifier: 'worldInfoBefore', enabled: true },
          { identifier: 'charDescription', enabled: true },
          { identifier: 'charPersonality', enabled: true },
          { identifier: 'scenario', enabled: true },
          { identifier: 'worldInfoAfter', enabled: true },
          { identifier: 'dialogueExamples', enabled: true },
          { identifier: 'chatHistory', enabled: true },
        ] }, { character_id: 100001, order: [
          { identifier: 'uuid-system-shell', enabled: true },
          { identifier: 'uuid-history-shell', enabled: true },
        ] }],
        prompts: [
          { identifier: 'worldInfoBefore', name: 'World Info (before)', system_prompt: true, marker: true },
          { identifier: 'charDescription', name: 'Char Description', system_prompt: true, marker: true },
          { identifier: 'charPersonality', name: 'Char Personality', system_prompt: true, marker: true },
          { identifier: 'scenario', name: 'Scenario', system_prompt: true, marker: true },
          { identifier: 'worldInfoAfter', name: 'World Info (after)', system_prompt: true, marker: true },
          { identifier: 'dialogueExamples', name: 'Chat Examples', system_prompt: true, marker: true },
          { identifier: 'chatHistory', name: 'Chat History', system_prompt: true, marker: true },
          { identifier: 'uuid-system-shell', name: 'UUID shell', content: '<shell>' },
          { identifier: 'uuid-history-shell', name: 'UUID history shell', content: '</shell>' },
        ],
      }),
    },
  },
  context,
  presetName: 'Dual Order Preset',
});
assert.deepEqual(
  dualPromptOrderGroups[0].items.slice(0, 7).map((item) => item.markerType || ''),
  ['worldInfoBefore', 'charDescription', 'charPersonality', 'scenario', 'worldInfoAfter', 'dialogueExamples', 'chatHistory'],
);
assert.ok(dualPromptOrderGroups[0].items.slice(0, 7).every((item) => item.locked));

const promptArrayOrderGroups = collectPresetImportGroups({
  targetWindow: {
    getPresetManager: () => ({ getSelectedPresetName: () => 'Prompt Array Order Preset' }),
    TavernHelper: {
      getPresetNames: () => ['Prompt Array Order Preset'],
      getPreset: () => ({
        prompts: [
          { identifier: 'before-shell', role: 'system', content: '<bkgd_info>' },
          { identifier: 'worldInfoBefore', name: 'World Info (before)', system_prompt: true, marker: true },
          { identifier: 'char-info-open', role: 'system', content: '<char_info>' },
          { identifier: 'charDescription', name: 'Char Description', system_prompt: true, marker: true },
          { identifier: 'charPersonality', name: 'Char Personality', system_prompt: true, marker: true },
          { identifier: 'char-info-close', role: 'system', content: '</char_info>' },
          { identifier: 'scenario', name: 'Scenario', system_prompt: true, marker: true },
          { identifier: 'worldInfoAfter', name: 'World Info (after)', system_prompt: true, marker: true },
          { identifier: 'history-close', role: 'system', content: '历史对话结束' },
          { identifier: 'dialogueExamples', name: 'Chat Examples', system_prompt: true, marker: true },
          { identifier: 'chatHistory', name: 'Chat History', system_prompt: true, marker: true },
        ],
      }),
    },
  },
  context,
  presetName: 'Prompt Array Order Preset',
});
assert.deepEqual(
  promptArrayOrderGroups[0].items.map((item) => item.markerType || ''),
  ['', 'worldInfoBefore', '', 'charDescription', 'charPersonality', '', 'scenario', 'worldInfoAfter', '', 'dialogueExamples', 'chatHistory'],
);

const namedPlaceholderGroups = collectPresetImportGroups({
  targetWindow: {
    getPreset: (name) => name === 'in_use' ? {
      prompts: [
        { id: 'ako-world-before-placeholder', name: 'World Info (before)', content: '' },
        { id: 'ako-char-description-placeholder', name: 'Char Description', content: '' },
        { id: 'ako-persona-placeholder', name: 'Persona Description', content: '' },
      ],
    } : null,
    getPresetManager: () => ({ getSelectedPresetName: () => 'Named Placeholder Preset' }),
    TavernHelper: {
      getPresetNames: () => ['Named Placeholder Preset'],
      getPreset: () => null,
    },
  },
  context,
});
assert.deepEqual(
  namedPlaceholderGroups[0].items.map((item) => item.markerType || ''),
  ['worldInfoBefore', 'charDescription', 'personaDescription'],
);
assert.ok(namedPlaceholderGroups[0].items.every((item) => item.locked));

const inUseOrderOnlyPlaceholderGroups = collectPresetImportGroups({
  targetWindow: {
    getPreset: (name) => name === 'in_use' ? {
      prompt_order: [{ character_id: 100001, order: [
        { identifier: 'bkgd-open', enabled: true },
        { identifier: 'worldInfoBefore', enabled: true },
        { identifier: 'charDescription', enabled: true },
        { identifier: 'worldInfoAfter', enabled: true },
        { identifier: 'bkgd-close', enabled: true },
      ] }],
      prompts: [
        { identifier: 'bkgd-open', role: 'system', content: '<bkgd_info>' },
        { identifier: 'bkgd-close', role: 'system', content: '</bkgd_info>' },
      ],
    } : null,
    getPresetManager: () => ({ getSelectedPresetName: () => 'In Use Order Preset' }),
    TavernHelper: {
      getPresetNames: () => ['In Use Order Preset'],
      getPreset: () => null,
    },
  },
  context,
});
assert.deepEqual(
  inUseOrderOnlyPlaceholderGroups[0].items.map((item) => item.name),
  ['bkgd-open', 'World Info (before)', 'Char Description', 'World Info (after)', 'bkgd-close'],
);
assert.deepEqual(
  inUseOrderOnlyPlaceholderGroups[0].items.map((item) => item.markerType || ''),
  ['', 'worldInfoBefore', 'charDescription', 'worldInfoAfter', ''],
);
assert.deepEqual(inUseOrderOnlyPlaceholderGroups[0].items.map((item) => Boolean(item.locked)), [false, true, true, true, false]);

const orderOnlyPresetGroups = collectPresetImportGroups({
  targetWindow: {
    getPresetManager: () => ({ getSelectedPresetName: () => 'Order Only Preset' }),
    TavernHelper: {
      getPresetNames: () => ['Order Only Preset'],
      getPreset: () => ({
        prompt_order: [{ character_id: 100001, order: [
          { identifier: 'before-shell', enabled: true },
          { identifier: 'worldInfoBefore', enabled: true },
          { identifier: 'charDescription', enabled: true },
          { identifier: 'worldInfoAfter', enabled: true },
          { identifier: 'after-shell', enabled: true },
        ] }],
        prompts: [
          { identifier: 'before-shell', role: 'system', content: '<bkgd_info>' },
          { identifier: 'after-shell', role: 'system', content: '</bkgd_info>' },
        ],
      }),
    },
  },
  context,
});
assert.deepEqual(
  orderOnlyPresetGroups[0].items.map((item) => item.name),
  ['before-shell', 'World Info (before)', 'Char Description', 'World Info (after)', 'after-shell'],
);
assert.deepEqual(
  orderOnlyPresetGroups[0].items.map((item) => item.markerType || ''),
  ['', 'worldInfoBefore', 'charDescription', 'worldInfoAfter', ''],
);
assert.deepEqual(orderOnlyPresetGroups[0].items.map((item) => Boolean(item.locked)), [false, true, true, true, false]);

const idBackedWorldbooks = collectWorldbookImportGroups({
  targetWindow: {
    TavernHelper: {
      getWorldbookNames: () => ['Visible Global Book'],
      getGlobalWorldbookNames: () => ['Visible Global Book'],
      getCharWorldbookNames: () => ({}),
      getChatWorldbookName: () => '',
    },
  },
  context: {},
  selectedWorldNames: ['15'],
});
assert.deepEqual(idBackedWorldbooks.map((group) => group.source), ['Visible Global Book']);

const savedSchemeWorldbooks = collectWorldbookImportGroups({
  targetWindow: {
    TavernHelper: {
      getWorldbookNames: () => ['Current Character Book', 'Saved Scheme Book'],
      getGlobalWorldbookNames: () => { throw new Error('saved schemes must not inspect Tavern assignments'); },
      getCharWorldbookNames: () => { throw new Error('saved schemes must not inspect the current character'); },
      getChatWorldbookName: () => { throw new Error('saved schemes must not inspect the current chat'); },
    },
  },
  context: {},
  explicitWorldbookNames: ['Saved Scheme Book'],
});
assert.deepEqual(savedSchemeWorldbooks.map((group) => [group.source, group.category]), [['Saved Scheme Book', 'plugin']]);
assert.deepEqual(collectWorldbookImportGroups({
  targetWindow: { TavernHelper: { getWorldbookNames: () => ['Current Character Book'] } },
  context: {},
  explicitWorldbookNames: [],
}), []);

const lazyWorldbookItems = await collectWorldbookImportCandidates(targetWindow, '状态栏世界书');
assert.equal(worldbookReadCount, 1);
assert.deepEqual(lazyWorldbookItems.map((item) => item.name), ['背包组件']);
assert.equal(lazyWorldbookItems[0].enabled, false);

assert.equal(isWorldbookEntryConstant({ constant: true }), true);
assert.equal(isWorldbookEntryConstant({ alwaysActive: true }), true);
assert.equal(isWorldbookEntryConstant({ alwaysActivated: true }), true);
assert.equal(isWorldbookEntryConstant({ strategy: { type: 'constant' } }), true);
assert.equal(isWorldbookEntryConstant({ strategy: { constant: true } }), true);
assert.equal(isWorldbookEntryConstant({ constant: false, strategy: { type: 'normal' } }), false);
assert.deepEqual(getWorldbookEntryKeys({ key: ['主关键词'] }), ['主关键词']);
assert.deepEqual(getWorldbookEntryKeys({ keys: ['兼容关键词'] }), ['兼容关键词']);
assert.equal(getWorldbookEntryKeys({ strategy: { keys: '策略关键词' } }), '策略关键词');

const candidates = await collectComponentImportCandidates({ targetWindow, context });

assert.equal(candidates.length, 6);
assert.deepEqual(candidates.map((item) => item.scope), ['预设', '预设', '世界书', '世界书', '世界书', '世界书']);
assert.deepEqual(candidates.map((item) => item.name), ['状态栏格式', '错误预设条目', '背包组件', '错误世界书条目', '错误世界书条目', '错误世界书条目']);
assert.ok(candidates.every((item) => item.content.includes('<')));
assert.ok(!candidates.some((item) => item.group.includes('角色卡') || item.source.includes('角色卡')));

const components = [
  { name: '全局状态栏', scope: '全局', content: 'global' },
  { name: '当前预设状态栏', scope: '预设', bindName: 'Ako 预设', content: 'preset-current' },
  { name: '其他预设状态栏', scope: '预设', bindName: '其他预设', content: 'preset-other' },
  { name: '当前角色状态栏', scope: '角色', bindName: '当前角色', content: 'character-current' },
  { name: '其他角色状态栏', scope: '角色', bindName: '其他角色', content: 'character-other' },
  { name: '旧世界书归属', scope: '世界书', content: 'legacy-worldbook-scope' },
  { name: '关闭组件', scope: '全局', enabled: false, content: 'disabled' },
];

assert.equal(normalizeComponent({ scope: '世界书' }, targetWindow, context).scope, '全局');
assert.deepEqual(
  getActiveComponentsForContext(components, targetWindow, context).map((item) => item.name),
  ['全局状态栏', '当前预设状态栏', '当前角色状态栏', '旧世界书归属'],
);

const schemeBoundComponents = [
  { name: '全局组件', scope: '全局', content: 'global' },
  { name: '当前方案组件', scope: '预设', presetSchemeId: 'preset-current', content: 'current' },
  { name: '其他方案组件', scope: '预设', presetSchemeId: 'preset-other', content: 'other' },
  { name: '当前角色组件', scope: '角色', bindName: '当前角色', content: 'character' },
];
assert.deepEqual(
  getActiveComponentsForContext(schemeBoundComponents, targetWindow, context, { presetSchemeId: 'preset-current' }).map((item) => item.name),
  ['全局组件', '当前方案组件', '当前角色组件'],
);
assert.deepEqual(
  getActiveComponentsForContext(schemeBoundComponents, targetWindow, context, { presetSchemeId: '' }).map((item) => item.name),
  ['全局组件', '当前角色组件'],
);
assert.deepEqual(
  getComponentLibraryFolders(schemeBoundComponents, '预设', { presetSchemeId: 'preset-current' }).ungrouped.map((item) => item.name),
  ['当前方案组件'],
);

const orderedWorldbookItems = await collectWorldbookImportCandidates({
  TavernHelper: {
    getWorldbook: () => [
      { uid: 30, comment: 'Component start', content: 'start' },
      { uid: 10, comment: 'Component middle', content: 'middle' },
      { uid: 20, comment: 'Component end', content: 'end' },
    ],
  },
}, 'Ordered Book');
assert.deepEqual(orderedWorldbookItems.map((item) => item.name), ['Component start', 'Component middle', 'Component end']);
assert.deepEqual(orderedWorldbookItems.map((item) => item.sourceOrder), [0, 1, 2]);

const shuffledImportedComponents = [
  { name: 'Component end', scope: '鍏ㄥ眬', sourceType: SOURCE_WORLDBOOK, source: 'Ordered Book', sourceOrder: 2, content: 'end' },
  { name: 'Manual note', scope: '鍏ㄥ眬', sourceType: 'manual', content: 'manual' },
  { name: 'Component start', scope: '鍏ㄥ眬', sourceType: SOURCE_WORLDBOOK, source: 'Ordered Book', sourceOrder: 0, content: 'start' },
  { name: 'Component middle', scope: '鍏ㄥ眬', sourceType: SOURCE_WORLDBOOK, source: 'Ordered Book', sourceOrder: 1, content: 'middle' },
];
assert.deepEqual(
  getActiveComponentsForContext(shuffledImportedComponents, targetWindow, context).map((item) => item.name),
  ['Component end', 'Manual note', 'Component start', 'Component middle'],
);

const presetLibrary = getComponentLibraryFolders([
  { name: 'Manual preset item', scope: '预设', sourceType: '手动', content: 'manual' },
  { name: 'Choice end', scope: '预设', sourceType: SOURCE_WORLDBOOK, source: 'Clickable Choices', sourceOrder: 2, content: 'end' },
  { name: 'Choice start', scope: '预设', sourceType: SOURCE_WORLDBOOK, source: 'Clickable Choices', sourceOrder: 0, content: 'start' },
  { name: 'Ako format', scope: '预设', sourceType: '预设', source: 'Ako Preset', sourceOrder: 0, content: 'format' },
], '预设');
assert.deepEqual(presetLibrary.groups, []);
assert.deepEqual(presetLibrary.ungrouped.map((item) => item.name), ['Manual preset item', 'Choice end', 'Choice start', 'Ako format']);

const folderGateComponents = [
  { name: 'Global manual', scope: '\u5168\u5c40', groupId: 'global-manual', enabled: true, content: 'global' },
  { name: 'Character manual', scope: '\u89d2\u8272', bindName: getCurrentCharacterNameSafe(context), groupId: 'character-manual', enabled: true, content: 'character' },
  { name: 'Individually disabled', scope: '\u5168\u5c40', groupId: 'other', enabled: false, content: 'disabled' },
];
const componentGroups = [
  { id: 'global-manual', name: 'Manual', scope: '\u5168\u5c40', enabled: false, order: 0 },
  { id: 'character-manual', name: 'Manual', scope: '\u89d2\u8272', enabled: true, order: 1 },
  { id: 'other', name: 'Other', scope: '\u5168\u5c40', enabled: true, order: 2 },
];
assert.deepEqual(
  getActiveComponentsForContext(folderGateComponents, targetWindow, context, {
    componentGroups,
  }).map((item) => item.name),
  ['Character manual'],
);
assert.equal(folderGateComponents[0].enabled, true);
assert.equal(folderGateComponents[1].enabled, true);

const defaultGroupGateComponents = [
  { name: 'Default global', scope: '全局', content: 'global' },
  { name: 'Default character', scope: '角色', bindName: getCurrentCharacterNameSafe(context), content: 'character' },
];
assert.deepEqual(
  getActiveComponentsForContext(defaultGroupGateComponents, targetWindow, context, {
    defaultGroupEnabled: { 全局: false },
  }).map((item) => item.name),
  ['Default character'],
);

const orderedGroupComponents = [
  { name: 'Ungrouped', scope: '\u5168\u5c40', content: 'ungrouped' },
  { name: 'Later group item', scope: '\u5168\u5c40', groupId: 'later', content: 'later' },
  { name: 'First group item', scope: '\u5168\u5c40', groupId: 'first', content: 'first' },
];
const orderedGroups = [
  { id: 'empty', name: 'Empty', scope: '\u5168\u5c40', enabled: true, order: 0 },
  { id: 'later', name: 'Later', scope: '\u5168\u5c40', enabled: true, order: 2 },
  { id: 'first', name: 'First', scope: '\u5168\u5c40', enabled: true, order: 1 },
];
const orderedLibrary = getComponentLibraryFolders(orderedGroupComponents, '\u5168\u5c40', { componentGroups: orderedGroups });
assert.deepEqual(orderedLibrary.groups.map((group) => group.name), ['Empty', 'First', 'Later']);
assert.deepEqual(orderedLibrary.groups[0].items, []);
assert.deepEqual(orderedLibrary.ungrouped.map((item) => item.name), ['Ungrouped']);
assert.deepEqual(
  getActiveComponentsForContext(orderedGroupComponents, targetWindow, context, { componentGroups: orderedGroups }).map((item) => item.name),
  ['First group item', 'Later group item', 'Ungrouped'],
);

const legacyComponents = [
  { name: 'Manual', scope: '\u5168\u5c40', folderName: 'Manual', content: 'manual' },
  { name: 'Worldbook last', scope: '\u5168\u5c40', sourceType: SOURCE_WORLDBOOK, source: 'Book', sourceOrder: 2, content: 'last' },
  { name: 'Worldbook first', scope: '\u5168\u5c40', sourceType: SOURCE_WORLDBOOK, source: 'Book', sourceOrder: 0, content: 'first' },
  { name: 'Character manual', scope: '\u89d2\u8272', folderName: 'Manual', bindName: getCurrentCharacterNameSafe(context), content: 'character' },
];
let migrationId = 0;
const migratedLegacyGroups = migrateLegacyComponentGroups(legacyComponents, [], { '\u5168\u5c40::Manual': false }, { randomUUID: () => `group-${++migrationId}` });
assert.deepEqual(migratedLegacyGroups.componentGroups.map((group) => [group.name, group.scope, group.enabled, group.order]), [
  ['Manual', '\u5168\u5c40', false, 0],
  ['世界书：Book', '\u5168\u5c40', true, 1],
  ['Manual', '\u89d2\u8272', true, 2],
]);
assert.deepEqual(migratedLegacyGroups.components.map((item) => item.name), ['Manual', 'Worldbook first', 'Worldbook last', 'Character manual']);
const repeatedMigration = migrateLegacyComponentGroups(migratedLegacyGroups.components, migratedLegacyGroups.componentGroups, {}, { randomUUID: () => 'unexpected' });
assert.deepEqual(repeatedMigration.componentGroups, migratedLegacyGroups.componentGroups);
assert.deepEqual(repeatedMigration.components, migratedLegacyGroups.components);
