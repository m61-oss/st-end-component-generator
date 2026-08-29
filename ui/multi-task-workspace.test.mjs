import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createMultiTask } from '../generation/multi-task-state.js';
import { renderGenerationModeSwitch, renderMultiTaskWorkspace } from './multi-task-workspace.js';

test('renders compact generation mode tabs with one mode-aware settings icon', () => {
  const markup = renderGenerationModeSwitch('multi');
  assert.match(markup, /data-generation-mode="single"/);
  assert.match(markup, /data-generation-mode="multi"[^>]*aria-pressed="true"/);
  assert.match(markup, /data-generation-mode-settings/);
  assert.equal((markup.match(/fa-gear/g) || []).length, 1);
  assert.match(markup, />单任务</);
  assert.match(markup, />多任务</);
});

test('renders a compact empty hint and leaves task creation inside the settings gear', () => {
  const markup = renderMultiTaskWorkspace({ tasks: [] });
  assert.match(markup, /st-esg-multi-task-empty/);
  assert.match(markup, /打开设置/);
  assert.doesNotMatch(markup, /data-multi-task-action="add"/);
  assert.doesNotMatch(markup, /st-esg-multi-task-preview/);
});

test('renders named task tabs and the scheme-B icon toolbar without duplicating generation fields', () => {
  let state = createMultiTask({}, '<状态栏>', { id: 'status', status: 'generating', extraInstruction: '保留标签' }).state;
  state = createMultiTask(state, '小剧场', { id: 'theater', status: 'queued' }).state;
  const markup = renderMultiTaskWorkspace({ ...state, activeTaskId: 'status' });

  assert.match(markup, /data-multi-task-id="status"[^>]*aria-selected="true"/);
  assert.match(markup, /aria-label="&lt;状态栏&gt;，生成中"/);
  assert.match(markup, /&lt;状态栏&gt;/);
  assert.match(markup, /data-task-status="generating"/);
  assert.match(markup, /data-task-status="queued"/);
  assert.match(markup, /data-multi-task-action="history"[^>]*aria-label="最近生成记录"/);
  assert.match(markup, /data-multi-task-action="undo"[^>]*aria-label="撤回当前任务"/);
  assert.match(markup, /data-multi-task-action="generate"[^>]*aria-label="生成当前任务"/);
  assert.match(markup, /data-multi-task-action="inject"[^>]*aria-label="注入当前任务"/);
  for (const icon of ['fa-clock-rotate-left', 'fa-rotate-left', 'fa-sparkles', 'fa-file-import']) {
    assert.match(markup, new RegExp(icon));
  }
  assert.doesNotMatch(markup, /st-esg-multi-task-preview|st-esg-multi-task-extra|st-esg-multi-task-result/);
  assert.doesNotMatch(markup, /data-multi-task-action="settings"|data-multi-task-action="rename"|data-multi-task-action="delete"/);
});

test('multi-task workspace styles use compact tabs and icon actions while animating only running lamps', async () => {
  const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  assert.match(css, /\.st-esg-generation-mode-switch\s*\{[^}]*display:\s*flex/s);
  assert.doesNotMatch(css, /\.st-esg-generation-mode-switch\s*\{[^}]*grid-template-columns/s);
  assert.match(css, /\.st-esg-generation-mode\.active::after\s*\{[^}]*background:/s);
  assert.match(css, /\.st-esg-multi-task-tabs\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /\.st-esg-multi-task-tools \.menu_button\s*\{[^}]*width:\s*34px/s);
  assert.match(css, /data-task-status="generating"[^}]*animation:\s*st-esg-task-breathe/s);
  assert.match(css, /prefers-reduced-motion:\s*reduce[^}]*st-esg-task-status-lamp/s);
  assert.doesNotMatch(css, /\.st-esg-multi-task-preview\s*\{/);
});
