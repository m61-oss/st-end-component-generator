const OUTPUT_PROTOCOL_SYSTEM_PROMPT = `【固定输出协议｜最高优先级】
无论任务要求输出何种内容，完整回复必须且只能是一个可被标准 JSON 解析器解析的对象，格式固定为：
{
"thinking": "任务要求的全部思考过程",
"output": "任务要求交付的全部最终内容"
}

严格遵守：
1. 顶层只能存在 "thinking"、"output" 两个字段，且顺序固定；"output" 必须为最后一个字段。
2. 两个字段必须始终存在且均为字符串：
   - "thinking"：仅放置任务要求的思考、分析或推演过程。
   - "output"：仅放置最终交付内容。
3. 任务要求的 Markdown、HTML/XML 标签、换行、特殊符号、内容顺序与数量，均保留在对应字符串中，不得因此改变 JSON 外层结构。
4. 严格按照 JSON 语法转义字符串中的双引号、反斜杠、换行等字符，确保整个回复可直接解析。
5. 即使某字段没有内容，也必须输出为空字符串，不得省略字段。

禁止：
- 在 JSON 对象前后输出任何字符；
- 使用 Markdown / "json" 代码围栏；
- 添加其他字段、对象外壳、数组或元数据；
- 混淆 "thinking" 与 "output" 的内容；
- 在 "output" 后追加任何字段或文本。

输出前确认：回复以 "{" 开始、以 "}" 结束，顶层仅含上述两个字段，并可被标准 JSON 解析器直接解析。`;

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
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (!Object.prototype.hasOwnProperty.call(value, 'output')) return null;
    return {
      mode: 'json',
      thinking: normalizeField(value.thinking),
      content: normalizeField(value.output),
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
  const outputProperty = findLastTopLevelProperty(candidate, 'output');
  if (!outputProperty) return null;
  const thinkingProperty = findLastTopLevelProperty(candidate, 'thinking');
  let thinking = '';
  if (thinkingProperty) thinking = readLooseValue(candidate, thinkingProperty.valueStart).value;
  const content = readLooseValue(candidate, outputProperty.valueStart);
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
