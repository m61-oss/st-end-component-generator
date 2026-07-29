import assert from 'node:assert/strict';
import {
  ApiParameterValidationError,
  buildApiRequestParts,
  parseApiAdditionalParameters,
  parseApiNumericSettings,
} from '../api-request-parameters.js';

const yamlParser = {
  parse(source) {
    if (source === 'broken') {
      const error = new Error('Unexpected scalar');
      error.linePos = [{ line: 3, col: 5 }];
      throw error;
    }
    return JSON.parse(source);
  },
};

assert.deepEqual(
  parseApiNumericSettings({ maxTokens: '65535', temperature: '1' }),
  { maxTokens: 65535, temperature: 1 },
);
assert.deepEqual(
  parseApiNumericSettings({ maxTokens: '1', temperature: '0' }),
  { maxTokens: 1, temperature: 0 },
  'temperature zero must not be replaced by a fallback',
);
assert.throws(
  () => parseApiNumericSettings({ maxTokens: '12.5', temperature: '1' }),
  (error) => error instanceof ApiParameterValidationError && error.field === '最大 Token',
);
assert.throws(
  () => parseApiNumericSettings({ maxTokens: '10', temperature: 'NaN' }),
  (error) => error instanceof ApiParameterValidationError && error.field === '温度',
);

assert.deepEqual(parseApiAdditionalParameters({
  additionalBodyYaml: '{"top_k":20}',
  excludedBodyYaml: '["frequency_penalty"]',
  additionalHeadersYaml: '{"X-Test":"yes"}',
}, yamlParser), {
  additionalBody: { top_k: 20 },
  excludedBodyKeys: ['frequency_penalty'],
  additionalHeaders: { 'X-Test': 'yes' },
});

assert.deepEqual(parseApiAdditionalParameters({
  additionalBodyYaml: '[{"top_k":20},{"temperature":0.4}]',
  excludedBodyYaml: '{"frequency_penalty":true,"presence_penalty":true}',
  additionalHeadersYaml: '[{"X-First":"one"},{"X-Second":"two"}]',
}, yamlParser), {
  additionalBody: { top_k: 20, temperature: 0.4 },
  excludedBodyKeys: ['frequency_penalty', 'presence_penalty'],
  additionalHeaders: { 'X-First': 'one', 'X-Second': 'two' },
});

assert.deepEqual(parseApiAdditionalParameters({
  additionalBodyYaml: '',
  excludedBodyYaml: '"max_tokens"',
  additionalHeadersYaml: ' ',
}, yamlParser), {
  additionalBody: {},
  excludedBodyKeys: ['max_tokens'],
  additionalHeaders: {},
});

assert.throws(
  () => parseApiAdditionalParameters({
    additionalBodyYaml: 'broken',
    excludedBodyYaml: '',
    additionalHeadersYaml: '',
  }, yamlParser),
  (error) => error instanceof ApiParameterValidationError
    && error.field === '追加请求体参数'
    && error.line === 3
    && error.column === 5,
);

assert.throws(
  () => parseApiAdditionalParameters({
    additionalBodyYaml: '["not-an-object"]',
    excludedBodyYaml: '',
    additionalHeadersYaml: '',
  }, yamlParser),
  (error) => error instanceof ApiParameterValidationError
    && error.field === '追加请求体参数',
);

assert.deepEqual(buildApiRequestParts(
  { model: 'base', max_tokens: 65535, temperature: 1 },
  { 'Content-Type': 'application/json', Authorization: 'Bearer base' },
  {
    additionalBody: { temperature: 0.4, top_k: 20 },
    excludedBodyKeys: ['max_tokens'],
    additionalHeaders: { Authorization: 'Bearer custom', 'X-Test': 'yes' },
  },
), {
  body: { model: 'base', temperature: 0.4, top_k: 20 },
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer custom',
    'X-Test': 'yes',
  },
});

console.log('api-request-parameters tests passed');
