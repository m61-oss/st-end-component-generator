import assert from 'node:assert/strict';
import test from 'node:test';

import { cleanChatHistory, selectAndCleanChatHistory } from './history-cleanup.js';
import { getWorldbookScanText } from '../sources/worldbook-scan.js';

test('applies host prompt regexes by message role and full-history depth', () => {
  const chat = [
    { is_user: true, mes: 'user' },
    { is_system: true, mes: 'system' },
    { is_user: false, mes: 'assistant' },
  ];
  const calls = [];
  const cleaned = cleanChatHistory(chat, {
    followTavernRegex: true,
    regexPlacement: { USER_INPUT: 1, AI_OUTPUT: 2 },
    getRegexedString: (text, placement, options) => {
      calls.push({ text, placement, options });
      return `${text}-clean`;
    },
  });

  assert.deepEqual(calls, [
    { text: 'user', placement: 1, options: { isPrompt: true, depth: 1 } },
    { text: 'assistant', placement: 2, options: { isPrompt: true, depth: 0 } },
  ]);
  assert.equal(cleaned[0].mes, 'user-clean');
  assert.equal(cleaned[1].mes, 'system');
  assert.equal(cleaned[2].mes, 'assistant-clean');
  assert.equal(chat[0].mes, 'user');
});

test('uses plugin cleanup rules when following Tavern regex is disabled', () => {
  const cleaned = cleanChatHistory([{ is_user: false, mes: 'before <secret>x</secret> after' }], {
    historyCleanupRules: [{ rule: 'secret', keep: 0 }],
    getRegexedString: () => assert.fail('host regex must not run'),
  });
  assert.equal(cleaned[0].mes, 'before  after');
});

test('skips disabled history cleanup rules and keeps legacy rules enabled', () => {
  const cleaned = cleanChatHistory([{ is_user: false, mes: '<secret>one</secret><legacy>two</legacy>' }], {
    historyCleanupRules: [
      { rule: 'secret', keep: 0, enabled: false },
      { rule: 'legacy', keep: 0 },
    ],
  });
  assert.equal(cleaned[0].mes, '<secret>one</secret>');
});

test('uses Tavern-cleaned messages for worldbook keyword scans', () => {
  const chat = [
    { is_user: false, mes: 'hidden keyword' },
    { is_user: true, mes: 'visible' },
  ];
  const scanned = getWorldbookScanText(chat, 2, {
    followTavernRegex: true,
    regexPlacement: { USER_INPUT: 1, AI_OUTPUT: 2 },
    getRegexedString: (text, placement, { depth }) =>
      depth === 1 && placement === 2 ? text.replace('keyword', '') : text,
  });
  assert.equal(scanned, 'visible\nhidden');
});

test('applies host regex depth before selecting recent history and preserves source indices', () => {
  const chat = [
    { is_user: true, mes: 'old' },
    { is_system: true, mes: 'system' },
    { is_user: false, mes: 'middle' },
    { is_user: true, mes: 'latest' },
  ];
  const calls = [];
  const selected = selectAndCleanChatHistory(chat, {
    followTavernRegex: true,
    historyRangeMode: 'recent',
    recentMessageCount: 2,
    regexPlacement: { USER_INPUT: 1, AI_OUTPUT: 2 },
    getRegexedString: (text, placement, { depth }) => {
      calls.push({ text, depth });
      return `${text}-clean`;
    },
  });

  assert.deepEqual(calls, [
    { text: 'old', depth: 2 },
    { text: 'middle', depth: 1 },
    { text: 'latest', depth: 0 },
  ]);
  assert.deepEqual(selected.map((message) => message.__stEsgSourceMessageIndex), [2, 3]);
  assert.deepEqual(selected.map((message) => message.mes), ['middle-clean', 'latest-clean']);
  assert.equal(chat[2].mes, 'middle');
});
