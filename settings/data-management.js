const textOf = (value) => String(value ?? '').trim();
const byteSize = (value) => new TextEncoder().encode(JSON.stringify(value ?? null)).length;
const hasStoredValue = (value) => {
  if (value == null || value === '') return false;
  if (Array.isArray(value)) return value.some(hasStoredValue);
  if (typeof value === 'object') return Object.values(value).some(hasStoredValue);
  return true;
};

export function formatByteSize(size) {
  const bytes = Math.max(0, Number(size) || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function clearSettingsDataCategory(settings, category, updatedAt = Date.now()) {
  const next = settings && typeof settings === 'object' ? settings : {};
  if (category === 'schemes') {
    next.apiSchemes = [];
    next.taskSchemes = [];
    next.presetSchemes = [];
    next.worldbookSchemes = [];
    next.selectedApiSchemeId = '';
    next.selectedTaskSchemeId = '';
    next.selectedPresetSchemeId = '';
    next.selectedWorldbookSchemeId = '';
    next.activeSchemeIds = {};
    next.dirtySchemeTypes = {};
  } else if (category === 'libraries') {
    next.components = [];
    next.componentGroups = [];
    next.defaultGroupEnabled = {};
    next.theaterComponents = [];
    next.theaterGroups = [];
    next.theaterDefaultGroupEnabled = true;
  } else if (category === 'bindings') {
    next.chatWorldbookBindings = (Array.isArray(next.chatWorldbookBindings) ? next.chatWorldbookBindings : [])
      .map((item) => ({ chatId: textOf(item?.chatId), cancelled: true, updatedAt }))
      .filter((item) => item.chatId);
  }
  return next;
}

function groupComponents(items, keyOf, labelOf, isOrphan) {
  const groups = new Map();
  for (const item of items) {
    const key = keyOf(item) || 'unknown';
    if (!groups.has(key)) groups.set(key, { key, label: labelOf(item) || '未知归属', orphan: isOrphan(item), items: [] });
    groups.get(key).items.push(item);
  }
  return [...groups.values()];
}

export function buildDataManagementModel(settings, { characterNames = [], runtimeData = {} } = {}) {
  const components = Array.isArray(settings?.components) ? settings.components : [];
  const presetSchemes = Array.isArray(settings?.presetSchemes) ? settings.presetSchemes : [];
  const worldbookSchemes = Array.isArray(settings?.worldbookSchemes) ? settings.worldbookSchemes : [];
  const presetIds = new Set(presetSchemes.map((item) => textOf(item?.id)).filter(Boolean));
  const worldbookIds = new Set(worldbookSchemes.map((item) => textOf(item?.id)).filter(Boolean));
  const characters = new Set(characterNames.map(textOf).filter(Boolean));
  const characterItems = components.filter((item) => textOf(item?.scope) === '角色');
  const presetItems = components.filter((item) => textOf(item?.scope) === '预设');
  const characterGroups = groupComponents(characterItems, (item) => textOf(item?.bindName), (item) => textOf(item?.bindName), (item) => characters.size > 0 && !characters.has(textOf(item?.bindName)));
  const presetGroups = groupComponents(presetItems, (item) => textOf(item?.presetSchemeId) || textOf(item?.bindName), (item) => textOf(item?.bindName), (item) => Boolean(textOf(item?.presetSchemeId)) && !presetIds.has(textOf(item?.presetSchemeId)));
  const chatBindings = (Array.isArray(settings?.chatWorldbookBindings) ? settings.chatWorldbookBindings : [])
    .filter((item) => !item?.cancelled)
    .map((item) => ({ ...item, orphan: !worldbookIds.has(textOf(item?.schemeId)) }));
  const orphanComponentIds = [...characterGroups, ...presetGroups].filter((group) => group.orphan).flatMap((group) => group.items.map((item) => textOf(item?.id))).filter(Boolean);
  const orphanBindingChatIds = chatBindings.filter((item) => item.orphan).map((item) => textOf(item?.chatId)).filter(Boolean);
  const schemes = { api: settings?.apiSchemes, task: settings?.taskSchemes, preset: presetSchemes, worldbook: worldbookSchemes };
  const libraries = { components, componentGroups: settings?.componentGroups, theaterComponents: settings?.theaterComponents, theaterGroups: settings?.theaterGroups };
  const bindings = { chatWorldbookBindings: settings?.chatWorldbookBindings };
  const caches = { lastPromptLog: settings?.lastPromptLog, lastGenerated: settings?.lastGenerated, lastGeneratedThinking: settings?.lastGeneratedThinking, ...runtimeData };
  const settingsSize = byteSize(settings);
  const externalRuntimeSize = byteSize(runtimeData);
  return {
    storage: { total: settingsSize + externalRuntimeSize, schemes: byteSize(schemes), libraries: byteSize(libraries), bindings: byteSize(bindings), caches: byteSize(caches) },
    counts: {
      schemes: [settings?.apiSchemes, settings?.taskSchemes, presetSchemes, worldbookSchemes].reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0),
      libraries: components.length + (Array.isArray(settings?.theaterComponents) ? settings.theaterComponents.length : 0),
      bindings: chatBindings.length,
      runtime: [settings?.lastGenerated, settings?.lastPromptLog, ...(Array.isArray(settings?.lastGeneratedThinking) ? settings.lastGeneratedThinking : []), ...Object.values(runtimeData || {})].filter(hasStoredValue).length,
    },
    characterGroups,
    presetGroups,
    chatBindings,
    orphanComponentIds,
    orphanBindingChatIds,
  };
}
