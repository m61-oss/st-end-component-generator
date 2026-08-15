const OUTPUT_PROTOCOL_SYSTEM_PROMPT = `【织幕固定输出协议｜必须遵守】
本协议只规定回复的外层格式，不改变任务要求的内容、文风、步骤和标签。
你的完整回复必须是一个 JSON 对象，且只包含以下两个字段，并严格按此顺序输出：

{
  "thinking": "执行任务要求的全部思考步骤",
  "content": "思考结束后需要交付的全部最终内容"
}

规则：
1. thinking 必须包含任务要求的思维链步骤。
2. content 必须是最后一个字段，包含所有委托要求的内容。
3. 不得把思维链写入 content。
4. JSON 外不得输出解释、标题或代码围栏。
5. 即使某部分为空，也不得省略 thinking 或 content。`;

function normalizeText(value) {
  return value === null || value === undefined ? '' : String(value);
}

function normalizeField(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function stripOuterJsonFence(value) {
  const source = normalizeText(value).trim();
  const fenced = source.match(/^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```\s*$/i);
  if (fenced) return fenced[1].trim();
  if (/^```(?:json)?\s*\r?\n/i.test(source)) return source.replace(/^```(?:json)?\s*\r?\n/i, '').trim();
  return source;
}

function parseStrictEnvelope(candidate) {
  try {
    const value = JSON.parse(candidate);
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.prototype.hasOwnProperty.call(value, 'content')) return null;
    return {
      mode: 'json',
      thinking: normalizeField(value.thinking),
      content: normalizeField(value.content),
      complete: true,
    };
  } catch {
    return null;
  }
}

function readQuotedToken(source, start) {
  if (source[start] !== '"') return null;
  let escaped = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (character === '"') {
      const raw = source.slice(start, index + 1);
      try {
        return { value: JSON.parse(raw), end: index + 1, closed: true };
      } catch {
        return { value: raw.slice(1, -1), end: index + 1, closed: true };
      }
    }
  }
  return { value: source.slice(start + 1), end: source.length, closed: false };
}

function decodeQuotedFragment(fragment) {
  try {
    return JSON.parse(`"${fragment}"`);
  } catch {
    return fragment
      .replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
      .replace(/\\(["\\/bfnrt])/g, (_, code) => ({
        '"': '"',
        '\\': '\\',
        '/': '/',
        b: '\b',
        f: '\f',
        n: '\n',
        r: '\r',
        t: '\t',
      }[code] || code));
  }
}

function findLastTopLevelProperty(source, propertyName) {
  if (source[0] !== '{') return null;
  let depth = 0;
  let last = null;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      const token = readQuotedToken(source, index);
      if (!token) continue;
      if (depth === 1 && token.value === propertyName && token.closed) {
        let cursor = token.end;
        while (/\s/.test(source[cursor] || '')) cursor += 1;
        if (source[cursor] === ':') {
          cursor += 1;
          while (/\s/.test(source[cursor] || '')) cursor += 1;
          last = { valueStart: cursor };
        }
      }
      index = Math.max(index, token.end - 1);
      continue;
    }
    if (character === '{' || character === '[') depth += 1;
    else if (character === '}' || character === ']') depth = Math.max(0, depth - 1);
  }
  return last;
}

function readLooseValue(source, valueStart) {
  if (source[valueStart] === '"') {
    const token = readQuotedToken(source, valueStart);
    if (token.closed) {
      return { value: normalizeField(token.value), complete: false };
    }
    return { value: decodeQuotedFragment(token.value), complete: false };
  }

  let value = source.slice(valueStart).trim();
  value = value.replace(/\s*```\s*$/i, '').trim();
  value = value.replace(/\s*}\s*$/, '').trim();
  value = value.replace(/\s*,\s*$/, '').trim();
  return { value, complete: false };
}

function parseLooseEnvelope(candidate) {
  const contentProperty = findLastTopLevelProperty(candidate, 'content');
  if (!contentProperty) return null;
  const thinkingProperty = findLastTopLevelProperty(candidate, 'thinking');
  let thinking = '';
  if (thinkingProperty) thinking = readLooseValue(candidate, thinkingProperty.valueStart).value;
  const content = readLooseValue(candidate, contentProperty.valueStart);
  return {
    mode: 'loose-json',
    thinking,
    content: content.value,
    complete: content.complete,
  };
}

export { OUTPUT_PROTOCOL_SYSTEM_PROMPT };

export function buildOutputProtocolMessage() {
  return { role: 'system', content: OUTPUT_PROTOCOL_SYSTEM_PROMPT };
}

export function parseOutputProtocolResponse(rawText) {
  const original = normalizeText(rawText);
  if (!original.trim()) return null;
  const candidate = stripOuterJsonFence(original);
  return parseStrictEnvelope(candidate)
    || parseLooseEnvelope(candidate)
    || {
      mode: 'legacy',
      thinking: '',
      content: original,
      complete: false,
    };
}
