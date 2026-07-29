import assert from 'node:assert/strict';
import { buildExternalStatusbarMessages, createRuntimePromptDiagnostics } from '../prompt-builder.js';

const targetWindow = {
  TavernHelper: {
    getCurrentPresetName: () => 'Main Preset',
    getPreset: () => ({
      prompt_order: [{ order: [
        { identifier: 'system-main', enabled: true },
        { identifier: 'disabled-one', enabled: false },
        { identifier: 'history', enabled: true },
      ] }],
      prompts: [
        { identifier: 'history', role: 'user', content: 'History here:\n{{chatHistory}}' },
        { identifier: 'system-main', role: 'system', content: 'Write as {{char}} for {{user}}.' },
        { identifier: 'disabled-one', role: 'system', content: 'SHOULD_NOT_EXIST' },
      ],
    }),
  },
};

const context = {
  name1: 'UserName',
  name2: 'CharName',
  characterId: '0',
  characters: [{ description: 'Runtime character description', personality: 'Runtime personality', scenario: 'Runtime scenario', mes_example: 'Runtime examples' }],
  getCharacterCardFields: () => ({
    description: 'Card fields description',
    personality: 'Card fields personality',
    scenario: 'Card fields scenario',
    mesExamples: 'Card fields examples',
    persona: 'Card fields persona',
  }),
  chat: [
    { is_user: true, mes: 'Hello' },
    { is_user: false, mes: 'Reply' },
  ],
};

const messages = await buildExternalStatusbarMessages({
  targetWindow,
  context,
  latestMessage: { mes: 'Latest assistant prose' },
  taskPrompt: 'Generate footer widgets only.',
  components: [{ scope: 'global', name: 'Choices', content: '<roleplay_options />' }],
});

assert.deepEqual(messages.map((message) => message.role), ['system', 'user', 'user', 'assistant', 'user']);
assert.equal(messages[0].content, 'Write as CharName for UserName.');
assert.ok(messages[1].content.includes('Hello'));
assert.ok(messages[1].content.includes('Reply'));
assert.ok(!messages.some((message) => message.content.includes('SHOULD_NOT_EXIST')));
assert.equal(messages[2].role, 'user');
assert.equal(messages[2].content, 'Hello');
assert.equal(messages[3].role, 'assistant');
assert.equal(messages[3].content, 'Reply');
assert.ok(messages[4].content.includes('Generate footer widgets only.'));
assert.ok(!messages[4].content.includes('<roleplay_options />'));
assert.ok(!messages[4].content.includes('Choices'));
assert.ok(!messages[4].content.includes('Latest assistant prose'));

const messagesWithTaskAsLastUserMessage = await buildExternalStatusbarMessages({
  targetWindow: {
    TavernHelper: {
      getCurrentPresetName: () => 'Last User Preset',
      getPreset: () => ({
        prompts: [
          { identifier: 'last-user-capture', role: 'system', content: 'Captured: {{LastUserMessage}}' },
        ],
      }),
    },
  },
  context,
  latestMessage: { mes: 'Latest assistant prose' },
  taskPrompt: 'Task says\n{{external_components}}',
  components: [{ content: '<status_component />' }],
  replaceLastUserMessageWithTask: true,
  omitOriginalUserMessages: true,
});

assert.equal(messagesWithTaskAsLastUserMessage[0].content, 'Captured: Task says\n<status_component />');
assert.deepEqual(messagesWithTaskAsLastUserMessage.map((message) => message.role), ['system', 'assistant', 'user']);
assert.ok(!messagesWithTaskAsLastUserMessage.some((message) => message.content === 'Hello'));

const messagesWithoutOriginalUserMessages = await buildExternalStatusbarMessages({
  targetWindow: {},
  context,
  latestMessage: { mes: 'Latest assistant prose' },
  taskPrompt: 'Task only',
  components: [],
  omitOriginalUserMessages: true,
});

assert.deepEqual(messagesWithoutOriginalUserMessages.map((message) => message.role), ['assistant', 'user']);
assert.ok(!messagesWithoutOriginalUserMessages.some((message) => message.content === 'Hello'));

const messagesWithComponentPlaceholder = await buildExternalStatusbarMessages({
  targetWindow: {},
  context,
  latestMessage: { mes: 'Latest assistant prose' },
  taskPrompt: 'Before\n{{external_components}}\nAfter',
  components: [
    { scope: 'global', name: 'Choices', content: '<roleplay_options />' },
    { scope: 'global', name: 'Guide', content: '<evil_guidance />' },
  ],
  promptSourceItems: [],
});

assert.equal(messagesWithComponentPlaceholder.at(-1).content, 'Before\n<roleplay_options />\n\n<evil_guidance />\nAfter');

const messagesWithTemplateRendering = await buildExternalStatusbarMessages({
  targetWindow: {},
  context,
  latestMessage: { mes: 'Latest assistant prose' },
  taskPrompt: 'Hello <%= userName %>\n{{external_components}}',
  components: [{ content: 'Component <%= userName %>' }],
  renderTemplate: async (content) => content.replaceAll('<%= userName %>', 'Lin'),
});
assert.equal(messagesWithTemplateRendering.at(-1).content, 'Hello Lin\nComponent Lin');

const messagesWithoutPresetName = await buildExternalStatusbarMessages({
  targetWindow: {
    TavernHelper: {
      getCurrentPresetName: () => '',
      getSelectedPresetName: () => '',
      getPreset: (name) => {
        throw new Error(`Preset ${name} not found`);
      },
    },
  },
  context,
  latestMessage: { mes: 'Latest assistant prose' },
  taskPrompt: 'Generate footer widgets only.',
  components: [],
});

assert.deepEqual(messagesWithoutPresetName.map((message) => message.role), ['user', 'assistant', 'user']);
assert.equal(messagesWithoutPresetName.at(-1).role, 'user');

