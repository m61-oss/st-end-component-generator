import { stripHistoryBlocksByRules } from '../injection/tag-rules.js';
import { selectChatHistoryMessages } from './chat-history-range.js';

export function cleanChatHistory(chat, {
  followTavernRegex = false,
  historyCleanupRules = [],
  getRegexedString = null,
  regexPlacement = null,
} = {}) {
  const messages = Array.isArray(chat) ? chat : [];
  if (!followTavernRegex || typeof getRegexedString !== 'function') {
    return stripHistoryBlocksByRules(messages, historyCleanupRules);
  }

  const historyLength = messages.filter((item) => item?.is_system !== true).length;
  let historyIndex = 0;
  return messages.map((item) => {
    if (item?.is_system === true) return { ...item };
    const placement = item?.is_user ? regexPlacement?.USER_INPUT : regexPlacement?.AI_OUTPUT;
    const depth = historyLength - historyIndex - 1;
    historyIndex += 1;
    if (placement === undefined) return { ...item };
    return {
      ...item,
      mes: getRegexedString(String(item?.mes ?? ''), placement, { isPrompt: true, depth }),
    };
  });
}

export function selectAndCleanChatHistory(chat, {
  followTavernRegex = false,
  historyCleanupRules = [],
  historyRangeMode,
  recentMessageCount,
  getRegexedString = null,
  regexPlacement = null,
} = {}) {
  const source = Array.isArray(chat) ? chat : [];
  const indexedSource = source.map((message, index) => ({ ...message, __stEsgSourceMessageIndex: index }));
  if (followTavernRegex) {
    return selectChatHistoryMessages(cleanChatHistory(indexedSource, {
      followTavernRegex,
      getRegexedString,
      regexPlacement,
    }), { mode: historyRangeMode, recentMessageCount })
      .map((message) => ({ ...message }));
  }
  return cleanChatHistory(selectChatHistoryMessages(indexedSource, {
    mode: historyRangeMode,
    recentMessageCount,
  }), { historyCleanupRules })
    .map((message) => ({ ...message }));
}
