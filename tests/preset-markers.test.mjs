import assert from 'node:assert/strict';
import { collectPresetImportGroups } from '../component-sources.js';

const markerTargetWindow = {
  TavernHelper: {
    getPreset: () => ({
      prompt_order: [{
        character_id: 100001,
        order: [
          { identifier: 'custom-system', enabled: true },
        ],
      }, {
        character_id: 100000,
        order: [
          { identifier: 'worldInfoBefore', enabled: true },
          { identifier: 'charDescription', enabled: true },
          { identifier: 'charPersonality', enabled: true },
          { identifier: 'scenario', enabled: false },
          { identifier: 'dialogueExamples', enabled: true },
          { identifier: 'personaDescription', enabled: true },
          { identifier: 'chatHistory', enabled: true },
        ],
      }],
      prompts: [
        { identifier: 'worldInfoBefore', name: 'World Info (before)', marker: true, content: '' },
        { identifier: 'charDescription', name: 'Char Description', marker: true, content: '' },
        { identifier: 'charPersonality', name: 'Char Personality', marker: true, content: '' },
        { identifier: 'scenario', name: 'Scenario', marker: true, content: '' },
        { identifier: 'dialogueExamples', name: 'Chat Examples', marker: true, content: '' },
        { identifier: 'personaDescription', name: 'Persona Description', marker: true, content: '' },
        { identifier: 'chatHistory', name: 'Chat History', marker: true, content: '' },
        { identifier: 'custom-system', name: 'Custom System', role: 'system', content: 'Custom prompt' },
      ],
    }),
  },
};

const markerContext = {
  characterId: '0',
  characters: [{
    data: {
      description: '角色描述正文',
      personality: '角色性格正文',
      scenario: '场景正文',
      mes_example: '示例对话正文',
    },
  }],
  getCharacterCardFields: () => ({
    description: '酒馆字段角色描述',
    personality: '酒馆字段角色性格',
    scenario: '酒馆字段场景',
    mesExamples: '酒馆字段示例对话',
    persona: '酒馆字段用户设定',
  }),
};

const markerGroups = collectPresetImportGroups({
  targetWindow: markerTargetWindow,
  context: markerContext,
  presetName: 'Marker Preset',
});

assert.deepEqual(
  markerGroups[0].items.slice(0, 7).map((item) => item.markerType),
  ['worldInfoBefore', 'charDescription', 'charPersonality', 'scenario', 'dialogueExamples', 'personaDescription', 'chatHistory'],
);
assert.equal(markerGroups[0].items.find((item) => item.markerType === 'charDescription').content, '酒馆字段角色描述');
assert.equal(markerGroups[0].items.find((item) => item.markerType === 'charPersonality').content, '酒馆字段角色性格');
assert.equal(markerGroups[0].items.find((item) => item.markerType === 'dialogueExamples').content, '酒馆字段示例对话');
assert.equal(markerGroups[0].items.find((item) => item.markerType === 'personaDescription').content, '酒馆字段用户设定');
assert.equal(markerGroups[0].items.find((item) => item.markerType === 'scenario').enabled, false);
/*
assert.ok(markerGroups[0].items.find((item) => item.markerType === 'chatHistory').content.includes('聊天历史'));

*/
assert.equal(markerGroups[0].items.find((item) => item.markerType === 'chatHistory').content, '');
assert.equal(markerGroups[0].items.find((item) => item.markerType === 'chatHistory').locked, true);

const markerGroupsWithoutHelperPreset = collectPresetImportGroups({
  targetWindow: {
    TavernHelper: {
      getPreset: () => {
        throw new Error('helper preset unavailable');
      },
    },
  },
  context: markerContext,
  presetName: 'Broken Preset',
});

assert.deepEqual(markerGroupsWithoutHelperPreset, [{
  scope: '预设',
  group: '预设：Broken Preset',
  source: 'Broken Preset',
  loaded: true,
  items: [],
}]);
