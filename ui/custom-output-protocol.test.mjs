import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createDefaultSettings } from '../settings/default-settings.js';

const indexSource = await readFile(new URL('../index.js', import.meta.url), 'utf8');
const styleSource = await readFile(new URL('../style.css', import.meta.url), 'utf8');
const schemeSource = await readFile(new URL('../settings/scheme-utils.js', import.meta.url), 'utf8');

test('task page exposes independent protocol mode, role, editor, and reset controls', () => {
  assert.match(indexSource, /id="st-esg-output-protocol-mode"/);
  assert.match(indexSource, /id="st-esg-output-protocol-role"/);
  assert.match(indexSource, /id="st-esg-output-protocol-text"/);
  assert.match(indexSource, /id="st-esg-reset-output-protocol"/);
  assert.match(indexSource, /data-output-protocol-mode="standard"/);
  assert.match(indexSource, /data-output-protocol-mode="anchor"/);
});

test('stores separate standard and anchor prompt text and roles', () => {
  for (const key of [
    'standardOutputProtocol',
    'standardOutputProtocolRole',
    'anchorOutputProtocol',
    'anchorOutputProtocolRole',
  ]) assert.match(indexSource, new RegExp(key));
  assert.match(indexSource, /function renderOutputProtocolEditor\(/);
});

test('generation passes the active protocol override without adding it to task schemes', () => {
  assert.match(indexSource, /outputProtocol:\s*getActiveOutputProtocolSettings\(outputMode,\s*sourceSettings\)/);
  assert.doesNotMatch(schemeSource, /standardOutputProtocol|anchorOutputProtocol/);
});

test('protocol controls use scoped task-page styling', () => {
  assert.match(styleSource, /\.st-esg-output-protocol-details/);
  assert.match(styleSource, /#st-esg-output-protocol-text/);
});

test('renders tail constraints as the final task-page disclosure', () => {
  assert.match(indexSource, /className = 'st-esg-card st-esg-collapsible st-esg-output-protocol-details'/);
  assert.match(indexSource, /<summary class="st-esg-collapsible-summary">尾部格式约束<\/summary>/);
  assert.match(indexSource, /按所选身份原样作为提示词最后一条消息发送；留空则不插入。普通与锚点模式分别保存，不随任务方案保存。/);
  assert.match(indexSource, /taskPanel\.appendChild\(outputProtocolDetails\)/);
});

test('keeps the tail constraint explanation intact when compacting task-page descriptions', () => {
  assert.match(indexSource, /st-esg-output-protocol-help/);
  assert.match(indexSource, /\[data-tab-panel="task"\] > \.st-esg-card:not\(\.st-esg-output-protocol-details\) \.st-esg-card-desc/);
  assert.doesNotMatch(
    indexSource,
    /\['\[data-tab-panel="task"\] \.st-esg-card-desc',\s*'编辑发送给模型的任务指令/,
  );
});

test('does not leave a duplicate testing title inside the disclosure', () => {
  assert.doesNotMatch(indexSource, /自定义输出格式（测试）/);
});

test('defaults and migrates both output protocol roles to assistant once', () => {
  const defaults = createDefaultSettings();
  assert.equal(defaults.standardOutputProtocolRole, 'assistant');
  assert.equal(defaults.anchorOutputProtocolRole, 'assistant');
  assert.match(indexSource, /outputProtocolAssistantDefaultApplied/);
  assert.match(indexSource, /settings\.standardOutputProtocolRole = 'assistant'/);
  assert.match(indexSource, /settings\.anchorOutputProtocolRole = 'assistant'/);
});

test('reset restores only protocol text and preserves the selected role', () => {
  const handler = indexSource.match(/\$t\('#st-esg-reset-output-protocol'\)\.on\('click',[\s\S]*?\n  \}\);/)?.[0] || '';
  assert.match(handler, /settings\[keys\.text\] = DEFAULT_SETTINGS\[keys\.text\]/);
  assert.doesNotMatch(handler, /settings\[keys\.role\]\s*=/);
});