const messagesFromPresetMarkers = await buildExternalStatusbarMessages({
  targetWindow: {
    TavernHelper: {
      getCurrentPresetName: () => 'Marker Preset',
      getPreset: () => ({
        prompt_order: [{ character_id: 100001, order: [
          { identifier: 'charDescription', enabled: true },
          { identifier: 'charPersonality', enabled: true },
          { identifier: 'scenario', enabled: true },
          { identifier: 'dialogueExamples', enabled: true },
          { identifier: 'personaDescription', enabled: true },
          { identifier: 'chatHistory', enabled: true },
        ] }],
        prompts: [
          { identifier: 'charDescription', name: 'Char Description', marker: true, role: 'system', content: '' },
          { identifier: 'charPersonality', name: 'Char Personality', marker: true, role: 'system', content: '' },
          { identifier: 'scenario', name: 'Scenario', marker: true, role: 'system', content: '' },
          { identifier: 'dialogueExamples', name: 'Chat Examples', marker: true, role: 'system', content: '' },
          { identifier: 'personaDescription', name: 'Persona Description', marker: true, role: 'system', content: '' },
          { identifier: 'chatHistory', name: 'Chat History', marker: true, role: 'system', content: '' },
        ],
      }),
    },
  },
  context,
  latestMessage: { mes: 'Latest assistant prose' },
  taskPrompt: 'Generate footer widgets only.',
  components: [],
});

assert.deepEqual(messagesFromPresetMarkers.slice(0, 8).map((message) => message.role), ['system', 'system', 'system', 'system', 'system', 'user', 'assistant', 'user']);
assert.equal(messagesFromPresetMarkers[0].content, 'Card fields description');
assert.equal(messagesFromPresetMarkers[1].content, 'Card fields personality');
assert.equal(messagesFromPresetMarkers[2].content, 'Card fields scenario');
assert.equal(messagesFromPresetMarkers[3].content, 'Card fields examples');
assert.equal(messagesFromPresetMarkers[4].content, 'Card fields persona');
assert.deepEqual(
  messagesFromPresetMarkers.promptSourceItems.map((item) => item.markerType),
  ['charDescription', 'charPersonality', 'scenario', 'dialogueExamples', 'personaDescription', 'chatHistory'],
);

const messagesFromOrderOnlyPresetMarkers = await buildExternalStatusbarMessages({
  targetWindow: {
    TavernHelper: {
      getCurrentPresetName: () => 'Order Only Marker Preset',
      getPreset: () => ({
        prompt_order: [{ character_id: 100001, order: [
          { identifier: 'char-info-open', enabled: true },
          { identifier: 'charDescription', enabled: true },
          { identifier: 'chatHistory', enabled: true },
          { identifier: 'char-info-close', enabled: true },
        ] }],
        prompts: [
          { identifier: 'char-info-open', role: 'system', content: '<char_info>' },
          { identifier: 'char-info-close', role: 'system', content: '</char_info>' },
          { identifier: 'unordered-tail', role: 'system', content: 'SHOULD_NOT_APPEND_TO_END' },
        ],
      }),
    },
  },
  context,
  latestMessage: { mes: 'Latest assistant prose' },
  taskPrompt: 'Generate footer widgets only.',
  components: [],
});

assert.deepEqual(
  messagesFromOrderOnlyPresetMarkers.slice(0, 5).map((message) => message.content),
  ['<char_info>', 'Card fields description', 'Hello', 'Reply', '</char_info>'],
);
assert.ok(!messagesFromOrderOnlyPresetMarkers.some((message) => message.content === 'SHOULD_NOT_APPEND_TO_END'));

const messagesFromPersonaOrder = await buildExternalStatusbarMessages({
  targetWindow: {
    TavernHelper: {
      getCurrentPresetName: () => 'Persona Shell Preset',
      getPreset: () => ({
        prompt_order: [{ character_id: 100001, order: [
          { identifier: 'user-info-open', enabled: true },
          { identifier: 'personaDescription', enabled: true },
          { identifier: 'user-info-close', enabled: true },
        ] }],
        prompts: [
          { identifier: 'user-info-open', role: 'system', content: '<user_info>' },
          { identifier: 'personaDescription', name: 'Persona Description', role: 'system', content: '' },
          { identifier: 'user-info-close', role: 'system', content: '</user_info>' },
        ],
      }),
    },
  },
  context,
  latestMessage: { mes: 'Latest assistant prose' },
  taskPrompt: 'Generate footer widgets only.',
  components: [],
});

assert.deepEqual(
  messagesFromPersonaOrder.slice(0, 3).map((message) => message.content),
  ['<user_info>', 'Card fields persona', '</user_info>'],
);

const messagesFromEmptyRuntimeBlocks = await buildExternalStatusbarMessages({
  targetWindow: {
    TavernHelper: {
      getCurrentPresetName: () => 'Ako Shell Preset',
      getGlobalWorldbookNames: () => ['Global Lore'],
      getCharWorldbookNames: () => ({ primary: 'Character Lore', additional: [] }),
      getChatWorldbookName: () => '',
      getWorldbookNames: () => ['Global Lore', 'Character Lore'],
      getPreset: () => ({
        prompt_order: [{ character_id: 100001, order: [
          { identifier: 'bkgd-open', enabled: true },
          { identifier: 'worldInfoBefore', enabled: true },
          { identifier: 'char-info-open', enabled: true },
          { identifier: 'charDescription', enabled: true },
          { identifier: 'charPersonality', enabled: true },
          { identifier: 'char-info-close', enabled: true },
          { identifier: 'scenario', enabled: true },
          { identifier: 'worldInfoAfter', enabled: true },
          { identifier: 'bkgd-close', enabled: true },
        ] }],
        prompts: [
          { identifier: 'bkgd-open', role: 'system', content: '<bkgd_info>' },
          { identifier: 'worldInfoBefore', role: 'system', content: '' },
          { identifier: 'char-info-open', role: 'system', content: '<char_info>' },
          { identifier: 'char-info-close', role: 'system', content: '</char_info>' },
          { identifier: 'worldInfoAfter', role: 'system', content: '' },
          { identifier: 'bkgd-close', role: 'system', content: '</bkgd_info>' },
        ],
      }),
    },
    SillyTavern: {
      loadWorldInfo: async (name) => ({
        entries: name === 'Global Lore'
          ? {
              0: { uid: 0, content: 'Before character lore', position: { type: 'before_character_definition' }, enabled: true },
              1: { uid: 1, content: 'After character lore', position: { type: 'after_character_definition' }, enabled: true },
            }
          : {
              0: { uid: 0, content: 'Character book after lore', position: 1, enabled: true },
            },
      }),
    },
  },
  context,
  latestMessage: { mes: 'Latest assistant prose' },
  taskPrompt: 'Generate footer widgets only.',
  components: [],
});

