const textOf = (value) => String(value ?? '').trim();
const byteSize = (value) => new TextEncoder().encode(JSON.stringify(value ?? null)).length;

export function formatByteSize(size) {
  const bytes = Math.max(0, Number(size) || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
    characterGroups,
    presetGroups,
    chatBindings,
    orphanComponentIds,
    orphanBindingChatIds,
  };
}
