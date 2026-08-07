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

function cloneAnimaEntry(entry) {
  return {
    ...entry,
    content: String(entry?.content ?? ''),
  };
}

/**
 * Merge a newly captured Anima worldbook snapshot without allowing an empty
 * post-generation cleanup to erase the last usable memory content.
 */
export function mergeAnimaWorldbookSnapshots(previous, incoming) {
  const merged = (Array.isArray(previous) ? previous : [])
    .filter((entry) => Boolean(getAnimaEntryKind(entry)))
    .map(cloneAnimaEntry);
  const indexByKind = new Map(
    merged.map((entry, index) => [getAnimaEntryKind(entry), index]),
  );

  for (const rawEntry of Array.isArray(incoming) ? incoming : []) {
    const entry = cloneAnimaEntry(rawEntry);
    const kind = getAnimaEntryKind(entry);
    if (!kind) continue;
    const existingIndex = indexByKind.get(kind);
    if (existingIndex === undefined) {
      indexByKind.set(kind, merged.length);
      merged.push(entry);
      continue;
    }
    if (textOf(entry.content)) merged[existingIndex] = entry;
  }

  return merged;
}

/**
 * Apply the two independent Anima source switches without creating entries.
 * The status entry is a macro placeholder and therefore belongs to the
 * status-variable switch, not the ordinary history/knowledge switch.
 */
export function filterAnimaWorldbookEntries(entries, {
  includeWorldbook = false,
  includeStatus = false,
} = {}) {
  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    const kind = getAnimaEntryKind(entry);
    if (kind === 'status') return includeStatus;
    return includeWorldbook && Boolean(kind);
  });
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

function isAssistantMessage(message) {
  return Boolean(message)
    && message.is_user !== true
    && message.is_system !== true
    && String(message.role || '').toLowerCase() !== 'user';
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

function getYamlLibrary(explicitLibrary = null) {
  const candidates = [
    explicitLibrary,
    globalThis?.jsyaml,
    globalThis?.window?.jsyaml,
    globalThis?.parent?.jsyaml,
    globalThis?.top?.jsyaml,
  ];
  return candidates.find((candidate) => candidate && typeof candidate.dump === 'function') || null;
}

function yamlKey(value) {
  const key = String(value ?? '');
  return /^[\w\u3400-\u4dbf\u4e00-\u9fff][\w\u3400-\u4dbf\u4e00-\u9fff ._/-]*$/u.test(key)
    ? key
    : JSON.stringify(key);
}

function yamlScalar(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  const text = String(value ?? '');
  if (!text) return "''";
  if (/^[\w\u3400-\u4dbf\u4e00-\u9fff ._/@+-]+$/u.test(text)
    && !/^(?:true|false|null|yes|no|on|off|[-+]?\d+(?:\.\d+)?)$/i.test(text)) {
    return text;
  }
  return JSON.stringify(text);
}

function fallbackYaml(value, indent = 0) {
  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) {
    if (!value.length) return `${pad}[]`;
    return value.map((item) => {
      if (item !== null && typeof item === 'object') {
        const nested = fallbackYaml(item, indent + 2);
        return `${pad}-\n${nested}`;
      }
      return `${pad}- ${yamlScalar(item)}`;
    }).join('\n');
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length) return `${pad}{}`;
    return entries.map(([key, child]) => {
      if (child !== null && typeof child === 'object') {
        return `${pad}${yamlKey(key)}:\n${fallbackYaml(child, indent + 2)}`;
      }
      return `${pad}${yamlKey(key)}: ${yamlScalar(child)}`;
    }).join('\n');
  }
  return `${pad}${yamlScalar(value)}`;
}

function serializeYaml(value, yamlLibrary = null) {
  const parser = getYamlLibrary(yamlLibrary);
  if (parser) {
    try {
      return String(parser.dump(value, { lineWidth: -1, noRefs: true })).trimEnd();
    } catch (_) {}
  }
  return fallbackYaml(value);
}

function serializeValue(value, format = 'json', yamlLibrary = null) {
  if (typeof value === 'string') return value;
  if (format === 'yaml') return serializeYaml(value, yamlLibrary);
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
  const latestMessageIndex = messages.length - 1;
  if (!hasTargetIndex) {
    try {
      const latestVariables = getVariables.call(targetWindow.TavernHelper, { type: 'message', message_id: 'latest' });
      const latestData = latestVariables?.anima_data;
      if (isAssistantMessage(messages[latestMessageIndex]) && isObject(latestData) && !isEmptyObject(latestData)) {
        return { data: latestData, messageId: 'latest', messageIndex: latestMessageIndex };
      }
    } catch (_) {}
  }
  for (let index = start; index >= 0; index -= 1) {
    const message = messages[index];
    if (!isAssistantMessage(message)) continue;
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

export function replaceAnimaStatusMacros(content, status, { yamlLibrary = null } = {}) {
  const text = String(content ?? '');
  if (status === null || status === undefined) return text;
  const resolve = (path = '', format = 'yaml') => {
    const value = getPathValue(status, path);
    return value === undefined ? '' : serializeValue(value, format, yamlLibrary);
  };
  let result = text.replace(
    /\{\{\s*(status|anima_data|ANIMA_STATUS|ANIMA_BASE_STATUS)(?:::([^}]*))?\s*\}\}/gi,
    (_match, _name, path) => resolve(path, 'yaml'),
  );
  result = result.replace(
    /\{\{\s*(format_message_variable|format_message_variables|get_message_variable|get_message_variables)\s*::\s*anima_data(?:\.([^}]*))?\s*\}\}/gi,
    (_match, operation, path) => resolve(path, operation.toLowerCase().startsWith('format') ? 'yaml' : 'json'),
  );
  return result;
}