assert.deepEqual(
  messagesFromEmptyRuntimeBlocks.slice(0, 9).map((message) => message.content),
  [
    '<bkgd_info>',
    'Before character lore',
    '<char_info>',
    'Card fields description',
    'Card fields personality',
    '</char_info>',
    'Card fields scenario',
    'After character lore\n\nCharacter book after lore',
    '</bkgd_info>',
  ],
);
assert.equal(messagesFromEmptyRuntimeBlocks.runtimeInsertions.charInfoLength > 0, true);
assert.equal(messagesFromEmptyRuntimeBlocks.runtimeInsertions.worldbookBeforeCount, 1);
assert.equal(messagesFromEmptyRuntimeBlocks.runtimeInsertions.worldbookAfterCount, 2);

const messagesFromWorldbookDepthInjections = await buildExternalStatusbarMessages({
  targetWindow: {
    TavernHelper: {
      getCurrentPresetName: () => 'Depth Lore Preset',
      getGlobalWorldbookNames: () => ['Depth Lore'],
      getCharWorldbookNames: () => ({ primary: '', additional: [] }),
      getChatWorldbookName: () => '',
      getPreset: () => ({
        prompt_order: [{ character_id: 100001, order: [
          { identifier: 'worldInfoAfter', enabled: true },
          { identifier: 'chatHistory', enabled: true },
        ] }],
        prompts: [
          { identifier: 'worldInfoAfter', role: 'system', content: '' },
          { identifier: 'chatHistory', role: 'system', content: '' },
        ],
      }),
    },
    SillyTavern: {
      loadWorldInfo: async () => ({
        entries: {
          0: { uid: 0, content: 'Flat after lore', position: 1, enabled: true },
          1: { uid: 1, content: 'D1 assistant lore', position: 4, depth: 1, role: 'assistant', order: 100, enabled: true },
          2: { uid: 2, content: 'D1 system high order lore', position: 4, depth: 1, role: 'system', order: 200, enabled: true },
          3: { uid: 3, content: 'D1 user lore', position: 4, depth: 1, role: 'user', order: 100, enabled: true },
          4: { uid: 4, content: 'D0 system lore', position: { type: 'at_depth' }, depth: 0, role: 'system', order: 100, enabled: true },
        },
      }),
    },
  },
  context: {
    ...context,
    chat: [
      { is_user: true, mes: 'Older user' },
      { is_user: false, mes: 'Newest assistant' },
    ],
  },
  latestMessage: { mes: 'Latest assistant prose' },
  taskPrompt: 'Generate footer widgets only.',
  components: [],
});

assert.deepEqual(
  messagesFromWorldbookDepthInjections.slice(0, 7).map((message) => [message.role, message.content]),
  [
    ['system', 'Flat after lore'],
    ['user', 'Older user'],
    ['assistant', 'D1 assistant lore'],
    ['user', 'D1 user lore'],
    ['system', 'D1 system high order lore'],
    ['assistant', 'Newest assistant'],
    ['system', 'D0 system lore'],
  ],
);
assert.equal(messagesFromWorldbookDepthInjections.runtimeInsertions.worldbookAfterCount, 1);
assert.equal(messagesFromWorldbookDepthInjections.runtimeInsertions.worldbookAtDepthCount, 4);
assert.ok(!messagesFromWorldbookDepthInjections[0].content.includes('D1 assistant lore'));
assert.equal(messagesFromWorldbookDepthInjections.some((message) => 'injected' in message), false);

const messagesFromPositionObjectDepthMetadata = await buildExternalStatusbarMessages({
  targetWindow: {
    TavernHelper: {
      getCurrentPresetName: () => 'Position Object Depth Preset',
      getGlobalWorldbookNames: () => ['Position Object Lore'],
      getCharWorldbookNames: () => ({ primary: '', additional: [] }),
      getChatWorldbookName: () => '',
      getPreset: () => ({
        prompt_order: [{ character_id: 100001, order: [
          { identifier: 'chatHistory', enabled: true },
        ] }],
        prompts: [
          { identifier: 'chatHistory', role: 'system', content: '' },
        ],
      }),
    },
    SillyTavern: {
      loadWorldInfo: async () => ({
        entries: {
          0: { uid: 0, content: 'D1 object lore', position: { type: 'at_depth', depth: 1, role: 0, order: 999 }, enabled: true },
          1: { uid: 1, content: 'D2 object lore', position: { type: 'at_depth', depth: 2, role: 0, order: 200 }, enabled: true },
        },
      }),
    },
  },
  context: {
    ...context,
    chat: [
      { is_user: false, mes: 'Object History 1' },
      { is_user: false, mes: 'Object History 2' },
      { is_user: false, mes: 'Object History 3' },
      { is_user: false, mes: 'Object History 4' },
    ],
  },
  latestMessage: { mes: 'Latest assistant prose' },
  taskPrompt: 'Generate footer widgets only.',
  components: [],
});

