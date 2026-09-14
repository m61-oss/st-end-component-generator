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

test('inserts the formatted QianQianJie memory as exactly one system message', async () => {
  const content = '<qqj_prequel>前情</qqj_prequel>\n\n<qqj_recalled_context>召回</qqj_recalled_context>';
  const messages = await build({ qqjPromptText: content });
  const matches = messages.filter((message) => message.role === 'system' && message.content === content);
  const taskIndex = messages.findIndex((message) => message.role === 'user' && message.content === 'TASK');

  assert.equal(matches.length, 1);
  assert.ok(messages.indexOf(matches[0]) < taskIndex);
});

test('keeps QianQianJie memory immediately before the task when custom task placement is enabled', async () => {
  const content = '<qqj_recalled_context>召回</qqj_recalled_context>';
  const messages = await build({
    qqjPromptText: content,
    taskPlacement: { enabled: true, afterSourceId: TASK_PLACEMENT_AFTER_CHAT_HISTORY },
  });
  const taskIndex = messages.findIndex((message) => message.role === 'user' && message.content === 'TASK');

  assert.ok(taskIndex >= 1);
  assert.deepEqual(messages[taskIndex - 1], { role: 'system', content });
  assert.deepEqual(messages.at(-1), buildOutputProtocolMessage());
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

test('places a custom standard protocol and role at the message-list end', async () => {
  const messages = await build({
    outputProtocol: { content: 'STANDARD CUSTOM', role: 'assistant' },
  });
  assert.deepEqual(messages.at(-1), { role: 'assistant', content: 'STANDARD CUSTOM' });
});

test('places a custom anchor protocol and role at the message-list end', async () => {
  const messages = await build({
    outputMode: 'anchor',
    outputProtocol: { content: 'ANCHOR CUSTOM', role: 'user' },
  });
  assert.deepEqual(messages.at(-1), { role: 'user', content: 'ANCHOR CUSTOM' });
});

test('omits an empty tail constraint without moving or duplicating the task', async () => {
  const messages = await build({
    outputProtocol: { content: '', role: 'assistant' },
  });
  assert.equal(messages.some((message) => message.role === 'assistant' && message.content === ''), false);
  assert.equal(messages.filter((message) => message.role === 'user' && message.content === 'TASK').length, 1);
  assert.equal(messages.at(-1)?.content, 'TASK');
});

test('places anchor boundary tags in adjacent system messages without mutating assistant content', async () => {
  const messages = await build({ outputMode: 'anchor' });
  const targetIndex = messages.findIndex((message) => message?.role === 'assistant' && message?.content === '助手消息');
  assert.ok(targetIndex >= 0, 'anchor mode should keep the existing latest assistant content');
  assert.deepEqual(messages.slice(targetIndex - 1, targetIndex + 2).map(({ role, content }) => ({ role, content })), [
    { role: 'system', content: '<latest_assistant_target>' },
    { role: 'assistant', content: '助手消息' },
    { role: 'system', content: '</latest_assistant_target>' },
  ]);
  assert.equal(messages.filter((message) => /<latest_assistant_target>/.test(message?.content || '')).length, 2);
  assert.deepEqual(messages.at(-1), buildOutputProtocolMessage({ mode: 'anchor' }));
});

test('keeps the marked assistant message and boundary tags in chat order when task placement changes', async () => {
  const messages = await build({
    outputMode: 'anchor',
    taskPlacement: { enabled: true, afterSourceId: 'system-entry' },
  });
  const targetIndex = messages.findIndex((message) => message?.role === 'assistant' && message?.content === '助手消息');
  const taskIndex = messages.findIndex((message) => message?.role === 'user' && message?.content === 'TASK');
  assert.ok(targetIndex >= 0, 'target should remain in chat history');
  assert.ok(taskIndex >= 0, 'task should remain present');
  assert.ok(targetIndex > taskIndex, 'task placement must not move the marked assistant message');
  assert.equal(messages[targetIndex - 1]?.content, '<latest_assistant_target>');
  assert.equal(messages[targetIndex + 1]?.content, '</latest_assistant_target>');
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

test('preserves source message ids until the final outgoing-message compatibility pass', async () => {
  const messages = await build();
  const assistantMessage = messages.find((message) => message.content === context.chat[1].mes);

  assert.equal(assistantMessage?.sourceMessageIndex, 1);
});

test('inserts the floor-variable snapshot immediately after its source assistant', async () => {
  const messages = await build({
    floorVariableSnapshot: { content: '<snow>state</snow>', sourceMessageIndex: 1 },
  });
  const assistantIndex = messages.findIndex((message) => message.content === context.chat[1].mes);
  const taskIndex = messages.findIndex((message) => message.role === 'user' && message.content === 'TASK');

  assert.deepEqual(messages[assistantIndex + 1], {
    role: 'system',
    content: '<snow>state</snow>',
    floorVariableSnapshot: true,
  });
  assert.ok(assistantIndex + 1 < taskIndex);
});

test('does not trim the extracted floor-variable snapshot', async () => {
  const content = '\n<snow>state</snow>\n';
  const messages = await build({
    floorVariableSnapshot: { content, sourceMessageIndex: 1 },
  });
  assert.equal(messages.find((message) => message.floorVariableSnapshot)?.content, content);
});

test('keeps the floor snapshot before a task placed after chat history', async () => {
  const messages = await build({
    floorVariableSnapshot: { content: '<snow>state</snow>', sourceMessageIndex: 1 },
    taskPlacement: { enabled: true, afterSourceId: TASK_PLACEMENT_AFTER_CHAT_HISTORY },
  });
  const snapshotIndex = messages.findIndex((message) => message.floorVariableSnapshot);
  const taskIndex = messages.findIndex((message) => message.role === 'user' && message.content === 'TASK');
  assert.ok(snapshotIndex >= 0);
  assert.equal(taskIndex, snapshotIndex + 1);
});
