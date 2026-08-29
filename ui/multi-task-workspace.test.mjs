import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createMultiTask } from '../generation/multi-task-state.js';
import { renderGenerationModeSwitch, renderMultiTaskWorkspace } from './multi-task-workspace.js';

test('renders an explicit single and multi task mode switch', () => {
  const markup = renderGenerationModeSwitch('multi');
  assert.match(markup, /data-generation-mode="single"/);
  assert.match(markup, /data-generation-mode="multi"[^>]*aria-pressed="true"/);
  assert.match(markup, />单任务</);
  assert.match(markup, />多任务</);
});

test('renders a focused empty state before the first multi-task is added', () => {
  const markup = renderMultiTaskWorkspace({ tasks: [] });
  assert.match(markup, /st-esg-multi-task-empty/);
  assert.match(markup, /添加第一个任务/);
  assert.doesNotMatch(markup, /st-esg-multi-task-preview/);
});

test('renders named task tabs and only one active result surface', () => {
  let state = createMultiTask({}, '<状态栏>', { id: 'status', status: 'generating', extraInstruction: '保留标签' }).state;
  state = createMultiTask(state, '小剧场', { id: 'theater', status: 'queued' }).state;
  const markup = renderMultiTaskWorkspace({ ...state, activeTaskId: 'status' });

  assert.match(markup, /data-multi-task-id="status"[^>]*aria-selected="true"/);
  assert.match(markup, /aria-label="&lt;状态栏&gt;，生成中"/);
  assert.match(markup, /&lt;状态栏&gt;/);
  assert.match(markup, /data-task-status="generating"/);
  assert.match(markup, /data-task-status="queued"/);
  assert.equal((markup.match(/st-esg-multi-task-preview/g) || []).length, 1);
  assert.ok(markup.indexOf('st-esg-multi-task-extra') < markup.indexOf('st-esg-multi-task-result'));
  assert.match(markup, /保留标签/);
  assert.match(markup, /撤回任务/);
  assert.match(markup, /生成任务/);
  assert.match(markup, /撤回全部/);
  assert.match(markup, /生成全部/);
});

test('multi-task workspace styles keep actions horizontal and animate only running lamps', async () => {
  const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  assert.match(css, /\.st-esg-multi-task-tabs\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /\.st-esg-multi-task-actions\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s);
  assert.match(css, /data-task-status="generating"[^}]*animation:\s*st-esg-task-breathe/s);
  assert.match(css, /prefers-reduced-motion:\s*reduce[^}]*st-esg-task-status-lamp/s);
  assert.match(css, /\.st-esg-multi-task-preview\s*\{[^}]*min-height:/s);
});
