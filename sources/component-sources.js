export const SOURCE_PRESET = '预设';
export const SOURCE_WORLDBOOK = '世界书';
export const COMPONENT_SCOPE_GLOBAL = '全局';
export const COMPONENT_SCOPE_PRESET = '预设';
export const COMPONENT_SCOPE_CHARACTER = '角色';

import { getAnimaEntryKind } from './anima-memory.js';
import { createWorldbookEntryKey, getWorldbookRawName } from './worldbook-identity.js';
import { createPresetEntryKey } from './preset-identity.js';
import { selectPresetPromptOrder } from './preset-export.js';

const textOf = (value) => String(value ?? '').trim();

export function addImportCandidate(candidates, group, source, scope, name, content, enabled = true, metadata = {}) {
  const clean = textOf(content);
  const allowEmpty = metadata?.allowEmpty === true || scope === SOURCE_WORLDBOOK;
  if (!clean && !textOf(metadata?.markerType) && !allowEmpty) return;
  const cleanName = textOf(name) || '未命名条目';
  const emptyUidSuffix = !clean && allowEmpty && metadata?.sourceUid !== undefined
    ? `::${String(metadata.sourceUid)}`
    : '';
  const legacyKey = `${group}::${source}::${scope}::${cleanName}::${clean.slice(0, 200)}${emptyUidSuffix}`;
  const stableWorldbookKey = scope === SOURCE_WORLDBOOK
    ? createWorldbookEntryKey(source, metadata?.sourceUid)
    : '';
  const stablePresetKey = scope === SOURCE_PRESET
    ? createPresetEntryKey(source, metadata?.sourceUid)
    : '';
  const stableKey = stableWorldbookKey || stablePresetKey;
  const identityConflicts = stableKey ? candidates.filter((item) => (
    item.scope === scope
    && item.source === source
    && String(item.sourceUid ?? '') === String(metadata?.sourceUid ?? '')
  )) : [];
  identityConflicts.forEach((item) => { item.key = item.legacyKey || item.key; });
  const key = identityConflicts.length ? legacyKey : stableKey || legacyKey;
  const animaEntryKind = scope === SOURCE_WORLDBOOK ? getAnimaEntryKind({ name: cleanName }) : '';
  const candidateMetadata = {
    ...metadata,
    ...(allowEmpty ? { allowEmpty: true } : {}),
    ...(animaEntryKind ? { animaEntryKind } : {}),
  };
  if (!candidates.some((item) => item.key === key)) {
    candidates.push({ key, legacyKey: stableKey ? legacyKey : '', group, source, scope, name: cleanName, content: clean, enabled: enabled !== false, ...candidateMetadata });
  }
}

export function getPresetEntriesSafe(targetWindow, name) {
  let preset = null;
  try { preset = targetWindow?.TavernHelper?.getPreset?.(name) || null; } catch (_) {}
  return preset && Array.isArray(preset.prompts) ? preset.prompts : [];
}

function getInUsePresetSafe(targetWindow) {
  const candidates = [targetWindow, targetWindow?.parent, globalThis].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const preset = candidate?.getPreset?.('in_use');
      if (preset && Array.isArray(preset.prompts)) return preset;
    } catch (_) {}
  }
  return null;
}

export function getPresetPromptEnabledMap(targetWindow, name) {
  let preset = null;
  try { preset = targetWindow?.TavernHelper?.getPreset?.(name) || null; } catch (_) {}
  const order = getActivePresetPromptOrder(preset);
  return new Map(order.map((entry) => [textOf(entry?.identifier), entry?.enabled !== false]).filter(([identifier]) => Boolean(identifier)));
}

function getActivePresetPromptOrder(preset) {
  const selectedOrder = selectPresetPromptOrder(preset);
  if (selectedOrder.length) return selectedOrder;

  const prompts = Array.isArray(preset?.prompts) ? preset.prompts : [];
  return prompts
    .map((prompt) => ({ identifier: textOf(prompt?.identifier || prompt?.id || prompt?.name), enabled: prompt?.enabled !== false }))
    .filter((orderItem) => orderItem.identifier);
}

function getSelectedCharacter(context) {
  const characterId = textOf(context?.characterId) || textOf(context?.this_chid);
  return context?.characters?.[characterId] || {};
}

function getCharacterField(context, field) {
  const cardFields = getCharacterCardFieldsSafe(context);
  const fieldMap = {
    description: cardFields.description,
    personality: cardFields.personality,
    scenario: cardFields.scenario,
    mes_example: cardFields.mesExamples,
    persona: cardFields.persona,
  };
  if (textOf(fieldMap[field])) return textOf(fieldMap[field]);
  const character = getSelectedCharacter(context);
  return textOf(character?.[field] || character?.data?.[field]);
}

