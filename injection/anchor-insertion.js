function isInsertionItem(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      (value.position === 'before' || value.position === 'after') &&
      typeof value.anchor === 'string' &&
      value.anchor.trim().length > 0 &&
      typeof value.content === 'string' &&
      value.content.trim().length > 0,
  );
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

export function locateAnchorInsertions(messageText, items) {
  const text = typeof messageText === 'string' ? messageText : '';
  const matches = [];
  const skipped = [];

  (Array.isArray(items) ? items : []).forEach((item, itemIndex) => {
    if (!isInsertionItem(item)) {
      skipped.push({ item, itemIndex, reason: '格式无效' });
      return;
    }

    const occurrences = findOccurrences(text, item.anchor);
    if (occurrences.length === 0) {
      skipped.push({ item, itemIndex, reason: '未找到唯一锚点' });
      return;
    }
    if (occurrences.length !== 1) {
      skipped.push({ item, itemIndex, reason: '锚点不唯一' });
      return;
    }

    const start = occurrences[0];
    matches.push({
      item,
      itemIndex,
      start,
      end: start + item.anchor.length,
      offset: item.position === 'before' ? start : start + item.anchor.length,
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
  const body = stripOuterNewlines(content);
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
