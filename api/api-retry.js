export const DEFAULT_API_RETRY_COUNT = 0;
export const MAX_API_RETRY_COUNT = 10;
export const API_RETRY_BASE_DELAY_MS = 1000;
export const API_RETRY_MAX_DELAY_MS = 8000;

const RETRYABLE_HTTP_STATUSES = new Set([
  408, 425, 429, 500, 502, 503, 504,
  520, 521, 522, 523, 524,
]);

const PERMANENT_HTTP_STATUSES = new Set([
  400, 401, 402, 403, 404, 405, 406, 407, 409, 410, 411, 412,
  413, 414, 415, 416, 417, 418, 421, 422, 423, 424, 426, 428, 431,
  451,
]);

const PERMANENT_ERROR_PATTERN = /(?:invalid\s+(?:api\s+)?key|unauthori[sz]ed|forbidden|regionerror|explicit\s+opt(?:-|\s)?in|model\s+(?:not\s+found|does\s+not\s+exist)|context\s+(?:length|window)|too\s+many\s+tokens|quota|insufficient\s+(?:quota|balance)|invalid\s+(?:request|model|url|configuration)|malformed\s+(?:url|request))/i;
const TRANSIENT_ERROR_PATTERN = /(?:socket\s+hang\s+up|econnreset|econnrefused|etimedout|eai_again|epipe|premature\s+close|unexpected\s+(?:eof|end)|failed\s+to\s+fetch|networkerror|network\s+error|fetch\s+failed|connection\s+(?:reset|closed|aborted|timed\s+out)|service\s+unavailable|bad\s+gateway|gateway\s+timeout|temporarily\s+unavailable|try\s+again|rate\s+limit|too\s+many\s+requests|empty\s+response|no\s+(?:content|response)|返回为空|响应为空|连接(?:被重置|中断|超时)|网络错误|暂时不可用|请求超时)/i;

function collectErrorText(error) {
  const values = [];
  const visited = new Set();
  let current = error;

  for (let depth = 0; current && depth < 5 && !visited.has(current); depth += 1) {
    visited.add(current);
    if (typeof current === 'string') {
      values.push(current);
      break;
    }
    if (typeof current.message === 'string') values.push(current.message);
    if (typeof current.name === 'string') values.push(current.name);
    if (typeof current.code === 'string') values.push(current.code);
    if (typeof current.type === 'string') values.push(current.type);
    if (typeof current.error === 'string') values.push(current.error);
    if (current.error && current.error !== current) current = current.error;
    else if (current.cause && current.cause !== current) current = current.cause;
    else break;
  }

  return values.join(' ');
}

function getNumericStatus(error) {
  const candidates = [
    error?.status,
    error?.statusCode,
    error?.responseStatus,
    error?.httpStatus,
    error?.response?.status,
    error?.response?.statusCode,
    error?.cause?.status,
    error?.cause?.statusCode,
  ];
  for (const value of candidates) {
    const status = Number(value);
    if (Number.isInteger(status) && status >= 100 && status <= 599) return status;
  }
  const statusMatch = collectErrorText(error).match(/\b(?:status(?:\s+code)?|http(?:\s+status)?|code)\s*[:=]?\s*(\d{3})\b/i);
  if (statusMatch) {
    const status = Number(statusMatch[1]);
    if (status >= 100 && status <= 599) return status;
  }
  return null;
}

function getRetryAfterMs(error) {
  const direct = Number(error?.retryAfterMs);
  if (Number.isFinite(direct) && direct >= 0) return direct;

  const seconds = Number(error?.retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

  const headerValue = typeof error?.response?.headers?.get === 'function'
    ? error.response.headers.get('retry-after')
    : error?.response?.headers?.['retry-after'] ?? error?.response?.headers?.['Retry-After'];
  if (headerValue == null) return null;

  const numericSeconds = Number(headerValue);
  if (Number.isFinite(numericSeconds) && numericSeconds >= 0) return numericSeconds * 1000;

  const dateMs = Date.parse(String(headerValue));
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
  return null;
}

export function normalizeApiRetryCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return DEFAULT_API_RETRY_COUNT;
  return Math.min(MAX_API_RETRY_COUNT, Math.floor(number));
}

export function getApiRetryDelayMs(retryNumber, {
  baseDelayMs = API_RETRY_BASE_DELAY_MS,
  maxDelayMs = API_RETRY_MAX_DELAY_MS,
  retryAfterMs = null,
} = {}) {
  const serverDelay = Number(retryAfterMs);
  if (retryAfterMs != null && Number.isFinite(serverDelay) && serverDelay >= 0) return serverDelay;

  const number = Math.max(1, Math.floor(Number(retryNumber) || 1));
  const base = Math.max(0, Number(baseDelayMs) || 0);
  const maximum = Math.max(base, Number(maxDelayMs) || 0);
  return Math.min(maximum, base * (2 ** (number - 1)));
}

export function classifyApiError(error) {
  if (error?.name === 'AbortError' || error?.code === 'ABORT_ERR') {
    return { retryable: false, reason: 'aborted', status: getNumericStatus(error), retryAfterMs: null };
  }

  const status = getNumericStatus(error);
  const text = collectErrorText(error);
  if (status != null && PERMANENT_HTTP_STATUSES.has(status)) {
    return { retryable: false, reason: `http-${status}`, status, retryAfterMs: null };
  }
  if (PERMANENT_ERROR_PATTERN.test(text)) {
    return { retryable: false, reason: 'permanent-error', status, retryAfterMs: null };
  }
  if (status != null && RETRYABLE_HTTP_STATUSES.has(status)) {
    return { retryable: true, reason: `http-${status}`, status, retryAfterMs: getRetryAfterMs(error) };
  }
  if (TRANSIENT_ERROR_PATTERN.test(text)) {
    return { retryable: true, reason: 'transient-error', status, retryAfterMs: getRetryAfterMs(error) };
  }
  return { retryable: false, reason: 'unknown-error', status, retryAfterMs: null };
}

function createAbortError() {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

function sleepWithAbort(delayMs, signal) {
  if (!delayMs) return Promise.resolve();
  if (signal?.aborted) return Promise.reject(createAbortError());

  return new Promise((resolve, reject) => {
    let timer = null;
    const onAbort = () => {
      if (timer != null) clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(createAbortError());
    };
    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function withApiRetries(operation, {
  maxRetries = DEFAULT_API_RETRY_COUNT,
  signal,
  onRetry,
  sleep = sleepWithAbort,
} = {}) {
  const retryLimit = normalizeApiRetryCount(maxRetries);
  let attempt = 0;

  while (true) {
    if (signal?.aborted) throw createAbortError();
    try {
      return await operation({ attempt, retryNumber: attempt });
    } catch (error) {
      const classification = classifyApiError(error);
      if (attempt >= retryLimit || !classification.retryable) throw error;

      const retryNumber = attempt + 1;
      const delayMs = getApiRetryDelayMs(retryNumber, { retryAfterMs: classification.retryAfterMs });
      await onRetry?.({
        attempt,
        retryNumber,
        delayMs,
        error,
        classification,
      });
      await sleep(delayMs, signal);
      attempt = retryNumber;
    }
  }
}
