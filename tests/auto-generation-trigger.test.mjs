import assert from 'node:assert/strict';
import { createAutoGenerationTracker } from '../generation/auto-generation-trigger.js';

const assistantMessage = { is_user: false, is_system: false, mes: '助手正文' };

for (const type of ['normal', 'regenerate', 'swipe', 'continue', undefined]) {
  const tracker = createAutoGenerationTracker();
  tracker.start(type, false);
  assert.equal(tracker.recordAssistantMessage(3, assistantMessage), true, `${type ?? 'default'} should accept an assistant message`);
  assert.equal(tracker.finish(), 3, `${type ?? 'default'} should trigger for an assistant message`);
  assert.equal(tracker.finish(), null, 'a completed cycle should be consumed');
}

for (const type of ['quiet', 'impersonate']) {
  const tracker = createAutoGenerationTracker();
  tracker.start(type, false);
  assert.equal(tracker.recordAssistantMessage(4, assistantMessage), false, `${type} should ignore rendered messages`);
  assert.equal(tracker.finish(), null, `${type} should not trigger`);
}

{
  const tracker = createAutoGenerationTracker();
  tracker.start('normal', true);
  assert.equal(tracker.recordAssistantMessage(5, assistantMessage), false, 'dry runs should ignore rendered messages');
  assert.equal(tracker.finish(), null, 'dry runs should not trigger');
}

for (const message of [
  { is_user: true, is_system: false, mes: '生成的用户消息' },
  { is_user: false, is_system: true, mes: '系统消息' },
  { is_user: false, is_system: false, mes: '   ' },
  null,
]) {
  const tracker = createAutoGenerationTracker();
  tracker.start('normal', false);
  assert.equal(tracker.recordAssistantMessage(6, message), false, 'non-assistant content should be ignored');
  assert.equal(tracker.finish(), null, 'non-assistant content should not trigger');
}

{
  const tracker = createAutoGenerationTracker();
  tracker.start('normal', false);
  assert.equal(tracker.recordAssistantMessage('7', assistantMessage), true, 'numeric message ids should be normalized');
  assert.equal(tracker.finish(), 7);
}

for (const messageId of [-1, 'bad', null]) {
  const tracker = createAutoGenerationTracker();
  tracker.start('normal', false);
  assert.equal(tracker.recordAssistantMessage(messageId, assistantMessage), false, 'invalid message ids should be ignored');
  assert.equal(tracker.finish(), null);
}

{
  const tracker = createAutoGenerationTracker();
  tracker.start('normal', false);
  tracker.recordAssistantMessage(8, assistantMessage);
  tracker.stop();
  assert.equal(tracker.finish(), null, 'a stopped generation should not trigger');
}

{
  const tracker = createAutoGenerationTracker();
  tracker.start('normal', false);
  assert.equal(tracker.finish(), null, 'a generation without an assistant message should not trigger');
}

{
  const tracker = createAutoGenerationTracker();
  tracker.start('normal', false);
  tracker.recordAssistantMessage(9, assistantMessage);
  tracker.start('quiet', false);
  assert.equal(tracker.finish(), null, 'a new generation should clear the previous candidate');
}

console.log('auto-generation-trigger tests passed');
