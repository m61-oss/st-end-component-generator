import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyAnchorInsertions,
  locateAnchorInsertions,
} from './anchor-insertion.js';

test('locates only unique exact anchors and reports skipped entries', () => {
  const message = '第一段。\n\n第二段。\n\n第三段。';
  const result = locateAnchorInsertions(message, [
    { position: 'after', anchor: '第一段。', content: '一' },
    { position: 'before', anchor: '第二段。', content: '二' },
    { position: 'after', anchor: '不存在', content: '跳过' },
    { position: 'after', anchor: '段。', content: '歧义' },
  ]);

  assert.deepEqual(result.matches.map(({ item }) => item), [
    { position: 'after', anchor: '第一段。', content: '一' },
    { position: 'before', anchor: '第二段。', content: '二' },
  ]);
  assert.equal(result.skipped.length, 2);
  assert.match(result.skipped[0].reason, /未找到/);
  assert.match(result.skipped[1].reason, /不唯一/);
});

test('inserts each component as its own line while preserving paragraph spacing', () => {
  const message = '第一段。\n\n第二段。';
  const output = applyAnchorInsertions(message, [
    { position: 'after', anchor: '第一段。', content: '<a>一</a>' },
    { position: 'before', anchor: '第二段。', content: '<b>二</b>' },
  ]);

  assert.equal(output.text, '第一段。\n<a>一</a>\n\n<b>二</b>\n第二段。');
  assert.equal(output.applied.length, 2);
  assert.equal(output.skipped.length, 0);
});

test('uses CRLF when the target message uses CRLF', () => {
  const output = applyAnchorInsertions('A\r\nB', [
    { position: 'after', anchor: 'A', content: '\r\nX\r\n' },
  ]);

  assert.equal(output.text, 'A\r\nX\r\nB');
});

test('applies multiple matches from right to left without offset drift', () => {
  const output = applyAnchorInsertions('A\nB\nC', [
    { position: 'after', anchor: 'A', content: 'one' },
    { position: 'after', anchor: 'C', content: 'three' },
  ]);

  assert.equal(output.text, 'A\none\nB\nC\nthree');
});

