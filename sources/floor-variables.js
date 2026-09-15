const textOf = (value) => String(value ?? '');

export const FLOOR_VARIABLE_NAMESPACE = 'st_end_component_generator';
export const EMPTY_FLOOR_VARIABLE_RULES = Object.freeze({ tagNames: '', regexText: '' });

function normalizeRules(value) {
  return {
    tagNames: textOf(value?.tagNames),
    regexText: textOf(value?.regexText),
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseTagNames(value) {
  return [...new Set(textOf(value).split(',').map((item) => item.trim()).filter(Boolean))];
}

function parseRegexLine(line) {
  const source = line.trim();
  if (!source) return null;
  const literal = source.match(/^\/(.*)\/([a-z]*)$/);
  if (!literal) return { source, flags: 'gms' };
  const flags = [...new Set(`${literal[2]}gms`.split(''))].join('');
  return { source: literal[1], flags };
}

function collectMatches(source, regex, ranges) {
  regex.lastIndex = 0;
  let match;
  while ((match = regex.exec(source)) !== null) {
    if (match[0]) ranges.push({ start: match.index, end: match.index + match[0].length });
    if (!match[0]) regex.lastIndex += 1;
  }
}

function mergeRanges(ranges) {
  const sorted = ranges
    .filter((range) => range.end > range.start)
    .sort((left, right) => left.start - right.start || right.end - left.end);
  const merged = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

export function extractFloorVariableSnapshot(content, ruleSets = []) {
  const source = textOf(content);
  const rules = (Array.isArray(ruleSets) ? ruleSets : [ruleSets]).map(normalizeRules);
  const ranges = [];
  const errors = [];

  for (const ruleset of rules) {
    for (const tagName of parseTagNames(ruleset.tagNames)) {
      const name = escapeRegExp(tagName);
      const regex = new RegExp(`<${name}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${name}\\s*>`, 'g');
      collectMatches(source, regex, ranges);
    }
    ruleset.regexText.split(/\r?\n/).forEach((line, index) => {
      const parsed = parseRegexLine(line);
      if (!parsed) return;
      try {
        collectMatches(source, new RegExp(parsed.source, parsed.flags), ranges);
      } catch (error) {
        errors.push({ line: index + 1, expression: line, message: String(error?.message || error) });
      }
    });
  }

  const merged = mergeRanges(ranges);
  return {
    text: merged.map(({ start, end }) => source.slice(start, end)).join('\n\n'),
    ranges: merged,
    errors,
  };
}

function getNamespace(variables) {
  const value = variables?.[FLOOR_VARIABLE_NAMESPACE];
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function requireHelperMethod(helper, method) {
  const fn = helper?.[method];
  if (typeof fn !== 'function') throw new Error('酒馆助手变量接口不可用');
  return fn.bind(helper);
}

export function readFloorVariableRules(helper, scope) {
  const getVariables = requireHelperMethod(helper, 'getVariables');
  const variables = getVariables({ type: scope });
  return normalizeRules(getNamespace(variables).floorVariableRules);
}

export function writeFloorVariableRules(helper, scope, rules) {
  const getVariables = requireHelperMethod(helper, 'getVariables');
  const insertOrAssignVariables = requireHelperMethod(helper, 'insertOrAssignVariables');
  const namespace = getNamespace(getVariables({ type: scope }));
  const normalized = normalizeRules(rules);
  insertOrAssignVariables({
    [FLOOR_VARIABLE_NAMESPACE]: { ...namespace, floorVariableRules: normalized },
  }, { type: scope });
  return normalized;
}

export function readAllFloorVariableRules(helper) {
  return ['global', 'character', 'chat'].map((scope) => {
    try {
      return readFloorVariableRules(helper, scope);
    } catch (_) {
      return { ...EMPTY_FLOOR_VARIABLE_RULES };
    }
  });
}

export function readFloorVariableSnapshot(helper, messageIndex) {
  const getVariables = requireHelperMethod(helper, 'getVariables');
  const variables = getVariables({ type: 'message', message_id: Number(messageIndex) });
  return textOf(getNamespace(variables).floorVariableSnapshot);
}

export function writeFloorVariableSnapshot(helper, messageIndex, snapshot) {
  const getVariables = requireHelperMethod(helper, 'getVariables');
  const insertOrAssignVariables = requireHelperMethod(helper, 'insertOrAssignVariables');
  const option = { type: 'message', message_id: Number(messageIndex) };
  const namespace = getNamespace(getVariables(option));
  const text = textOf(snapshot);
  insertOrAssignVariables({
    [FLOOR_VARIABLE_NAMESPACE]: { ...namespace, floorVariableSnapshot: text },
  }, option);
  return text;
}

function isOrdinaryAssistant(message) {
  if (!message || message.is_user === true || message.is_system === true) return false;
  return String(message.role || '').toLowerCase() !== 'user'
    && String(message.role || '').toLowerCase() !== 'system';
}

export function findLatestAssistantMessageIndex(chat, beforeIndex = null) {
  const messages = Array.isArray(chat) ? chat : [];
  const upperBound = Number.isInteger(beforeIndex) ? Math.min(beforeIndex - 1, messages.length - 1) : messages.length - 1;
  for (let index = upperBound; index >= 0; index -= 1) {
    if (isOrdinaryAssistant(messages[index])) return index;
  }
  return null;
}

function findLastOrdinaryMessageIndex(chat) {
  const messages = Array.isArray(chat) ? chat : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.is_system !== true) return index;
  }
  return null;
}

export function resolveBodySnapshotSourceIndex(chat, generationType = '') {
  const latestAssistant = findLatestAssistantMessageIndex(chat);
  if (latestAssistant === null) return null;
  const reroll = ['swipe', 'regenerate'].includes(String(generationType || '').toLowerCase());
  if (!reroll || findLastOrdinaryMessageIndex(chat) !== latestAssistant) return latestAssistant;
  return findLatestAssistantMessageIndex(chat, latestAssistant);
}

function findChatHistoryAssistantIndex(promptMessages, promptManagerMessages) {
  if (typeof promptManagerMessages?.flatten !== 'function') return -1;
  let flattened;
  try {
    flattened = promptManagerMessages.flatten();
  } catch (_) {
    return -1;
  }
  const outgoing = (Array.isArray(flattened) ? flattened : [])
    .filter((message) => message?.content || message?.tool_calls);
  if (outgoing.length !== promptMessages.length) return -1;
  const matchesCurrentPrompt = outgoing.every((message, index) => (
    String(message?.role || '').toLowerCase() === String(promptMessages[index]?.role || '').toLowerCase()
    && message?.content === promptMessages[index]?.content
  ));
  if (!matchesCurrentPrompt) return -1;
  for (let index = outgoing.length - 1; index >= 0; index -= 1) {
    const message = outgoing[index];
    if (String(message?.role || '').toLowerCase() !== 'assistant') continue;
    if (/^chatHistory-\d+$/.test(String(message?.identifier || ''))) return index;
  }
  return -1;
}

export function insertBodyFloorVariableSnapshot(promptMessages, content, promptManagerMessages = null) {
  const text = textOf(content);
  if (!text.trim() || !Array.isArray(promptMessages)) return false;
  const chatHistoryIndex = findChatHistoryAssistantIndex(promptMessages, promptManagerMessages);
  let latestUserIndex = -1;
  if (chatHistoryIndex < 0) {
    for (let index = promptMessages.length - 1; index >= 0; index -= 1) {
      if (String(promptMessages[index]?.role || '').toLowerCase() === 'user') {
        latestUserIndex = index;
        break;
      }
    }
  }
  let sourceIndex = chatHistoryIndex;
  const searchStart = latestUserIndex >= 0 ? latestUserIndex - 1 : promptMessages.length - 1;
  if (sourceIndex < 0) {
    for (let index = searchStart; index >= 0; index -= 1) {
      if (String(promptMessages[index]?.role || '').toLowerCase() === 'assistant') {
        sourceIndex = index;
        break;
      }
    }
  }
  if (sourceIndex < 0) return false;
  const message = { role: 'system', content: text };
  Object.defineProperty(message, 'stEsgFloorVariableSnapshot', { value: true, enumerable: false });
  promptMessages.splice(sourceIndex + 1, 0, message);
  return true;
}
