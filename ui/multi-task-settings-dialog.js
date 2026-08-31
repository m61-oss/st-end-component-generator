import { normalizeMultiTaskSettings } from '../generation/multi-task-state.js';
import { normalizeSchemeList } from '../settings/scheme-utils.js';

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

export function renderMultiTaskSchemeOptions(list, selectedId, emptyLabel = '未选择') {
  const options = [`<option value="">${escapeHtml(emptyLabel)}</option>`];
  for (const scheme of normalizeSchemeList(list)) {
    options.push(`<option value="${escapeHtml(scheme.id)}"${scheme.id === selectedId ? ' selected' : ''}>${escapeHtml(scheme.name)}</option>`);
  }
  return options.join('');
}

export function createMultiTaskSettingsDialogController({
  getSettings,
  setMultiTaskSettings,
  targetDoc,
  getThemeClassName,
  replaceTask,
  saveSettings,
  notify,
  handleAction,
  textOf = (value) => String(value ?? '').trim(),
} = {}) {
  function show(initialPage = 'general') {
    const settings = getSettings();
    const state = normalizeMultiTaskSettings(settings.multiTaskSettings);
    const settingsCard = targetDoc.querySelector('.st-esg-generation-settings');
    const injectionSection = settingsCard?.querySelector('.st-esg-generation-injection-section');
    if (!settingsCard || !injectionSection) return;
    targetDoc.getElementById('st-esg-generation-mode-settings-dialog')?.remove();
    const settingsMarker = targetDoc.createComment('st-esg-generation-settings-home');
    const injectionMarker = targetDoc.createComment('st-esg-single-task-injection-home');
    injectionSection.before(injectionMarker);
    settingsCard.before(settingsMarker);
    const dialog = targetDoc.createElement('dialog');
    dialog.id = 'st-esg-generation-mode-settings-dialog';
    dialog.className = `st-esg-scheme-name-dialog st-esg-generation-mode-settings-dialog st-esg-multi-task-settings-dialog ${getThemeClassName(settings.theme)}`;
    const taskFields = state.tasks.map((item) => `<section class="st-esg-multi-task-settings-task" data-multi-task-settings-task-id="${escapeHtml(item.id)}">
      <header class="st-esg-multi-task-settings-task-head"><strong>${escapeHtml(item.name)}</strong><div><button class="menu_button menu_button_icon st-esg-secondary-action" type="button" data-multi-task-settings-action="rename" data-multi-task-task-id="${escapeHtml(item.id)}" aria-label="重命名 ${escapeHtml(item.name)}" title="改名"><i class="fa-solid fa-pen" aria-hidden="true"></i></button><button class="menu_button menu_button_icon st-esg-secondary-action st-esg-icon-danger" type="button" data-multi-task-settings-action="delete" data-multi-task-task-id="${escapeHtml(item.id)}" aria-label="删除 ${escapeHtml(item.name)}" title="删除"><i class="fa-solid fa-trash" aria-hidden="true"></i></button></div></header>
      <label class="st-esg-multi-task-compact-field"><span>预设方案</span><select class="text_pole" data-multi-task-task-field="presetSchemeId">${renderMultiTaskSchemeOptions(settings.presetSchemes, item.presetSchemeId, '酒馆默认')}</select></label>
      <label class="st-esg-multi-task-compact-field"><span>世界书方案</span><select class="text_pole" data-multi-task-task-field="worldbookSchemeId">${renderMultiTaskSchemeOptions(settings.worldbookSchemes, item.worldbookSchemeId, '酒馆默认')}</select></label>
      <label class="st-esg-multi-task-compact-field"><span>API 方案</span><select class="text_pole" data-multi-task-task-field="apiSchemeId">${renderMultiTaskSchemeOptions(settings.apiSchemes, item.apiSchemeId)}</select></label>
      <label class="st-esg-multi-task-compact-field"><span>组件方案</span><select class="text_pole" data-multi-task-task-field="componentSchemeId">${renderMultiTaskSchemeOptions(settings.componentSchemes, item.componentSchemeId)}</select></label>
      <label class="st-esg-multi-task-compact-field"><span>注入方式</span><select class="text_pole" data-multi-task-task-field="injectMode"><option value="append"${item.injectMode === 'append' ? ' selected' : ''}>追加</option><option value="anchor"${item.injectMode === 'anchor' ? ' selected' : ''}>锚点插入</option></select></label>
    </section>`).join('') || '<div class="st-esg-multi-task-settings-empty">还没有任务，请点击“添加任务”。</div>';
    const activePage = initialPage === 'tasks' ? 'tasks' : 'general';
    dialog.innerHTML = `<div class="st-esg-generation-mode-settings-shell"><header><div class="st-esg-card-title">生成设置</div><button class="menu_button menu_button_icon st-esg-secondary-action" type="button" data-generation-settings-close aria-label="关闭设置" title="关闭设置"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header>
      <div class="st-esg-generation-settings-pages" role="tablist" aria-label="生成设置分页"><button class="${activePage === 'general' ? 'active' : ''}" type="button" role="tab" aria-selected="${activePage === 'general'}" data-generation-settings-page="general">通用设置</button><button class="${activePage === 'tasks' ? 'active' : ''}" type="button" role="tab" aria-selected="${activePage === 'tasks'}" data-generation-settings-page="tasks">任务配置</button></div>
      <div class="st-esg-all-mode-settings-body">
        <section class="st-esg-generation-settings-panel${activePage === 'general' ? '' : ' st-esg-hidden'}" data-generation-settings-panel="general"><div data-generation-settings-card-host></div></section>
        <section class="st-esg-generation-settings-panel${activePage === 'tasks' ? '' : ' st-esg-hidden'}" data-generation-settings-panel="tasks">
          <section class="st-esg-multi-task-settings-section"><div class="st-esg-generation-settings-section-title"><strong>单任务</strong></div><div data-single-task-injection-host></div></section>
          <section class="st-esg-multi-task-settings-section"><div class="st-esg-multi-task-settings-heading"><strong>多任务</strong><button class="menu_button menu_button_icon st-esg-secondary-action" type="button" data-multi-task-settings-action="add"><i class="fa-solid fa-plus" aria-hidden="true"></i><span>添加任务 ${state.tasks.length}/5</span></button></div>
            <div class="st-esg-multi-task-runtime-settings"><div class="st-esg-multi-task-runtime-row"><label class="st-esg-multi-task-runtime-field"><span>并发任务数</span><select class="text_pole" name="concurrency">${[1, 2, 3, 4, 5].map((value) => `<option value="${value}"${state.concurrency === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label><label class="st-esg-multi-task-runtime-field"><span>注入间隔</span><input class="text_pole" type="number" name="injectionIntervalSeconds" min="0" max="10" step="0.5" value="${state.injectionIntervalSeconds}"></label><label class="st-esg-multi-task-runtime-field"><span>注入顺序</span><select class="text_pole" name="injectionOrder"><option value="completion"${state.injectionOrder === 'completion' ? ' selected' : ''}>完成顺序</option><option value="task"${state.injectionOrder === 'task' ? ' selected' : ''}>任务顺序</option></select></label></div><em class="st-esg-multi-task-runtime-help">超出并发数的任务会自动排队；自动注入可按完成顺序即时注入，或等待前项后按任务顺序注入；失败或停止的任务会自动跳过；注入间隔范围为 0–10 秒。</em></div>
            <div class="st-esg-multi-task-settings-list">${taskFields}</div>
          </section>
        </section>
      </div>
    </div>`;
    settingsCard.classList.remove('st-esg-hidden');
    settingsCard.open = true;
    dialog.querySelector('[data-generation-settings-card-host]').appendChild(settingsCard);
    dialog.querySelector('[data-single-task-injection-host]').appendChild(injectionSection);
    const finish = () => {
      if (dialog.open) dialog.close();
      injectionMarker.replaceWith(injectionSection);
      settingsMarker.replaceWith(settingsCard);
      settingsCard.classList.add('st-esg-hidden');
      dialog.remove();
    };
    dialog.querySelectorAll('[data-generation-settings-close]').forEach((button) => button.addEventListener('click', finish));
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(); });
    dialog.querySelectorAll('[data-generation-settings-page]').forEach((button) => button.addEventListener('click', () => {
      const nextPage = String(button.getAttribute('data-generation-settings-page'));
      dialog.querySelectorAll('[data-generation-settings-page]').forEach((item) => {
        const isActive = item === button;
        item.classList.toggle('active', isActive);
        item.setAttribute('aria-selected', String(isActive));
      });
      dialog.querySelectorAll('[data-generation-settings-panel]').forEach((panel) => panel.classList.toggle('st-esg-hidden', panel.getAttribute('data-generation-settings-panel') !== nextPage));
    }));
    dialog.querySelectorAll('[data-multi-task-settings-action]').forEach((button) => button.addEventListener('click', () => {
      const action = String(button.getAttribute('data-multi-task-settings-action'));
      const taskId = String(button.getAttribute('data-multi-task-task-id') || '');
      if (action === 'add' && state.tasks.length >= 5) {
        notify('最多只能添加五个任务。', 'warning');
        return;
      }
      finish();
      void handleAction(action, true, taskId);
    }));
    dialog.querySelectorAll('[data-multi-task-task-field]').forEach((control) => control.addEventListener('change', () => {
      const taskId = String(control.closest('[data-multi-task-settings-task-id]')?.getAttribute('data-multi-task-settings-task-id') || '');
      const field = String(control.getAttribute('data-multi-task-task-field') || '');
      if (!taskId || !['componentSchemeId', 'apiSchemeId', 'presetSchemeId', 'worldbookSchemeId', 'injectMode'].includes(field)) return;
      const rawValue = textOf(control.value);
      replaceTask(taskId, { [field]: field === 'injectMode' ? (rawValue === 'anchor' ? 'anchor' : 'append') : rawValue });
      saveSettings();
    }));
    for (const [name, field] of [['concurrency', 'concurrency'], ['injectionIntervalSeconds', 'injectionIntervalSeconds'], ['injectionOrder', 'injectionOrder']]) {
      dialog.querySelector(`[name="${name}"]`)?.addEventListener('change', (event) => {
        const next = normalizeMultiTaskSettings({ ...getSettings().multiTaskSettings, [field]: event.currentTarget.value });
        setMultiTaskSettings(next);
        if (field === 'injectionIntervalSeconds') event.currentTarget.value = String(next.injectionIntervalSeconds);
        saveSettings();
      });
    }
    targetDoc.body.appendChild(dialog);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  return { show };
}
