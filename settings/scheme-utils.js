export const SCHEME_TYPES = ['api', 'task', 'preset', 'worldbook'];

const textOf = (value) => String(value ?? '').trim();
const clone = (value) => JSON.parse(JSON.stringify(value ?? {}));

export function normalizeSchemeList(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object' && textOf(item.name)) : [];
}

function groupKeys(groups, predicate) {
  const keys = new Set();
  for (const group of Array.isArray(groups) ? groups : []) {
    if (!predicate(group)) continue;
    for (const item of Array.isArray(group.items) ? group.items : []) {
      if (item?.key) keys.add(item.key);
    }
  }
  return keys;
}

function pickByKeys(source, keys) {
  const result = {};
  const store = source && typeof source === 'object' ? source : {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(store, key)) result[key] = store[key];
  }
  return result;
}

function hasSelectedWorldbookItem(group, selections) {
  const store = selections && typeof selections === 'object' ? selections : {};
  return (Array.isArray(group?.items) ? group.items : []).some((item) => (
    item?.key && Object.prototype.hasOwnProperty.call(store, item.key) && store[item.key] !== false
  ));
}

export function getWorldbookSchemeSourceNames(snapshot = {}) {
  const sourceNames = [...new Set((Array.isArray(snapshot?.worldbookSources) ? snapshot.worldbookSources : [])
    .map(textOf)
    .filter(Boolean))];
  const selectionSources = new Set();
  for (const store of [snapshot?.promptSelections, snapshot?.importSelections]) {
    for (const [key, value] of Object.entries(store && typeof store === 'object' ? store : {})) {
      const parts = String(key).split('::');
      if (value !== false && parts[2] === '世界书' && textOf(parts[1])) selectionSources.add(textOf(parts[1]));
    }
  }

  // Older versions saved every discoverable worldbook. When that snapshot also carries
  // explicit entry selections, those selections are the reliable static source list.
  return sourceNames;
}

export function captureSchemeSnapshot(type, settings, groups = [], options = {}) {
  const isWorldbookGroup = options.isWorldbookGroup || ((group) => group?.scope === 'worldbook');
  if (type === 'api') {
    return {
      apiUrl: settings.apiUrl || '',
      apiKey: settings.apiKey || '',
      apiModel: settings.apiModel || '',
      apiModelOptions: Array.isArray(settings.apiModelOptions) ? [...settings.apiModelOptions] : [],
      maxTokens: settings.maxTokens || '',
      temperature: settings.temperature || '',
      additionalBodyYaml: settings.additionalBodyYaml || '',
      excludedBodyYaml: settings.excludedBodyYaml || '',
      additionalHeadersYaml: settings.additionalHeadersYaml || '',
      streamingEnabled: Boolean(settings.streamingEnabled),
    };
  }
  if (type === 'task') return { taskPrompt: settings.taskPrompt || '' };
  if (type === 'preset') {
    const keys = groupKeys(groups, (group) => !isWorldbookGroup(group));
    return {
      activeSourcePreset: settings.activeSourcePreset || '',
      sourceMode: settings.sourceModes?.preset || settings.sourceMode || 'prompt',
      taskPlacementEnabled: Boolean(settings.taskPlacementEnabled),
      taskPlacementAfterSourceId: settings.taskPlacementAfterSourceId || '',
      replaceLastUserMessageWithTask: Boolean(settings.replaceLastUserMessageWithTask),
      omitOriginalUserMessages: Boolean(settings.omitOriginalUserMessages),
      promptSelections: pickByKeys(settings.promptSelections, keys),
      importSelections: pickByKeys(settings.importSelections, keys),
      sourceContentOverrides: pickByKeys(settings.sourceContentOverrides, keys),
    };
  }
  if (type === 'worldbook') {
    const worldbookGroups = (Array.isArray(groups) ? groups : []).filter(isWorldbookGroup);
    const sourceSelections = (settings.sourceModes?.worldbook || settings.sourceMode || 'prompt') === 'import'
      ? settings.importSelections
      : settings.promptSelections;
    const configuredSources = new Set((Array.isArray(settings.worldbookDraftSources) ? settings.worldbookDraftSources : [])
      .map(textOf)
      .filter(Boolean));
    // A dirty or saved scheme keeps its own source list. Tavern default has no draft list,
    // so retain the native active books until the user makes a change.
    const savedWorldbookGroups = configuredSources.size
      ? worldbookGroups.filter((group) => configuredSources.has(textOf(group.source)))
      : worldbookGroups.filter((group) => (
        textOf(group?.category) !== 'inactive' || hasSelectedWorldbookItem(group, sourceSelections)
      ));
    const keys = groupKeys(savedWorldbookGroups, () => true);
    return {
      worldbookSources: [...new Set(savedWorldbookGroups.map((group) => textOf(group.source)).filter(Boolean))],
      sourceMode: settings.sourceModes?.worldbook || settings.sourceMode || 'prompt',
      promptSelections: pickByKeys(settings.promptSelections, keys),
      importSelections: pickByKeys(settings.importSelections, keys),
      sourceContentOverrides: pickByKeys(settings.sourceContentOverrides, keys),
      worldbookActivationOverrides: pickByKeys(settings.worldbookActivationOverrides, keys),
      worldbookKeywordOverrides: pickByKeys(settings.worldbookKeywordOverrides, keys),
    };
  }
  return {};
}

export function saveScheme(list, name, snapshot, id = '') {
  const cleanName = textOf(name);
  if (!cleanName) return normalizeSchemeList(list);
  const schemes = normalizeSchemeList(list).map((item) => ({ ...item, snapshot: clone(item.snapshot) }));
  const schemeId = textOf(id) || `scheme-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const next = { id: schemeId, name: cleanName, updatedAt: Date.now(), snapshot: clone(snapshot) };
  const index = schemes.findIndex((item) => item.id === schemeId);
  if (index >= 0) schemes[index] = next;
  else schemes.push(next);
  return schemes;
}

export function findScheme(list, id) {
  const schemeId = textOf(id);
  return normalizeSchemeList(list).find((item) => item.id === schemeId) || null;
}

export function deleteScheme(list, id) {
  const schemeId = textOf(id);
  return normalizeSchemeList(list).filter((item) => item.id !== schemeId);
}
