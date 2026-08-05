import assert from 'node:assert/strict';
import { createInjectionUndoSnapshot, validateInjectionUndoSnapshot } from '../injection/injection-undo.js';

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
assert.equal('promptBaseText' in snapshot, false, 'undo snapshots should only retain the actual pre-injection reply');
assert.equal('promptBaseSwipeText' in snapshot, false);
assert.equal(snapshot.mvuReprocessed, true);

console.log('injection-undo tests passed');
