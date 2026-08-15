import assert from 'node:assert/strict';
import test from 'node:test';

import { buildExternalStatusbarMessages } from './prompt-builder.js';
import { TASK_PLACEMENT_AFTER_CHAT_HISTORY } from '../settings/task-placement.js';

const context = {
  chat: [
    { is_user: true, mes: '用户消息' },
    { is_user: false, mes: '助手消息' },
  ],
};

async function build(options = {}) {
  return buildExternalStatusbarMessages({
    targetWindow: {},
    context,
    latestMessage: context.chat.at(-1),
    taskPrompt: 'TASK',
    components: [],
    theaterComponents: [],
    promptSourceItems: [
      { id: 'system-entry', role: 'system', content: 'SYSTEM' },
      { id: 'history-entry', markerType: 'chatHistory', role: 'system', content: '' },
    ],
    substituteParams: null,
    ...options,
  });
}

function assertProtocolImmediatelyBeforeTask(messages) {
  const taskIndex = messages.findIndex((message) => message.role === 'user' && message.content === 'TASK');
  assert.ok(taskIndex > 0, 'task user message should exist after at least one protocol message');
  assert.deepEqual(messages[taskIndex - 1], {
    role: 'system',
    content: '【织幕固定输出协议｜必须遵守】\n本协议只规定回复的外层格式，不改变任务要求的内容、文风、步骤和标签。\n你的完整回复必须是一个 JSON 对象，且只包含以下两个字段，并严格按此顺序输出：\n\n{\n  "thinking": "执行任务要求的全部思考步骤",\n  "content": "思考结束后需要交付的全部最终内容"\n}\n\n规则：\n1. thinking 必须包含任务要求的思维链步骤。\n2. content 必须是最后一个字段，包含所有委托要求的内容。\n3. 不得把思维链写入 content。\n4. JSON 外不得输出解释、标题或代码围栏。\n5. 即使某部分为空，也不得省略 thinking 或 content。',
  });
  return taskIndex;
}

test('places protocol immediately before task when placement is disabled', async () => {
  const messages = await build({ taskPlacement: { enabled: false } });
  const taskIndex = assertProtocolImmediatelyBeforeTask(messages);
  assert.equal(taskIndex, messages.length - 1);
});

test('places protocol and task immediately after chat history', async () => {
  const messages = await build({
    taskPlacement: { enabled: true, afterSourceId: TASK_PLACEMENT_AFTER_CHAT_HISTORY },
  });
  const taskIndex = assertProtocolImmediatelyBeforeTask(messages);
  assert.equal(messages[taskIndex - 2].content, '助手消息');
});

test('places protocol and task immediately after a selected source item', async () => {
  const messages = await build({
    taskPlacement: { enabled: true, afterSourceId: 'system-entry' },
  });
  const taskIndex = assertProtocolImmediatelyBeforeTask(messages);
  assert.equal(messages[taskIndex - 2].content, 'SYSTEM');
});

test('keeps the task content as the last-user-message override', async () => {
  const messages = await build({
    replaceLastUserMessageWithTask: true,
    promptSourceItems: [
      { id: 'macro-entry', role: 'system', content: '{{lastUserMessage}}' },
    ],
  });
  const taskIndex = assertProtocolImmediatelyBeforeTask(messages);
  assert.equal(messages.find((message) => message.content === 'TASK' && message.role === 'system')?.content, 'TASK');
  assert.equal(messages[taskIndex - 2].content, 'TASK');
});
