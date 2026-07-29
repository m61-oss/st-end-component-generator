import assert from 'node:assert/strict';
import { createAutoGenerationTracker } from '../generation/auto-generation-trigger.js';

const userMessage = { is_user: true, is_system: false, mes: 'User input' };
const assistantMessage = { is_user: false, is_system: false, mes: 'Assistant reply' };

function finishWithChat(tracker, chat) {
  const completion = tracker.end();
  return tracker.finalize(completion, chat);
}

for (const type of ['normal', 'regenerate', 'swipe', 'continue', undefined]) {
  const tracker = createAutoGenerationTracker();
  tracker.start(type, false, [userMessage]);
  assert.equal(tracker.recordAssistantMessage(1, assistantMessage), true, `${type ?? 'default'} should accept an assistant message`);
  assert.equal(finishWithChat(tracker, [userMessage, assistantMessage]), 1, `${type ?? 'default'} should trigger for a new assistant reply`);
}

for (const type of ['quiet', 'impersonate']) {
  const tracker = createAutoGenerationTracker();
  tracker.start(type, false, [userMessage]);
  assert.equal(tracker.recordAssistantMessage(1, assistantMessage), false, `${type} should ignore rendered messages`);
  assert.equal(tracker.end(), null, `${type} should not create a completion`);
}

{
  const tracker = createAutoGenerationTracker();
  tracker.start('normal', true, [userMessage]);
  assert.equal(tracker.recordAssistantMessage(1, assistantMessage), false, 'dry runs should ignore rendered messages');
  assert.equal(tracker.end(), null, 'dry runs should not create a completion');
}

for (const message of [
  userMessage,
  { is_user: false, is_system: true, mes: 'System message' },
  { is_user: false, is_system: false, mes: '   ' },
  null,
]) {
  const tracker = createAutoGenerationTracker();
  tracker.start('normal', false, [userMessage]);
  assert.equal(tracker.recordAssistantMessage(1, message), false, 'non-assistant content should be ignored');
  assert.equal(finishWithChat(tracker, [userMessage, message]), null, 'non-assistant content should not trigger');
}

{
  const tracker = createAutoGenerationTracker();
  tracker.start('normal', false, [userMessage]);
  assert.equal(tracker.recordAssistantMessage('1', assistantMessage), true, 'numeric message IDs should be normalized');
  assert.equal(finishWithChat(tracker, [userMessage, assistantMessage]), 1);
}

for (const messageId of [-1, 'bad', null]) {
  const tracker = createAutoGenerationTracker();
  tracker.start('normal', false, [userMessage]);
  assert.equal(tracker.recordAssistantMessage(messageId, assistantMessage), false, 'invalid message IDs should be ignored');
  assert.equal(finishWithChat(tracker, [userMessage, assistantMessage]), null);
}

{
  const tracker = createAutoGenerationTracker();
  tracker.start('normal', false, [userMessage]);
  tracker.recordAssistantMessage(1, assistantMessage);
  tracker.stop();
  assert.equal(finishWithChat(tracker, [userMessage, assistantMessage]), null, 'stop before end should suppress automatic generation');
}

{
  const tracker = createAutoGenerationTracker();
  const partial = { ...assistantMessage, mes: 'Partial' };
  tracker.start('normal', false, [userMessage]);
  tracker.recordAssistantMessage(1, partial);
  const completion = tracker.end();
  tracker.stop();
  assert.equal(tracker.finalize(completion, [userMessage, partial]), null, 'stop after end was announced should suppress partial output');
}

{
  const tracker = createAutoGenerationTracker();
  tracker.start('normal', false, [userMessage]);
  tracker.start('quiet', false, [userMessage]);
  assert.equal(tracker.end(), null, 'nested quiet generation should consume only its own end event');
  tracker.recordAssistantMessage(1, assistantMessage);
  assert.equal(finishWithChat(tracker, [userMessage, assistantMessage]), 1, 'nested quiet generation should not erase the foreground session');
}

{
  const tracker = createAutoGenerationTracker();
  const oldAssistant = { ...assistantMessage, mes: 'Old reply' };
  tracker.start('regenerate', false, [userMessage, oldAssistant]);
  tracker.recordAssistantMessage(1, oldAssistant);
  assert.equal(finishWithChat(tracker, [userMessage, oldAssistant]), null, 'unchanged old assistant re-render should not trigger');
}

for (const type of ['regenerate', 'swipe', 'continue']) {
  const tracker = createAutoGenerationTracker();
  const oldAssistant = { ...assistantMessage, mes: 'Old reply' };
  const changedAssistant = { ...assistantMessage, mes: 'Changed reply' };
  tracker.start(type, false, [userMessage, oldAssistant]);
  tracker.recordAssistantMessage(1, changedAssistant);
  assert.equal(finishWithChat(tracker, [userMessage, changedAssistant]), 1, `${type} should trigger when the assistant content changes`);
}

{
  const tracker = createAutoGenerationTracker();
  tracker.start('normal', false, [userMessage]);
  tracker.recordAssistantMessage(1, assistantMessage);
  assert.equal(finishWithChat(tracker, [userMessage, assistantMessage, { ...userMessage, mes: 'Rewritten user tail' }]), null, 'assistant candidate must remain the chat tail');
}

{
  const tracker = createAutoGenerationTracker();
  tracker.start('normal', false, [userMessage]);
  tracker.recordAssistantMessage(1, assistantMessage);
  assert.equal(finishWithChat(tracker, [userMessage, { ...userMessage, mes: 'Database user message' }]), null, 'rewritten user tail should not trigger');
}

{
  const tracker = createAutoGenerationTracker();
  tracker.start('normal', false, [userMessage]);
  tracker.recordAssistantMessage(1, assistantMessage);
  const completion = tracker.end();
  assert.equal(tracker.finalize(completion, [userMessage, assistantMessage]), 1);
  assert.equal(tracker.finalize(completion, [userMessage, assistantMessage]), null, 'a completion should be consumed once');
  assert.equal(tracker.end(), null, 'duplicate end events should not produce a second completion');
}

console.log('auto-generation-trigger tests passed');
