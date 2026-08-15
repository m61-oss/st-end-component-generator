const ANCHOR_POSITIONS = new Set(['start', 'end', 'before', 'after']);

function isBoundaryPosition(position) {
  return position === 'start' || position === 'end';
}

function isInsertionItem(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (!ANCHOR_POSITIONS.has(value.position)) return false;
  if (typeof value.content !== 'string' || !value.content.trim()) return false;
  if (isBoundaryPosition(value.position)) return true;
  return typeof value.anchor === 'string' && value.anchor.trim().length > 0;
}

function findOccurrences(text, anchor) {
  const matches = [];
  let from = 0;
  while (from <= text.length - anchor.length) {
    const index = text.indexOf(anchor, from);
    if (index < 0) break;
    matches.push(index);
    from = index + Math.max(anchor.length, 1);
  }
  return matches;
}

function normalizeAnchorCharacter(character) {
  return character
    .replace(/[“”＂]/g, '"')
    .replace(/[‘’＇]/g, "'")
    .replace(/[、，]/g, ',')
    .replace(/[。．]/g, '.')
    .replace(/[！]/g, '!')
    .replace(/[？]/g, '?')
    .replace(/[：]/g, ':')
    .replace(/[；]/g, ';')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[【]/g, '[')
    .replace(/[】]/g, ']')
    .replace(/[「『]/g, '[')
    .replace(/[」』]/g, ']');
}

function isPunctuation(character) {
  return /[\p{P}\p{S}]/u.test(character);
}

/**
 * Normalize a string while retaining the source range represented by every
 * normalized UTF-16 code unit. This lets a tolerant match still insert into
 * the original message without changing its text.
 */
function normalizeForAnchorSearch(value, { stripPunctuation = false, stripWhitespace = false } = {}) {
  const source = String(value ?? '');
  let normalized = '';
  const starts = [];
  const ends = [];
  let pendingWhitespace = null;

  const append = (part, start, end) => {
    for (let index = 0; index < part.length; index += 1) {
      normalized += part[index];
      starts.push(start);
      ends.push(end);
    }
  };

  for (let index = 0; index < source.length;) {
    const character = String.fromCodePoint(source.codePointAt(index));
    const width = character.length;
    const end = index + width;
    index = end;

    if (/\s/u.test(character)) {
      if (stripWhitespace) continue;
      if (pendingWhitespace === null) pendingWhitespace = { start: index - width, end };
      continue;
    }

    if (pendingWhitespace !== null) {
      if (normalized.length > 0) append(' ', pendingWhitespace.start, pendingWhitespace.end);
      pendingWhitespace = null;
    }

    const mapped = normalizeAnchorCharacter(character).normalize('NFKC');
    if (stripPunctuation && isPunctuation(mapped)) continue;
    append(mapped, end - width, end);
  }

  return { text: normalized, starts, ends };
}

function findNormalizedOccurrences(text, anchor, options) {
  const source = normalizeForAnchorSearch(text, options);
  const needle = normalizeForAnchorSearch(anchor, options).text;
  if (!needle) return [];
  const occurrences = findOccurrences(source.text, needle);
  return occurrences.map((normalizedStart) => {
    const normalizedEnd = normalizedStart + needle.length;
    const start = source.starts[normalizedStart];
    const end = source.ends[normalizedEnd - 1];
    return { start, end, matchedText: text.slice(start, end) };
  });
}

function resolveAnchor(text, anchor) {
  const exact = findOccurrences(text, anchor);
  if (exact.length === 1) {
    const start = exact[0];
    return {
      status: 'matched',
      matchType: 'exact',
      start,
      end: start + anchor.length,
      matchedText: text.slice(start, start + anchor.length),
    };
  }
  if (exact.length > 1) return { status: 'multiple', occurrences: exact.length };

  const loose = findNormalizedOccurrences(text, anchor);
  if (loose.length === 1) return { status: 'matched', matchType: 'loose', ...loose[0] };
  if (loose.length > 1) return { status: 'multiple', occurrences: loose.length };

  const fuzzy = findNormalizedOccurrences(text, anchor, { stripPunctuation: true, stripWhitespace: true });
  if (fuzzy.length === 1) return { status: 'matched', matchType: 'fuzzy', ...fuzzy[0] };
  if (fuzzy.length > 1) return { status: 'multiple', occurrences: fuzzy.length };
  return { status: 'missing' };
}

