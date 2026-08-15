import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isAnchorInsertionItem,
  normalizeAnchorInsertionItem,
  parseAnchorOutput,
} from './anchor-output-protocol.js';

test('parses an anchor output array and preserves item order', () => {
  const parsed = parseAnchorOutput(JSON.stringify({
    thinking: '先定位正文，再安排组件',
    output: [
      { position: 'after', anchor: '第一段。', content: '<a>一</a>' },
      { position: 'before', anchor: '第二段。', content: '<b>二</b>' },
    ],
  }));

  assert.deepEqual(parsed, {
    mode: 'anchor-json',
    thinking: '先定位正文，再安排组件',
    items: [
      { position: 'after', anchor: '第一段。', content: '<a>一</a>' },
      { position: 'before', anchor: '第二段。', content: '<b>二</b>' },
    ],
    complete: true,
    warnings: [],
  });
});

test('drops malformed anchor items without changing valid item order', () => {
  const parsed = parseAnchorOutput(JSON.stringify({
    thinking: '',
    output: [
      { position: 'after', anchor: '有效锚点', content: '有效内容' },
      { position: 'sideways', anchor: '错误方向', content: '跳过' },
      { position: 'before', anchor: '', content: '空锚点' },
      { position: 'before', anchor: '第二个有效锚点', content: '第二个有效内容' },
    ],
  }));

  assert.deepEqual(parsed.items, [
    { position: 'after', anchor: '有效锚点', content: '有效内容' },
    { position: 'before', anchor: '第二个有效锚点', content: '第二个有效内容' },
  ]);
  assert.equal(parsed.complete, true);
  assert.equal(parsed.warnings.length, 2);
});

test('accepts an empty insertion plan but rejects non-array output', () => {
  const empty = parseAnchorOutput(JSON.stringify({ thinking: 'x', output: [] }));
  assert.deepEqual(empty.items, []);
  assert.equal(empty.complete, true);

  assert.equal(parseAnchorOutput(JSON.stringify({ thinking: 'x', output: 'text' })), null);
});

test('validates and normalizes one anchor item without trimming source text', () => {
  const item = normalizeAnchorInsertionItem({
    position: ' AFTER ',
    anchor: '  原文两侧的空格  ',
    content: '\n组件\n',
  });

  assert.deepEqual(item, {
    position: 'after',
    anchor: '  原文两侧的空格  ',
    content: '\n组件\n',
  });
  assert.equal(isAnchorInsertionItem(item), true);
});

test('recovers valid anchor items from an incomplete envelope and unescaped content quotes', () => {
  const parsed = parseAnchorOutput('{"thinking":"先定位","output":[{"position":"after","anchor":"原文。","content":"<summary style="list-style:none">内容</summary>"}]');

  assert.equal(parsed.mode, 'anchor-loose-json');
  assert.equal(parsed.complete, false);
  assert.deepEqual(parsed.items, [
    { position: 'after', anchor: '原文。', content: '<summary style="list-style:none">内容</summary>' },
  ]);
});
