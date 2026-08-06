export const CHAT_HISTORY_RANGE_VISIBLE = 'visible';
export const CHAT_HISTORY_RANGE_RECENT = 'recent';

const IGNORE_SYMBOL = Symbol.for('ignore');

function isChatHistoryMessage(item) {
  return Boolean(item) && item.is_system !== true;
}

function isNativeVisibleChatMessage(item) {
  return isChatHistoryMessage(item) && !item?.extra?.[IGNORE_SYMBOL];
}

export function normalizeChatHistoryRangeMode(value, fallback = CHAT_HISTORY_RANGE_VISIBLE) {
  return value === CHAT_HISTORY_RANGE_RECENT || value === CHAT_HISTORY_RANGE_VISIBLE ? value : fallback;
}

export function normalizeRecentMessageCount(value, fallback = 10) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

export function selectChatHistoryMessages(chat, { mode = CHAT_HISTORY_RANGE_VISIBLE, recentMessageCount = 10 } = {}) {
  const messages = Array.isArray(chat) ? chat.filter(isChatHistoryMessage) : [];
  if (normalizeChatHistoryRangeMode(mode) === CHAT_HISTORY_RANGE_RECENT) {
    return messages.slice(-normalizeRecentMessageCount(recentMessageCount));
  }
  return messages.filter(isNativeVisibleChatMessage);
}
