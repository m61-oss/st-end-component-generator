import assert from 'node:assert/strict';
import {
  ANIMA_ENTRY_NAMES,
  applyAnimaWorldbookOverrides,
  captureAnimaWorldbookEntries,
  getAnimaEntryKind,
  readLatestAnimaStatus,
  replaceAnimaStatusMacros,
} from '../sources/anima-memory.js';

assert.deepEqual(ANIMA_ENTRY_NAMES, [
  '[anima_status]',
  '[ANIMA_Chat_History_Container]',
  '[ANIMA_Knowledge_Container]',
]);
assert.equal(getAnimaEntryKind({ name: '[anima_status]' }), 'status');
assert.equal(getAnimaEntryKind({ name: '[ANIMA_Knowledge_Container]' }), 'knowledge');
assert.equal(getAnimaEntryKind({ name: 'ordinary entry' }), '');

const captured = await captureAnimaWorldbookEntries({
  TavernHelper: {
    getChatWorldbookName: async () => 'chat-book',
    getWorldbook: async () => [
      { uid: 1, name: '[ANIMA_Chat_History_Container]', content: 'recall text' },
      { uid: 2, name: '[ANIMA_Knowledge_Container]', content: '' },
    ],
  },
});
assert.equal(captured.length, 2, 'capture keeps existing Anima entries, including empty content');
assert.equal(captured[1].content, '');

const overridden = applyAnimaWorldbookOverrides([
  { name: '[ANIMA_Chat_History_Container]', content: '' },
  { name: '[ANIMA_Knowledge_Container]', content: 'stale content' },
  { name: 'ordinary entry', content: 'ordinary content' },
], captured);
assert.equal(overridden[0].content, 'recall text');
assert.equal(overridden[1].content, '', 'an existing empty Anima entry can intentionally replace stale content');
assert.equal(overridden.length, 3, 'the adapter never creates a missing Anima entry');
const missingOptionalEntry = applyAnimaWorldbookOverrides([
  { name: '[ANIMA_Chat_History_Container]', content: '' },
], captured);
assert.equal(missingOptionalEntry.length, 1, 'an optional Anima entry is never synthesized');

const statusTargetWindow = {
  TavernHelper: {
    getVariables: ({ message_id }) => message_id === 'latest' || message_id === 2
      ? { other: true }
      : message_id === 1
        ? { anima_data: { protagonist: { hp: 42 }, mood: 'tense' } }
        : {},
  },
};
const status = readLatestAnimaStatus({
  targetWindow: statusTargetWindow,
  chat: [
    { message_id: 1, is_user: true, mes: 'user' },
    { message_id: 2, is_user: false, mes: 'assistant with status' },
    { message_id: 3, is_user: false, mes: 'latest assistant without status' },
  ],
});
assert.deepEqual(status, { data: { protagonist: { hp: 42 }, mood: 'tense' }, messageId: 1, messageIndex: 1 });
const latestStatus = readLatestAnimaStatus({
  targetWindow: {
    TavernHelper: {
      getVariables: ({ message_id }) => message_id === 'latest' ? { anima_data: { mood: 'calm' } } : {},
    },
  },
  chat: [{ is_user: false, mes: 'assistant' }],
});
assert.deepEqual(latestStatus, { data: { mood: 'calm' }, messageId: 'latest', messageIndex: 0 });

const replaced = replaceAnimaStatusMacros(
  'A={{status}} B={{ANIMA_BASE_STATUS::protagonist.hp}} C={{format_message_variable::anima_data.mood}}',
  status.data,
);
assert.match(replaced, /A=\{[\s\S]*protagonist[\s\S]*hp[\s\S]*42/);
assert.match(replaced, /B=42/);
assert.match(replaced, /C=tense/);
assert.equal(replaceAnimaStatusMacros('{{status}}', null), '{{status}}', 'disabled/missing status leaves the macro untouched');

console.log('anima-memory tests passed');