function getCharacterCardFieldsSafe(context) {
  if (typeof context?.getCharacterCardFields !== 'function') return {};
  try {
    return context.getCharacterCardFields({ chid: context?.characterId ?? context?.this_chid }) || {};
  } catch {
    try {
      return context.getCharacterCardFields() || {};
    } catch {
      return {};
    }
  }
}

const BUILTIN_MARKER_PROMPTS = {
  worldInfoBefore: { name: 'World Info (before)', content: '【世界书 before 会在生成时按当前勾选世界书展开】' },
  worldInfoAfter: { name: 'World Info (after)', content: '【世界书 after 会在生成时按当前勾选世界书展开】' },
  charDescription: { name: 'Char Description', getContent: (context) => getCharacterField(context, 'description') },
  charPersonality: { name: 'Char Personality', getContent: (context) => getCharacterField(context, 'personality') },
  scenario: { name: 'Scenario', getContent: (context) => getCharacterField(context, 'scenario') },
  personaDescription: { name: 'Persona Description', getContent: (context) => getCharacterField(context, 'persona') || textOf(context?.personaDescription || context?.power_user?.persona_description || context?.powerUser?.personaDescription) },
  dialogueExamples: { name: 'Chat Examples', getContent: (context) => getCharacterField(context, 'mes_example') },
  chatHistory: { name: 'Chat History', content: '【聊天历史会在生成时按预设位置展开】' },
};

const BUILTIN_MARKER_NAMES = new Map(Object.entries(BUILTIN_MARKER_PROMPTS).map(([markerType, prompt]) => [textOf(prompt.name).toLowerCase(), markerType]));

function getBuiltinMarkerType(value) {
  const clean = textOf(value);
  if (BUILTIN_MARKER_PROMPTS[clean]) return clean;
  return BUILTIN_MARKER_NAMES.get(clean.toLowerCase()) || '';
}

function getBuiltinMarkerPrompt(identifier, context) {
  const markerType = getBuiltinMarkerType(identifier);
  const marker = BUILTIN_MARKER_PROMPTS[markerType];
  if (!marker) return null;
  const content = typeof marker.getContent === 'function' ? marker.getContent(context) : marker.content;
  const placeholderOnly = ['worldInfoBefore', 'worldInfoAfter', 'chatHistory'].includes(markerType);
  return {
    identifier: markerType,
    name: marker.name,
    role: 'system',
    content: placeholderOnly ? '' : textOf(content),
    markerType,
    locked: true,
  };
}

function isNativePresetPlaceholder(targetWindow, prompt, identifier) {
  const markerPrompt = getBuiltinMarkerPrompt(identifier, {}) || getBuiltinMarkerPrompt(prompt?.name, {});
  if (!markerPrompt) return false;
  if (prompt?.marker === true) return true;
  const candidates = [targetWindow, targetWindow?.parent, globalThis].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (typeof candidate?.isPresetPlaceholderPrompt === 'function') return Boolean(candidate.isPresetPlaceholderPrompt(prompt));
    } catch (_) {}
  }
  return !textOf(prompt?.content);
}

function getNativePlaceholderMarker(targetWindow, prompt, context) {
  const identifier = textOf(prompt?.identifier || prompt?.id);
  const markerIdentifier = getBuiltinMarkerType(identifier) || getBuiltinMarkerType(prompt?.name);
  if (!markerIdentifier || !isNativePresetPlaceholder(targetWindow, prompt, markerIdentifier)) return null;
  return getBuiltinMarkerPrompt(markerIdentifier, context);
}

export function isPresetPromptEnabled(prompt, enabledMap) {
  const identifiers = [prompt?.identifier, prompt?.id, prompt?.name].map(textOf).filter(Boolean);
  for (const identifier of identifiers) {
    if (enabledMap.has(identifier)) return enabledMap.get(identifier);
  }
  return prompt?.enabled !== false;
}

export function getCurrentPresetNameSafe(targetWindow, context) {
  const candidates = [
    targetWindow?.TavernHelper?.getCurrentPresetName?.(),
    targetWindow?.TavernHelper?.getSelectedPresetName?.(),
    targetWindow?.getPresetManager?.()?.getSelectedPresetName?.(),
    context?.getPresetManager?.()?.getSelectedPresetName?.(),
    context?.presetName,
  ];
  const selectedFromDom = targetWindow?.document?.querySelector?.('select[data-preset-manager-for] option:checked')?.textContent;
  candidates.push(selectedFromDom);
  return candidates.map(textOf).find(Boolean) || '';
}

