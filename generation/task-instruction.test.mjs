import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_TASK_INSTRUCTION, migrateDefaultTaskInstruction } from './task-instruction.js';

test('default task instruction limits output to the delimited components', () => {
  assert.equal(DEFAULT_TASK_INSTRUCTION, [
    '现在停止生成正文，为最新的正文补充以下内容，未提及的内容禁止擅自添加。',
    '',
    '——补充内容开始——',
    '{{external_components}}',
    '——补充内容结束——',
  ].join('\n'));
});

test('upgrades only the old default task instruction', () => {
  const oldDefault = [
    '现在停止生成正文，为最新的正文补充下面这些内容。',
    '{{external_components}}',
    '上方为需要补充的内容，现在开始输出思考过程并按规则和格式输出需要补充的内容，禁止额外生成正文。',
  ].join('\n');
  assert.equal(migrateDefaultTaskInstruction(oldDefault), DEFAULT_TASK_INSTRUCTION);
  assert.equal(migrateDefaultTaskInstruction('自定义 {{external_components}}'), '自定义 {{external_components}}');
});
