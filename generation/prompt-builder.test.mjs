import assert from 'node:assert/strict';
import test from 'node:test';

import { buildExternalStatusbarMessages } from './prompt-builder.js';
import { buildOutputProtocolMessage } from './output-protocol.js';
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

function assertProtocolIsFinalMessage(messages) {
  const taskIndex = messages.findIndex((message) => message.role === 'user' && message.content === 'TASK');
  assert.ok(taskIndex >= 0, 'task user message should exist');
  assert.deepEqual(messages.at(-1), buildOutputProtocolMessage());
  assert.ok(taskIndex < messages.length - 1, 'task user message should precede the final protocol message');
  return taskIndex;
}

test('places task before the final protocol when placement is disabled', async () => {
  const messages = await build({ taskPlacement: { enabled: false } });
  const taskIndex = assertProtocolIsFinalMessage(messages);
  assert.equal(taskIndex, messages.length - 2);
});

test('places task after chat history and protocol at the end', async () => {
  const messages = await build({
    taskPlacement: { enabled: true, afterSourceId: TASK_PLACEMENT_AFTER_CHAT_HISTORY },
  });
  const taskIndex = assertProtocolIsFinalMessage(messages);
  assert.equal(messages[taskIndex - 1].content, '助手消息');
});

test('places task after a selected source item and protocol at the end', async () => {
  const messages = await build({
    taskPlacement: { enabled: true, afterSourceId: 'system-entry' },
  });
  const taskIndex = assertProtocolIsFinalMessage(messages);
  assert.equal(messages[taskIndex - 1].content, 'SYSTEM');
});

test('keeps the task content as the last-user-message override', async () => {
  const messages = await build({
    replaceLastUserMessageWithTask: true,
    promptSourceItems: [
      { id: 'macro-entry', role: 'system', content: '{{lastUserMessage}}' },
    ],
  });
  const taskIndex = assertProtocolIsFinalMessage(messages);
  assert.equal(messages.find((message) => message.content === 'TASK' && message.role === 'system')?.content, 'TASK');
  assert.equal(messages[taskIndex - 1].content, 'TASK');
});

test('uses the anchor protocol only when anchor output mode is requested', async () => {
  const messages = await build({ outputMode: 'anchor' });
  assert.deepEqual(messages.at(-1), buildOutputProtocolMessage({ mode: 'anchor' }));
  assert.notDeepEqual(messages.at(-1), buildOutputProtocolMessage());
});

test('marks the latest assistant message in place for anchor generation', async () => {
  const messages = await build({ outputMode: 'anchor' });
  const target = messages.find((message) => message?.role === 'assistant' && /<latest_assistant_target>/.test(message?.content || ''));
  assert.ok(target, 'anchor mode should mark the existing latest assistant message');
  assert.equal(target.role, 'assistant');
  assert.match(target.content, /<latest_assistant_target>\s*助手消息\s*<\/latest_assistant_target>/);
  assert.equal(messages.filter((message) => message?.role === 'assistant' && /<latest_assistant_target>/.test(message?.content || '')).length, 1);
  assert.equal(messages.filter((message) => /锚点插入目标/.test(message?.content || '')).length, 0);
  assert.equal(messages.filter((message) => message?.content === '助手消息').length, 0);
  assert.deepEqual(messages.at(-1), buildOutputProtocolMessage({ mode: 'anchor' }));
});

test('keeps the marked assistant message in chat order when task placement changes', async () => {
  const messages = await build({
    outputMode: 'anchor',
    taskPlacement: { enabled: true, afterSourceId: 'system-entry' },
  });
  const targetIndex = messages.findIndex((message) => message?.role === 'assistant' && /<latest_assistant_target>/.test(message?.content || ''));
  const taskIndex = messages.findIndex((message) => message?.role === 'user' && message?.content === 'TASK');
  assert.ok(targetIndex >= 0, 'marked target should remain in chat history');
  assert.ok(taskIndex >= 0, 'task should remain present');
  assert.ok(targetIndex > taskIndex, 'task placement must not move the marked assistant message');
});

test('resolves core plugin macros without case sensitivity', async () => {
  const messages = await build({
    promptSourceItems: [
      {
        id: 'macro-entry',
        role: 'system',
        content: '{{char}}|{{CHAR}}|{{user}}|{{USER}}|{{lastUserMessage}}|{{LastUserMessage}}|{{lastusermessage}}|{{LASTUSERMESSAGE}}',
      },
    ],
  });
  const macroMessage = messages.find((message) => message.role === 'system');
  assert.equal(
    macroMessage?.content,
    `角色|角色|User|User|${context.chat[0].mes}|${context.chat[0].mes}|${context.chat[0].mes}|${context.chat[0].mes}`,
  );
});
