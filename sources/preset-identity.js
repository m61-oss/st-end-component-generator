const PRESET_SCOPE = '预设';
const STABLE_KEY_PREFIX = 'preset-v2';

const encodeKeyPart = (value) => encodeURIComponent(String(value ?? ''));

export function getPresetEntryKeyPrefix(source) {
  const name = String(source ?? '');
  return name.trim() ? `${STABLE_KEY_PREFIX}::${encodeKeyPart(name)}::${PRESET_SCOPE}::` : '';
}

export function getLegacyPresetEntryKeyPrefix(source) {
  const name = String(source ?? '').trim();
  return name ? `预设：${name}::${name}::${PRESET_SCOPE}::` : '';
}

export function createPresetEntryKey(source, uid) {
  const prefix = getPresetEntryKeyPrefix(source);
  if (!prefix || uid === null || uid === undefined || String(uid) === '') return '';
  return `${prefix}${encodeKeyPart(uid)}`;
}

export function reconcilePresetEntryRecords(recordStores, source, items) {
  const stores = Object.fromEntries(Object.entries(recordStores && typeof recordStores === 'object' ? recordStores : {})
    .map(([name, store]) => [name, { ...(store && typeof store === 'object' ? store : {}) }]));
  const currentItems = Array.isArray(items) ? items.filter((item) => item?.key?.startsWith(getPresetEntryKeyPrefix(source))) : [];
  const currentNames = currentItems.reduce((counts, item) => {
    const name = String(item?.name ?? '');
    if (name) counts.set(name, (counts.get(name) || 0) + 1);
    return counts;
  }, new Map());
  const legacyPrefix = getLegacyPresetEntryKeyPrefix(source);
  const keyMap = Object.fromEntries(currentItems
    .filter((item) => item.legacyKey && item.key)
    .map((item) => [item.legacyKey, item.key]));
  let changed = false;

  for (const store of Object.values(stores)) {
    for (const item of currentItems) {
      let sourceKey = item.legacyKey && Object.prototype.hasOwnProperty.call(store, item.legacyKey)
        ? item.legacyKey
        : '';
      if (!sourceKey && item?.name && currentNames.get(String(item.name)) === 1) {
        const matches = Object.keys(store).filter((key) => key.startsWith(`${legacyPrefix}${String(item.name)}::`));
        if (matches.length === 1) sourceKey = matches[0];
      }
      if (!sourceKey || sourceKey === item.key) continue;
      keyMap[sourceKey] = item.key;
      if (!Object.prototype.hasOwnProperty.call(store, item.key)) store[item.key] = store[sourceKey];
      delete store[sourceKey];
      changed = true;
    }
  }

  return { stores, keyMap, changed };
}

export function migratePresetPromptSourceSnapshot(snapshot, source, items) {
  if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.items)) {
    return { snapshot: null, changed: false };
  }
  const keyMap = reconcilePresetEntryRecords({}, source, items).keyMap;
  let changed = false;
  const nextItems = snapshot.items.map((item) => {
    if (String(item?.source ?? '').trim() !== String(source ?? '').trim()) return item;
    const key = keyMap[item?.key];
    if (!key || key === item.key) return item;
    changed = true;
    return { ...item, key };
  });
  return { snapshot: changed ? { ...snapshot, items: nextItems } : snapshot, changed };
}

export function reconcilePresetSchemeRecords(schemes, source, items) {
  let changed = false;
  const nextSchemes = (Array.isArray(schemes) ? schemes : []).map((scheme) => {
    const snapshot = scheme?.snapshot && typeof scheme.snapshot === 'object' ? scheme.snapshot : {};
    if (String(snapshot.activeSourcePreset ?? '').trim() !== String(source ?? '').trim()) return scheme;
    const migration = reconcilePresetEntryRecords({
      promptSelections: snapshot.promptSelections,
      importSelections: snapshot.importSelections,
      sourceContentOverrides: snapshot.sourceContentOverrides,
    }, source, items);
    if (!migration.changed) return scheme;
    changed = true;
    const taskPlacementAfterSourceId = migration.keyMap[snapshot.taskPlacementAfterSourceId]
      || snapshot.taskPlacementAfterSourceId;
    return { ...scheme, snapshot: { ...snapshot, ...migration.stores, taskPlacementAfterSourceId } };
  });
  return { schemes: nextSchemes, changed };
}