assert.deepEqual(
  messagesFromPositionObjectDepthMetadata.slice(0, 6).map((message) => message.content),
  ['Object History 1', 'Object History 2', 'D2 object lore', 'Object History 3', 'D1 object lore', 'Object History 4'],
);
assert.deepEqual(messagesFromPositionObjectDepthMetadata.runtimeInsertions.worldbookDebug.map((item) => ({
  uid: item.uid,
  depth: item.depth,
  order: item.order,
  role: item.role,
})), [
  { uid: '0', depth: 1, order: 999, role: 'system' },
  { uid: '1', depth: 2, order: 200, role: 'system' },
]);

const messagesFromHiddenUserDepthPlacement = await buildExternalStatusbarMessages({
  targetWindow: {
    TavernHelper: {
      getCurrentPresetName: () => 'Native Depth Placement Preset',
      getGlobalWorldbookNames: () => ['Native Depth Lore'],
      getCharWorldbookNames: () => ({ primary: '', additional: [] }),
      getChatWorldbookName: () => '',
      getPreset: () => ({
        prompt_order: [{ character_id: 100001, order: [
          { identifier: 'chatHistory', enabled: true },
        ] }],
        prompts: [
          { identifier: 'chatHistory', role: 'system', content: '' },
        ],
      }),
    },
    SillyTavern: {
      loadWorldInfo: async () => ({
        entries: {
          0: { uid: 0, content: 'D1 lore', position: 'at_depth', depth: 1, role: 'system', order: 999, enabled: true },
          1: { uid: 1, content: 'D2 lore', position: 'at_depth', depth: 2, role: 'system', order: 200, enabled: true },
          2: { uid: 2, content: 'D3 lore', position: 'at_depth', depth: 3, role: 'system', order: 102, enabled: true },
          3: { uid: 3, content: 'D4 lore', position: 'at_depth', depth: 4, role: 'system', order: 100, enabled: true },
        },
      }),
    },
  },
  context: {
    ...context,
    chat: [
      { is_user: false, mes: 'History 1' },
      { is_user: true, mes: 'Hidden user 2' },
      { is_user: false, mes: 'History 2' },
      { is_user: true, mes: 'Hidden user 3' },
      { is_user: false, mes: 'History 3' },
      { is_user: true, mes: 'Hidden user 4' },
      { is_user: false, mes: 'History 4' },
      { is_user: true, mes: 'Hidden user 5' },
      { is_user: false, mes: 'History 5' },
      { is_user: true, mes: 'Hidden user 6' },
      { is_user: false, mes: 'History 6' },
    ],
  },
  latestMessage: { mes: 'Latest assistant prose' },
  taskPrompt: 'Generate footer widgets only.',
  components: [],
  omitOriginalUserMessages: true,
});

assert.deepEqual(
  messagesFromHiddenUserDepthPlacement.slice(0, 10).map((message) => message.content),
  ['History 1', 'History 2', 'History 3', 'History 4', 'D4 lore', 'D3 lore', 'History 5', 'D2 lore', 'D1 lore', 'History 6'],
);

const messagesWithPositionedTaskDepthReference = await buildExternalStatusbarMessages({
  targetWindow: {
    TavernHelper: {
      getCurrentPresetName: () => 'Positioned Task Depth Preset',
      getGlobalWorldbookNames: () => ['Positioned Task Lore'],
      getCharWorldbookNames: () => ({ primary: '', additional: [] }),
      getChatWorldbookName: () => '',
      getPreset: () => ({
        prompt_order: [{ character_id: 100001, order: [
          { identifier: 'setup', enabled: true },
          { identifier: 'chatHistory', enabled: true },
        ] }],
        prompts: [
          { identifier: 'setup', role: 'system', content: 'Setup' },
          { identifier: 'chatHistory', role: 'system', content: '' },
        ],
      }),
    },
    SillyTavern: {
      loadWorldInfo: async () => ({
        entries: {
          0: { uid: 0, content: 'D1 positioned lore', position: 'at_depth', depth: 1, role: 'system', order: 100, enabled: true },
        },
      }),
    },
  },
  context: {
    ...context,
    chat: [
      { is_user: false, mes: 'Older assistant' },
      { is_user: true, mes: 'Older user' },
      { is_user: false, mes: 'Newest assistant' },
      { is_user: true, mes: 'Newest user' },
    ],
  },
  latestMessage: { mes: 'Newest assistant' },
  taskPrompt: 'Positioned task',
  components: [],
  taskPlacement: { enabled: true, afterSourceId: 'setup' },
});

const positionedTaskContents = messagesWithPositionedTaskDepthReference.map((message) => message.content);
assert.ok(positionedTaskContents.indexOf('D1 positioned lore') > positionedTaskContents.indexOf('Newest user'));

const messagesFromAuthorNoteWorldbookInjections = await buildExternalStatusbarMessages({
  targetWindow: {
    TavernHelper: {
      getCurrentPresetName: () => 'Author Note Lore Preset',
      getGlobalWorldbookNames: () => ['AN Lore'],
      getCharWorldbookNames: () => ({ primary: '', additional: [] }),
      getChatWorldbookName: () => '',
      getPreset: () => ({
        prompt_order: [{ character_id: 100001, order: [
          { identifier: 'worldInfoAfter', enabled: true },
          { identifier: 'chatHistory', enabled: true },
        ] }],
        prompts: [
          { identifier: 'worldInfoAfter', role: 'system', content: '' },
          { identifier: 'chatHistory', role: 'system', content: '' },
        ],
      }),
    },
    SillyTavern: {
      loadWorldInfo: async () => ({
        entries: {
          0: { uid: 0, content: 'After character lore stays flat', position: 1, enabled: true },
          1: { uid: 1, content: 'AN bottom lore follows note depth', position: 'after_author_note', depth: 4, role: 0, order: 101, enabled: true },
        },
      }),
    },
  },
  context: {
    ...context,
    chat: [
      { is_user: true, mes: 'Oldest user' },
      { is_user: false, mes: 'Older assistant' },
      { is_user: true, mes: 'Middle user' },
      { is_user: false, mes: 'Newer assistant' },
      { is_user: true, mes: 'Newest user' },
    ],
  },
  latestMessage: { mes: 'Latest assistant prose' },
  taskPrompt: 'Generate footer widgets only.',
  components: [],
});

