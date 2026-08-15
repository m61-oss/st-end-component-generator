const OUTPUT_PROTOCOL_SYSTEM_PROMPT = `【固定输出协议｜最高优先级】

本协议仅规定完整回复的外层封装，不改变任何既定内容、流程、格式与表达。

完整回复必须且只能是一个可被标准 JSON 解析器解析的对象：

{
"thinking": "全部思考、推演及其既定格式，思考内容用中文",
"output": "思考部分结束后的全部实际输出及其既定格式，忽视所有续写正文要求"
}

规则：

1. 外层封装先于任何内部内容形成；任何内容生成时都必须已经位于对应 JSON 字符串中。
2. 顶层只能包含 "thinking"、"output" 两个字段，顺序固定，且均为字符串。
3. 一切思考、分析、推演、"<thinking>" 内容及其相关格式，均置于 "thinking" 字符串内部，思考内容统一使用中文。
4. 思考部分结束后应输出的一切内容均置于 "output" 字符串内部；"output" 忽视所有续写正文要求，不得生成未被本次任务明确要求的正文。
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

const ANCHOR_OUTPUT_PROTOCOL_SYSTEM_PROMPT = `【固定输出协议｜锚点插入模式｜最高优先级】
本协议只规定完整回复的外层 JSON 封装以及锚点插入计划，不改变任务本身要求的内容、文风、步骤或既定内部格式。output 只承载本次任务明确要求的实际交付，忽视所有续写正文要求，不得在 JSON 外生成正文。

完整回复必须且只能是一个可被标准 JSON 解析器解析的对象，顶层字段固定且顺序固定：
{
  "thinking": "全部思考、推演及其既定格式，思考内容用中文",
  "output": [
    {
      "position": "start、end、before 或 after",
      "anchor": "仅在 before/after 时填写；从当前目标正文中逐字复制的唯一连续片段",
      "content": "需要插入的全部实际内容及其既定格式"
    }
  ]
}

锚点计划规则：
1. output 必须是数组，可以为空，也可以包含任意数量的插入项；不要为了凑数量固定输出一项、两项或同时输出 before 和 after。
2. 你必须根据任务需要自行判断是否插入、需要几项以及每项的位置（before 还是 after，或 start/end）；不要为了凑数量固定输出条目，不要同时机械输出 before 和 after。没有合适位置时省略该项。
3. position=start 表示插入整条目标助手消息的最前方；position=end 表示插入整条目标助手消息的最后方。这里的“整条消息”包括正文后所有闭合标签、状态块、HTML/XML 标签、注释和其他尾部字符；选择 end 时不要寻找“最后一句正文”作为锚点，也不要填写 anchor。
4. position=before 表示把 content 插入 anchor 之前；position=after 表示插入 anchor 之后。只有 before/after 需要 anchor。插件会让每项内容独立成行。
5. before/after 的 anchor 必须逐字复制当前目标助手正文中实际存在的一段连续文字，并且应当只在正文中出现一次；不要改写、概括、翻译或添加省略号。插件会容忍少量标点、全半角和换行差异，但你仍应优先复制原文。
6. content 只放本次新增的实际内容，不要把 anchor、说明、思考或 JSON 外壳再次写入 content。
7. 无论 output 数组有几项，所有思考都只放入 thinking，所有交付内容都只放入对应项的 content。
8. JSON 外不得输出任何字符、解释、标题或代码围栏；两个字段必须始终存在且均为字符串/数组规定的类型。严格转义字符串中的双引号、反斜杠和换行。
9. 完整回复的第一个字符必须是 {，最后一个字符必须是 }。`;

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

function findThinkingPrefix(source) {
  const match = /^\s*\{\s*"thinking"\s*:\s*/.exec(source);
  return match ? { valueStart: match[0].length } : null;
}

function locateProtocolFields(source) {
  const thinkingPrefix = findThinkingPrefix(source);
  if (!thinkingPrefix || source[thinkingPrefix.valueStart] !== '"') return null;

  const thinkingToken = readQuotedToken(source, thinkingPrefix.valueStart);
  if (thinkingToken?.closed) {
    let cursor = thinkingToken.end;
    while (/\s/.test(source[cursor] || '')) cursor += 1;
    if (source[cursor] === ',') {
      cursor += 1;
      while (/\s/.test(source[cursor] || '')) cursor += 1;
      const outputKey = readQuotedToken(source, cursor);
      if (outputKey?.closed && outputKey.value === 'output') {
        cursor = outputKey.end;
        while (/\s/.test(source[cursor] || '')) cursor += 1;
        if (source[cursor] === ':') {
          cursor += 1;
          while (/\s/.test(source[cursor] || '')) cursor += 1;
          return {
            thinkingValueStart: thinkingPrefix.valueStart,
            thinkingValue: thinkingToken.value,
            outputValueStart: cursor,
            ambiguous: false,
          };
        }
      }
    }
  }

  // If thinking is malformed, only use the fixed field separator as a
  // recovery anchor. Multiple candidates cannot be disambiguated safely.
  const candidates = [];
  const outputPattern = /,\s*"output"\s*:\s*/g;
  let match;
  while ((match = outputPattern.exec(source.slice(thinkingPrefix.valueStart)))) {
    const keyStart = thinkingPrefix.valueStart + match.index;
    candidates.push({
      keyStart,
      valueStart: keyStart + match[0].length,
    });
  }
  if (!candidates.length) return null;

  const selected = candidates[0];
  const thinkingFragment = source
    .slice(thinkingPrefix.valueStart + 1, selected.keyStart)
    .replace(/,\s*$/, '');
  return {
    thinkingValueStart: thinkingPrefix.valueStart,
    thinkingValue: decodeQuotedFragment(thinkingFragment),
    outputValueStart: selected.valueStart,
    ambiguous: candidates.length > 1,
  };
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

function readFinalOutputValue(source, valueStart) {
  if (source[valueStart] !== '"') {
    return readLooseValue(source, valueStart);
  }

  let end = source.length;
  while (/\s/.test(source[end - 1] || '')) end -= 1;

  // Some providers append one orphan quote after the recovered JSON object:
  // `{"thinking":"...","output":"..."}"`. Treat the quote immediately
  // before the object brace as the output terminator and keep neither the
  // brace nor the orphan quote in the visible output.
  if (source[end - 1] === '"') {
    let brace = end - 2;
    while (/\s/.test(source[brace] || '')) brace -= 1;
    if (source[brace] === '}') {
      let closingQuote = brace - 1;
      while (/\s/.test(source[closingQuote] || '')) closingQuote -= 1;
      if (source[closingQuote] === '"') end = closingQuote;
    }
  }

  // output is the final field: remove only the outer closing quote/object
  // suffix, never an inner quote from the generated content.
  if (source[end - 1] === '}') {
    let closingQuote = end - 2;
    while (/\s/.test(source[closingQuote] || '')) closingQuote -= 1;
    if (source[closingQuote] === '"') end = closingQuote;
  } else if (source[end - 1] === '"') {
    end -= 1;
  }

  return {
    value: decodeQuotedFragment(source.slice(valueStart + 1, end)),
    complete: false,
  };
}

