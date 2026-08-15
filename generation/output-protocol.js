const OUTPUT_PROTOCOL_SYSTEM_PROMPT = `【固定输出协议｜最高优先级】

本协议仅规定完整回复的外层封装，不改变任何既定内容、流程、格式与表达。

完整回复必须且只能是一个可被标准 JSON 解析器解析的对象：

{
"thinking": "全部思考、推演及其既定格式",
"output": "思考部分结束后的全部实际输出及其既定格式"
}

规则：

1. 外层封装先于任何内部内容形成；任何内容生成时都必须已经位于对应 JSON 字符串中。
2. 顶层只能包含 "thinking"、"output" 两个字段，顺序固定，且均为字符串。
3. 一切思考、分析、推演、"<thinking>" 内容及其相关格式，均置于 "thinking" 字符串内部。
4. 思考部分结束后应输出的一切内容均置于 "output" 字符串内部。
5. 所有既定的开头、结尾、标签、换行、顺序、数量与特殊格式，均在所属字段内部执行，不得突破 JSON 外层。
6. 若思考部分规定以特定字符或标签开始，该要求作用于 "thinking" 字符串的开头；其余输出的格式要求作用于 "output" 字符串内部。
7. 按标准 JSON 语法转义双引号、反斜杠、换行等字符，确保整个对象可直接解析。
8. 任一字段无内容时使用空字符串，不得省略。

禁止：

- 在 JSON 前后输出任何字符；
- 在 "{" 之前先输出思考、标签或其他内容；
- 在 JSON 外重复任何已写入字段的内容；
- 使用代码围栏包裹 JSON；
- 添加第三个字段、额外对象、数组外壳或元数据；
- 混淆 "thinking" 与 "output" 的内容归属。

完整回复的第一个字符必须是 "{"，最后一个字符必须是 "}"。`;

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