assert.deepEqual(
  messagesFromAuthorNoteWorldbookInjections.slice(0, 7).map((message) => [message.role, message.content]),
  [
    ['system', 'After character lore stays flat'],
    ['user', 'Oldest user'],
    ['system', 'AN bottom lore follows note depth'],
    ['assistant', 'Older assistant'],
    ['user', 'Middle user'],
    ['assistant', 'Newer assistant'],
    ['user', 'Newest user'],
  ],
);
assert.equal(messagesFromAuthorNoteWorldbookInjections.runtimeInsertions.worldbookAfterCount, 1);
assert.equal(messagesFromAuthorNoteWorldbookInjections.runtimeInsertions.authorNoteWorldbookCount, 1);
assert.deepEqual(messagesFromAuthorNoteWorldbookInjections.runtimeInsertions.worldbookDebug.map((item) => ({
  bookName: item.bookName,
  uid: item.uid,
  position: item.position,
  bucket: item.bucket,
  depth: item.depth,
  role: item.role,
  order: item.order,
  contentPreview: item.contentPreview,
})), [
  {
    bookName: 'AN Lore',
    uid: '0',
    position: '1',
    bucket: 'after',
    depth: 4,
    role: 'system',
    order: 100,
    contentPreview: 'After character lore stays flat',
  },
  {
    bookName: 'AN Lore',
    uid: '1',
    position: 'after_author_note',
    bucket: 'anBottom',
    depth: 4,
    role: 'system',
    order: 101,
    contentPreview: 'AN bottom lore follows note depth',
  },
]);

const messagesFromAuthorNoteAndDepthNativeOrder = await buildExternalStatusbarMessages({
  targetWindow: {
    TavernHelper: {
      getCurrentPresetName: () => 'Author Note And Depth Order Preset',
      getGlobalWorldbookNames: () => ['Order Lore'],
      getCharWorldbookNames: () => ({ primary: '', additional: [] }),
      getChatWorldbookName: () => '',
      getPreset: () => ({
        prompt_order: [{ character_id: 100001, order: [
          { identifier: 'chatHistory', enabled: true },
        ] }],
        prompts: [
          { identifier: 'chatHistory', role: 'system', content: '' },
        ],
      }),
    },
    SillyTavern: {
      loadWorldInfo: async () => ({
        entries: {
          0: { uid: 0, content: 'BUSINESS BACKGROUND', position: 'after_author_note', depth: 4, role: 'system', order: 101, enabled: true },
          1: { uid: 1, content: 'INTIMATE PROFILE', position: 'at_depth', depth: 4, role: 'system', order: 100, enabled: true },
          2: { uid: 2, content: 'STATUS RULE', position: 'at_depth', depth: 3, role: 'system', order: 102, enabled: true },
        },
      }),
    },
  },
  context: {
    ...context,
    chat: [
      { is_user: false, mes: 'History 1' },
      { is_user: false, mes: 'History 2' },
      { is_user: false, mes: 'History 3' },
      { is_user: false, mes: 'History 4' },
      { is_user: false, mes: 'History 5' },
    ],
  },
  latestMessage: { mes: 'Latest assistant prose' },
  taskPrompt: 'Generate footer widgets only.',
  components: [],
});

const nativeOrderContent = messagesFromAuthorNoteAndDepthNativeOrder.map((message) => message.content).join('\n');
assert.ok(nativeOrderContent.indexOf('BUSINESS BACKGROUND') < nativeOrderContent.indexOf('INTIMATE PROFILE'));
assert.ok(nativeOrderContent.indexOf('INTIMATE PROFILE') < nativeOrderContent.indexOf('STATUS RULE'));

const messagesFromExampleMessageWorldbookInjections = await buildExternalStatusbarMessages({
  targetWindow: {
    TavernHelper: {
      getCurrentPresetName: () => 'Example Lore Preset',
      getGlobalWorldbookNames: () => ['EM Lore'],
      getCharWorldbookNames: () => ({ primary: '', additional: [] }),
      getChatWorldbookName: () => '',
      getPreset: () => ({
        prompt_order: [{ character_id: 100001, order: [
          { identifier: 'dialogueExamples', enabled: true },
          { identifier: 'chatHistory', enabled: true },
        ] }],
        prompts: [
          { identifier: 'dialogueExamples', name: 'Chat Examples', role: 'system', content: '' },
          { identifier: 'chatHistory', role: 'system', content: '' },
        ],
      }),
    },
    SillyTavern: {
      loadWorldInfo: async () => ({
        entries: {
          0: { uid: 0, content: 'EM top lore', position: 5, enabled: true },
          1: { uid: 1, content: 'EM bottom lore', position: 6, enabled: true },
        },
      }),
    },
  },
  context,
  latestMessage: { mes: 'Latest assistant prose' },
  taskPrompt: 'Generate footer widgets only.',
  components: [],
});

assert.equal(
  messagesFromExampleMessageWorldbookInjections[0].content,
  'EM top lore\nCard fields examples\nEM bottom lore',
);
assert.equal(messagesFromExampleMessageWorldbookInjections.runtimeInsertions.exampleMessageWorldbookCount, 2);

const messagesFromSelectedSources = await buildExternalStatusbarMessages({
  targetWindow: {
    TavernHelper: {
      getCurrentPresetName: () => 'Main Preset',
      getPreset: () => ({
        prompts: [{ identifier: 'should-not-duplicate', role: 'system', content: 'Should not be used when source items exist' }],
      }),
    },
  },
  context,
  latestMessage: { mes: 'Latest assistant prose' },
  taskPrompt: 'Generate footer widgets only.',
  components: [],
  promptSourceItems: [
    { scope: 'preset', name: 'Ako order 1', role: 'system', content: 'Selected preset prompt' },
    { scope: '\u4e16\u754c\u4e66', name: 'Status lore', content: 'Selected worldbook entry' },
  ],
});

