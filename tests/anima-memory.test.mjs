import assert from 'node:assert/strict';
import {
  ANIMA_ENTRY_NAMES,
  applyAnimaWorldbookOverrides,
  captureAnimaWorldbookEntries,
  captureAnimaWorldbookUntil,
  filterAnimaWorldbookEntries,
  getAnimaEntryKind,
  mergeAnimaWorldbookSnapshots,
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

let retryReads = 0;
const retryResult = await captureAnimaWorldbookUntil({
  read: async () => {
    retryReads += 1;
    return retryReads < 3
      ? [{ name: '[ANIMA_Chat_History_Container]', content: '' }]
      : [{ name: '[ANIMA_Chat_History_Container]', content: 'latest recall slice' }];
  },
  isActive: () => true,
  wait: async () => {},
});
assert.equal(retryReads, 3, 'capture retries until a non-empty Anima recall slice is available');
assert.equal(retryResult.found, true);
assert.equal(retryResult.entries[0].content, 'latest recall slice');

let stoppedReads = 0;
let captureActive = true;
const stoppedResult = await captureAnimaWorldbookUntil({
  read: async () => {
    stoppedReads += 1;
    captureActive = false;
    return [{ name: '[ANIMA_Knowledge_Container]', content: '' }];
  },
  isActive: () => captureActive,
  wait: async () => { throw new Error('must not wait after generation ends'); },
});
assert.equal(stoppedReads, 1, 'capture stops when the body generation has ended');
assert.equal(stoppedResult.found, false);

const mergedSnapshot = mergeAnimaWorldbookSnapshots([
  { name: '[ANIMA_Chat_History_Container]', content: 'old history' },
  { name: '[ANIMA_Knowledge_Container]', content: 'old knowledge' },
], [
  { name: '[ANIMA_Chat_History_Container]', content: '' },
  { name: '[ANIMA_Knowledge_Container]', content: 'new knowledge' },
]);
assert.equal(mergedSnapshot[0].content, 'old history', 'an empty capture cannot erase a previous worldbook snapshot');
assert.equal(mergedSnapshot[1].content, 'new knowledge');

assert.deepEqual(
  filterAnimaWorldbookEntries([
    { name: '[anima_status]', content: 'status' },
    { name: '[ANIMA_Chat_History_Container]', content: 'history' },
    { name: '[ANIMA_Knowledge_Container]', content: 'knowledge' },
  ], { includeWorldbook: true, includeStatus: false }).map((entry) => getAnimaEntryKind(entry)),
  ['history', 'knowledge'],
  'worldbook-only mode excludes the status placeholder',
);
assert.deepEqual(
  filterAnimaWorldbookEntries([
    { name: '[anima_status]', content: 'status' },
    { name: '[ANIMA_Chat_History_Container]', content: 'history' },
  ], { includeWorldbook: false, includeStatus: true }).map((entry) => getAnimaEntryKind(entry)),
  ['status'],
  'status-only mode keeps the existing status placeholder',
);

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

const userLatestStatus = readLatestAnimaStatus({
  targetWindow: {
    TavernHelper: {
      getVariables: ({ message_id }) => message_id === 'latest'
        ? { anima_data: { mood: 'stale-user-data' } }
        : message_id === 0
          ? { anima_data: { mood: 'previous-assistant' } }
          : {},
    },
  },
  chat: [
    { is_user: false, mes: 'assistant with status' },
    { is_user: true, mes: 'latest user' },
  ],
});
assert.deepEqual(userLatestStatus, { data: { mood: 'previous-assistant' }, messageId: 0, messageIndex: 0 }, 'latest user variables must not override the latest assistant state');

const replaced = replaceAnimaStatusMacros(
  'A={{status}} B={{ANIMA_BASE_STATUS::protagonist.hp}} C={{format_message_variable::anima_data}} D={{get_message_variable::anima_data}}',
  status.data,
);
assert.match(replaced, /A=[\s\S]*protagonist:/);
assert.doesNotMatch(replaced.split('B=')[0], /\"protagonist\"/);
assert.match(replaced, /B=42/);
assert.match(replaced, /C=[\s\S]*mood: tense/);
assert.match(replaced, /D=\{[\s\S]*\"mood\"[\s\S]*tense/);
assert.equal(replaceAnimaStatusMacros('{{status}}', null), '{{status}}', 'disabled/missing status leaves the macro untouched');

console.log('anima-memory tests passed');
