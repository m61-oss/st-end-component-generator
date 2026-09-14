import assert from 'node:assert/strict';
import test from 'node:test';

const qqjModule = await import('./qqj-memory.js').catch(() => null);

test('reads the formatted QianQianJie prompt snapshot as one system-message body', () => {
  assert.ok(qqjModule, 'qqj memory bridge module should exist');
  const result = qqjModule.readQqjPromptSnapshot({
    qqj_v3_public_bridge_v1: {
      getPromptSnapshot: () => ({
        status: 'ready',
        prequel: { text: '<qqj_prequel>前情</qqj_prequel>' },
        recall: { text: '<qqj_recalled_context>召回</qqj_recalled_context>' },
      }),
    },
  });

  assert.deepEqual(result, {
    status: 'ready',
    sourceStatus: 'ready',
    text: '<qqj_prequel>前情</qqj_prequel>\n\n<qqj_recalled_context>召回</qqj_recalled_context>',
  });
});

test('preserves a single non-empty prompt field without manufacturing wrappers', () => {
  assert.ok(qqjModule, 'qqj memory bridge module should exist');
  const result = qqjModule.readQqjPromptSnapshot({
    qqj_v3_public_bridge_v1: {
      getPromptSnapshot: () => ({ status: 'ready', prequel: { text: '' }, recall: { text: '  原样召回  ' } }),
    },
  });

  assert.equal(result.status, 'ready');
  assert.equal(result.text, '  原样召回  ');
});

test('degrades safely when the bridge is absent, unready, empty, or throws', () => {
  assert.ok(qqjModule, 'qqj memory bridge module should exist');
  assert.equal(qqjModule.readQqjPromptSnapshot({}).status, 'unavailable');
  assert.deepEqual(
    qqjModule.readQqjPromptSnapshot({
      qqj_v3_public_bridge_v1: { getPromptSnapshot: () => ({ status: 'loading' }) },
    }),
    { status: 'not-ready', sourceStatus: 'loading', text: '' },
  );
  assert.equal(
    qqjModule.readQqjPromptSnapshot({
      qqj_v3_public_bridge_v1: { getPromptSnapshot: () => ({ status: 'ready', prequel: {}, recall: {} }) },
    }).status,
    'empty',
  );
  assert.equal(
    qqjModule.readQqjPromptSnapshot({
      qqj_v3_public_bridge_v1: { getPromptSnapshot: () => { throw new Error('bridge failed'); } },
    }).status,
    'error',
  );
});
