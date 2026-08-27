import assert from 'node:assert/strict';
import test from 'node:test';

import {
  replaceTavernHelperMacrosInMessages,
  replaceTavernHelperVariableMacros,
} from './tavern-helper-macros.js';

function createVariables(overrides = {}) {
  return {
    message: { value: 'message-value' },
    chat: { value: 'chat-value' },
    character: { value: 'character-value' },
    preset: { value: 'preset-value' },
    global: { value: 'global-value' },
    ...overrides,
  };
}

test('resolves get macros for all five official variable scopes', () => {
  const variables = createVariables();
  const result = replaceTavernHelperVariableMacros(
    '{{get_message_variable::value}}|{{get_chat_variable::value}}|{{get_character_variable::value}}|{{get_preset_variable::value}}|{{get_global_variable::value}}',
    { getVariables: ({ type }) => variables[type], messageId: 7 },
  );

  assert.equal(result.content, 'message-value|chat-value|character-value|preset-value|global-value');
  assert.deepEqual(result.warnings, []);
});

test('serializes non-string get values as one-line JSON and recursively removes dollar keys', () => {
  const result = replaceTavernHelperVariableMacros('{{get_chat_variable::stat_data}}', {
    getVariables: () => ({
      stat_data: {
        hp: 10,
        $meta: 'hidden',
        nested: { mp: 4, $internal: true },
        rows: [{ name: 'A', $cache: 1 }],
      },
    }),
  });

  assert.equal(result.content, '{"hp":10,"nested":{"mp":4},"rows":[{"name":"A"}]}');
});

test('supports dotted and bracket paths, unescapes the path, and returns null for missing paths', () => {
  const result = replaceTavernHelperVariableMacros(
    '{{get_global_variable::profile.stats[0].hp}}|{{get_global_variable::labels.a&amp;b}}|{{get_global_variable::missing.path}}',
    {
      getVariables: () => ({
        profile: { stats: [{ hp: 18 }] },
        labels: { 'a&b': 'matched' },
      }),
    },
  );

  assert.equal(result.content, '18|matched|null');
});

test('formats non-string values as YAML and aligns continuation lines to the macro column', () => {
  const yamlCalls = [];
  const result = replaceTavernHelperVariableMacros('状态: {{format_message_variable::stat_data}}', {
    getVariables: () => ({ stat_data: { hp: 10, mp: 4 } }),
    yamlLibrary: {
      stringify(value, options) {
        yamlCalls.push({ value, options });
        return 'hp: 10\nmp: 4\n';
      },
    },
    messageId: 3,
  });

  assert.equal(result.content, '状态: hp: 10\n    mp: 4');
  assert.deepEqual(yamlCalls, [{ value: { hp: 10, mp: 4 }, options: { blockQuote: 'literal' } }]);
});

test('inserts string format values directly and resolves multiple macros', () => {
  const result = replaceTavernHelperVariableMacros(
    '{{format_chat_variable::first}} / {{format_chat_variable::second}} / {{get_chat_variable::count}}',
    { getVariables: () => ({ first: 'A', second: 'B', count: 2 }) },
  );

  assert.equal(result.content, 'A / B / 2');
});

test('matches TavernHelper recursive indentation for multiple formatted values on one line', () => {
  const result = replaceTavernHelperVariableMacros(
    'X {{format_chat_variable::left}} Y {{format_chat_variable::right}}',
    {
      getVariables: () => ({ left: { id: 'left' }, right: { id: 'right' } }),
      yamlLibrary: {
        stringify(value) {
          return value.id === 'left' ? 'L1\nL2\n' : 'R1\nR2\n';
        },
      },
    },
  );

  assert.equal(result.content, 'X L1\n  L2 Y R1\n            R2');
});

test('uses the source message id and otherwise falls back to the latest message with variables', () => {
  const calls = [];
  const getVariables = (options) => {
    calls.push(options);
    return { value: String(options.message_id) };
  };
  const chat = [
    { variables: [{ old: true }], swipe_id: 0 },
    { variables: [] },
    { variables: [{ latest: true }], swipe_id: 0 },
    { mes: 'no variables here' },
  ];

  const direct = replaceTavernHelperVariableMacros('{{get_message_variable::value}}', {
    getVariables,
    chat,
    messageId: 1,
  });
  const fallback = replaceTavernHelperVariableMacros('{{get_message_variable::value}}', {
    getVariables,
    chat,
  });

  assert.equal(direct.content, '1');
  assert.equal(fallback.content, '2');
  assert.deepEqual(calls, [
    { type: 'message', message_id: 1 },
    { type: 'message', message_id: 2 },
  ]);
});

test('preserves macros and reports warnings when TavernHelper is unavailable or a scope read fails', () => {
  const unavailable = replaceTavernHelperVariableMacros('{{get_chat_variable::value}}', {});
  assert.equal(unavailable.content, '{{get_chat_variable::value}}');
  assert.deepEqual(unavailable.warnings.map((warning) => warning.code), ['helper-unavailable']);

  const partial = replaceTavernHelperVariableMacros(
    '{{get_chat_variable::value}}|{{get_global_variable::value}}',
    {
      getVariables: ({ type }) => {
        if (type === 'chat') throw new Error('chat failed');
        return { value: 'ok' };
      },
    },
  );
  assert.equal(partial.content, '{{get_chat_variable::value}}|ok');
  assert.deepEqual(partial.warnings.map((warning) => warning.code), ['variable-read-failed']);
});

test('resolves a complete message list with per-floor message ids and deduplicated warnings', () => {
  const messages = [
    { role: 'assistant', content: '{{get_message_variable::value}}', sourceMessageIndex: 0 },
    { role: 'system', content: '{{get_message_variable::value}}' },
    { role: 'system', content: '{{get_chat_variable::value}} {{get_chat_variable::again}}' },
  ];
  const chat = [
    { variables: [{ value: 'floor-0' }], swipe_id: 0 },
    { variables: [{ value: 'latest' }], swipe_id: 0 },
  ];

  const warnings = replaceTavernHelperMacrosInMessages(messages, {
    chat,
    getVariables: ({ type, message_id }) => {
      if (type === 'chat') throw new Error('chat scope unavailable');
      return { value: message_id === 0 ? 'floor-0' : 'latest' };
    },
  });

  assert.deepEqual(messages.map((message) => message.content), [
    'floor-0',
    'latest',
    '{{get_chat_variable::value}} {{get_chat_variable::again}}',
  ]);
  assert.deepEqual(warnings.map((warning) => warning.code), ['variable-read-failed']);
});
