import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FLOOR_VARIABLE_NAMESPACE,
  clearFloorVariableSnapshot,
  extractFloorVariableSnapshot,
  findLatestEffectiveFloorVariableSnapshot,
  findLatestAssistantMessageIndex,
  readFloorVariableRules,
  readAllFloorVariableRules,
  readFloorVariableSnapshot,
  resolveBodySnapshotSourceIndex,
  setFloorVariableDepthZeroPrompt,
  writeFloorVariableRules,
  writeFloorVariableSnapshot,
} from './floor-variables.js';

test('extracts case-sensitive tag blocks and every repeated block in source order', () => {
  const source = [
    '<branches>first</branches>',
    '<BRANCHES>ignored</BRANCHES>',
    '<snow kind="ui">second\nline</snow>',
    '<branches>third</branches>',
  ].join('\n');
  const result = extractFloorVariableSnapshot(source, {
    tagNames: 'branches, snow',
    regexText: '',
  });

  assert.equal(result.text, [
    '<branches>first</branches>',
    '<snow kind="ui">second\nline</snow>',
    '<branches>third</branches>',
  ].join('\n\n'));
  assert.deepEqual(result.errors, []);
});

test('combines scope rules, preserves document order, and merges overlapping matches', () => {
  const source = 'before\n<box>alpha\nID: 42</box>\nafter';
  const result = extractFloorVariableSnapshot(source, [
    { tagNames: 'box', regexText: '' },
    { tagNames: '', regexText: 'ID: \\d+[\\s\\S]*after$' },
  ]);

  assert.equal(result.text, '<box>alpha\nID: 42</box>\nafter');
});

test('skips invalid custom expressions without discarding valid matches', () => {
  const result = extractFloorVariableSnapshot('A1 B2', {
    tagNames: '',
    regexText: '[invalid\n/[A-Z]\\d/g',
  });

  assert.equal(result.text, 'A1\n\nB2');
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].line, 1);
});

test('reads and writes each TavernHelper rule scope under the plugin namespace', () => {
  const stores = { global: {}, character: {}, chat: {} };
  const helper = {
    getVariables: ({ type }) => structuredClone(stores[type]),
    insertOrAssignVariables: (value, { type }) => {
      stores[type] = { ...stores[type], ...structuredClone(value) };
    },
  };

  writeFloorVariableRules(helper, 'character', { tagNames: 'snow', regexText: '^note:' });
  assert.deepEqual(readFloorVariableRules(helper, 'character'), { tagNames: 'snow', regexText: '^note:' });
  assert.equal(stores.character[FLOOR_VARIABLE_NAMESPACE].floorVariableRules.tagNames, 'snow');
  assert.deepEqual(readFloorVariableRules(helper, 'chat'), { tagNames: '', regexText: '' });
});

test('one unavailable rule scope does not discard the other scopes', () => {
  const helper = {
    getVariables: ({ type }) => {
      if (type === 'character') throw new Error('no character');
      return {
        [FLOOR_VARIABLE_NAMESPACE]: {
          floorVariableRules: { tagNames: type, regexText: '' },
        },
      };
    },
  };
  assert.deepEqual(readAllFloorVariableRules(helper), [
    { tagNames: 'global', regexText: '' },
    { tagNames: '', regexText: '' },
    { tagNames: 'chat', regexText: '' },
  ]);
});

test('message snapshots update only their namespace and exact message swipe', () => {
  const stores = new Map([[3, { unrelated: 7 }]]);
  const helper = {
    getVariables: ({ message_id }) => structuredClone(stores.get(message_id) || {}),
    insertOrAssignVariables: (value, { message_id }) => {
      stores.set(message_id, { ...(stores.get(message_id) || {}), ...structuredClone(value) });
    },
  };

  writeFloorVariableSnapshot(helper, 3, 'snapshot text');
  assert.equal(readFloorVariableSnapshot(helper, 3), 'snapshot text');
  assert.equal(stores.get(3).unrelated, 7);
  assert.equal(stores.get(3)[FLOOR_VARIABLE_NAMESPACE].floorVariableSnapshot, 'snapshot text');
});

test('finds the newest non-empty assistant snapshot by walking backward', () => {
  const chat = [
    { is_user: false, mes: 'older assistant' },
    { is_user: true, mes: 'user' },
    { is_user: false, mes: 'latest assistant without a snapshot' },
  ];
  const stores = new Map([
    [0, { [FLOOR_VARIABLE_NAMESPACE]: { floorVariableSnapshot: '<snow>old</snow>' } }],
    [1, { [FLOOR_VARIABLE_NAMESPACE]: { floorVariableSnapshot: '<snow>copied to user</snow>' } }],
    [2, { [FLOOR_VARIABLE_NAMESPACE]: { floorVariableSnapshot: '' } }],
  ]);
  const helper = {
    getVariables: ({ message_id }) => structuredClone(stores.get(message_id) || {}),
  };

  assert.deepEqual(findLatestEffectiveFloorVariableSnapshot(helper, chat, 2), {
    messageIndex: 0,
    snapshot: '<snow>old</snow>',
  });
});

