function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const STATUS_PLACEHOLDER_TAG = '<StatusPlaceHolderImpl/>';

export function containsStatusPlaceholder(value) {
  return String(value || '').includes(STATUS_PLACEHOLDER_TAG);
}

export function normalizeStatusPlaceholder(value, force = false) {
  const source = String(value || '');
  if (!force && !containsStatusPlaceholder(source)) return source;
  const withoutPlaceholders = source
    .replace(/[ \t]*<StatusPlaceHolderImpl\/>[ \t]*(?:\r?\n|$)/g, '')
    .replace(/<StatusPlaceHolderImpl\/>/g, '')
    .trim();
  return withoutPlaceholders ? `${withoutPlaceholders}\n${STATUS_PLACEHOLDER_TAG}` : STATUS_PLACEHOLDER_TAG;
}

function replaceMatchingTagBlocks(messageText, statusbarText) {
  let nextMessage = String(messageText || '');
  let replaced = false;
  const unmatchedBlocks = [];
  const tagBlockPattern = /<([^\s<>/]+)(?:\s[^>]*)?>[\s\S]*?<\/\1\s*>/g;
  const blocks = String(statusbarText || '').match(tagBlockPattern) || [];

  for (const block of blocks) {
    const tagName = /^<([^\s<>/]+)/.exec(block)?.[1];
    if (!tagName) continue;
    const escapedTagName = escapeRegex(tagName);
    const patternSource = `<${escapedTagName}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${escapedTagName}\\s*>`;
    const existingPattern = new RegExp(patternSource, 'i');
    if (existingPattern.test(nextMessage)) {
      nextMessage = nextMessage.replace(new RegExp(patternSource, 'gi'), block);
      replaced = true;
    } else {
      unmatchedBlocks.push(block);
    }
  }

  if (!replaced) return null;
  const remainder = String(statusbarText || '').replace(tagBlockPattern, '').trim();
  return [nextMessage.trim(), remainder, ...unmatchedBlocks].filter(Boolean).join('\n\n').trim();
}

export function injectStatusbarText(
  messageText,
  statusbarText,
  { mode = 'append', normalizeStatusPlaceholder: shouldNormalize = false, rawStatusbarText = statusbarText } = {},
) {
  const cleanText = String(statusbarText || '').trim();
  const markerFound = shouldNormalize && [messageText, statusbarText, rawStatusbarText].some(containsStatusPlaceholder);
  if (!cleanText) {
    const original = String(messageText || '');
    return markerFound ? normalizeStatusPlaceholder(original, true) : original;
  }
  let result = '';
  if (mode === 'replace') {
    const replaced = replaceMatchingTagBlocks(messageText, cleanText);
    if (replaced) result = replaced;
  }
  if (!result) result = `${String(messageText || '')}\n\n${cleanText}`.trim();
  return markerFound ? normalizeStatusPlaceholder(result, true) : result;
}