export function getPresetNamesSafe(targetWindow, context) {
  const names = targetWindow?.TavernHelper?.getPresetNames?.() || [];
  if (Array.isArray(names) && names.length) return [...new Set(names.map(textOf).filter(Boolean))];
  const current = getCurrentPresetNameSafe(targetWindow, context);
  return current ? [current] : [];
}

export function getCurrentCharacterNameSafe(context) {
  const characterId = textOf(context?.characterId) || textOf(context?.this_chid);
  const character = context?.characters?.[characterId];
  const cardName = textOf(character?.name || character?.data?.name);
  if (cardName) return cardName;
  const fallbackName = textOf(context?.characterName || context?.name2);
  return ['SillyTavern System', 'Assistant'].includes(fallbackName) ? '' : fallbackName;
}

export function normalizeComponentScope(scope) {
  const clean = textOf(scope);
  if (clean === COMPONENT_SCOPE_PRESET) return COMPONENT_SCOPE_PRESET;
  if (clean === COMPONENT_SCOPE_CHARACTER || clean === '角色卡') return COMPONENT_SCOPE_CHARACTER;
  return COMPONENT_SCOPE_GLOBAL;
}

export function getComponentBindingName(scope, targetWindow, context, fallback = '') {
  const normalized = normalizeComponentScope(scope);
  if (normalized === COMPONENT_SCOPE_PRESET) return getCurrentPresetNameSafe(targetWindow, context) || textOf(fallback);
  if (normalized === COMPONENT_SCOPE_CHARACTER) return getCurrentCharacterNameSafe(context) || textOf(fallback);
  return '';
}

export function createComponentId(existingIds = new Set(), cryptoObject = globalThis.crypto) {
  const usedIds = existingIds instanceof Set ? existingIds : new Set(existingIds);
  let candidate = '';
  try { candidate = textOf(cryptoObject?.randomUUID?.()); } catch (_) {}
  if (candidate && !usedIds.has(candidate)) return candidate;
  let collisionOffset = 0;
  do {
    candidate = String(Date.now() + Math.random() + collisionOffset);
    collisionOffset += 1;
  } while (!candidate || usedIds.has(candidate));
  return candidate;
}

export function normalizeComponentIds(components, cryptoObject = globalThis.crypto) {
  const usedIds = new Set();
  return (Array.isArray(components) ? components : []).map((component) => {
    const currentId = textOf(component?.id);
    const id = currentId && !usedIds.has(currentId) ? currentId : createComponentId(usedIds, cryptoObject);
    usedIds.add(id);
    return currentId === id ? component : { ...component, id };
  });
}

export function normalizeComponent(component, targetWindow, context) {
  const scope = normalizeComponentScope(component?.scope);
  return {
    ...component,
    scope,
    groupId: textOf(component?.groupId),
    bindName: component?.bindName || getComponentBindingName(scope, targetWindow, context, component?.source),
  };
}

export function componentMatchesContext(component, targetWindow, context, options = {}) {
  const item = normalizeComponent(component, targetWindow, context);
  if (item.enabled === false) return false;
  if (!isComponentGroupEnabled(item, options)) return false;
  if (item.scope === COMPONENT_SCOPE_GLOBAL) return true;
  if (item.scope === COMPONENT_SCOPE_PRESET) {
    if (Object.prototype.hasOwnProperty.call(options, 'presetSchemeId')) return Boolean(textOf(options.presetSchemeId)) && textOf(item.presetSchemeId) === textOf(options.presetSchemeId);
    return textOf(item.bindName) === getCurrentPresetNameSafe(targetWindow, context);
  }
  if (item.scope === COMPONENT_SCOPE_CHARACTER) return textOf(item.bindName) === getCurrentCharacterNameSafe(context);
  return false;
}

export function getActiveComponentsForContext(components, targetWindow, context, options = {}) {
  return (Array.isArray(components) ? components : [])
    .map((item, originalIndex) => ({ item, originalIndex }))
    .filter(({ item }) => componentMatchesContext(item, targetWindow, context, options))
    .sort((left, right) => {
      // Keep prompt injection in the same order as the component library. sourceOrder is diagnostics only.
      const groupOrderDiff = getComponentGroupOrder(left.item, options) - getComponentGroupOrder(right.item, options);
      if (groupOrderDiff) return groupOrderDiff;
      return left.originalIndex - right.originalIndex;
    })
    .map(({ item }) => item);
}

