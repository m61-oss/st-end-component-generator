function asText(value) {
  return typeof value === 'string' ? value : '';
}

function stripJsonFence(value) {
  const text = asText(value).trim();
  const match = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : text;
}

function decodeLooseString(value) {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value
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

function parseLooseAnchorOutput(source) {
  const outputMatch = /"output"\s*:\s*\[/i.exec(source);
  if (!outputMatch) return null;

  const thinkingStart = /"thinking"\s*:\s*"/i.exec(source);
  const thinkingEnd = source.indexOf('"output"', thinkingStart ? thinkingStart.index : 0);
  const thinking = thinkingStart && thinkingEnd > thinkingStart.index
    ? decodeLooseString(source.slice(thinkingStart.index + thinkingStart[0].length, thinkingEnd).replace(/"\s*,\s*$/, '').replace(/\s*,\s*$/, ''))
    : '';
  const body = source.slice(outputMatch.index + outputMatch[0].length);
  const itemPattern = /\{\s*"position"\s*:\s*"(start|end|before|after)"\s*,\s*(?:"anchor"\s*:\s*"([\s\S]*?)"\s*,\s*)?"content"\s*:\s*"([\s\S]*?)"\s*(?=\}|,\s*\{|$)/gi;
  const items = [];
  const completedItemStarts = new Set();
  let match;
  while ((match = itemPattern.exec(body))) {
    completedItemStarts.add(match.index);
    const item = normalizeAnchorInsertionItem({
      position: match[1],
      anchor: match[2] === undefined ? undefined : decodeLooseString(match[2]),
      content: decodeLooseString(match[3]),
    });
    if (item) items.push(item);
  }

  const itemStartPattern = /\{\s*"position"\s*:\s*"(?:start|end|before|after)"/gi;
  let trailingItemStart = -1;
  while ((match = itemStartPattern.exec(body))) trailingItemStart = match.index;
  if (trailingItemStart >= 0 && !completedItemStarts.has(trailingItemStart)) {
    const partialPattern = /^\{\s*"position"\s*:\s*"(start|end|before|after)"\s*,\s*(?:"anchor"\s*:\s*"([\s\S]*?)"\s*,\s*)?"content"\s*:\s*"([\s\S]*)$/i;
    const partial = partialPattern.exec(body.slice(trailingItemStart));
    const item = partial && normalizeAnchorInsertionItem({
      position: partial[1],
      anchor: partial[2] === undefined ? undefined : decodeLooseString(partial[2]),
      content: decodeLooseString(partial[3]),
    });
    if (item) items.push(item);
  }
  if (!items.length) return null;
  return {
    mode: 'anchor-loose-json',
    thinking,
    items,
    complete: false,
    warnings: [],
  };
}

/**
 * Validate an item from the variable-length anchor insertion plan.
 * Anchor source text is intentionally not trimmed: the locator must be able
 * to match the exact text copied from the current assistant message.
 */
export function isAnchorInsertionItem(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      (value.position === 'start' || value.position === 'end' || value.position === 'before' || value.position === 'after') &&
      typeof value.content === 'string' &&
      value.content.trim().length > 0 &&
      ((value.position === 'start' || value.position === 'end')
        || (typeof value.anchor === 'string' && value.anchor.trim().length > 0)),
  );
}

export function normalizeAnchorInsertionItem(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const position = asText(value.position).trim().toLowerCase();
  const normalized = {
    position,
    content: asText(value.content),
  };
  if (position === 'before' || position === 'after') normalized.anchor = asText(value.anchor);

  return isAnchorInsertionItem(normalized) ? normalized : null;
}

/**
 * Parse the strict anchor-output protocol:
 * { "thinking": "...", "output": [{ position, anchor, content }] }
 *
 * Invalid plan entries are skipped individually so one malformed item does
 * not discard all usable insertions. A non-object/non-array output is not an
 * anchor response and returns null, allowing the legacy parser to handle it.
 */
export function parseAnchorOutput(rawText) {
  const source = stripJsonFence(rawText);
  if (!source || !source.startsWith('{')) return null;

  let payload;
  try {
    payload = JSON.parse(source);
  } catch {
    return parseLooseAnchorOutput(source);
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  if (typeof payload.thinking !== 'string' || !Array.isArray(payload.output)) return null;

  const warnings = [];
  const items = [];
  payload.output.forEach((candidate, index) => {
    const item = normalizeAnchorInsertionItem(candidate);
    if (item) {
      items.push(item);
    } else {
      warnings.push(`第${index + 1}项锚点格式无效，已跳过`);
    }
  });

  return {
    mode: 'anchor-json',
    thinking: payload.thinking,
    items,
    complete: true,
    warnings,
  };
}
