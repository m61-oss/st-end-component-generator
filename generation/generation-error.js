function textOf(value) {
  return String(value ?? '').trim();
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
    message: textOf(error?.message || error) || '发生未知错误。',
    createdAt,
  };
}
