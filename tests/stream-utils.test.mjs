import assert from 'node:assert/strict';
import { extractStreamDelta, readOpenAiStream } from '../stream-utils.js';

assert.equal(extractStreamDelta({ choices: [{ delta: { content: 'Hello' } }] }), 'Hello');
assert.equal(extractStreamDelta({ choices: [{ text: ' legacy' }] }), ' legacy');
assert.equal(extractStreamDelta({ choices: [{ delta: {} }] }), '');

const encoder = new TextEncoder();
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n'));
    controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"lo"}}]}\n\n'));
    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
    controller.close();
  },
});

const chunks = [];
const text = await readOpenAiStream({ body: stream }, (delta, fullText) => chunks.push([delta, fullText]));
assert.equal(text, 'Hello');
assert.deepEqual(chunks, [['Hel', 'Hel'], ['lo', 'Hello']]);
