import assert from 'node:assert/strict';
import { createPromptLog, createPromptLogViewModel, mergeConsecutiveSystemMessages } from '../generation/prompt-log.js';

const log = createPromptLog({
  apiUrl: 'https://example.com/v1/chat/completions',
  apiKey: 'secret-key-should-not-appear',
  model: 'test-model',
  maxTokens: 512,
  temperature: 0.6,
  messages: [
    { role: 'system', content: 'System prompt' },
    { role: 'user', content: 'Generate statusbar' },
  ],
  createdAt: '2026-07-22T00:00:00.000Z',
});

const parsed = JSON.parse(log);
assert.equal(parsed.createdAt, '2026-07-22T00:00:00.000Z');
assert.equal(parsed.summary.extensionVersion, '');
assert.equal(parsed.request.model, 'test-model');
assert.equal(parsed.request.messages.length, 2);
assert.equal(parsed.summary.messageCount, 2);
assert.equal(parsed.summary.characterCount, 'System promptGenerate statusbar'.length);
assert.ok(!log.includes('secret-key-should-not-appear'));

const diagnosticLog = JSON.parse(createPromptLog({
  extensionVersion: '0.3.38',
  messages: [
    { role: 'system', content: '# <user_info>提供User的角色设定\n<user_info>' },
    { role: 'system', content: '</user_info>' },
    { role: 'system', content: '<char_info>' },
    { role: 'system', content: '角色描述' },
    { role: 'system', content: '</char_info>' },
  ],
}));

assert.equal(diagnosticLog.summary.extensionVersion, '0.3.38');
assert.deepEqual(diagnosticLog.diagnostics.emptyBlocks, [
  { tag: 'user_info', startIndex: 0, endIndex: 1 },
]);

const runtimeDiagnosticLog = JSON.parse(createPromptLog({
  runtimeDiagnostics: {
    characterFields: {
      characterId: '0',
      descriptionLength: 24,
      personalityLength: 8,
      scenarioLength: 0,
    },
  },
  messages: [],
}));

assert.deepEqual(runtimeDiagnosticLog.diagnostics.characterFields, {
  characterId: '0',
  descriptionLength: 24,
  personalityLength: 8,
  scenarioLength: 0,
});

const mergedMessages = mergeConsecutiveSystemMessages([
  { role: 'system', content: 'A' },
  { role: 'system', content: 'B' },
  { role: 'assistant', content: 'Example answer' },
  { role: 'system', content: 'C' },
  { role: 'system', content: 'D' },
  { role: 'user', content: 'Task' },
  { role: 'system', content: 'E' },
]);

assert.deepEqual(mergedMessages, [
  { role: 'system', content: 'A\n\nB' },
  { role: 'assistant', content: 'Example answer' },
  { role: 'system', content: 'C\n\nD' },
  { role: 'user', content: 'Task' },
  { role: 'system', content: 'E' },
]);

const preservedMemoryMessages = mergeConsecutiveSystemMessages([
  { role: 'system', content: '柏宝书历史', preserveSystemMessage: true },
  { role: 'system', content: '普通系统内容' },
  { role: 'system', content: '柏宝书状态', preserveSystemMessage: true },
]);

assert.deepEqual(preservedMemoryMessages.map(({ role, content }) => ({ role, content })), [
  { role: 'system', content: '柏宝书历史' },
  { role: 'system', content: '普通系统内容' },
  { role: 'system', content: '柏宝书状态' },
]);

const mergedLog = JSON.parse(createPromptLog({
  messages: [
    { role: 'system', content: 'A' },
    { role: 'system', content: 'B' },
    { role: 'assistant', content: 'Example answer' },
  ],
  compressSystemMessages: true,
}));

assert.equal(mergedLog.summary.messageCount, 2);
assert.equal(mergedLog.summary.compressedSystemMessages, true);
assert.equal(mergedLog.request.messages[0].content, 'A\n\nB');

const viewModel = createPromptLogViewModel(JSON.stringify({
  summary: { messageCount: 2, characterCount: 21, extensionVersion: '0.3.58' },
  request: {
    model: 'test-model',
    messages: [
      { role: 'system', content: 'System prompt' },
      { role: 'assistant', content: 'Assistant prompt' },
    ],
  },
}));

assert.equal(viewModel.summary.messageCount, 2);
assert.deepEqual(viewModel.messages.map((message) => message.role), ['system', 'assistant']);
assert.deepEqual(viewModel.messages.map((message) => message.content), ['System prompt', 'Assistant prompt']);
assert.ok(viewModel.messages[0].tokenEstimate > 0);
assert.equal(viewModel.messages[0].tokenEstimateLabel, `约 ${viewModel.messages[0].tokenEstimate} tokens`);
