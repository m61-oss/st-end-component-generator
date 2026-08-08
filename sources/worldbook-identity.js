const WORLD_BOOK_SCOPE = '世界书';
const STABLE_KEY_PREFIX = 'worldbook-v2';

export function getWorldbookRawName(value) {
  return value === null || value === undefined ? '' : String(value);
}

function encodeKeyPart(value) {
  return encodeURIComponent(String(value ?? ''));
}

export function getWorldbookEntryKeyPrefix(source) {
  const name = getWorldbookRawName(source);
  return name.trim() ? `${STABLE_KEY_PREFIX}::${encodeKeyPart(name)}::${WORLD_BOOK_SCOPE}::` : '';
}

export function getLegacyWorldbookEntryKeyPrefix(source) {
  const name = getWorldbookRawName(source).trim();
  return name ? `世界书：${name}::${name}::${WORLD_BOOK_SCOPE}::` : '';
}

export function getWorldbookEntryKeyPrefixes(source) {
  return [...new Set([
    getWorldbookEntryKeyPrefix(source),
    getLegacyWorldbookEntryKeyPrefix(source),
  ].filter(Boolean))];
}

export function createWorldbookEntryKey(source, uid) {
  const prefix = getWorldbookEntryKeyPrefix(source);
  if (!prefix || uid === null || uid === undefined || String(uid) === '') return '';
  return `${prefix}${encodeKeyPart(uid)}`;
}

export function isWorldbookEntryKeyForSource(key, source) {
  const value = String(key ?? '');
  return getWorldbookEntryKeyPrefixes(source).some((prefix) => value.startsWith(prefix));
}

export function reconcileWorldbookEntryRecords(recordStores, source, items) {
  const stores = Object.fromEntries(Object.entries(recordStores && typeof recordStores === 'object' ? recordStores : {})
    .map(([name, store]) => [name, { ...(store && typeof store === 'object' ? store : {}) }]));
  const currentItems = Array.isArray(items) ? items.filter((item) => item?.key) : [];
  const currentKeys = new Set(currentItems.map((item) => item.key));
  const currentNameCounts = currentItems.reduce((counts, item) => {
    const name = String(item?.name ?? '');
    if (name) counts.set(name, (counts.get(name) || 0) + 1);
    return counts;
  }, new Map());
  const currentLegacyKeyCounts = currentItems.reduce((counts, item) => {
    const legacyKey = String(item?.legacyKey || '');
    if (legacyKey) counts.set(legacyKey, (counts.get(legacyKey) || 0) + 1);
    return counts;
  }, new Map());
  let changed = false;

  for (const [storeName, store] of Object.entries(stores)) {
    for (const item of currentItems) {
      const legacyKey = String(item?.legacyKey || '');
      let sourceKey = legacyKey
        && currentLegacyKeyCounts.get(legacyKey) === 1
        && Object.prototype.hasOwnProperty.call(store, legacyKey)
        ? legacyKey
        : '';
      if (!sourceKey && item?.name && currentNameCounts.get(String(item.name)) === 1) {
        const legacyNamePrefix = `${getLegacyWorldbookEntryKeyPrefix(source)}${String(item.name)}::`;
        const matches = Object.keys(store).filter((key) => key.startsWith(legacyNamePrefix));
        if (matches.length === 1) sourceKey = matches[0];
      }
      if (!sourceKey || sourceKey === item.key) continue;
      if (!Object.prototype.hasOwnProperty.call(store, item.key)) store[item.key] = store[sourceKey];
      delete store[sourceKey];
      changed = true;
    }

    if (storeName === 'promptSelections' || storeName === 'importSelections') {
      const remainingItems = currentItems.filter((item) => !Object.prototype.hasOwnProperty.call(store, item.key));
      const legacyPrefix = getLegacyWorldbookEntryKeyPrefix(source);
      const remainingLegacyKeys = Object.keys(store).filter((key) => legacyPrefix && key.startsWith(legacyPrefix));
      if (remainingItems.length > 0 && remainingLegacyKeys.length === remainingItems.length) {
        remainingItems.forEach((item, index) => {
          const legacyKey = remainingLegacyKeys[index];
          store[item.key] = store[legacyKey];
          delete store[legacyKey];
          changed = true;
        });
      }
    }

  }

  const unmatchedKeys = [...new Set(Object.values(stores).flatMap((store) => Object.keys(store)))]
    .filter((key) => isWorldbookEntryKeyForSource(key, source) && !currentKeys.has(key));
  const unmatchedRecords = [];
  for (const key of unmatchedKeys) {
    const enabled = stores.promptSelections?.[key] !== false && Object.prototype.hasOwnProperty.call(stores.promptSelections || {}, key)
      || stores.importSelections?.[key] !== false && Object.prototype.hasOwnProperty.call(stores.importSelections || {}, key);
    const hasOverrides = ['sourceContentOverrides', 'worldbookActivationOverrides', 'worldbookKeywordOverrides']
      .some((storeName) => Object.prototype.hasOwnProperty.call(stores[storeName] || {}, key));
    if (!enabled && !hasOverrides) {
      for (const store of Object.values(stores)) delete store[key];
      changed = true;
      continue;
    }
    const legacyPrefix = getLegacyWorldbookEntryKeyPrefix(source);
    const stablePrefix = getWorldbookEntryKeyPrefix(source);
    let name = '旧方案条目';
    let contentPreview = '';
    let uid = '';
    if (legacyPrefix && key.startsWith(legacyPrefix)) {
      const suffix = key.slice(legacyPrefix.length);
      const separatorIndex = suffix.indexOf('::');
      name = separatorIndex >= 0 ? suffix.slice(0, separatorIndex) || name : suffix || name;
      contentPreview = separatorIndex >= 0 ? suffix.slice(separatorIndex + 2) : '';
    } else if (stablePrefix && key.startsWith(stablePrefix)) {
      try { uid = decodeURIComponent(key.slice(stablePrefix.length)); } catch (_) { uid = key.slice(stablePrefix.length); }
      name = uid ? `UID ${uid}` : name;
    }
    if (Object.prototype.hasOwnProperty.call(stores.sourceContentOverrides || {}, key)) {
      contentPreview = String(stores.sourceContentOverrides[key] ?? '');
    }
    unmatchedRecords.push({ key, name, uid, enabled: Boolean(enabled), contentPreview: contentPreview.slice(0, 200) });
  }

  return {
    stores,
    changed,
    staleEnabledCount: unmatchedRecords.filter((record) => record.enabled).length,
    unmatchedRecords,
  };
}

