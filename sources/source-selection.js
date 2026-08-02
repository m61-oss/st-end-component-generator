export function normalizePromptSourceType(source) {
  const value = typeof source === 'object' && source !== null ? source.scope : source;
  return value === 'worldbook' || value === '世界书' ? 'worldbook' : 'preset';
}

export function clearImportSelectionsForScope(selections, scope) {
  const marker = `::${String(scope ?? '').trim()}::`;
  return Object.fromEntries(Object.entries(selections && typeof selections === 'object' ? selections : {})
    .filter(([key]) => !marker || !String(key).includes(marker)));
}

export function resolveWorldbookSelection(item, selections = {}, followsTavernState = false) {
  if (followsTavernState) {
    return String(item?.worldbookCategory ?? '').trim() !== 'inactive' && item?.enabled !== false;
  }
  const store = selections && typeof selections === 'object' ? selections : {};
  return Boolean(item?.key && Object.prototype.hasOwnProperty.call(store, item.key) && store[item.key] !== false);
}

export function syncPromptSelectionsFromGroups(groups, currentSelections = {}, shouldForceOverwrite = false) {
  const nextSelections = { ...(currentSelections && typeof currentSelections === 'object' ? currentSelections : {}) };
  for (const group of Array.isArray(groups) ? groups : []) {
    if (!group?.loaded || !Array.isArray(group.items)) continue;
    // Tavern's own entry state may only seed defaults for a book the plugin is mirroring. An inactive
    // book contributes nothing, and while a scheme drives the list (followsTavernState === false) the
    // snapshot is authoritative, so missing keys must default to unchecked rather than to Tavern.
    const ignoresTavernState = group?.scope === '世界书'
      && (group?.category === 'inactive' || group?.followsTavernState === false);
    const forceOverwrite = typeof shouldForceOverwrite === 'function' ? shouldForceOverwrite(group) : Boolean(shouldForceOverwrite);
    for (const item of group.items) {
      if (!item?.key) continue;
      if (item?.locked) continue;
      if (forceOverwrite || !Object.prototype.hasOwnProperty.call(nextSelections, item.key)) {
        nextSelections[item.key] = ignoresTavernState ? false : item.enabled !== false;
      }
    }
  }
  return nextSelections;
}

export function collectSelectedPromptSourceItems(groups, promptSelections = {}, contentOverrides = {}) {
  const store = promptSelections && typeof promptSelections === 'object' ? promptSelections : {};
  const overrides = contentOverrides && typeof contentOverrides === 'object' ? contentOverrides : {};
  const selected = [];
  const withOverride = (item) => {
    if (!item?.key || !Object.prototype.hasOwnProperty.call(overrides, item.key)) return item;
    return { ...item, content: String(overrides[item.key] ?? '') };
  };
  for (const group of Array.isArray(groups) ? groups : []) {
    if (!group?.loaded || !Array.isArray(group.items)) continue;
    for (const item of group.items) {
      if (!item?.key) continue;
      const sourceItem = withOverride(item);
      if (!String(sourceItem?.content ?? '').trim() && !String(sourceItem?.markerType ?? '').trim()) continue;
      if (item?.locked) {
        if (item.enabled !== false) selected.push(sourceItem);
        continue;
      }
      const checked = Object.prototype.hasOwnProperty.call(store, item.key) ? store[item.key] !== false : item.enabled !== false;
      if (checked) selected.push(sourceItem);
    }
  }
  return selected;
}