// Deprecated: retained only to migrate legacy folderName-based settings.
export function getComponentFolderName(component) {
  const explicit = textOf(component?.folderName);
  if (explicit) return explicit;
  const source = textOf(component?.source);
  if (component?.sourceType === SOURCE_PRESET && source) return `预设：${source}`;
  if (component?.sourceType === SOURCE_WORLDBOOK && source) return `世界书：${source}`;
  return '手动添加';
}

function getValidComponentGroups(groups) {
  return (Array.isArray(groups) ? groups : [])
    .map((group, index) => ({ ...group, id: textOf(group?.id), name: textOf(group?.name), scope: normalizeComponentScope(group?.scope), index }))
    .filter((group) => group.id && group.name);
}

function getComponentGroup(component, options = {}) {
  const groupId = textOf(component?.groupId);
  if (!groupId) return null;
  return getValidComponentGroups(options?.componentGroups).find((group) => group.id === groupId) || null;
}

function isComponentGroupEnabled(component, options = {}) {
  if (!textOf(component?.groupId)) {
    const defaultGroupEnabled = options?.defaultGroupEnabled;
    return !defaultGroupEnabled || typeof defaultGroupEnabled !== 'object' || Array.isArray(defaultGroupEnabled)
      || defaultGroupEnabled[normalizeComponentScope(component?.scope)] !== false;
  }
  const group = getComponentGroup(component, options);
  return !group || group.enabled !== false;
}

function getComponentGroupOrder(component, options = {}) {
  const group = getComponentGroup(component, options);
  if (!group) return Number.MAX_SAFE_INTEGER;
  const order = Number(group.order);
  return Number.isFinite(order) ? order : group.index;
}

// Legacy-only ordering used once during migration to preserve the old visible list order.
function compareLegacyComponentLibraryItems(left, right) {
  const leftOrder = Number(left.sourceOrder);
  const rightOrder = Number(right.sourceOrder);
  const leftOrdered = Number.isFinite(leftOrder);
  const rightOrdered = Number.isFinite(rightOrder);
  if (leftOrdered && rightOrdered && leftOrder !== rightOrder) return leftOrder - rightOrder;
  if (leftOrdered !== rightOrdered) return leftOrdered ? -1 : 1;
  return left.index - right.index;
}

function getLegacyFolderSortRank(folder) {
  const first = folder.items[0] || {};
  if (first.sourceType === SOURCE_PRESET) return 1;
  if (first.sourceType === SOURCE_WORLDBOOK) return 2;
  return 0;
}

function getLegacyComponentLibraryFolders(components, scope) {
  const normalizedScope = normalizeComponentScope(scope);
  const folders = new Map();
  (Array.isArray(components) ? components : [])
    .map((item, index) => ({ ...item, index, scope: normalizeComponentScope(item?.scope) }))
    .filter((item) => item.scope === normalizedScope)
    .forEach((item) => {
      const folderName = getComponentFolderName(item);
      if (!folders.has(folderName)) folders.set(folderName, { name: folderName, firstIndex: item.index, items: [] });
      folders.get(folderName).items.push(item);
    });
  return [...folders.values()]
    .map((folder) => ({ ...folder, items: folder.items.sort(compareLegacyComponentLibraryItems) }))
    .sort((left, right) => {
      const rankDiff = getLegacyFolderSortRank(left) - getLegacyFolderSortRank(right);
      if (rankDiff) return rankDiff;
      return left.firstIndex - right.firstIndex;
    });
}

export function migrateLegacyComponentGroups(components, existingGroups = [], componentFolderEnabled = {}, cryptoObject = globalThis.crypto) {
  const validExistingGroups = getValidComponentGroups(existingGroups);
  if (validExistingGroups.length) return { components: Array.isArray(components) ? components : [], componentGroups: validExistingGroups.map(({ index, ...group }) => group) };

  const sourceComponents = Array.isArray(components) ? components : [];
  const legacyGates = componentFolderEnabled && typeof componentFolderEnabled === 'object' && !Array.isArray(componentFolderEnabled)
    ? componentFolderEnabled
    : {};
  const usedIds = new Set();
  const componentGroups = [];
  const migratedComponents = [];

  [COMPONENT_SCOPE_GLOBAL, COMPONENT_SCOPE_PRESET, COMPONENT_SCOPE_CHARACTER].forEach((scope) => {
    getLegacyComponentLibraryFolders(sourceComponents, scope).forEach((folder) => {
      const id = createComponentId(usedIds, cryptoObject);
      usedIds.add(id);
      const key = `${scope}::${folder.name}`;
      componentGroups.push({ id, name: folder.name, scope, enabled: legacyGates[key] !== false, order: componentGroups.length });
      folder.items.forEach((item) => migratedComponents.push({ ...item, groupId: id }));
    });
  });

  return { components: migratedComponents, componentGroups };
}

