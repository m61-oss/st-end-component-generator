import assert from 'node:assert/strict';
import test from 'node:test';

import {
  OUTPUT_PROTOCOL_SYSTEM_PROMPT,
  ANCHOR_OUTPUT_PROTOCOL_SYSTEM_PROMPT,
  buildOutputProtocolMessage,
  parseOutputProtocolResponse,
  parseOutputProtocolStreamPreview,
} from './output-protocol.js';

test('publishes the fixed two-field protocol as a system message', () => {
  const message = buildOutputProtocolMessage();

  assert.deepEqual(message, {
    role: 'system',
    content: OUTPUT_PROTOCOL_SYSTEM_PROMPT,
  });
  assert.match(OUTPUT_PROTOCOL_SYSTEM_PROMPT, /"thinking"[\s\S]*"output"/);
  assert.match(OUTPUT_PROTOCOL_SYSTEM_PROMPT, /固定输出协议｜最高优先级/);
  assert.match(OUTPUT_PROTOCOL_SYSTEM_PROMPT, /本协议仅规定完整回复的外层封装/);
  assert.match(OUTPUT_PROTOCOL_SYSTEM_PROMPT, /外层封装先于任何内部内容形成/);
  assert.match(OUTPUT_PROTOCOL_SYSTEM_PROMPT, /全部思考、推演及其既定格式/);
  assert.match(OUTPUT_PROTOCOL_SYSTEM_PROMPT, /思考内容用中文/);
  assert.match(OUTPUT_PROTOCOL_SYSTEM_PROMPT, /思考部分结束后的全部实际输出及其既定格式/);
  assert.match(OUTPUT_PROTOCOL_SYSTEM_PROMPT, /忽视所有续写正文要求/);
  assert.match(OUTPUT_PROTOCOL_SYSTEM_PROMPT, /不得生成未被本次任务明确要求的正文/);
  assert.match(OUTPUT_PROTOCOL_SYSTEM_PROMPT, /若思考部分规定以特定字符或标签开始/);
  assert.match(OUTPUT_PROTOCOL_SYSTEM_PROMPT, /按标准 JSON 语法转义/);
  assert.match(OUTPUT_PROTOCOL_SYSTEM_PROMPT, /完整回复的第一个字符必须是/);
  assert.doesNotMatch(OUTPUT_PROTOCOL_SYSTEM_PROMPT, /"content"\s*:/);
  assert.doesNotMatch(OUTPUT_PROTOCOL_SYSTEM_PROMPT, /织幕固定输出协议/);
});

test('publishes a variable-length anchor plan only in anchor mode', () => {
  const message = buildOutputProtocolMessage({ mode: 'anchor' });

  assert.deepEqual(message, {
    role: 'system',
    content: ANCHOR_OUTPUT_PROTOCOL_SYSTEM_PROMPT,
  });
  assert.match(ANCHOR_OUTPUT_PROTOCOL_SYSTEM_PROMPT, /output[\s\S]*position[\s\S]*anchor[\s\S]*content/);
  assert.match(ANCHOR_OUTPUT_PROTOCOL_SYSTEM_PROMPT, /任意数量/);
  assert.match(ANCHOR_OUTPUT_PROTOCOL_SYSTEM_PROMPT, /before 还是 after/);
  assert.doesNotMatch(ANCHOR_OUTPUT_PROTOCOL_SYSTEM_PROMPT, /织幕/);
});

test('parses a strict JSON envelope and preserves both fields', () => {
  const parsed = parseOutputProtocolResponse(JSON.stringify({
    thinking: 'Phase.0\nPhase.1',
    output: '<draft>摘要</draft>',
  }));

  assert.deepEqual(parsed, {
    mode: 'json',
    thinking: 'Phase.0\nPhase.1',
    content: '<draft>摘要</draft>',
    complete: true,
  });
});