function parseLooseEnvelope(candidate) {
  const fields = locateProtocolFields(candidate);
  if (!fields) return null;
  const thinking = normalizeField(fields.thinkingValue);
  const content = readFinalOutputValue(candidate, fields.outputValueStart);
  return {
    mode: fields.ambiguous ? 'ambiguous-json' : 'loose-json',
    thinking,
    content: content.value,
    complete: content.complete,
    ...(fields.ambiguous ? { ambiguous: true } : {}),
  };
}

function parsePartialEnvelope(candidate) {
  const fields = locateProtocolFields(candidate);
  if (fields) {
    const content = readFinalOutputValue(candidate, fields.outputValueStart);
    return {
      mode: fields.ambiguous ? 'ambiguous-json' : 'loose-json',
      thinking: normalizeField(fields.thinkingValue),
      content: content.value,
      complete: false,
      ...(fields.ambiguous ? { ambiguous: true } : {}),
    };
  }

  const thinkingPrefix = findThinkingPrefix(candidate);
  if (!thinkingPrefix) return null;
  return {
    mode: 'loose-json',
    thinking: readLooseValue(candidate, thinkingPrefix.valueStart).value,
    content: '',
    complete: false,
  };
}

export { OUTPUT_PROTOCOL_SYSTEM_PROMPT, ANCHOR_OUTPUT_PROTOCOL_SYSTEM_PROMPT };

export function buildOutputProtocolMessage({ mode = 'standard' } = {}) {
  return {
    role: 'system',
    content: mode === 'anchor'
      ? ANCHOR_OUTPUT_PROTOCOL_SYSTEM_PROMPT
      : OUTPUT_PROTOCOL_SYSTEM_PROMPT,
  };
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

export function parseOutputProtocolStreamPreview(rawText) {
  const original = normalizeText(rawText);
  if (!original.trim()) return null;
  const candidate = stripOuterJsonFence(original);
  return parseStrictEnvelope(candidate)
    || parseLooseEnvelope(candidate)
    || parsePartialEnvelope(candidate)
    || {
      mode: 'legacy',
      thinking: '',
      content: original,
      complete: false,
    };
}