test('prefers a non-empty snapshot on the current assistant floor', () => {
  const chat = [
    { is_user: false, mes: 'older assistant' },
    { is_user: false, mes: 'current assistant' },
  ];
  const stores = new Map([
    [0, { [FLOOR_VARIABLE_NAMESPACE]: { floorVariableSnapshot: '<snow>old</snow>' } }],
    [1, { [FLOOR_VARIABLE_NAMESPACE]: { floorVariableSnapshot: '<snow>current</snow>' } }],
  ]);
  const helper = {
    getVariables: ({ message_id }) => structuredClone(stores.get(message_id) || {}),
  };

  assert.deepEqual(findLatestEffectiveFloorVariableSnapshot(helper, chat, 1), {
    messageIndex: 1,
    snapshot: '<snow>current</snow>',
  });
});

test('refuses to write a floor snapshot to user and system messages when chat ownership is supplied', () => {
  const stores = new Map();
  const helper = {
    getVariables: ({ message_id }) => structuredClone(stores.get(message_id) || {}),
    insertOrAssignVariables: (value, { message_id }) => stores.set(message_id, structuredClone(value)),
  };
  const chat = [
    { is_user: true, mes: 'user' },
    { is_system: true, mes: 'system' },
    { is_user: false, mes: 'assistant' },
  ];

  assert.equal(writeFloorVariableSnapshot(helper, 0, 'user snapshot', { chat }), '');
  assert.equal(writeFloorVariableSnapshot(helper, 1, 'system snapshot', { chat }), '');
  assert.equal(writeFloorVariableSnapshot(helper, 2, 'assistant snapshot', { chat }), 'assistant snapshot');
  assert.equal(stores.has(0), false);
  assert.equal(stores.has(1), false);
  assert.equal(readFloorVariableSnapshot(helper, 2), 'assistant snapshot');
});

test('removes only the copied floor snapshot from an exact message', () => {
  const stores = new Map([[4, {
    unrelated: 7,
    [FLOOR_VARIABLE_NAMESPACE]: {
      floorVariableSnapshot: '<snow>copied</snow>',
      retained: 'value',
    },
  }]]);
  const helper = {
    getVariables: ({ message_id }) => structuredClone(stores.get(message_id) || {}),
    replaceVariables: (value, { message_id }) => stores.set(message_id, structuredClone(value)),
  };

  assert.equal(clearFloorVariableSnapshot(helper, 4), true);
  assert.deepEqual(stores.get(4), {
    unrelated: 7,
    [FLOOR_VARIABLE_NAMESPACE]: { retained: 'value' },
  });
});

test('finds only ordinary assistant messages, including an empty latest assistant', () => {
  const chat = [
    { is_user: false, is_system: true, mes: 'system' },
    { is_user: false, mes: 'assistant' },
    { is_user: true, mes: 'user' },
    { role: 'assistant', mes: '' },
  ];
  assert.equal(findLatestAssistantMessageIndex(chat), 3);
});

test('body rerolls use the previous assistant but normal and continue use the latest one', () => {
  const endedWithAssistant = [
    { is_user: false, mes: 'old assistant' },
    { is_user: true, mes: 'user' },
    { is_user: false, mes: 'current assistant' },
  ];
  const endedWithUser = [...endedWithAssistant, { is_user: true, mes: 'new user' }];

  assert.equal(resolveBodySnapshotSourceIndex(endedWithAssistant, 'swipe'), 0);
  assert.equal(resolveBodySnapshotSourceIndex(endedWithAssistant, 'regenerate'), 0);
  assert.equal(resolveBodySnapshotSourceIndex(endedWithAssistant, 'continue'), 2);
  assert.equal(resolveBodySnapshotSourceIndex(endedWithUser, 'regenerate'), 2);
  assert.equal(resolveBodySnapshotSourceIndex(endedWithUser, 'normal'), 2);
});

test('body snapshot uses SillyTavern native system depth-zero injection', () => {
  const calls = [];
  const context = { setExtensionPrompt: (...args) => calls.push(args) };

  assert.equal(setFloorVariableDepthZeroPrompt(context, '\n<snow>state</snow>\n'), true);
  assert.deepEqual(calls, [[
    'st-end-component-generator-floor-variables',
    '\n<snow>state</snow>\n',
    1,
    0,
    false,
    0,
  ]]);
});

test('body snapshot clears the native depth-zero injection when no content is available', () => {
  const calls = [];
  const context = { setExtensionPrompt: (...args) => calls.push(args) };

  assert.equal(setFloorVariableDepthZeroPrompt(context, ''), true);
  assert.equal(calls[0][1], '');
  assert.equal(calls[0][3], 0);
});