export function getComponentLibraryFolders(components, scope, options = {}) {
  const normalizedScope = normalizeComponentScope(scope);
  const scopedItems = (Array.isArray(components) ? components : [])
    .map((item, index) => ({ ...item, index, scope: normalizeComponentScope(item?.scope), groupId: textOf(item?.groupId) }))
    .filter((item) => item.scope === normalizedScope)
    .filter((item) => normalizedScope !== COMPONENT_SCOPE_PRESET || !Object.prototype.hasOwnProperty.call(options, 'presetSchemeId') || (Boolean(textOf(options.presetSchemeId)) && textOf(item.presetSchemeId) === textOf(options.presetSchemeId)))
    .filter((item) => normalizedScope !== COMPONENT_SCOPE_CHARACTER || !Object.prototype.hasOwnProperty.call(options, 'characterName') || textOf(item.bindName) === textOf(options.characterName));
  const groups = getValidComponentGroups(options?.componentGroups)
    .filter((group) => group.scope === normalizedScope)
    .sort((left, right) => {
      const leftOrder = Number.isFinite(Number(left.order)) ? Number(left.order) : left.index;
      const rightOrder = Number.isFinite(Number(right.order)) ? Number(right.order) : right.index;
      return leftOrder - rightOrder || left.index - right.index;
    });
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const sortItems = (items) => items.sort((left, right) => left.index - right.index);
  const ungroupedItems = scopedItems.filter((item) => !item.groupId || !groupsById.has(item.groupId));
  return {
    groups: groups.map((group) => ({ groupId: group.id, name: group.name, enabled: group.enabled !== false, items: sortItems(scopedItems.filter((item) => item.groupId === group.id)) })),
    ungrouped: sortItems(ungroupedItems),
  };
}

export function getWorldbookNamesSafe(targetWindow, context, selectedWorldNames = []) {
  return getWorldbookGroupsSafe(targetWindow, context, selectedWorldNames).map((item) => item.name);
}

export function getWorldbookGroupsSafe(targetWindow, context, selectedWorldNames = [], { explicitWorldbookNames = null } = {}) {
  let globalNames = [];
  let charNames = [];
  let chatName = '';
  let allNames = [];
  try {
    if (targetWindow?.TavernHelper?.getWorldbookNames) allNames = targetWindow.TavernHelper.getWorldbookNames() || [];
    else if (Array.isArray(targetWindow?.world_names)) allNames = targetWindow.world_names;
  } catch (_) {}
  const hasExplicitWorldbookNames = Array.isArray(explicitWorldbookNames);
  const rawName = (value) => getWorldbookRawName(value);
  const nonEmptyRawName = (value) => rawName(value).trim() ? rawName(value) : '';
  const explicit = [...new Set((hasExplicitWorldbookNames ? explicitWorldbookNames : [explicitWorldbookNames])
    .map(nonEmptyRawName)
    .filter(Boolean))];
  try { globalNames = targetWindow?.TavernHelper?.getGlobalWorldbookNames?.() || []; } catch (_) {}
  try {
    const charBooks = targetWindow?.TavernHelper?.getCharWorldbookNames?.('current') || {};
    charNames = [charBooks.primary, ...(charBooks.additional || [])].filter(Boolean);
  } catch (_) {}
  try { chatName = targetWindow?.TavernHelper?.getChatWorldbookName?.('current') || ''; } catch (_) {}
  const allNameSet = new Set(allNames.map(nonEmptyRawName).filter(Boolean));
  const selected = (Array.isArray(selectedWorldNames) ? selectedWorldNames : [selectedWorldNames])
    .map(nonEmptyRawName)
    .filter(Boolean)
    .filter((name) => !allNameSet.size || allNameSet.has(name));
  const groups = [];
  const seen = new Set();
  const add = (name, category, categoryLabel, metadata = {}) => {
    const clean = nonEmptyRawName(name);
    if (!clean) return;
    if (seen.has(clean)) {
      const existing = groups.find((item) => item.name === clean);
      if (existing && metadata.schemeSource) existing.schemeSource = true;
      return;
    }
    seen.add(clean);
    groups.push({ name: clean, category, categoryLabel, ...metadata });
  };
  // Always record Tavern's own assignment. It stays the grouping for books that the plugin also
  // enables; whether it is used at all is decided later by the shared runtime-state resolver.
  [...globalNames, ...selected].forEach((name) => add(name, 'global', '全局世界书'));
  charNames.forEach((name) => add(name, 'character', '角色世界书'));
  add(chatName, 'chat', '聊天世界书');
  allNames.forEach((name) => add(name, 'inactive', '未启用世界书'));
  explicit.forEach((name) => add(name, 'plugin', '插件启用', {
    schemeSource: true,
    missingFromTavern: allNameSet.size > 0 && !allNameSet.has(name),
  }));
  return groups;
}