assert.deepEqual(messagesFromSelectedSources.map((message) => message.role), ['system', 'system', 'user']);
assert.equal(messagesFromSelectedSources[0].content, 'Selected preset prompt');
assert.equal(messagesFromSelectedSources[1].content, 'Selected worldbook entry');
assert.ok(!messagesFromSelectedSources.some((message) => message.content.includes('Should not be used')));

const messagesWithTaskAfterPresetSource = await buildExternalStatusbarMessages({
  targetWindow: {},
  context,
  latestMessage: { mes: 'Latest assistant prose' },
  taskPrompt: 'Task after preset B',
  components: [],
  promptSourceItems: [
    { key: 'preset-a', scope: 'preset', name: 'Preset A', role: 'system', content: 'Preset A prompt' },
    { key: 'preset-b', scope: 'preset', name: 'Preset B', role: 'system', content: 'Preset B prompt' },
    { key: 'preset-c', scope: 'preset', name: 'Preset C', role: 'system', content: 'Preset C prompt' },
  ],
  taskPlacement: { enabled: true, afterSourceId: 'preset-b' },
});

assert.deepEqual(
  messagesWithTaskAfterPresetSource.map((message) => message.content),
  ['Preset A prompt', 'Preset B prompt', 'Task after preset B', 'Preset C prompt'],
);

const messagesWithMissingTaskPlacementSource = await buildExternalStatusbarMessages({
  targetWindow: {},
  context,
  latestMessage: { mes: 'Latest assistant prose' },
  taskPrompt: 'Task fallback tail',
  components: [],
  promptSourceItems: [
    { key: 'preset-a', scope: 'preset', name: 'Preset A', role: 'system', content: 'Preset A prompt' },
  ],
  taskPlacement: { enabled: true, afterSourceId: 'missing-preset' },
});

assert.deepEqual(
  messagesWithMissingTaskPlacementSource.map((message) => message.content),
  ['Preset A prompt', 'Task fallback tail'],
);

const messagesFromSelectedSourcesWithMissingMarkers = await buildExternalStatusbarMessages({
  targetWindow: {
    TavernHelper: {
      getCurrentPresetName: () => 'Current Order Preset',
      getPreset: () => ({
        prompt_order: [{ character_id: 100001, order: [
          { identifier: 'bkgd-open', enabled: true },
          { identifier: 'worldInfoBefore', enabled: true },
          { identifier: 'char-info-open', enabled: true },
          { identifier: 'charDescription', enabled: true },
          { identifier: 'char-info-close', enabled: true },
          { identifier: 'worldInfoAfter', enabled: true },
          { identifier: 'bkgd-close', enabled: true },
        ] }],
        prompts: [
          { identifier: 'bkgd-open', role: 'system', content: '<bkgd_info>' },
          { identifier: 'char-info-open', role: 'system', content: '<char_info>' },
          { identifier: 'char-info-close', role: 'system', content: '</char_info>' },
          { identifier: 'bkgd-close', role: 'system', content: '</bkgd_info>' },
        ],
      }),
      getGlobalWorldbookNames: () => ['Runtime Lore'],
      getCharWorldbookNames: () => ({ primary: '', additional: [] }),
      getChatWorldbookName: () => '',
    },
    SillyTavern: {
      loadWorldInfo: async () => ({
        entries: {
          0: { uid: 0, content: 'Runtime before lore', position: { type: 'before_character_definition' }, enabled: true },
          1: { uid: 1, content: 'Runtime after lore', position: { type: 'after_character_definition' }, enabled: true },
        },
      }),
    },
  },
  context,
  latestMessage: { mes: 'Latest assistant prose' },
  taskPrompt: 'Generate footer widgets only.',
  components: [],
  promptSourceItems: [
    { scope: 'preset', name: 'Only selected static prompt', role: 'system', content: 'Selected static prompt' },
  ],
});

assert.deepEqual(
  messagesFromSelectedSourcesWithMissingMarkers.slice(0, 7).map((message) => message.content),
  ['<bkgd_info>', 'Runtime before lore', '<char_info>', 'Card fields description', '</char_info>', 'Runtime after lore', '</bkgd_info>'],
);
assert.equal(messagesFromSelectedSourcesWithMissingMarkers.some((message) => message.content === 'Selected static prompt'), true);
assert.deepEqual(
  messagesFromSelectedSourcesWithMissingMarkers.promptSourceItems.slice(0, 7).map((item) => item.markerType || ''),
  ['', 'worldInfoBefore', '', 'charDescription', '', 'worldInfoAfter', ''],
);

const messagesFromInUsePresetFallback = await buildExternalStatusbarMessages({
  targetWindow: {
    getPreset: (name) => name === 'in_use' ? {
      prompt_order: [{ character_id: 100001, order: [
        { identifier: 'char-info-open', enabled: true },
        { identifier: 'charDescription', enabled: true },
        { identifier: 'char-info-close', enabled: true },
      ] }],
      prompts: [
        { identifier: 'char-info-open', role: 'system', content: '<char_info>' },
        { identifier: 'char-info-close', role: 'system', content: '</char_info>' },
      ],
    } : null,
  },
  context,
  latestMessage: { mes: 'Latest assistant prose' },
  taskPrompt: 'Generate footer widgets only.',
  components: [],
  promptSourceItems: [
    { scope: 'preset', name: 'Only selected static prompt', role: 'system', content: 'Selected static prompt' },
  ],
});

