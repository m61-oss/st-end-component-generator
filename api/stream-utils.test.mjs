import assert from 'node:assert/strict';
import test from 'node:test';

import { readOpenAiStream } from './stream-utils.js';
import { withApiRetries } from './api-retry.js';

const encoder = new TextEncoder();

function createHeldOpenResponse(firstChunk) {
  let reads = 0;
  let cancelled = false;
  return {
    response: {
      body: {
        getReader() {
          return {
            read() {
              reads += 1;
              if (reads === 1) return Promise.resolve({ value: encoder.encode(firstChunk), done: false });
              return new Promise(() => {});
            },
            cancel() {
              cancelled = true;
              return Promise.resolve();
            },
          };
        },
      },
    },
    getReads: () => reads,
    wasCancelled: () => cancelled,
  };
}

test('finishes immediately at the SSE DONE marker even if the connection stays open', async () => {
  const held = createHeldOpenResponse('data: {"choices":[{"delta":{"content":"done"}}]}\n\ndata: [DONE]\n\n');
  const result = await Promise.race([
    readOpenAiStream(held.response),
    new Promise((_, reject) => setTimeout(() => reject(new Error('stream reader did not stop at DONE')), 80)),
  ]);

  assert.equal(result, 'done');
  assert.equal(held.getReads(), 1);
  assert.equal(held.wasCancelled(), true);
});

test('does not retry a completed stream when reader cleanup fails', async () => {
  let attempts = 0;
  const result = await withApiRetries(async () => {
    attempts += 1;
    const response = { body: { getReader: () => ({
      read: async () => ({ value: encoder.encode('data: {"choices":[{"delta":{"content":"complete"}}]}\n\ndata: [DONE]\n\n'), done: false }),
      cancel: async () => { throw new Error('network error'); },
    }) } };
    return readOpenAiStream(response);
  }, { maxRetries: 1, sleep: async () => {} });

  assert.equal(result, 'complete');
  assert.equal(attempts, 1);
});

test('emits CRLF-delimited SSE events before the connection closes', async () => {
  const held = createHeldOpenResponse('data: {"choices":[{"delta":{"content":"live"}}]}\r\n\r\n');
  const delta = await Promise.race([
    new Promise((resolve) => {
      void readOpenAiStream(held.response, (value) => resolve(value));
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('CRLF event was not emitted incrementally')), 80)),
  ]);

  assert.equal(delta, 'live');
});
