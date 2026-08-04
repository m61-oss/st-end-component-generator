function textOf(value) {
  return String(value ?? '').trim();
}

function collectErrorMessages(error, messages = [], visited = new Set()) {
  if (error === null || error === undefined) return messages;
  if (typeof error === 'string') {
    const message = textOf(error);
    if (message && !messages.includes(message)) messages.push(message);
    return messages;
  }
  if (typeof error !== 'object' || visited.has(error)) return messages;
  visited.add(error);

  if (typeof error.message === 'string') {
    const message = textOf(error.message);
    if (message && !messages.includes(message)) messages.push(message);
  }

  [error.cause, error.error, error.detail, error.reason, error.response?.data, error.response?.body, error.body]
    .forEach((nested) => collectErrorMessages(nested, messages, visited));
  return messages;
}

export function getGenerationErrorMessage(error) {
  const messages = collectErrorMessages(error);
  return messages.join('\n').slice(0, 4000) || '发生未知错误。';
}

const RESPONSE_ERROR = Symbol('generationResponseError');

export function markGenerationResponseError(error) {
  if (error && typeof error === 'object') error[RESPONSE_ERROR] = true;
  return error;
}

export function isGenerationResponseError(error) {
  return Boolean(error?.[RESPONSE_ERROR]);
}

export function createGenerationErrorRecord(action, error, createdAt = new Date().toISOString()) {
  return {
    action: textOf(action) || '操作',
    message: getGenerationErrorMessage(error),
    createdAt,
  };
}
