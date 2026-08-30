import { isAnchorInsertionEnabled, locateAnchorInsertions } from './anchor-insertion.js';

const textOf = (value) => String(value ?? '');

function detectNewline(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function stripOuterNewlines(value) {
  return textOf(value).replace(/^(?:\r?\n)+/, '').replace(/(?:\r?\n)+$/, '');
}

function createRecord(taskId, targetIndex, beforeText, afterText, operations, mode) {
  return {
    taskId: String(taskId ?? ''),
    targetIndex: Number.isInteger(targetIndex) ? targetIndex : null,
    mode,
    beforeText,
    afterText,
    operations: operations.map((operation) => ({
      ...operation,
      beforeContext: afterText.slice(Math.max(0, operation.start - 48), operation.start),
      afterContext: afterText.slice(operation.start + operation.text.length, operation.start + operation.text.length + 48),
    })),
  };
}

function applyAppend(messageText, result) {
  const beforeText = textOf(messageText);
  const newline = detectNewline(beforeText);
  const body = stripOuterNewlines(result.output).trim();
  if (!body) throw new Error('No append content');
  const prefix = !beforeText || beforeText.endsWith(newline) ? '' : newline;
  const inserted = `${prefix}${body}`;
  const text = `${beforeText}${inserted}`;
  const operations = [{ start: beforeText.length, text: inserted }];
  return {
    text,
    record: createRecord(result.taskId, result.targetIndex, beforeText, text, operations, 'append'),
    appliedCount: 1,
    skippedCount: 0,
  };
}

function applyAnchors(messageText, result) {
  const beforeText = textOf(messageText);
  const items = Array.isArray(result.anchorItems) ? result.anchorItems : [];
  const located = locateAnchorInsertions(beforeText, items);
  const newline = detectNewline(beforeText);
  const ordered = located.matches
    .filter((match) => isAnchorInsertionEnabled(match.item))
    .sort((left, right) => right.offset - left.offset || right.itemIndex - left.itemIndex);
  let text = beforeText;
  const operations = [];
  for (const match of ordered) {
    const offset = Math.max(0, Math.min(Number(match.offset) || 0, text.length));
    const left = text.slice(0, offset);
    const right = text.slice(offset);
    const body = stripOuterNewlines(match.item.content);
    const prefix = left.length === 0 || left.endsWith(newline) ? '' : newline;
    const suffix = right.length === 0 || right.startsWith(newline) ? '' : newline;
    const inserted = `${prefix}${body}${suffix}`;
    operations.forEach((operation) => {
      if (operation.start >= offset) operation.start += inserted.length;
    });
    text = `${left}${inserted}${right}`;
    operations.push({ start: offset, text: inserted, itemIndex: match.itemIndex });
  }
  if (!operations.length) throw new Error('No anchor insertion could be applied');
  operations.sort((left, right) => left.start - right.start || left.itemIndex - right.itemIndex);
  const disabledCount = items.filter((item) => !isAnchorInsertionEnabled(item)).length;
  return {
    text,
    record: createRecord(result.taskId, result.targetIndex, beforeText, text, operations, 'anchor'),
    appliedCount: operations.length,
    skippedCount: located.skipped.length + disabledCount,
  };
}

export function applyMultiTaskInjection(messageText, result = {}) {
  return result.resultMode === 'anchor' || (Array.isArray(result.anchorItems) && result.anchorItems.length)
    ? applyAnchors(messageText, result)
    : applyAppend(messageText, result);
}

function findOccurrences(text, needle) {
  const result = [];
  let offset = 0;
  while (offset <= text.length - needle.length) {
    const index = text.indexOf(needle, offset);
    if (index < 0) break;
    result.push(index);
    offset = index + Math.max(1, needle.length);
  }
  return result;
}

function chooseOccurrence(text, operation) {
  const occurrences = findOccurrences(text, operation.text);
  if (!occurrences.length) return -1;
  const scored = occurrences.map((index) => {
    const before = text.slice(Math.max(0, index - operation.beforeContext.length), index);
    const afterStart = index + operation.text.length;
    const after = text.slice(afterStart, afterStart + operation.afterContext.length);
    let score = Math.abs(index - operation.start);
    if (operation.beforeContext && before.endsWith(operation.beforeContext)) score -= 100000;
    if (operation.afterContext && after.startsWith(operation.afterContext)) score -= 100000;
    return { index, score };
  });
  scored.sort((left, right) => left.score - right.score || right.index - left.index);
  return scored[0].index;
}

export function undoMultiTaskInjection(messageText, record = {}) {
  const original = textOf(messageText);
  const operations = Array.isArray(record.operations)
    ? record.operations.filter((item) => item && typeof item.text === 'string' && item.text.length)
    : [];
  if (!operations.length) return { ok: false, reason: 'invalid-record', text: original };
  let text = original;
  const ordered = [...operations].sort((left, right) => Number(right.start) - Number(left.start));
  for (const operation of ordered) {
    const index = chooseOccurrence(text, operation);
    if (index < 0) return { ok: false, reason: 'inserted-content-missing', text: original };
    text = `${text.slice(0, index)}${text.slice(index + operation.text.length)}`;
  }
  return { ok: true, reason: '', text };
}