// Following Tavern means mirroring its assignment exactly, so the category passes straight through.
// Once a scheme drives the list, the plugin selection decides placement in three steps:
//   - not enabled in the plugin -> inactive, even when this window activates the book
//   - enabled in the plugin and inactive in Tavern -> the plugin category
//   - enabled in both -> keep Tavern's own global / character / chat grouping
// `schemeEnabled` short-circuits the count so a scheme book is filed correctly before the background
// entry count arrives; otherwise it would stay misplaced until the user opened it once by hand.
export function getWorldbookImportDisplayCategory(worldbook, {
  pluginEnabledCount = 0,
  followingTavern = false,
  schemeEnabled = false,
  entriesResolved = false,
  loadFailed = false,
  unmatchedEnabledCount = 0,
} = {}) {
  if (loadFailed) return 'failed';
  const category = textOf(worldbook?.category) || 'inactive';
  if (followingTavern) return category;
  if (entriesResolved) return Number(pluginEnabledCount) > 0 || Number(unmatchedEnabledCount) > 0
    ? (category === 'inactive' ? 'plugin' : category)
    : 'inactive';
  if (!schemeEnabled && Number(pluginEnabledCount) <= 0) return 'inactive';
  return category === 'inactive' ? 'plugin' : category;
}

export async function getWbEntriesSafe(targetWindow, name) {
  const rawName = getWorldbookRawName(name);
  let availableNames = null;
  try {
    if (typeof targetWindow?.TavernHelper?.getWorldbookNames === 'function') {
      availableNames = targetWindow.TavernHelper.getWorldbookNames() || [];
    } else if (Array.isArray(targetWindow?.world_names)) {
      availableNames = targetWindow.world_names;
    }
  } catch (_) {}
  if (Array.isArray(availableNames) && availableNames.length > 0 && !availableNames.some((item) => getWorldbookRawName(item) === rawName)) {
    throw new Error(`未找到世界书“${rawName}”。它可能已被改名、删除，或方案保存的名称与酒馆实际名称不一致。`);
  }
  let lastError = null;
  try {
    if (typeof targetWindow?.SillyTavern?.loadWorldInfo === 'function') {
      const wb = await targetWindow.SillyTavern.loadWorldInfo(rawName);
      if (wb) {
        const entries = wb.entries || wb;
        return Array.isArray(entries) ? entries : Object.values(entries);
      }
    }
  } catch (error) { lastError = error; }
  try {
    if (typeof targetWindow?.TavernHelper?.getWorldbook === 'function') {
      const wb = await targetWindow.TavernHelper.getWorldbook(rawName);
      if (wb) return Array.isArray(wb) ? wb : Object.values(wb);
    }
  } catch (error) { lastError = error; }
  try {
    if (typeof targetWindow?.getWorldbook === 'function') {
      const wb = await targetWindow.getWorldbook(rawName);
      if (wb) return Array.isArray(wb) ? wb : Object.values(wb);
    }
  } catch (error) { lastError = error; }
  try {
    const csrf = targetWindow?.document?.querySelector?.('meta[name="csrf-token"]')?.getAttribute('content') || targetWindow?.token || '';
    const res = await targetWindow.fetch('/api/worldinfo/get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ name: rawName }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.entries) return Object.values(data.entries);
      if (data[rawName]?.entries) return Object.values(data[rawName].entries);
      return Array.isArray(data) ? data : Object.values(data);
    }
    lastError = new Error(`酒馆世界书接口返回 ${res.status}`);
  } catch (error) { lastError = error; }
  throw new Error(lastError?.message || `读取世界书“${rawName}”失败。`);
}

export function getWorldbookEntryName(entry) {
  return textOf(entry?.name) || textOf(entry?.comment) || (Array.isArray(entry?.key) ? entry.key.join(', ') : textOf(entry?.key)) || `条目 ${entry?.uid ?? ''}`;
}

export function isWorldbookEntryEnabled(entry) {
  if (typeof entry?.disable === 'boolean') return !entry.disable;
  if (typeof entry?.enabled === 'boolean') return entry.enabled;
  return true;
}

// TavernHelper and older world-info APIs can expose the constant flag in different shapes.
export function isWorldbookEntryConstant(entry) {
  if (entry?.constant === true || entry?.alwaysActive === true || entry?.alwaysActivated === true) return true;
  const strategy = entry?.strategy;
  return strategy?.type === 'constant' || strategy?.constant === true;
}

