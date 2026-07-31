const IGNORE_SYMBOL = Symbol.for('ignore');

const textOf = (value) => String(value ?? '').trim();

function isVisibleChatMessage(item) {
  return Boolean(item) && item.is_system !== true && !item?.extra?.[IGNORE_SYMBOL];
}

function normalizeKeys(value) {
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean);
  return textOf(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function matches(text, keyword, caseSensitive = false) {
  if (!keyword) return false;
  const haystack = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? keyword : keyword.toLowerCase();
  return haystack.includes(needle);
}

export function normalizeWorldbookActivationMode(value, fallback = 'green') {
  return textOf(value).toLowerCase() === 'blue' ? 'blue' : textOf(value).toLowerCase() === 'green' ? 'green' : fallback;
}

export function getWorldbookScanText(chat, depth = 2) {
  const limit = Math.max(0, Number.isFinite(Number(depth)) ? Math.floor(Number(depth)) : 2);
  return (Array.isArray(chat) ? chat : [])
    .filter(isVisibleChatMessage)
    .slice(-limit)
    .reverse()
    .map((item) => textOf(item?.mes))
    .filter(Boolean)
    .join('\n');
}

// `enabled` / `disable` only carry Tavern's own toggle. They seed the default checkbox state when a
// book is first synced, so they must not veto activation here: once an entry reaches this filter the
// plugin has already decided it is selected, and the plugin selection is what the user expects to win.
export function isWorldbookEntryActivated(entry, { scanText = '', depth = 2, activationMode = null } = {}) {
  const mode = normalizeWorldbookActivationMode(activationMode ?? entry?.activationMode, entry?.constant ? 'blue' : 'green');
  if (mode === 'blue') return true;
  const worldbookKeys = normalizeKeys(entry?.worldbookKeys);
  const keys = worldbookKeys.length ? worldbookKeys : normalizeKeys(entry?.key);
  const caseSensitive = entry?.caseSensitive === true;
  return keys.some((key) => matches(scanText, key, caseSensitive));
}

export function filterWorldbookPromptItems(items, { chat = [], scanDepth = 2, activationModeForItem = null } = {}) {
  const scanText = getWorldbookScanText(chat, scanDepth);
  return (Array.isArray(items) ? items : []).filter((item) => {
    if (textOf(item?.scope) !== '世界书') return true;
    const activationMode = typeof activationModeForItem === 'function' ? activationModeForItem(item) : item?.activationMode;
    return isWorldbookEntryActivated(item, { scanText, scanDepth, activationMode });
  });
}
