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
  const staleEnabledKeys = new Set();
  let changed = false;

  for (const [storeName, store] of Object.entries(stores)) {
    for (const item of currentItems) {
      const legacyKey = String(item?.legacyKey || '');
      let sourceKey = legacyKey && Object.prototype.hasOwnProperty.call(store, legacyKey) ? legacyKey : '';
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

    for (const key of Object.keys(store)) {
      if (!isWorldbookEntryKeyForSource(key, source) || currentKeys.has(key)) continue;
      if ((storeName === 'promptSelections' || storeName === 'importSelections') && store[key] !== false) {
        staleEnabledKeys.add(key);
      }
      delete store[key];
      changed = true;
    }
  }

  return { stores, changed, staleEnabledCount: staleEnabledKeys.size };
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
    ? `有 ${staleEnabledCount} 条已选世界书记录已经失效，可能是条目被删除或旧记录无法对应。请重新检查并保存世界书方案。`
    : '';
}
