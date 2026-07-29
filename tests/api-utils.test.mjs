import assert from 'node:assert/strict';
import {
  extractModelIds,
  normalizeChatCompletionsUrl,
  normalizeModelsUrl,
} from '../api/api-utils.js';

assert.equal(normalizeChatCompletionsUrl('https://api.example.com/v1'), 'https://api.example.com/v1/chat/completions');
assert.equal(normalizeChatCompletionsUrl('https://api.example.com/v1/'), 'https://api.example.com/v1/chat/completions');
assert.equal(normalizeChatCompletionsUrl('https://api.example.com/v1/chat/completions'), 'https://api.example.com/v1/chat/completions');

assert.equal(normalizeModelsUrl('https://api.example.com/v1'), 'https://api.example.com/v1/models');
assert.equal(normalizeModelsUrl('https://api.example.com/v1/'), 'https://api.example.com/v1/models');
assert.equal(normalizeModelsUrl('https://api.example.com/v1/chat/completions'), 'https://api.example.com/v1/models');
assert.equal(normalizeModelsUrl(''), '');

assert.deepEqual(extractModelIds({
  data: [
    { id: 'gpt-4.1-mini' },
    { id: 'gpt-4o-mini' },
    { id: '' },
    { id: 'gpt-4o-mini' },
  ],
}), ['gpt-4.1-mini', 'gpt-4o-mini']);

assert.deepEqual(extractModelIds([
  { id: 'deepseek-chat' },
  'manual-model',
]), ['deepseek-chat', 'manual-model']);

assert.deepEqual(extractModelIds({
  models: [
    { name: 'gemini-2.5-pro' },
    { model: 'gemini-2.5-flash' },
  ],
}), ['gemini-2.5-pro', 'gemini-2.5-flash']);

assert.deepEqual(extractModelIds({
  data: {
    models: [
      { id: 'custom-model' },
    ],
  },
}), ['custom-model']);
