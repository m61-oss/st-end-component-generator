import { stripHistoryBlocksByRules } from '../injection/tag-rules.js';
import { CHAT_HISTORY_RANGE_VISIBLE, selectChatHistoryMessages } from '../generation/chat-history-range.js';

const textOf = (value) => String(value ?? '').trim();

function isEscapedAt(value, index) {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) slashCount += 1;
  return slashCount % 2 === 1;
}

export function parseWorldbookRegex(value) {
  const source = textOf(value);
  if (!source.startsWith('/')) return null;
  let delimiter = -1;
  for (let index = source.length - 1; index > 0; index -= 1) {
    if (source[index] === '/' && !isEscapedAt(source, index)) {
      delimiter = index;
      break;
    }
  }
  if (delimiter <= 0) return null;
  const flags = source.slice(delimiter + 1);
  if (!/^[gimsuy]*$/.test(flags)) return null;
  const pattern = source.slice(1, delimiter);
  if (!pattern) return null;
  for (let index = 0; index < pattern.length; index += 1) {
    if (pattern[index] === '/' && !isEscapedAt(pattern, index)) return null;
  }
  try {
    return new RegExp(pattern, flags);
  } catch (_) {
    return null;
  }
}

export function splitWorldbookKeywords(value) {
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean);
  const source = String(value ?? '');
  const result = [];
  let start = 0;
  let regexCandidate = false;
  let regexClosed = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const current = source.slice(start, index + 1);
    if (!regexCandidate && current.trimStart() === '/') regexCandidate = true;
    else if (regexCandidate && character === '/' && !isEscapedAt(source, index) && source.slice(start, index).trimStart().length > 0) regexClosed = true;
    if (character !== ',' || (regexCandidate && !regexClosed)) continue;
    const keyword = source.slice(start, index).trim();
    if (keyword) result.push(keyword);
    start = index + 1;
    regexCandidate = false;
    regexClosed = false;
  }
  const finalKeyword = source.slice(start).trim();
  if (finalKeyword) result.push(finalKeyword);
  return result;
}

function normalizeKeys(value) {
  return Array.isArray(value) ? value.map(textOf).filter(Boolean) : splitWorldbookKeywords(value);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matches(text, keyword, { caseSensitive = false, matchWholeWords = false } = {}) {
  if (!keyword) return false;
  const regex = parseWorldbookRegex(keyword);
  if (regex) {
    regex.lastIndex = 0;
    return regex.test(text);
  }
  if (matchWholeWords) {
    const flags = caseSensitive ? 'u' : 'iu';
    return new RegExp(`(?:^|\\W)(${escapeRegex(keyword)})(?:$|\\W)`, flags).test(text);
  }
  const haystack = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? keyword : keyword.toLowerCase();
  return haystack.includes(needle);
}

export function normalizeWorldbookActivationMode(value, fallback = 'green') {
  return textOf(value).toLowerCase() === 'blue' ? 'blue' : textOf(value).toLowerCase() === 'green' ? 'green' : fallback;
}

// Green-light keywords are scanned against the same range the model will receive. Range selection
// happens before cleanup, so an old message outside the plugin range cannot activate an entry.
// Cleanup still runs before matching, so text removed from a retained block cannot activate one.
export function getWorldbookScanText(chat, depth = 2, {
  historyCleanupRules = [],
  historyRangeMode = CHAT_HISTORY_RANGE_VISIBLE,
  recentMessageCount = 10,
} = {}) {
  const limit = Math.max(0, Number.isFinite(Number(depth)) ? Math.floor(Number(depth)) : 2);
  const selectedHistory = selectChatHistoryMessages(chat, {
    mode: historyRangeMode,
    recentMessageCount,
  });
  return stripHistoryBlocksByRules(selectedHistory, historyCleanupRules)
    .slice(-limit)
    .reverse()
    .map((item) => textOf(item?.mes))
    .filter(Boolean)
    .join('\n');
}

// `enabled` / `disable` only carry Tavern's own toggle. They seed the default checkbox state when a
// book is first synced, so they must not veto activation here: once an entry reaches this filter the
// plugin has already decided it is selected, and the plugin selection is what the user expects to win.
export function isWorldbookEntryActivated(entry, { scanText = '', depth = 2, activationMode = null, substituteKeyword = null } = {}) {
  const mode = normalizeWorldbookActivationMode(activationMode ?? entry?.activationMode, entry?.constant ? 'blue' : 'green');
  if (mode === 'blue') return true;
  const hasWorldbookKeys = Boolean(entry) && Object.prototype.hasOwnProperty.call(entry, 'worldbookKeys');
  const keys = hasWorldbookKeys ? normalizeKeys(entry?.worldbookKeys) : normalizeKeys(entry?.key);
  const caseSensitive = entry?.caseSensitive === true;
  const matchWholeWords = entry?.matchWholeWords === true;
  return keys.some((key) => {
    let keyword = key;
    if (typeof substituteKeyword === 'function') {
      try { keyword = textOf(substituteKeyword(key)); } catch (_) { keyword = key; }
    }
    return matches(scanText, keyword, { caseSensitive, matchWholeWords });
  });
}

export function filterWorldbookPromptItems(items, {
  chat = [],
  scanDepth = 2,
  activationModeForItem = null,
  historyCleanupRules = [],
  historyRangeMode = CHAT_HISTORY_RANGE_VISIBLE,
  recentMessageCount = 10,
  substituteKeyword = null,
} = {}) {
  const scanText = getWorldbookScanText(chat, scanDepth, {
    historyCleanupRules,
    historyRangeMode,
    recentMessageCount,
  });
  return (Array.isArray(items) ? items : []).filter((item) => {
    if (textOf(item?.scope) !== '世界书') return true;
    const activationMode = typeof activationModeForItem === 'function' ? activationModeForItem(item) : item?.activationMode;
    return isWorldbookEntryActivated(item, { scanText, scanDepth, activationMode, substituteKeyword });
  });
}
