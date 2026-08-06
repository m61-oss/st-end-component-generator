import assert from 'node:assert/strict';
import {
  CHAT_HISTORY_RANGE_RECENT,
  CHAT_HISTORY_RANGE_VISIBLE,
  normalizeRecentMessageCount,
  selectChatHistoryMessages,
} from '../generation/chat-history-range.js';

const ignored = Symbol.for('ignore');
const chat = [
  { is_user: true, mes: 'old user' },
  { is_user: false, mes: 'hidden assistant', extra: { [ignored]: true } },
  { is_user: false, mes: 'visible assistant' },
  { is_system: true, mes: 'system entry' },
  { is_user: true, mes: 'hidden user', extra: { [ignored]: true } },
  { is_user: false, mes: 'latest assistant' },
];

assert.deepEqual(
  selectChatHistoryMessages(chat, { mode: CHAT_HISTORY_RANGE_VISIBLE }),
  [chat[0], chat[2], chat[4], chat[5]].filter((item) => !item.extra?.[ignored]),
  'unhidden mode should remove ignored messages and system entries',
);

assert.deepEqual(
  selectChatHistoryMessages(chat, { mode: CHAT_HISTORY_RANGE_RECENT, recentMessageCount: 3 }),
  [chat[2], chat[4], chat[5]],
  'recent mode should count hidden user/assistant messages before filtering and ignore system entries only',
);

assert.equal(normalizeRecentMessageCount(undefined), 10);
assert.equal(normalizeRecentMessageCount('4.8'), 4);
assert.equal(normalizeRecentMessageCount(0), 1);
assert.equal(normalizeRecentMessageCount('invalid'), 10);

console.log('chat-history-range tests passed');
