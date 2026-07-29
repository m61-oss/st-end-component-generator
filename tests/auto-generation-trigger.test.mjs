import assert from 'node:assert/strict';
import { resolveAutomaticAssistantMessageIndex } from '../generation/auto-generation-trigger.js';

const assistant = { is_user: false, is_system: false, mes: 'Assistant reply' };
const chat = [
  { is_user: true, is_system: false, mes: 'User input' },
  assistant,
  { is_user: false, is_system: true, mes: 'System notice' },
];

assert.equal(resolveAutomaticAssistantMessageIndex(1, chat), 1, 'assistant messages should trigger');
assert.equal(resolveAutomaticAssistantMessageIndex('1', chat), 1, 'numeric message IDs should be accepted');

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
