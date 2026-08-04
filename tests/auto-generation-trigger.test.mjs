import assert from 'node:assert/strict';
import {
  captureAutomaticAssistantTarget,
  captureAutomaticGenerationBaseline,
  getAutomaticAssistantTargetKey,
  isAutomaticTargetAfterGenerationStart,
  isAutomaticAssistantTargetAddressable,
  isAutomaticAssistantMessageTypeEligible,
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

for (const messageType of ['first_message', 'command', 'extension', 'impersonate', 'quiet']) {
  assert.equal(
    isAutomaticAssistantMessageTypeEligible(messageType),
    false,
    `${messageType} messages are loaded or injected rather than newly generated body replies`,
  );
}
for (const messageType of ['normal', 'swipe', 'continue', 'append', 'appendFinal', undefined]) {
  assert.equal(
    isAutomaticAssistantMessageTypeEligible(messageType),
    true,
    `${String(messageType)} should remain compatible with normal assistant generation`,
  );
}
assert.deepEqual(
  resolveReadyAutomaticAssistantTarget(pendingTarget, chat),
  { messageIndex: 1, messageText: 'Assistant reply', swipeId: null },
  'missing swipe metadata and a later system message must not block the latest assistant reply',
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
assert.equal(
  isAutomaticAssistantTargetAddressable(readyTarget, [chat[0], { ...assistant, mes: '同楼层被其他插件更新' }]),
  true,
  'a same-floor text update without swipe metadata should still allow automatic injection',
);
assert.equal(
  isAutomaticAssistantTargetAddressable(readyTarget, [
    chat[0],
    { ...assistant, mes: 'Another swipe', swipe_id: 1, swipes: ['Assistant reply normalized', 'Another swipe'] },
    { is_user: false, is_system: true, mes: 'System metadata' },
  ]),
  true,
  'switching swipe or appending system metadata must not make the latest assistant unaddressable',
);
const baseline = captureAutomaticGenerationBaseline(readyChat);
assert.equal(
  isAutomaticTargetAfterGenerationStart(readyTarget, null),
  false,
  'a generation-ended event without a matching start baseline must not claim a loaded assistant reply',
);
assert.equal(
  isAutomaticTargetAfterGenerationStart(readyTarget, baseline),
  false,
  'an ended event without a new assistant or swipe must not retrigger the same reply',
);
const newSwipeTarget = resolveReadyAutomaticAssistantTarget(
  { messageIndex: 1 },
  [chat[0], { ...assistant, mes: 'Another swipe', swipe_id: 1, swipes: ['Assistant reply normalized', 'Another swipe'] }],
);
assert.equal(isAutomaticTargetAfterGenerationStart(newSwipeTarget, baseline), true);
assert.notEqual(getAutomaticAssistantTargetKey(newSwipeTarget), getAutomaticAssistantTargetKey(readyTarget));
assert.equal(
  isAutomaticTargetAfterGenerationStart(
    resolveReadyAutomaticAssistantTarget({ messageIndex: 2 }, [...readyChat, { is_user: false, is_system: false, mes: 'New reply', swipe_id: 0, swipes: ['New reply'] }]),
    baseline,
  ),
  true,
  'a newly appended assistant reply must be eligible after generation ended',
);
assert.equal(
  isAutomaticAssistantTargetAddressable(readyTarget, [...readyChat, { ...assistant, mes: 'New floor', swipe_id: 0, swipes: ['New floor'] }]),
  false,
  'a later assistant floor must prevent automatic injection into the old floor',
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
