import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyApiError,
  getApiRetryDelayMs,
  normalizeApiRetryCount,
  withApiRetries,
} from '../api/api-retry.js';

test('retry count is normalized to a bounded non-negative integer', () => {
  assert.equal(normalizeApiRetryCount(undefined), 0);
  assert.equal(normalizeApiRetryCount(''), 0);
  assert.equal(normalizeApiRetryCount('-1'), 0);
  assert.equal(normalizeApiRetryCount('2.9'), 2);
  assert.equal(normalizeApiRetryCount('999'), 10);
});

test('transient HTTP and transport errors are retryable', () => {
  assert.equal(classifyApiError(Object.assign(new Error('service unavailable'), { status: 503 })).retryable, true);
  assert.equal(classifyApiError(Object.assign(new Error('rate limited'), { status: 429 })).retryable, true);
  assert.equal(classifyApiError(new Error('Got response status 502')).retryable, true);
  assert.equal(classifyApiError(new Error('socket hang up')).retryable, true);
  assert.equal(classifyApiError(new Error('Failed to fetch')).retryable, true);
  assert.equal(classifyApiError(new Error('API 返回为空。')).retryable, true);
});

test('permanent configuration and authorization errors are not retryable', () => {
  assert.equal(classifyApiError(Object.assign(new Error('invalid API key'), { status: 401 })).retryable, false);
  assert.equal(classifyApiError(Object.assign(new Error('forbidden'), { status: 403 })).retryable, false);
  assert.equal(classifyApiError(Object.assign(new Error('model not found'), { status: 404 })).retryable, false);
  assert.equal(classifyApiError(new Error('RegionError: explicit opt in required')).retryable, false);
  assert.equal(classifyApiError(Object.assign(new Error('aborted'), { name: 'AbortError' })).retryable, false);
});

test('retry delay uses exponential backoff and honors Retry-After', () => {
  assert.equal(getApiRetryDelayMs(1), 1000);
  assert.equal(getApiRetryDelayMs(2), 2000);
  assert.equal(getApiRetryDelayMs(3), 4000);
  assert.equal(getApiRetryDelayMs(4), 8000);
  assert.equal(getApiRetryDelayMs(5), 8000);
  assert.equal(getApiRetryDelayMs(1, { retryAfterMs: 3500 }), 3500);
});

test('withApiRetries reuses the operation and stops at the configured retry count', async () => {
  let attempts = 0;
  const retryEvents = [];
  const result = await withApiRetries(async () => {
    attempts += 1;
    if (attempts < 3) {
      throw Object.assign(new Error('temporary failure'), { status: 503 });
    }
    return 'ok';
  }, {
    maxRetries: 2,
    sleep: async () => {},
    onRetry: event => retryEvents.push(event),
  });

  assert.equal(result, 'ok');
  assert.equal(attempts, 3);
  assert.deepEqual(retryEvents.map(event => event.retryNumber), [1, 2]);
});

test('withApiRetries does not retry a permanent error', async () => {
  let attempts = 0;
  await assert.rejects(
    () => withApiRetries(async () => {
      attempts += 1;
      throw Object.assign(new Error('invalid API key'), { status: 401 });
    }, { maxRetries: 5, sleep: async () => {} }),
    /invalid API key/,
  );
  assert.equal(attempts, 1);
});