export function getWorldbookEntryKeys(entry) {
  const strategyKeys = entry?.strategy?.keys;
  if (Array.isArray(strategyKeys) || typeof strategyKeys === 'string') return strategyKeys;
  if (Array.isArray(entry?.key) || typeof entry?.key === 'string') return entry.key;
  if (Array.isArray(entry?.keys) || typeof entry?.keys === 'string') return entry.keys;
  return [];
}

export async function collectComponentImportCandidates({ targetWindow, context, selectedWorldNames = [] }) {
  const candidates = [];
  for (const presetName of getPresetNamesSafe(targetWindow, context)) {
    const enabledMap = getPresetPromptEnabledMap(targetWindow, presetName);
    getPresetEntriesSafe(targetWindow, presetName).forEach((prompt, sourceOrder) => {
    addImportCandidate(candidates, `预设：${presetName}`, presetName, SOURCE_PRESET, prompt?.name || prompt?.identifier || prompt?.id, prompt?.content, isPresetPromptEnabled(prompt, enabledMap), { sourceOrder, sourceUid: prompt?.identifier || prompt?.id, role: prompt?.role });
    });
  }
  for (const worldName of getWorldbookNamesSafe(targetWindow, context, selectedWorldNames)) {
    const entries = await getWbEntriesSafe(targetWindow, worldName);
    entries.forEach((entry, sourceOrder) => {
      addImportCandidate(candidates, `世界书：${worldName}`, worldName, SOURCE_WORLDBOOK, getWorldbookEntryName(entry), entry?.content, isWorldbookEntryEnabled(entry), { sourceOrder, sourceUid: entry?.uid });
    });
  }
  return candidates;
}

export function collectPresetImportGroups({ targetWindow, context, presetName = '' }) {
  const currentPreset = getCurrentPresetNameSafe(targetWindow, context);
  const selected = textOf(presetName) || currentPreset || getPresetNamesSafe(targetWindow, context)[0] || '';
  if (!selected) return [];
  const candidates = [];
  const inUsePreset = (!textOf(presetName) || selected === currentPreset) ? getInUsePresetSafe(targetWindow) : null;
  if (inUsePreset) {
    const groupName = `预设：${selected}`;
    const prompts = Array.isArray(inUsePreset.prompts) ? inUsePreset.prompts : [];
    const promptMap = new Map(prompts.map((prompt) => [textOf(prompt?.identifier || prompt?.id || prompt?.name), prompt]).filter(([id]) => Boolean(id)));
    const orderList = getActivePresetPromptOrder(inUsePreset);
    const used = new Set();
    const addPrompt = (rawPrompt, sourceOrder, enabled = rawPrompt?.enabled !== false) => {
      const identifier = textOf(rawPrompt?.identifier || rawPrompt?.id || rawPrompt?.name);
      const markerPrompt = getNativePlaceholderMarker(targetWindow, rawPrompt, context);
      const prompt = markerPrompt || rawPrompt;
      addImportCandidate(candidates, groupName, selected, SOURCE_PRESET, prompt?.name || prompt?.identifier || prompt?.id, prompt?.content, enabled, {
        sourceOrder,
        sourceUid: prompt?.identifier || prompt?.id || identifier,
        role: prompt?.role || rawPrompt?.role,
        markerType: prompt?.markerType,
        locked: Boolean(prompt?.locked || prompt?.markerType),
        allowEmpty: true,
      });
    };
    if (orderList.length) {
      orderList.forEach((orderItem, sourceOrder) => {
        const identifier = textOf(orderItem?.identifier);
        if (!identifier) return;
        used.add(identifier);
        const rawPrompt = promptMap.get(identifier);
        const markerPrompt = getBuiltinMarkerPrompt(identifier, context);
        const prompt = (rawPrompt?.marker || (markerPrompt && !textOf(rawPrompt?.content))) ? markerPrompt : rawPrompt || markerPrompt;
        if (!prompt) return;
        addPrompt(prompt, sourceOrder, orderItem?.enabled !== false);
      });
      prompts.forEach((rawPrompt, index) => {
        const identifier = textOf(rawPrompt?.identifier || rawPrompt?.id || rawPrompt?.name);
        if (identifier && used.has(identifier)) return;
        addPrompt(rawPrompt, orderList.length + index);
      });
    } else {
      prompts.forEach((rawPrompt, sourceOrder) => {
        addPrompt(rawPrompt, sourceOrder);
      });
    }
    return [{ scope: SOURCE_PRESET, group: groupName, source: selected, loaded: true, items: candidates }];
  }
  let preset = null;
  try { preset = targetWindow?.TavernHelper?.getPreset?.(selected) || null; } catch (_) {}
  const prompts = Array.isArray(preset?.prompts) ? preset.prompts : [];
  const promptMap = new Map(prompts.map((prompt) => [textOf(prompt?.identifier || prompt?.id || prompt?.name), prompt]).filter(([id]) => Boolean(id)));
  const orderList = getActivePresetPromptOrder(preset);
  const enabledMap = getPresetPromptEnabledMap(targetWindow, selected);
  const used = new Set();

  orderList.forEach((orderItem, sourceOrder) => {
    const identifier = textOf(orderItem?.identifier);
    if (!identifier) return;
    used.add(identifier);
    const rawPrompt = promptMap.get(identifier);
    const markerPrompt = getBuiltinMarkerPrompt(identifier, context);
    const prompt = (rawPrompt?.marker || (markerPrompt && !textOf(rawPrompt?.content))) ? markerPrompt : rawPrompt || markerPrompt;
    if (!prompt) return;
    addImportCandidate(candidates, `预设：${selected}`, selected, SOURCE_PRESET, prompt?.name || prompt?.identifier || prompt?.id, prompt?.content, orderItem?.enabled !== false, {
      sourceOrder,
      sourceUid: prompt?.identifier || prompt?.id,
      role: prompt?.role,
      markerType: prompt?.markerType,
      locked: Boolean(prompt?.locked || prompt?.markerType),
      allowEmpty: true,
    });
  });

  prompts.forEach((prompt, index) => {
    const identifier = textOf(prompt?.identifier || prompt?.id || prompt?.name);
    if (identifier && used.has(identifier)) return;
    addImportCandidate(candidates, `预设：${selected}`, selected, SOURCE_PRESET, prompt?.name || prompt?.identifier || prompt?.id, prompt?.content, isPresetPromptEnabled(prompt, enabledMap), {
      sourceOrder: orderList.length + index,
      sourceUid: prompt?.identifier || prompt?.id,
      role: prompt?.role,
      allowEmpty: true,
    });
  });
  return [{ scope: SOURCE_PRESET, group: `预设：${selected}`, source: selected, loaded: true, items: candidates }];
}

