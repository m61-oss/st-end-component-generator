import assert from 'node:assert/strict';
import test from 'node:test';

import {
  OUTPUT_PROTOCOL_SYSTEM_PROMPT,
  buildOutputProtocolMessage,
  parseOutputProtocolResponse,
} from './output-protocol.js';

test('publishes the fixed two-field protocol as a system message', () => {
  const message = buildOutputProtocolMessage();

  assert.deepEqual(message, {
    role: 'system',
    content: OUTPUT_PROTOCOL_SYSTEM_PROMPT,
  });
  assert.match(OUTPUT_PROTOCOL_SYSTEM_PROMPT, /织幕固定输出协议/);
  assert.match(OUTPUT_PROTOCOL_SYSTEM_PROMPT, /你的完整回复必须是一个 JSON 对象/);
  assert.match(OUTPUT_PROTOCOL_SYSTEM_PROMPT, /"thinking"[\s\S]*"content"/);
  assert.match(OUTPUT_PROTOCOL_SYSTEM_PROMPT, /JSON 外不得输出解释/);
});

test('parses a strict JSON envelope and preserves both fields', () => {
  const parsed = parseOutputProtocolResponse(JSON.stringify({
    thinking: 'Phase.0\nPhase.1',
    content: '<draft>摘要</draft>',
  }));

  assert.deepEqual(parsed, {
    mode: 'json',
    thinking: 'Phase.0\nPhase.1',
    content: '<draft>摘要</draft>',
    complete: true,
  });
});

test('accepts a markdown JSON fence around the envelope', () => {
  const parsed = parseOutputProtocolResponse('```json\n{"thinking":"x","content":"y"}\n```');

  assert.equal(parsed.mode, 'json');
  assert.equal(parsed.thinking, 'x');
  assert.equal(parsed.content, 'y');
  assert.equal(parsed.complete, true);
});

test('recovers content when the final object or quoted value is cut off', () => {
  const missingObject = parseOutputProtocolResponse('{\n  "thinking": "x",\n  "content": "正文"');
  assert.equal(missingObject.mode, 'loose-json');
  assert.equal(missingObject.thinking, 'x');
  assert.equal(missingObject.content, '正文');
  assert.equal(missingObject.complete, false);

  const missingQuote = parseOutputProtocolResponse('{"thinking":"x","content":"正文');
  assert.equal(missingQuote.mode, 'loose-json');
  assert.equal(missingQuote.content, '正文');
  assert.equal(missingQuote.complete, false);
});

test('ignores unknown fields while keeping content as the final protocol field', () => {
  const parsed = parseOutputProtocolResponse(JSON.stringify({
    thinking: '',
    future: { anchor: 'after-content' },
    content: '正文',
  }));

  assert.equal(parsed.mode, 'json');
  assert.equal(parsed.thinking, '');
  assert.equal(parsed.content, '正文');
});

test('falls back to the legacy text path when no content field exists', () => {
  const legacyInput = '<thinking>x</thinking><content>正文</content>';
  const parsed = parseOutputProtocolResponse(legacyInput);

  assert.equal(parsed.mode, 'legacy');
  assert.equal(parsed.thinking, '');
  assert.equal(parsed.content, legacyInput);
  assert.equal(parsed.complete, false);

  const arbitraryJson = '{"thinking":"x","other":"y"}';
  const arbitrary = parseOutputProtocolResponse(arbitraryJson);
  assert.equal(arbitrary.mode, 'legacy');
  assert.equal(arbitrary.content, arbitraryJson);
});

test('never throws for empty or malformed model output', () => {
  assert.equal(parseOutputProtocolResponse(''), null);
  assert.doesNotThrow(() => parseOutputProtocolResponse('{not json'));
  assert.equal(parseOutputProtocolResponse('{not json').mode, 'legacy');
});