export function removeWorldbookEntryRecord(recordStores, key) {
  const stores = Object.fromEntries(Object.entries(recordStores && typeof recordStores === 'object' ? recordStores : {})
    .map(([name, store]) => [name, { ...(store && typeof store === 'object' ? store : {}) }]));
  let removedCount = 0;
  for (const store of Object.values(stores)) {
    if (!Object.prototype.hasOwnProperty.call(store, key)) continue;
    delete store[key];
    removedCount += 1;
  }
  return { stores, removedCount };
}

export function removeWorldbookSourceRecords(recordStores, source) {
  const stores = Object.fromEntries(Object.entries(recordStores && typeof recordStores === 'object' ? recordStores : {})
    .map(([name, store]) => [name, { ...(store && typeof store === 'object' ? store : {}) }]));
  let removedCount = 0;
  for (const store of Object.values(stores)) {
    for (const key of Object.keys(store)) {
      if (!isWorldbookEntryKeyForSource(key, source)) continue;
      delete store[key];
      removedCount += 1;
    }
  }
  return { stores, removedCount };
}

export function getWorldbookGenerationIssue(groups) {
  const list = Array.isArray(groups) ? groups : [];
  const failed = list.filter((group) => !group?.loaded && group?.error);
  if (failed.length) {
    const names = failed.map((group) => `“${getWorldbookRawName(group.source)}”`).join('、');
    return `世界书读取失败：${names}。请到“世界书”页面的“读取失败”分类中点击查看。`;
  }
  const staleEnabledCount = list.reduce((sum, group) => sum + Number(group?.staleEnabledCount || 0), 0);
  return staleEnabledCount > 0
    ? `有 ${staleEnabledCount} 条已启用的旧方案记录未匹配上 UID。请到“世界书”页面打开对应世界书，重新勾选当前条目并处理未匹配记录。`
    : '';
}
