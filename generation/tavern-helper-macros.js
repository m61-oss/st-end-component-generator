const VARIABLE_SCOPE_PATTERN = '(message|chat|character|preset|global)';
const GET_VARIABLE_REGEX = new RegExp(`\\{\\{get_${VARIABLE_SCOPE_PATTERN}_variable::(.*?)\\}\\}`, 'gi');
const FORMAT_VARIABLE_REGEX = new RegExp(`^(.*)\\{\\{format_${VARIABLE_SCOPE_PATTERN}_variable::(.*?)\\}\\}`, 'gim');
const FORMAT_VARIABLE_PREFIX_REGEX = new RegExp(`^(.*)\\{\\{format_${VARIABLE_SCOPE_PATTERN}_variable::(.*?)\\}\\}`, 'im');
const ANY_VARIABLE_REGEX = new RegExp(`\\{\\{(?:get|format)_${VARIABLE_SCOPE_PATTERN}_variable::.*?\\}\\}`, 'i');

const RE_PROP_NAME = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;
const RE_ESCAPE_CHAR = /\\(\\)?/g;

function unescapeHtml(value) {
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
  };
  return String(value ?? '').replace(/&(amp|lt|gt|quot|#39);/g, (entity) => entities[entity] ?? entity);
}

function toPath(path) {
  const result = [];
  const source = String(path ?? '');
  if (source.startsWith('.')) result.push('');
  source.replace(RE_PROP_NAME, (match, number, quote, subString) => {
    result.push(quote ? subString.replace(RE_ESCAPE_CHAR, '$1') : (number ?? match));
    return match;
  });
  return result.length ? result : [source];
}

function getPathValue(source, path, lodashLike) {
  const unescapedPath = typeof lodashLike?.unescape === 'function'
    ? lodashLike.unescape(String(path ?? ''))
    : unescapeHtml(path);
  if (typeof lodashLike?.get === 'function') return lodashLike.get(source, unescapedPath, null);
  let value = source;
  for (const key of toPath(unescapedPath)) {
    if (value === null || value === undefined || !Object.prototype.hasOwnProperty.call(Object(value), key)) return null;
    value = value[key];
  }
  return value;
}

function omitDollarKeys(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  if (Array.isArray(value)) {
    const result = [];
    seen.set(value, result);
    value.forEach((item) => result.push(omitDollarKeys(item, seen)));
    return result;
  }
  const result = {};
  seen.set(value, result);
  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith('$')) continue;
    result[key] = omitDollarKeys(child, seen);
  }
  return result;
}

function isObject(value) {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}

function getLatestVariableMessageId(chat) {
  const messages = Array.isArray(chat) ? chat : [];
  return messages.findLastIndex((message) => isObject(message?.variables?.[message?.swipe_id ?? 0]));
}

function serializeYaml(value, yamlLibrary) {
  if (typeof yamlLibrary?.stringify === 'function') {
    return String(yamlLibrary.stringify(value, { blockQuote: 'literal' })).trimEnd();
  }
  if (typeof yamlLibrary?.dump === 'function') {
    return String(yamlLibrary.dump(value, { noRefs: true, lineWidth: -1, noCompatMode: true })).trimEnd();
  }
  return null;
}

function createWarningCollector() {
  const warnings = [];
  const seen = new Set();
  return {
    warnings,
    add(code, scope = '', error = null) {
      const key = `${code}:${scope}`;
      if (seen.has(key)) return;
      seen.add(key);
      warnings.push({ code, scope, error });
    },
  };
}

export function replaceTavernHelperVariableMacros(content, {
  getVariables = null,
  yamlLibrary = null,
  lodashLike = null,
  chat = [],
  messageId = null,
  variableCache = null,
} = {}) {
  const source = String(content ?? '');
  const warningCollector = createWarningCollector();
  if (!ANY_VARIABLE_REGEX.test(source)) return { content: source, warnings: warningCollector.warnings };
  if (typeof getVariables !== 'function') {
    warningCollector.add('helper-unavailable');
    return { content: source, warnings: warningCollector.warnings };
  }

  const cache = variableCache instanceof Map ? variableCache : new Map();
  const readVariables = (scope) => {
    const resolvedMessageId = Number.isInteger(messageId) ? messageId : getLatestVariableMessageId(chat);
    const options = scope === 'message'
      ? { type: scope, message_id: resolvedMessageId }
      : { type: scope };
    const cacheKey = scope === 'message' ? `${scope}:${resolvedMessageId}` : scope;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    try {
      const result = { ok: true, value: getVariables(options) };
      cache.set(cacheKey, result);
      return result;
    } catch (error) {
      const result = { ok: false, value: null };
      cache.set(cacheKey, result);
      warningCollector.add('variable-read-failed', scope, error);
      return result;
    }
  };

  const resolveValue = (scope, path, format) => {
    const variables = readVariables(scope);
    if (!variables.ok) return { ok: false, value: '' };
    const value = omitDollarKeys(getPathValue(variables.value, path, lodashLike));
    if (typeof value === 'string') return { ok: true, value };
    if (!format) return { ok: true, value: JSON.stringify(value) };
    const yaml = serializeYaml(value, yamlLibrary);
    if (yaml === null) {
      warningCollector.add('yaml-unavailable', scope);
      return { ok: false, value: '' };
    }
    return { ok: true, value: yaml };
  };

  const withGetMacros = source.replace(GET_VARIABLE_REGEX, (macro, scope, path) => {
    const replacement = resolveValue(scope.toLowerCase(), path, false);
    return replacement.ok ? replacement.value : macro;
  });

  const applyFormatVariable = (prefix, scope, path, macro) => {
    const previous = prefix.match(FORMAT_VARIABLE_PREFIX_REGEX);
    if (previous) {
      const previousMacro = previous[0].slice(previous[1].length);
      prefix = applyFormatVariable(previous[1], previous[2], previous[3], previousMacro)
        + prefix.slice(previous[0].length);
    }
    const replacement = resolveValue(scope.toLowerCase(), path, true);
    if (!replacement.ok) return prefix + macro;
    const indentation = ' '.repeat(prefix.length);
    return prefix + String(replacement.value).replaceAll('\n', `\n${indentation}`);
  };

  const output = withGetMacros.replace(FORMAT_VARIABLE_REGEX, (substring, prefix, scope, path) => (
    applyFormatVariable(prefix, scope, path, substring.slice(prefix.length))
  ));

  return { content: output, warnings: warningCollector.warnings };
}

export function replaceTavernHelperMacrosInMessages(messages, options = {}) {
  const warnings = [];
  const seenWarnings = new Set();
  const variableCache = new Map();
  for (const message of Array.isArray(messages) ? messages : []) {
    const result = replaceTavernHelperVariableMacros(message?.content, {
      ...options,
      messageId: Number.isInteger(message?.sourceMessageIndex) ? message.sourceMessageIndex : null,
      variableCache,
    });
    message.content = result.content;
    for (const warning of result.warnings) {
      const key = `${warning.code}:${warning.scope}`;
      if (seenWarnings.has(key)) continue;
      seenWarnings.add(key);
      warnings.push(warning);
    }
  }
  return warnings;
}
