import assert from 'node:assert/strict';
import { createGenerationErrorRecord, isGenerationResponseError, markGenerationResponseError } from '../generation-error.js';

const record = createGenerationErrorRecord('生成', new Error('API 请求失败：401 Unauthorized'), '2026-07-28T12:00:00.000Z');

assert.deepEqual(record, {
  action: '生成',
  message: 'API 请求失败：401 Unauthorized',
  createdAt: '2026-07-28T12:00:00.000Z',
});

assert.equal(createGenerationErrorRecord('注入', null, '2026-07-28T12:00:00.000Z').message, '发生未知错误。');

const plainError = new Error('网络连接失败');
assert.equal(isGenerationResponseError(plainError), false);
assert.equal(isGenerationResponseError(markGenerationResponseError(plainError)), true);
