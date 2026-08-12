import { getWorldbookRawName } from './worldbook-identity.js';

export function createPromptSourceCacheState() {
  return {
    structureDirty: true,
    signature: '',
    dirtyWorldbooks: new Set(),
  };
}

export function markPromptSourceStructureDirty(state) {
  state.structureDirty = true;
  state.signature = '';
}

export function markWorldbookSourceDirty(state, worldbookName) {
  const name = getWorldbookRawName(worldbookName);
  if (!name.trim()) {
    markPromptSourceStructureDirty(state);
    return;
  }
  state.dirtyWorldbooks.add(name);
}

export function takeDirtyWorldbookSources(state) {
  const names = [...state.dirtyWorldbooks];
  state.dirtyWorldbooks.clear();
  return names;
}

export async function loadWorldbookSourceGroups(groups, loadItems) {
  await Promise.all(groups.map(async (group) => {
    group.loading = true;
    group.error = '';
    try {
      group.items = await loadItems(group.source, group);
      group.loaded = true;
    } catch (error) {
      group.loaded = false;
      group.error = error?.message || '加载失败';
    } finally {
      group.loading = false;
    }
  }));
  return groups;
}