assert.deepEqual(
  messagesFromInUsePresetFallback.slice(0, 3).map((message) => message.content),
  ['<char_info>', 'Card fields description', '</char_info>'],
);
assert.deepEqual(
  createRuntimePromptDiagnostics({
    context,
    promptSourceItems: messagesFromInUsePresetFallback.promptSourceItems,
    runtimeInsertions: messagesFromInUsePresetFallback.runtimeInsertions,
  }).selectedPromptMarkers,
  ['charDescription'],
);

const messagesFromLockedWorldInfoSources = await buildExternalStatusbarMessages({
  targetWindow: {
    TavernHelper: {
      getGlobalWorldbookNames: () => ['Runtime Lore'],
      getCharWorldbookNames: () => ({ primary: '', additional: [] }),
      getChatWorldbookName: () => '',
    },
    SillyTavern: {
      loadWorldInfo: async () => ({
        entries: {
          0: { uid: 0, content: 'Runtime before lore', position: { type: 'before_character_definition' }, enabled: true },
          1: { uid: 1, content: 'Runtime after lore', position: { type: 'after_character_definition' }, enabled: true },
        },
      }),
    },
  },
  context,
  latestMessage: { mes: 'Latest assistant prose' },
  taskPrompt: 'Generate footer widgets only.',
  components: [],
  promptSourceItems: [
    { key: 'bkgd-open', scope: 'preset', name: 'Background start', role: 'system', content: '<bkgd_info>' },
    { key: 'wi-before', scope: 'preset', name: 'World Info (before)', role: 'system', content: '', markerType: 'worldInfoBefore', locked: true },
    { key: 'selected-world', scope: '\u4e16\u754c\u4e66', name: 'Selected flat lore', role: 'system', content: 'Should not flatten into locked marker' },
    { key: 'wi-after', scope: 'preset', name: 'World Info (after)', role: 'system', content: '', markerType: 'worldInfoAfter', locked: true },
    { key: 'bkgd-close', scope: 'preset', name: 'Background end', role: 'system', content: '</bkgd_info>' },
  ],
});

assert.deepEqual(
  messagesFromLockedWorldInfoSources.slice(0, 4).map((message) => message.content),
  ['<bkgd_info>', 'Runtime before lore', 'Runtime after lore', '</bkgd_info>'],
);
assert.ok(!messagesFromLockedWorldInfoSources.some((message) => message.content === 'Should not flatten into locked marker'));

const messagesWithMacroSubstitution = await buildExternalStatusbarMessages({
  targetWindow: {},
  context,
  latestMessage: { mes: 'Latest {{char}} prose' },
  taskPrompt: 'Task for {{user}}\n{{external_components}}',
  components: [{ scope: 'global', name: 'Macro component', content: 'Component for {{char}}' }],
  promptSourceItems: [
    { scope: 'preset', name: 'Macro preset', role: 'system', content: 'Preset for {{char}} and {{user}}' },
  ],
  substituteParams: (content) => String(content).replaceAll('{{char}}', 'CharName').replaceAll('{{user}}', 'UserName'),
});

assert.equal(messagesWithMacroSubstitution[0].content, 'Preset for CharName and UserName');
assert.ok(messagesWithMacroSubstitution.at(-1).content.includes('Task for UserName'));
assert.ok(messagesWithMacroSubstitution.at(-1).content.includes('Component for CharName'));
assert.ok(!messagesWithMacroSubstitution.at(-1).content.includes('Macro component'));

const messagesWithNativeMarkers = await buildExternalStatusbarMessages({
  targetWindow: {},
  context,
  latestMessage: { mes: 'Latest assistant prose' },
  taskPrompt: 'Generate footer widgets only.',
  components: [],
  promptSourceItems: [
    { scope: 'preset', markerType: 'worldInfoBefore', role: 'system', content: 'world placeholder' },
    { scope: '\u4e16\u754c\u4e66', name: 'Lore', role: 'system', content: 'Selected lore text' },
    { scope: 'preset', markerType: 'charDescription', role: 'system', content: 'scan placeholder' },
    { scope: 'preset', markerType: 'charPersonality', role: 'system', content: 'scan placeholder' },
    { scope: 'preset', markerType: 'scenario', role: 'system', content: 'scan placeholder' },
    { scope: 'preset', markerType: 'dialogueExamples', role: 'system', content: 'scan placeholder' },
    { scope: 'preset', markerType: 'personaDescription', role: 'system', content: 'scan placeholder' },
    { scope: 'preset', markerType: 'chatHistory', role: 'system', content: 'history placeholder' },
  ],
});

assert.deepEqual(messagesWithNativeMarkers.slice(0, 9).map((message) => message.role), ['system', 'system', 'system', 'system', 'system', 'system', 'user', 'assistant', 'user']);
assert.equal(messagesWithNativeMarkers[0].content, 'Selected lore text');
assert.equal(messagesWithNativeMarkers[1].content, 'Card fields description');
assert.equal(messagesWithNativeMarkers[2].content, 'Card fields personality');
assert.equal(messagesWithNativeMarkers[3].content, 'Card fields scenario');
assert.equal(messagesWithNativeMarkers[4].content, 'Card fields examples');
assert.equal(messagesWithNativeMarkers[5].content, 'Card fields persona');
assert.equal(messagesWithNativeMarkers[6].content, 'Hello');
assert.equal(messagesWithNativeMarkers[7].content, 'Reply');
assert.ok(!messagesWithNativeMarkers.some((message) => message.content === 'world placeholder'));
assert.ok(!messagesWithNativeMarkers.some((message) => message.content === 'history placeholder'));
assert.ok(!messagesWithNativeMarkers.some((message) => message.content === 'scan placeholder'));

const visibleChatBeyondLegacyLimit = Array.from({ length: 13 }, (_, index) => ({
  is_user: index % 2 === 0,
  mes: `Visible ${index + 1}`,
}));
visibleChatBeyondLegacyLimit.splice(3, 0, { is_system: true, mes: 'Hidden system floor' });
visibleChatBeyondLegacyLimit.splice(7, 0, { is_user: false, mes: 'Ignored runtime floor', extra: { [Symbol.for('ignore')]: true } });

