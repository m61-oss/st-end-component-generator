const SNAPSHOT_TYPES = ['preset', 'worldbook'];
const DEFAULT_DB_NAME = 'st-end-component-generator';
const DEFAULT_STORE_NAME = 'prompt-source-snapshots';

export const MISSING_PROMPT_SOURCE_SNAPSHOT_MESSAGE = '当前处于导入模式且无提示词快照，请先切回编辑模式建立快照。';

export function normalizePromptSourceSnapshot(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.items)) return null;
  return { items: value.items };
}

export async function loadAndMigratePromptSourceSnapshots(store, legacySnapshots = {}, { sourceModes = null } = {}) {
  const snapshots = { preset: null, worldbook: null };
  for (const type of SNAPSHOT_TYPES) {
    if (sourceModes?.[type] === 'prompt') {
      await store.remove(type);
      continue;
    }
    const stored = normalizePromptSourceSnapshot(await store.get(type));
    const legacy = normalizePromptSourceSnapshot(legacySnapshots?.[type]);
    if (stored) {
      snapshots[type] = stored;
      continue;
    }
    if (!legacy) continue;
    await store.set(type, legacy);
    snapshots[type] = legacy;
  }
  return snapshots;
}

export function assertPromptSourceSnapshotsAvailable(sourceModes = {}, snapshots = {}) {
  const missing = SNAPSHOT_TYPES.some((type) => (
    sourceModes?.[type] === 'import' && !normalizePromptSourceSnapshot(snapshots?.[type])
  ));
  if (missing) throw new Error(MISSING_PROMPT_SOURCE_SNAPSHOT_MESSAGE);
}

export function createIndexedDbPromptSourceSnapshotStore(indexedDb, {
  dbName = DEFAULT_DB_NAME,
  storeName = DEFAULT_STORE_NAME,
} = {}) {
  if (!indexedDb?.open) throw new Error('当前浏览器不支持 IndexedDB，无法保存提示词快照。');
  let databasePromise = null;

  const openDatabase = () => {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDb.open(dbName, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(storeName)) database.createObjectStore(storeName);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('无法打开提示词快照存储。'));
      request.onblocked = () => reject(new Error('提示词快照存储被其他页面占用。'));
    });
    return databasePromise;
  };

  const run = async (mode, operation) => {
    const database = await openDatabase();
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const objectStore = transaction.objectStore(storeName);
      let result;
      let request;
      try {
        request = operation(objectStore);
      } catch (error) {
        reject(error);
        return;
      }
      if (request) {
        request.onsuccess = () => { result = request.result; };
        request.onerror = () => reject(request.error || new Error('提示词快照读写失败。'));
      }
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error || new Error('提示词快照事务失败。'));
      transaction.onabort = () => reject(transaction.error || new Error('提示词快照事务已取消。'));
    });
  };

  return {
    async get(type) {
      return normalizePromptSourceSnapshot(await run('readonly', (store) => store.get(String(type))));
    },
    async set(type, snapshot) {
      const normalized = normalizePromptSourceSnapshot(snapshot);
      if (!normalized) return await this.remove(type);
      await run('readwrite', (store) => store.put(normalized, String(type)));
    },
    async remove(type) {
      await run('readwrite', (store) => store.delete(String(type)));
    },
  };
}