test('accepts a markdown JSON fence around the envelope', () => {
  const parsed = parseOutputProtocolResponse('```json\n{"thinking":"x","output":"y"}\n```');

  assert.equal(parsed.mode, 'json');
  assert.equal(parsed.thinking, 'x');
  assert.equal(parsed.content, 'y');
  assert.equal(parsed.complete, true);
});

test('recovers output when the final object or quoted value is cut off', () => {
  const missingObject = parseOutputProtocolResponse('{\n  "thinking": "x",\n  "output": "正文"');
  assert.equal(missingObject.mode, 'loose-json');
  assert.equal(missingObject.thinking, 'x');
  assert.equal(missingObject.content, '正文');
  assert.equal(missingObject.complete, false);

  const missingQuote = parseOutputProtocolResponse('{"thinking":"x","output":"正文');
  assert.equal(missingQuote.mode, 'loose-json');
  assert.equal(missingQuote.content, '正文');
  assert.equal(missingQuote.complete, false);
});

test('ignores unknown fields while keeping output as the final protocol field', () => {
  const parsed = parseOutputProtocolResponse(JSON.stringify({
    thinking: '',
    future: { anchor: 'after-content' },
    output: '正文',
  }));

  assert.equal(parsed.mode, 'json');
  assert.equal(parsed.thinking, '');
  assert.equal(parsed.content, '正文');

  const legacyEnvelope = parseOutputProtocolResponse('{"thinking":"x","content":"旧格式"}');
  assert.equal(legacyEnvelope.mode, 'legacy');
  assert.equal(legacyEnvelope.content, '{"thinking":"x","content":"旧格式"}');
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

test('decodes escaped line breaks while a JSON response is still streaming', () => {
  const parsed = parseOutputProtocolStreamPreview(String.raw`{"thinking":"第一步\n第二步","output":"第一行\n第二行`);

  assert.equal(parsed.mode, 'loose-json');
  assert.equal(parsed.thinking, '第一步\n第二步');
  assert.equal(parsed.content, '第一行\n第二行');
  assert.equal(parsed.complete, false);
});

test('recovers the full final output when HTML attributes contain unescaped quotes', () => {
  const parsed = parseOutputProtocolResponse(
    '{"thinking":"x","output":"<summary style="list-style:none; text-align:center;">title</summary>"}',
  );

  assert.equal(parsed.mode, 'loose-json');
  assert.equal(parsed.content, '<summary style="list-style:none; text-align:center;">title</summary>');
});

test('does not search for a later output field inside the output text', () => {
  const parsed = parseOutputProtocolResponse(
    '{"thinking":"x","output":"first, example: \\"output\\":\\"not a field\\"; second"}',
  );

  assert.equal(parsed.mode, 'json');
  assert.equal(parsed.content, 'first, example: "output":"not a field"; second');
});

test('keeps an unescaped output-field example inside recovered output', () => {
  const parsed = parseOutputProtocolResponse(
    '{"thinking":"x","output":"first, "output":"not a field"; second"}',
  );

  assert.equal(parsed.mode, 'loose-json');
  assert.equal(parsed.content, 'first, "output":"not a field"; second');
});

test('removes whitespace between the recovered output quote and outer object brace', () => {
  const parsed = parseOutputProtocolResponse(
    '{"thinking":"x","output":"content with "quoted" text"\n}',
  );

  assert.equal(parsed.mode, 'loose-json');
  assert.equal(parsed.content, 'content with "quoted" text');
});

test('marks malformed thinking with multiple output candidates as ambiguous', () => {
  const parsed = parseOutputProtocolResponse(
    '{"thinking":"thinking mentions, "output":"example", then continues","output":"actual"}',
  );

  assert.equal(parsed.mode, 'ambiguous-json');
  assert.equal(parsed.ambiguous, true);
});

test('recognizes the thinking field before the output field arrives', () => {
  const parsed = parseOutputProtocolStreamPreview(String.raw`{"thinking":"第一步\n第二步`);

  assert.equal(parsed.mode, 'loose-json');
  assert.equal(parsed.thinking, '第一步\n第二步');
  assert.equal(parsed.content, '');
  assert.equal(parsed.complete, false);
});
