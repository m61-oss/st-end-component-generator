import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createMultiTask } from '../generation/multi-task-state.js';
import { renderGenerationModeSwitch, renderMultiTaskWorkspace } from './multi-task-workspace.js';

test('renders compact generation mode tabs with shared history and settings icons', () => {
  const markup = renderGenerationModeSwitch('multi');
  assert.match(markup, /data-generation-mode="single"/);
  assert.match(markup, /data-generation-mode="multi"[^>]*aria-pressed="true"/);
  assert.match(markup, /data-generation-mode-settings/);
  assert.match(markup, /data-generation-history-open/);
  assert.equal((markup.match(/fa-gear/g) || []).length, 1);
  assert.equal((markup.match(/fa-clock-rotate-left/g) || []).length, 1);
  const settingsButton = markup.match(/<button[^>]*data-generation-mode-settings[^>]*>/)?.[0] || '';
  assert.match(settingsButton, /title="生成设置"/);
  assert.match(settingsButton, /aria-label="生成设置"/);
  assert.match(markup, /st-esg-generation-mode-actions/);
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

test('does not repeat an idle ready label beside the task status lamp', () => {
  const state = createMultiTask({}, '任务 1', { id: 'task-1' }).state;
  const markup = renderMultiTaskWorkspace(state);
  assert.doesNotMatch(markup, />就绪</);
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
  assert.match(markup, /st-esg-multi-task-toolbar/);
  assert.doesNotMatch(markup, /st-esg-multi-task-current-copy|st-esg-multi-task-head/);
  assert.doesNotMatch(markup, /data-multi-task-action="history"/);
  assert.match(markup, /data-multi-task-action="undo"[^>]*aria-label="撤回当前任务"/);
  assert.match(markup, /data-multi-task-action="generate"[^>]*aria-label="生成当前任务"/);
  assert.match(markup, /data-multi-task-action="inject"[^>]*aria-label="注入当前任务"/);
  const taskGenerateButton = markup.match(/<button[^>]*data-multi-task-action="generate"[^>]*>/)?.[0] || '';
  assert.match(taskGenerateButton, /st-esg-secondary-action/);
  assert.doesNotMatch(taskGenerateButton, /st-esg-primary-action/);
  const taskActionButtons = [...markup.matchAll(/<button[^>]*data-multi-task-action="(?:undo|generate|inject)"[^>]*>/g)].map((match) => match[0]);
  assert.equal(taskActionButtons.length, 3);
  for (const button of taskActionButtons) {
    assert.match(button, /st-esg-secondary-action/);
    assert.match(button, / disabled(?: |>|$)/);
    assert.doesNotMatch(button, /st-esg-primary-action/);
  }
  for (const icon of ['fa-rotate-left', 'fa-wand-magic-sparkles', 'fa-file-import']) {
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
  assert.match(css, /\.st-esg-multi-task-toolbar\s*\{[^}]*display:\s*flex[^}]*align-items:\s*center/s);
  assert.match(css, /\.st-esg-multi-task-tabs\s*\{[^}]*flex:\s*1 1 auto/s);
  assert.match(css, /\.st-esg-multi-task-tab\s*\{[^}]*min-height:\s*26px[^}]*font-size:\s*11px[^}]*border:\s*1px solid[^}]*border-radius:\s*999px/s);
  assert.match(css, /\.st-esg-multi-task-tab\.active\s*\{[^}]*border-color:/s);
  assert.match(css, /\.st-esg-multi-task-tools \.menu_button\s*\{[^}]*width:\s*32px/s);
  assert.match(css, /\.st-esg-generation-settings-pages\s*\{[^}]*display:\s*flex/s);
  assert.match(css, /\.st-esg-generation-mode-settings-shell \.st-esg-generation-settings\s*>\s*summary\s*\{[^}]*display:\s*none/s);
  assert.match(css, /\.st-esg-multi-task-compact-field\s*\{[^}]*grid-template-columns:/s);
  assert.match(css, /\.st-esg-multi-task-compact-field \.text_pole\s*\{[^}]*height:\s*34px\s*!important/s);
  assert.match(css, /\.st-esg-generation-mode-settings-shell\s*>\s*header\s*\{[^}]*padding:\s*10px 12px/s);
  assert.match(css, /\.st-esg-all-mode-settings-body\s*\{[^}]*padding:\s*8px/s);
  assert.match(css, /\.st-esg-multi-task-concurrency-help\s*\{[^}]*grid-column:\s*2/s);
  assert.match(css, /\.st-esg-multi-task-settings-list\s*\{[^}]*display:\s*grid/s);
  assert.doesNotMatch(css, /\.st-esg-multi-task-settings-tabs\s*\{/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*\.st-esg-multi-task-settings-dialog[^{]*\{[^}]*margin:\s*auto(?:;|\s)/s);
  assert.doesNotMatch(css, /\.st-esg-multi-task-settings-dialog[^{]*\{[^}]*margin:\s*auto 0 0/s);
  assert.match(css, /data-task-status="generating"[^}]*animation:\s*st-esg-task-breathe/s);
  assert.match(css, /prefers-reduced-motion:\s*reduce[^}]*st-esg-task-status-lamp/s);
  assert.doesNotMatch(css, /\.st-esg-multi-task-preview\s*\{/);
});
