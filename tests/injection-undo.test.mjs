import assert from 'node:assert/strict';
import { createInjectionUndoSnapshot, createRollbackPromptView, validateInjectionUndoSnapshot } from '../injection/injection-undo.js';
import { stripHistoryBlocksByRules } from '../injection/tag-rules.js';

const originalText = '正文\n<status>旧状态</status>';
const injectedText = '正文\n<status>新状态</status>';
const snapshot = createInjectionUndoSnapshot({
  targetIndex: 1,
  chatLength: 2,
  originalText,
  injectedText,
  swipeId: 0,
  hadSwipe: true,
  originalSwipeText: originalText,
  injectedSwipeText: injectedText,
  mvuReprocessed: true,
});

const createChat = (overrides = {}) => [
  { is_user: true, mes: '用户输入' },
  {
    is_user: false,
    is_system: false,
    mes: injectedText,
    swipe_id: 0,
    swipes: [injectedText],
    ...overrides,
  },
];

assert.deepEqual(
  validateInjectionUndoSnapshot(snapshot, createChat()),
  { valid: true, reason: '', message: createChat()[1] },
  'an unchanged injection on the latest assistant floor should be undoable',
);

assert.equal(
  validateInjectionUndoSnapshot(snapshot, [...createChat(), { is_user: false, mes: '新楼层' }]).reason,
  'chat-length-changed',
  'any later floor should invalidate the previous injection',
);

assert.equal(
  validateInjectionUndoSnapshot(snapshot, createChat({ mes: `${injectedText}\n用户修改` })).reason,
  'message-changed',
  'editing the injected message should prevent destructive restoration',
);

assert.equal(
  validateInjectionUndoSnapshot(snapshot, createChat({ swipe_id: 1, swipes: [injectedText, '其他 swipe'] })).reason,
  'swipe-changed',
  'switching swipe should invalidate the snapshot',
);

assert.equal(
  validateInjectionUndoSnapshot(snapshot, createChat({ swipes: ['被其他插件修改'] })).reason,
  'swipe-content-changed',
  'editing the active swipe should invalidate the snapshot',
);

assert.equal(
  validateInjectionUndoSnapshot(snapshot, createChat({ is_user: true })).reason,
  'target-not-assistant',
  'user messages must never be restored as assistant injections',
);

assert.equal(
  validateInjectionUndoSnapshot(snapshot, createChat({ is_system: true })).reason,
  'target-not-assistant',
  'system messages must never be restored as assistant injections',
);

assert.equal(validateInjectionUndoSnapshot(null, createChat()).reason, 'missing-snapshot');

assert.notEqual(snapshot.originalText, snapshot.injectedText);
assert.equal(snapshot.originalSwipeText, originalText);
assert.equal(snapshot.injectedSwipeText, injectedText);
assert.equal(snapshot.promptBaseText, originalText, 'an ordinary injection should use its pre-injection reply as the reroll prompt base');
assert.equal(snapshot.promptBaseSwipeText, originalText);
assert.equal(snapshot.mvuReprocessed, true);

const promptOriginalText = '正文原文\n<thinking>旧思维链</thinking>';
const promptInjectedText = `${promptOriginalText}\n<status>错误状态栏</status>`;
const promptSnapshot = createInjectionUndoSnapshot({
  targetIndex: 1,
  chatLength: 2,
  originalText: promptOriginalText,
  injectedText: promptInjectedText,
  swipeId: 0,
  hadSwipe: true,
  originalSwipeText: promptOriginalText,
  injectedSwipeText: promptInjectedText,
});
const promptChat = createChat({ mes: promptInjectedText, swipes: [promptInjectedText] });
const rollbackPromptView = createRollbackPromptView({
  snapshot: promptSnapshot,
  chat: promptChat,
  injectMode: 'rollbackAppend',
  targetIndex: 1,
});

assert.equal(rollbackPromptView.applied, true, 'rollback injection modes should build prompts from the pre-injection reply');
assert.notEqual(rollbackPromptView.chat, promptChat, 'the prompt view must not mutate the live chat array');
assert.notEqual(rollbackPromptView.message, promptChat[1], 'the prompt view must clone the target assistant message');
assert.equal(rollbackPromptView.message.mes, promptOriginalText);
assert.equal(rollbackPromptView.message.swipes[0], promptOriginalText);
assert.equal(promptChat[1].mes, promptInjectedText, 'the live injected reply must remain untouched while generation is pending');

const cleanedPromptChat = stripHistoryBlocksByRules(rollbackPromptView.chat, [{ rule: 'thinking', keep: 0 }]);
assert.equal(cleanedPromptChat[1].mes.trim(), '正文原文', 'the virtual pre-injection reply must still pass through history tag cleanup');
assert.doesNotMatch(cleanedPromptChat[1].mes, /错误状态栏|旧思维链/);

assert.equal(
  createRollbackPromptView({ snapshot: promptSnapshot, chat: promptChat, injectMode: 'append', targetIndex: 1 }).applied,
  false,
  'ordinary append and replace modes should keep using the current injected reply',
);
assert.equal(
  createRollbackPromptView({ snapshot: promptSnapshot, chat: promptChat, injectMode: 'rollbackReplace', targetIndex: 0 }).applied,
  false,
  'a rollback snapshot must not be applied to a different generation target',
);

const secondInjectedText = `${promptOriginalText}\n<status>第二版状态栏</status>`;
const rerolledSnapshot = createInjectionUndoSnapshot({
  targetIndex: 1,
  chatLength: 2,
  originalText: promptInjectedText,
  injectedText: secondInjectedText,
  swipeId: 0,
  hadSwipe: true,
  originalSwipeText: promptInjectedText,
  injectedSwipeText: secondInjectedText,
  promptBaseText: promptSnapshot.promptBaseText,
  promptBaseSwipeText: promptSnapshot.promptBaseSwipeText,
});
const rerolledChat = createChat({ mes: secondInjectedText, swipes: [secondInjectedText] });
const secondRollbackPromptView = createRollbackPromptView({
  snapshot: rerolledSnapshot,
  chat: rerolledChat,
  injectMode: 'rollbackAppend',
  targetIndex: 1,
});

assert.equal(rerolledSnapshot.originalText, promptInjectedText, 'undoing a reroll should restore the previous injected version');
assert.equal(secondRollbackPromptView.message.mes, promptOriginalText, 'later rerolls must still build from the original clean prompt base');
assert.equal(secondRollbackPromptView.message.swipes[0], promptOriginalText);

console.log('injection-undo tests passed');