export function locateAnchorInsertions(messageText, items) {
  const text = typeof messageText === 'string' ? messageText : '';
  const matches = [];
  const skipped = [];

  (Array.isArray(items) ? items : []).forEach((item, itemIndex) => {
    if (!isInsertionItem(item)) {
      skipped.push({ item, itemIndex, status: 'invalid', reason: '格式无效' });
      return;
    }

    if (item.position === 'start' || item.position === 'end') {
      const offset = item.position === 'start' ? 0 : text.length;
      matches.push({
        item,
        itemIndex,
        start: offset,
        end: offset,
        offset,
        status: 'matched',
        matchType: 'boundary',
        matchedText: '',
      });
      return;
    }

    const resolved = resolveAnchor(text, item.anchor);
    if (resolved.status !== 'matched') {
      skipped.push({
        item,
        itemIndex,
        status: resolved.status,
        reason: resolved.status === 'multiple' ? '锚点不唯一' : '未找到唯一锚点',
        occurrences: resolved.occurrences || 0,
      });
      return;
    }

    matches.push({
      item,
      itemIndex,
      start: resolved.start,
      end: resolved.end,
      offset: item.position === 'before' ? resolved.start : resolved.end,
      status: resolved.status,
      matchType: resolved.matchType,
      matchedText: resolved.matchedText,
    });
  });

  return { matches, skipped };
}

function detectNewline(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function stripOuterNewlines(value) {
  return value.replace(/^(?:\r?\n)+/, '').replace(/(?:\r?\n)+$/, '');
}

function insertOnOwnLine(text, offset, content, newline) {
  const left = text.slice(0, offset);
  const right = text.slice(offset);
  const body = stripOuterNewlines(String(content ?? ''));
  const prefix = left.length === 0 || left.endsWith(newline) ? '' : newline;
  const suffix = right.length === 0 || right.startsWith(newline) ? '' : newline;
  return `${left}${prefix}${body}${suffix}${right}`;
}

/**
 * Apply resolved anchor insertions from right to left so earlier offsets do
 * not drift after a later component is inserted. Every component is placed
 * on its own line; existing blank-line spacing around the target is kept.
 */
export function applyAnchorInsertions(messageText, items) {
  const text = typeof messageText === 'string' ? messageText : '';
  const located = locateAnchorInsertions(text, items);
  const newline = detectNewline(text);
  const ordered = [...located.matches].sort(
    (a, b) => b.offset - a.offset || b.itemIndex - a.itemIndex,
  );
  let result = text;
  const applied = [];

  for (const match of ordered) {
    result = insertOnOwnLine(result, match.offset, match.item.content, newline);
    applied.push(match);
  }

  applied.reverse();
  return { text: result, applied, skipped: located.skipped };
}

export function getAnchorMatchContext(messageText, match, radius = 72) {
  const text = typeof messageText === 'string' ? messageText : '';
  if (!match || match.matchType === 'boundary') {
    return match?.item?.position === 'start' ? '整条消息开头' : '整条消息末尾';
  }
  const start = Math.max(0, Number(match.start) - radius);
  const end = Math.min(text.length, Number(match.end) + radius);
  const before = text.slice(start, Number(match.start));
  const matched = text.slice(Number(match.start), Number(match.end));
  const after = text.slice(Number(match.end), end);
  return `${start > 0 ? '…' : ''}${before}【${matched}】${after}${end < text.length ? '…' : ''}`;
}

export { isInsertionItem };