const messagesWithNativeHiddenFloors = await buildExternalStatusbarMessages({
  targetWindow: {},
  context: { ...context, chat: visibleChatBeyondLegacyLimit },
  latestMessage: { mes: 'Latest assistant prose' },
  taskPrompt: 'Generate footer widgets only.',
  components: [],
  promptSourceItems: [{ scope: 'preset', markerType: 'chatHistory', role: 'system', content: '' }],
});

const nativeHiddenFloorContents = messagesWithNativeHiddenFloors.map((message) => message.content);
assert.equal(nativeHiddenFloorContents.includes('Hidden system floor'), false);
assert.equal(nativeHiddenFloorContents.includes('Ignored runtime floor'), false);
assert.equal(nativeHiddenFloorContents.includes('Visible 13'), true);
assert.equal(nativeHiddenFloorContents.filter((content) => content.startsWith('Visible ')).length, 13);

const messagesWithPluginWorldbookSource = await buildExternalStatusbarMessages({
  targetWindow: {
    TavernHelper: {
      getCurrentPresetName: () => 'Plugin Worldbook Preset',
      getGlobalWorldbookNames: () => ['Native Lore'],
      getPreset: () => ({
        prompt_order: [{ character_id: 100001, order: [
          { identifier: 'worldInfoBefore', enabled: true },
          { identifier: 'chatHistory', enabled: true },
        ] }],
        prompts: [
          { identifier: 'worldInfoBefore', role: 'system', content: '' },
          { identifier: 'chatHistory', role: 'system', content: '' },
        ],
      }),
    },
    SillyTavern: {
      loadWorldInfo: async () => ({ entries: { 0: { uid: 0, content: 'Native lore must stay out', position: 0, enabled: true } } }),
    },
  },
  context,
  latestMessage: { mes: 'Latest assistant prose' },
  taskPrompt: 'Generate footer widgets only.',
  components: [],
  worldbookSourceControlled: true,
  promptSourceItems: [
    { scope: 'preset', markerType: 'worldInfoBefore', role: 'system', content: '', locked: true },
    { scope: '\u4e16\u754c\u4e66', name: 'Plugin lore', role: 'system', content: 'Plugin lore stays in control' },
    { scope: 'preset', markerType: 'chatHistory', role: 'system', content: '', locked: true },
  ],
});

assert.ok(messagesWithPluginWorldbookSource.some((message) => message.content === 'Plugin lore stays in control'));
assert.ok(!messagesWithPluginWorldbookSource.some((message) => message.content === 'Native lore must stay out'));

const messagesWithControlledWorldbookDepth = await buildExternalStatusbarMessages({
  targetWindow: {},
  context: {
    ...context,
    chat: [
      { is_user: true, mes: 'Depth user history' },
      { is_user: false, mes: 'Depth assistant history' },
    ],
  },
  latestMessage: { mes: 'Latest assistant prose' },
  taskPrompt: 'Generate footer widgets only.',
  components: [],
  worldbookSourceControlled: true,
  promptSourceItems: [
    { scope: 'preset', markerType: 'worldInfoAfter', role: 'system', content: '', locked: true },
    { scope: 'preset', markerType: 'chatHistory', role: 'system', content: '', locked: true },
    { scope: '\u4e16\u754c\u4e66', source: 'Plugin Lore', sourceUid: 'depth-0', role: 'system', content: 'Controlled depth zero lore', worldbookPosition: 4, worldbookDepth: 0, worldbookRole: 0, worldbookOrder: 100 },
  ],
});

assert.equal(messagesWithControlledWorldbookDepth.runtimeInsertions.worldbookAtDepthCount, 1);
const controlledDepthIndex = messagesWithControlledWorldbookDepth.findIndex((message) => message.content === 'Controlled depth zero lore');
assert.equal(controlledDepthIndex >= 2, true);
assert.equal(messagesWithControlledWorldbookDepth[controlledDepthIndex].role, 'system');

const runtimeDiagnostics = createRuntimePromptDiagnostics({
  context,
  promptSourceItems: [
    { markerType: 'charDescription', content: '' },
    { markerType: 'charPersonality', content: '' },
    { markerType: 'chatHistory', content: '' },
  ],
});

assert.deepEqual(runtimeDiagnostics.characterFields, {
  characterId: '0',
  descriptionLength: 'Card fields description'.length,
  personalityLength: 'Card fields personality'.length,
  scenarioLength: 'Card fields scenario'.length,
  dialogueExamplesLength: 'Card fields examples'.length,
  personaLength: 'Card fields persona'.length,
});
assert.deepEqual(runtimeDiagnostics.selectedPromptMarkers, ['charDescription', 'charPersonality', 'chatHistory']);

const messagesWithDuplicatePresetSources = await buildExternalStatusbarMessages({
  targetWindow: {},
  context: {
    ...context,
    chat: [
      { is_user: true, mes: 'User turn' },
      { is_user: false, mes: 'Assistant turn' },
    ],
  },
  latestMessage: { mes: 'Assistant turn' },
  taskPrompt: 'Append controls only.',
  components: [],
  promptSourceItems: [
    { key: 'first-setup', sourceUid: 'preset-setup', scope: 'preset', role: 'system', content: 'Preset setup' },
    { key: 'second-setup', sourceUid: 'preset-setup', scope: 'preset', role: 'system', content: 'Preset setup' },
    { key: 'first-history', sourceUid: 'chatHistory', scope: 'preset', markerType: 'chatHistory', role: 'system', content: '' },
    { key: 'second-history', sourceUid: 'chatHistory', scope: 'preset', markerType: 'chatHistory', role: 'system', content: '' },
  ],
});

assert.deepEqual(messagesWithDuplicatePresetSources.map((message) => message.content), [
  'Preset setup',
  'User turn',
  'Assistant turn',
  'Append controls only.',
]);
