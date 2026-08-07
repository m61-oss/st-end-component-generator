const textOf = (value) => String(value ?? '').trim();

export const ANIMA_ENTRY_NAMES = [
  '[anima_status]',
  '[ANIMA_Chat_History_Container]',
  '[ANIMA_Knowledge_Container]',
];

const ENTRY_KIND_BY_NAME = new Map([
  ['[anima_status]', 'status'],
  ['[anima_chat_history_container]', 'history'],
  ['[anima_knowledge_container]', 'knowledge'],
]);

export function getAnimaEntryKind(entry) {
  for (const value of [entry?.name, entry?.comment]) {
    const name = textOf(value).toLowerCase();
    const kind = ENTRY_KIND_BY_NAME.get(name);
    if (kind) return kind;
  }
  return '';
}

function normalizeWorldbookEntries(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.entries)) return raw.entries;
  if (raw?.entries && typeof raw.entries === 'object') return Object.values(raw.entries);
  if (raw && typeof raw === 'object') return Object.values(raw);
  return [];
}

async function getChatWorldbookName(targetWindow) {
  const helper = targetWindow?.TavernHelper;
  if (typeof helper?.getChatWorldbookName !== 'function') return '';
  try {
    return textOf(await helper.getChatWorldbookName('current'));
  } catch (_) {
    return '';
  }
}

export async function captureAnimaWorldbookEntries(targetWindow) {
  const worldbookName = await getChatWorldbookName(targetWindow);
  if (!worldbookName || typeof targetWindow?.TavernHelper?.getWorldbook !== 'function') return [];
  let raw = null;
  try {
    raw = await targetWindow.TavernHelper.getWorldbook(worldbookName);
  } catch (_) {
    return [];
  }
  return normalizeWorldbookEntries(raw)
    .map((entry) => ({ ...entry, content: String(entry?.content ?? '') }))
    .filter((entry) => Boolean(getAnimaEntryKind(entry)));
}

export function applyAnimaWorldbookOverrides(items, entries) {
  const overrides = new Map(
    (Array.isArray(entries) ? entries : [])
      .map((entry) => [getAnimaEntryKind(entry), entry])
      .filter(([kind]) => Boolean(kind)),
  );
  return (Array.isArray(items) ? items : []).map((item) => {
    const kind = getAnimaEntryKind(item) || textOf(item?.animaEntryKind);
    const override = kind ? overrides.get(kind) : null;
    if (!override) return item;
    return {
      ...item,
      animaEntryKind: kind,
      content: String(override.content ?? ''),
    };
  });
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isEmptyObject(value) {
  return isObject(value) && Object.keys(value).length === 0;
}

function getPathValue(value, path) {
  const segments = textOf(path).split('.').filter(Boolean);
  if (!segments.length) return value;
  let current = value;
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object' && !Array.isArray(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function serializeValue(value) {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch (_) {
    return String(value ?? '');
  }
}

export function readLatestAnimaStatus({ targetWindow, chat, targetIndex = null } = {}) {
  const messages = Array.isArray(chat) ? chat : [];
  const hasTargetIndex = targetIndex !== null && targetIndex !== undefined && Number.isInteger(Number(targetIndex));
  const rawStart = hasTargetIndex ? Number(targetIndex) : messages.length - 1;
  const start = Math.min(messages.length - 1, Math.max(0, rawStart));
  const getVariables = targetWindow?.TavernHelper?.getVariables;
  if (typeof getVariables !== 'function') return null;
  const latestIndex = [...messages].findLastIndex((message) => !message?.is_user && !message?.is_system);
  if (!hasTargetIndex) {
    try {
      const latestVariables = getVariables.call(targetWindow.TavernHelper, { type: 'message', message_id: 'latest' });
      const latestData = latestVariables?.anima_data;
      if (isObject(latestData) && !isEmptyObject(latestData)) {
        return { data: latestData, messageId: 'latest', messageIndex: latestIndex };
      }
    } catch (_) {}
  }
  for (let index = start; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.is_user || message?.is_system) continue;
    // TavernHelper's message scope uses the chat array index (the same id Anima uses
    // when it searches backwards through message variables), not a DOM/database uid.
    const messageId = index;
    let variables = null;
    try {
      variables = getVariables.call(targetWindow.TavernHelper, { type: 'message', message_id: messageId });
    } catch (_) {
      continue;
    }
    const data = variables?.anima_data;
    if (!isObject(data) || isEmptyObject(data)) continue;
    return { data, messageId, messageIndex: index };
  }
  return null;
}

export function replaceAnimaStatusMacros(content, status) {
  const text = String(content ?? '');
  if (status === null || status === undefined) return text;
  const resolve = (path = '') => {
    const value = getPathValue(status, path);
    return value === undefined ? '' : serializeValue(value);
  };
  let result = text.replace(
    /\{\{\s*(status|anima_data|ANIMA_STATUS|ANIMA_BASE_STATUS)(?:::([^}]*))?\s*\}\}/gi,
    (_match, _name, path) => resolve(path),
  );
  result = result.replace(
    /\{\{\s*(format_message_variable|get_message_variable)\s*::\s*anima_data(?:\.([^}]*))?\s*\}\}/gi,
    (_match, _name, path) => resolve(path),
  );
  return result;
}
