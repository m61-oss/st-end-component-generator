import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyAnchorInsertions,
  buildAnchorPreviewSegments,
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

test('accepts start and end as absolute message boundaries', () => {
  const output = applyAnchorInsertions('正文\n</details>\n<!-- tail -->', [
    { position: 'start', content: 'START' },
    { position: 'end', content: 'END' },
  ]);

  assert.equal(output.text, 'START\n正文\n</details>\n<!-- tail -->\nEND');
  assert.equal(output.applied.length, 2);
  assert.equal(output.skipped.length, 0);
  assert.deepEqual(output.applied.map(({ item }) => item.position), ['start', 'end']);
});

test('matches punctuation and whitespace differences with a visible match type', () => {
  const result = locateAnchorInsertions('第一句，第二句。\n第三句', [
    { position: 'after', anchor: '第一句,第二句', content: '插入' },
  ]);

  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].matchType, 'loose');
  assert.equal(result.matches[0].matchedText, '第一句，第二句');
});

test('uses compact fuzzy matching when punctuation and line breaks differ', () => {
  const result = locateAnchorInsertions('第一句，\n第二句。', [
    { position: 'after', anchor: '第一句\n第二句', content: '插入' },
  ]);

  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].matchType, 'fuzzy');
  assert.equal(result.matches[0].matchedText, '第一句，\n第二句');
});

test('does not auto-select an ambiguous fuzzy anchor', () => {
  const result = locateAnchorInsertions('甲，乙。\n甲、乙。', [
    { position: 'after', anchor: '甲乙', content: '插入' },
  ]);

  assert.equal(result.matches.length, 0);
  assert.equal(result.skipped.length, 1);
  assert.equal(result.skipped[0].status, 'multiple');
});

test('applies multiple matches from right to left without offset drift', () => {
  const output = applyAnchorInsertions('A\nB\nC', [
    { position: 'after', anchor: 'A', content: 'one' },
    { position: 'after', anchor: 'C', content: 'three' },
  ]);

  assert.equal(output.text, 'A\none\nB\nC\nthree');
});

test('builds a final-message preview with inserted content segments', () => {
  const preview = buildAnchorPreviewSegments('第一段。\n\n第二段。', [
    { position: 'after', anchor: '第一段。', content: '新增组件' },
  ]);

  assert.equal(preview.text, '第一段。\n新增组件\n\n第二段。');
  assert.deepEqual(preview.segments, [
    { type: 'source', text: '第一段。\n' },
    { type: 'insert', text: '新增组件', itemIndex: 0 },
    { type: 'source', text: '\n\n第二段。' },
  ]);
  assert.equal(preview.applied.length, 1);
  assert.equal(preview.skipped.length, 0);
});

test('does not apply anchor items marked as excluded from injection', () => {
  const items = [
    { position: 'after', anchor: '第一段。', content: '保留组件' },
    { position: 'after', anchor: '第二段。', content: '排除组件', injectionEnabled: false },
  ];
  const output = applyAnchorInsertions('第一段。\n\n第二段。', items);
  const preview = buildAnchorPreviewSegments('第一段。\n\n第二段。', items);

  assert.equal(output.text, '第一段。\n保留组件\n\n第二段。');
  assert.equal(output.applied.length, 1);
  assert.equal(output.disabled.length, 1);
  assert.equal(preview.disabled.length, 1);
  assert.equal(preview.segments.some((segment) => segment.text === '排除组件'), false);
});
