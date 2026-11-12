export function createPluginUpdater(options) {
  const folder = decodeURIComponent(new URL(options.moduleUrl).pathname.match(/\/third-party\/([^/]+)\//)?.[1] || '');
  const state = { currentVersion: options.currentVersion, latestVersion: '', branch: '', available: false, updated: false, busy: false, checked: false, error: '', changes: options.changes || [] };
  let pending = null;
  let checkedAt = 0;
  const publish = () => options.onChange?.({ ...state });
  async function request(action) {
    if (!folder) throw new Error('无法识别插件安装目录。');
    const types = options.getExtensionTypes();
    const installType = types[`third-party/${folder}`] ?? types[folder];
    if (installType !== 'global' && installType !== 'local') throw new Error('无法识别插件安装范围，请稍后重试。');
    const response = await options.fetch(`/api/extensions/${action}`, {
      method: 'POST',
      headers: { ...options.getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ extensionName: `/${folder}`, global: installType === 'global' }),
      signal: AbortSignal.timeout(action === 'update' ? 120000 : 20000),
    });
    if (!response.ok) throw new Error(`${action === 'update' ? '更新失败' : '检查更新失败'}（${response.status}），请稍后重试。`);
    const data = await response.json();
    if (typeof data.isUpToDate !== 'boolean') throw new Error('宿主返回了无法识别的更新结果。');
    return data;
  }
  async function loadRemoteInfo(data) {
    const repository = String(data.remoteUrl || '').match(/^(?:https:\/\/github\.com\/|git@github\.com:)([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
    if (!repository || !state.branch) return;
    const base = `https://raw.githubusercontent.com/${repository[1]}/${repository[2]}/${encodeURIComponent(state.branch)}`;
    await Promise.allSettled(['manifest.json', 'changelog.json'].map(async (file) => {
      const response = await options.fetch(`${base}/${file}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (!response.ok) return;
      const content = await response.json();
      if (file === 'manifest.json' && typeof content.version === 'string') state.latestVersion = content.version;
      if (file === 'changelog.json' && Array.isArray(content)) state.changes = content;
    }));
  }
  function run(action) {
    state.busy = true;
    state.error = '';
    publish();
    pending = (async () => {
      try {
        const data = await request(action);
        if (action === 'update') {
          state.updated = true;
          state.available = false;
        } else {
          state.available = !data.isUpToDate;
          state.branch = data.currentBranchName || '';
          state.checked = true;
          checkedAt = Date.now();
          publish();
          await loadRemoteInfo(data);
        }
        return { ...state };
      } catch (error) {
        state.error = error?.message || '更新操作失败，请稍后重试。';
        throw error;
      } finally {
        state.busy = false;
        pending = null;
        publish();
      }
    })();
    return pending;
  }
  return {
    get state() { return { ...state }; },
    check(force = false) {
      if (pending) return pending;
      if (state.updated || (!force && state.checked && Date.now() - checkedAt < 30 * 60 * 1000)) return Promise.resolve({ ...state });
      return run('version');
    },
    async update() {
      while (pending) await pending;
      if (state.updated || !state.available) return { ...state };
      return run('update');
    },
  };
}

export function renderPluginUpdates(state) {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const status = state.updated ? '更新完成，刷新页面后生效' : state.busy ? '正在处理，请稍候…' : state.available ? '发现可用更新' : state.checked ? '当前已是最新版本' : '尚未检查更新';
  const logs = (Array.isArray(state.changes) ? state.changes : []).map(entry => `<section class="st-esg-update-release"><h3>v${escape(entry?.version)}</h3><ul>${(Array.isArray(entry?.changes) ? entry.changes : []).map(change => `<li>${escape(change)}</li>`).join('')}</ul></section>`).join('');
  return `<p>当前运行版本：v${escape(state.currentVersion)}${state.latestVersion ? ` · 分支最新版本：v${escape(state.latestVersion)}` : ''}</p>
    ${state.branch ? `<p class="st-esg-help-subtitle">当前分支：${escape(state.branch)}</p>` : ''}
    <p role="status">${escape(status)}</p>${state.error ? `<p role="alert">${escape(state.error)}</p>` : ''}
    <div class="st-esg-update-actions"><button type="button" class="menu_button st-esg-secondary-action" data-plugin-check ${state.busy || state.updated ? 'disabled' : ''}>检查更新</button>
    <button type="button" class="menu_button" data-plugin-update ${!state.available || state.busy || state.updated ? 'disabled' : ''}>更新插件</button></div>
    <p class="st-esg-help-subtitle">更新仅替换插件文件，不会自动刷新页面。你可以在方便时手动刷新，使更新生效。</p>
    <h2>更新日志</h2>${logs || '<p>暂时无法读取更新日志，可稍后重新检查。</p>'}`;
}
