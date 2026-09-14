import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FLOOR_VARIABLE_NAMESPACE,
  extractFloorVariableSnapshot,
  findLatestAssistantMessageIndex,
  readFloorVariableRules,
  readAllFloorVariableRules,
  readFloorVariableSnapshot,
  resolveBodySnapshotSourceIndex,
  insertBodyFloorVariableSnapshot,
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

test('body snapshot is inserted as a system message after the outgoing latest assistant', () => {
  const messages = [
    { role: 'system', content: 'system' },
    { role: 'assistant', content: 'assistant' },
    { role: 'user', content: 'user' },
  ];
  assert.equal(insertBodyFloorVariableSnapshot(messages, '<snow>state</snow>'), true);
  assert.deepEqual(messages.map(({ role, content }) => ({ role, content })), [
    { role: 'system', content: 'system' },
    { role: 'assistant', content: 'assistant' },
    { role: 'system', content: '<snow>state</snow>' },
    { role: 'user', content: 'user' },
  ]);
  assert.equal(Object.keys(messages[2]).includes('stEsgFloorVariableSnapshot'), false);
});

test('body snapshot is inserted after the body assistant instead of the assistant prefill', () => {
  const messages = [
    { role: 'system', content: 'system' },
    { role: 'assistant', content: 'body assistant' },
    { role: 'user', content: 'latest user' },
    { role: 'assistant', content: 'assistant prefill' },
  ];
  assert.equal(insertBodyFloorVariableSnapshot(messages, '<snow>state</snow>'), true);
  assert.deepEqual(messages.map(({ role, content }) => ({ role, content })), [
    { role: 'system', content: 'system' },
    { role: 'assistant', content: 'body assistant' },
    { role: 'system', content: '<snow>state</snow>' },
    { role: 'user', content: 'latest user' },
    { role: 'assistant', content: 'assistant prefill' },
  ]);
});

test('body snapshot uses the final assistant owned by Chat History instead of an assistant injection', () => {
  const messages = [
    { role: 'system', content: 'system' },
    { role: 'assistant', content: 'body assistant' },
    { role: 'assistant', content: 'depth assistant injection' },
    { role: 'user', content: 'latest user' },
    { role: 'assistant', content: 'assistant prefill' },
  ];
  const promptManagerMessages = {
    flatten: () => [
      { identifier: 'main', role: 'system', content: 'system' },
      { identifier: 'chatHistory-2', role: 'assistant', content: 'body assistant' },
      { identifier: 'extension-depth-prompt', role: 'assistant', content: 'depth assistant injection' },
      { identifier: 'chatHistory-1', role: 'user', content: 'latest user' },
      { identifier: 'controlPrompts', role: 'assistant', content: 'assistant prefill' },
    ],
  };

  assert.equal(insertBodyFloorVariableSnapshot(messages, '<snow>state</snow>', promptManagerMessages), true);
  assert.deepEqual(messages.map(({ role, content }) => ({ role, content })), [
    { role: 'system', content: 'system' },
    { role: 'assistant', content: 'body assistant' },
    { role: 'system', content: '<snow>state</snow>' },
    { role: 'assistant', content: 'depth assistant injection' },
    { role: 'user', content: 'latest user' },
    { role: 'assistant', content: 'assistant prefill' },
  ]);
});

test('body snapshot ignores a stale Prompt Manager collection from another request', () => {
  const messages = [
    { role: 'system', content: 'current system' },
    { role: 'assistant', content: 'current body assistant' },
    { role: 'user', content: 'current user' },
    { role: 'assistant', content: 'current prefill' },
  ];
  const stalePromptManagerMessages = {
    flatten: () => [
      { identifier: 'main', role: 'system', content: 'old system' },
      { identifier: 'chatHistory-2', role: 'user', content: 'old user' },
      { identifier: 'control', role: 'system', content: 'old control' },
      { identifier: 'chatHistory-1', role: 'assistant', content: 'old assistant' },
    ],
  };

  insertBodyFloorVariableSnapshot(messages, '<snow>state</snow>', stalePromptManagerMessages);
  assert.deepEqual(messages.map(({ role, content }) => ({ role, content })), [
    { role: 'system', content: 'current system' },
    { role: 'assistant', content: 'current body assistant' },
    { role: 'system', content: '<snow>state</snow>' },
    { role: 'user', content: 'current user' },
    { role: 'assistant', content: 'current prefill' },
  ]);
});

test('body snapshot is not inserted after a prefill when no body assistant exists', () => {
  const messages = [
    { role: 'system', content: 'system' },
    { role: 'user', content: 'latest user' },
    { role: 'assistant', content: 'assistant prefill' },
  ];
  assert.equal(insertBodyFloorVariableSnapshot(messages, '<snow>state</snow>'), false);
  assert.equal(messages.length, 3);
});

test('body prompt insertion preserves snapshot whitespace verbatim', () => {
  const messages = [{ role: 'assistant', content: 'assistant' }];
  insertBodyFloorVariableSnapshot(messages, '\n<box>value</box>\n');
  assert.equal(messages[1].content, '\n<box>value</box>\n');
});
