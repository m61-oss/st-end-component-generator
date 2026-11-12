import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createPluginUpdater, renderPluginUpdates } from './plugin-updates.js';

function setup({ available = true, failUpdate = false, failLogs = false } = {}) {
  const calls = [];
  const updater = createPluginUpdater({
    moduleUrl: 'https://localhost/scripts/extensions/third-party/custom-folder/index.js?ver=0.2.5',
    currentVersion: '0.2.6',
    getExtensionTypes: () => ({ 'third-party/custom-folder': 'global' }),
    getHeaders: () => ({ 'X-CSRF-Token': 'token' }),
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url === '/api/extensions/version') return { ok: true, json: async () => ({ isUpToDate: !available, currentBranchName: 'codex/multi-task-framework', remoteUrl: 'https://github.com/m61-oss/st-end-component-generator.git' }) };
      if (url === '/api/extensions/update') return { ok: !failUpdate, status: 500, json: async () => ({ isUpToDate: false }) };
      if (failLogs) throw new Error('offline');
      return { ok: true, json: async () => url.includes('manifest.json') ? { version: '0.2.7' } : [{ version: '0.2.7', changes: ['修复下拉框'] }] };
    },
  });
  return { updater, calls };
}

test('uses the installed folder, install scope and branch; caches and shares checks', async () => {
  const { updater, calls } = setup();
  await Promise.all([updater.check(), updater.check()]);
  await updater.check();
  assert.equal(calls.filter(call => call.url === '/api/extensions/version').length, 1);
  assert.deepEqual(JSON.parse(calls[0].options.body), { extensionName: '/custom-folder', global: true });
  assert.equal(calls[0].options.headers['X-CSRF-Token'], 'token');
  assert.ok(calls.some(call => call.url.includes('/codex%2Fmulti-task-framework/manifest.json')));
  assert.equal(updater.state.latestVersion, '0.2.7');
  assert.equal(updater.state.available, true);
});

test('updates once and preserves the refresh hint without more network requests', async () => {
  const { updater, calls } = setup();
  await updater.check();
  await Promise.all([updater.update(), updater.update()]);
  const count = calls.length;
  await updater.check(true);
  await updater.update();
  assert.equal(calls.length, count);
  assert.equal(calls.filter(call => call.url === '/api/extensions/update').length, 1);
  assert.equal(updater.state.updated, true);
  assert.equal(updater.state.available, false);
  assert.equal(updater.state.busy, false);
});

test('update clicks waiting for an ongoing check still issue only one update', async () => {
  const { updater, calls } = setup();
  const check = updater.check();
  await Promise.all([check, updater.update(), updater.update()]);
  assert.equal(calls.filter(call => call.url === '/api/extensions/update').length, 1);
});

test('failed update keeps availability and allows a retry', async () => {
  const { updater } = setup({ failUpdate: true });
  await updater.check();
  await assert.rejects(updater.update(), /更新失败/);
  assert.equal(updater.state.available, true);
  assert.equal(updater.state.busy, false);
});

test('remote log failures do not prevent an update', async () => {
  const { updater } = setup({ failLogs: true });
  await updater.check();
  assert.equal(updater.state.available, true);
  await updater.update();
  assert.equal(updater.state.updated, true);
});

test('up to date installations show no update marker', async () => {
  const { updater } = setup({ available: false });
  await updater.check();
  assert.equal(updater.state.available, false);
});

test('renders escaped changelog content and a manual update action', () => {
  const html = renderPluginUpdates({ currentVersion: '0.2.6', available: true, changes: [{ version: '0.2.7', changes: ['<img src=x onerror=alert(1)>'] }] });
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('data-plugin-update'));
  assert.ok(html.includes('更新插件'));
  assert.ok(renderPluginUpdates({ updated: true, changes: [] }).includes('更新完成，刷新页面后生效'));
});

test('shows versions without exposing the installed branch', () => {
  const html = renderPluginUpdates({ currentVersion: '0.2.6', latestVersion: '0.2.7', branch: 'codex/multi-task-framework', changes: [] });
  assert.ok(html.includes('v0.2.6'));
  assert.ok(html.includes('v0.2.7'));
  assert.ok(!html.includes('codex/multi-task-framework'));
  assert.ok(!html.includes('\u5206\u652f'));
});

test('version entry reflects available and pending-refresh states without opening a dialog', async () => {
  const source = await readFile(new URL('../index.js', import.meta.url), 'utf8');
  const renderState = source.match(/function renderPluginUpdateState\(\) \{[\s\S]*?\n\}/)[0];
  const badge = { classList: { toggle() {} } };
  const content = {};
  const state = { available: true, updated: false, changes: [] };
  const sandbox = vm.createContext({
    pluginUpdater: { get state() { return state; } },
    EXTENSION_VERSION: '0.2.6',
    localPluginChangelog: [{ version: '0.2.6', changes: ['本地日志'] }],
    renderPluginUpdates,
    targetDoc: { querySelector: selector => selector.includes('help-body') ? content : badge },
  });
  vm.runInContext(`${renderState}\nrenderPluginUpdateState();`, sandbox);
  assert.equal(badge.textContent, 'v0.2.6 · 有更新');
  assert.ok(content.innerHTML.includes('本地日志'));
  state.updated = true;
  state.available = false;
  vm.runInContext('renderPluginUpdateState();', sandbox);
  assert.equal(badge.textContent, 'v0.2.6 · 待刷新');
  assert.ok(content.innerHTML.includes('更新完成，刷新页面后生效'));
});

test('unknown install scopes and malformed host responses fail without claiming success', async () => {
  let requested = false;
  const options = {
    moduleUrl: 'https://localhost/scripts/extensions/third-party/custom-folder/index.js',
    currentVersion: '0.2.6',
    getExtensionTypes: () => ({}),
    getHeaders: () => ({}),
    fetch: async () => { requested = true; return { ok: true, json: async () => ({}) }; },
  };
  const unknown = createPluginUpdater(options);
  await assert.rejects(unknown.check(), /安装范围/);
  assert.equal(requested, false);
  const malformed = createPluginUpdater({ ...options, getExtensionTypes: () => ({ 'third-party/custom-folder': 'local' }) });
  await assert.rejects(malformed.check(), /无法识别的更新结果/);
  assert.equal(malformed.state.available, false);
  assert.equal(malformed.state.busy, false);
});
