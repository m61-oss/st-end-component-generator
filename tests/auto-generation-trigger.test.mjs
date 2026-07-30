import assert from 'node:assert/strict';
import {
  captureAutomaticAssistantTarget,
  isAutomaticAssistantTargetCurrent,
  resolveAutomaticAssistantMessageIndex,
  resolveReadyAutomaticAssistantTarget,
} from '../generation/auto-generation-trigger.js';

const assistant = { is_user: false, is_system: false, mes: 'Assistant reply' };
const chat = [
  { is_user: true, is_system: false, mes: 'User input' },
  assistant,
  { is_user: false, is_system: true, mes: 'System notice' },
];

assert.equal(resolveAutomaticAssistantMessageIndex(1, chat), 1, 'assistant messages should trigger');
assert.equal(resolveAutomaticAssistantMessageIndex('1', chat), 1, 'numeric message IDs should be accepted');

const pendingTarget = captureAutomaticAssistantTarget(1, chat);
assert.deepEqual(
  pendingTarget,
  { messageIndex: 1 },
  'the received event should capture only the floor because other listeners may still normalize its text',
);
assert.equal(
  resolveReadyAutomaticAssistantTarget(pendingTarget, chat),
  null,
  'automatic work must wait until SillyTavern has initialized the active swipe',
);

const readyChat = [
  chat[0],
  { ...assistant, mes: 'Assistant reply normalized', swipe_id: 0, swipes: ['Assistant reply normalized'] },
];
const readyTarget = resolveReadyAutomaticAssistantTarget(pendingTarget, readyChat);
assert.deepEqual(
  readyTarget,
  { messageIndex: 1, messageText: 'Assistant reply normalized', swipeId: 0 },
  'the stable target should use the finalized text instead of the temporary MESSAGE_RECEIVED text',
);
assert.equal(isAutomaticAssistantTargetCurrent(readyTarget, readyChat), true);
assert.equal(
  isAutomaticAssistantTargetCurrent(readyTarget, [
    chat[0],
    { ...assistant, mes: 'Another swipe', swipe_id: 1, swipes: ['Assistant reply normalized', 'Another swipe'] },
  ]),
  false,
  'switching to another swipe must invalidate an in-flight result',
);
assert.equal(
  isAutomaticAssistantTargetCurrent(readyTarget, [...readyChat, { ...assistant, mes: 'New floor', swipe_id: 0, swipes: ['New floor'] }]),
  false,
  'a later floor must invalidate an in-flight result',
);

for (const [messageId, messages] of [
  [0, chat],
  [2, chat],
  [1, [chat[0], { ...assistant, mes: '   ' }]],
  [1, [chat[0], null]],
  [-1, chat],
  ['bad', chat],
  [null, chat],
  [99, chat],
]) {
  assert.equal(
    resolveAutomaticAssistantMessageIndex(messageId, messages),
    null,
    `message ${String(messageId)} should not trigger when it is not a non-empty assistant message`,
  );
}

console.log('auto-generation-trigger tests passed');