export function collectWorldbookImportGroups({ targetWindow, context, selectedWorldNames = [], explicitWorldbookNames = null }) {
  return getWorldbookGroupsSafe(targetWindow, context, selectedWorldNames, { explicitWorldbookNames }).map((worldbook) => ({
    scope: SOURCE_WORLDBOOK,
    group: worldbook.name,
    source: worldbook.name,
    category: worldbook.category,
    categoryLabel: worldbook.categoryLabel,
    schemeSource: worldbook.schemeSource === true,
    missingFromTavern: worldbook.missingFromTavern === true,
    loaded: false,
    loading: false,
    items: [],
  }));
}

export async function collectWorldbookImportCounts({ targetWindow, context, selectedWorldNames = [], explicitWorldbookNames = null, promptSelections = {} }) {
  const groups = getWorldbookGroupsSafe(targetWindow, context, selectedWorldNames, { explicitWorldbookNames });
  const selections = promptSelections && typeof promptSelections === 'object' ? promptSelections : {};
  return Promise.all(groups.map(async (worldbook) => {
    const entries = await collectWorldbookImportCandidates(targetWindow, worldbook.name);
    const pluginEnabledCount = entries.filter((item) => {
      if (Object.prototype.hasOwnProperty.call(selections, item.key)) return selections[item.key] !== false;
      return worldbook.category !== 'inactive' && item.enabled !== false;
    }).length;
    return {
      name: worldbook.name,
      entryCount: entries.length,
      pluginEnabledCount,
    };
  }));
}

export async function collectWorldbookImportCandidates(targetWindow, worldName) {
  const candidates = [];
  const entries = await getWbEntriesSafe(targetWindow, worldName);
  entries.forEach((entry, sourceOrder) => {
    addImportCandidate(candidates, `世界书：${worldName}`, worldName, SOURCE_WORLDBOOK, getWorldbookEntryName(entry), entry?.content, isWorldbookEntryEnabled(entry), {
      sourceOrder,
      sourceUid: entry?.uid,
      worldbookKeys: getWorldbookEntryKeys(entry),
      caseSensitive: entry?.caseSensitive === true,
      matchWholeWords: entry?.matchWholeWords === true,
      activationMode: isWorldbookEntryConstant(entry) ? 'blue' : 'green',
      worldbookPosition: entry?.position,
      worldbookDepth: entry?.depth,
      worldbookRole: entry?.role,
      worldbookOrder: entry?.order,
    });
  });
  return candidates;
}
