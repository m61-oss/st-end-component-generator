const textOf = (value) => String(value ?? '').trim();

export const WORLDBOOK_RUNTIME_NATIVE = 'native';
export const WORLDBOOK_RUNTIME_DRAFT = 'draft';
export const WORLDBOOK_RUNTIME_SCHEME = 'scheme';

function hasOwn(store, key) {
  return Boolean(key) && Object.prototype.hasOwnProperty.call(store && typeof store === 'object' ? store : {}, key);
}

export function isWorldbookSourceEnabled(group, { mode = WORLDBOOK_RUNTIME_NATIVE, sourceNames = [] } = {}) {
  if (mode === WORLDBOOK_RUNTIME_NATIVE) return textOf(group?.category) !== 'inactive';
  const source = String(group?.source ?? '');
  return (Array.isArray(sourceNames) ? sourceNames : []).some((name) => String(name ?? '') === source);
}

export function resolveWorldbookEntryRuntimeState(group, item, {
  mode = WORLDBOOK_RUNTIME_NATIVE,
  sourceNames = [],
  selections = {},
} = {}) {
  const sourceEnabled = isWorldbookSourceEnabled(group, { mode, sourceNames });
  if (!sourceEnabled) return { sourceEnabled: false, entryEnabled: false, shouldInject: false };

  let entryEnabled = false;
  if (mode === WORLDBOOK_RUNTIME_NATIVE) {
    entryEnabled = item?.enabled !== false;
  } else if (hasOwn(selections, item?.key)) {
    entryEnabled = selections[item.key] !== false;
  } else if (mode === WORLDBOOK_RUNTIME_DRAFT) {
    entryEnabled = item?.enabled !== false;
  }
  return { sourceEnabled: true, entryEnabled, shouldInject: entryEnabled };
}

export function resolveWorldbookSourceDisplayCategory(group, {
  mode = WORLDBOOK_RUNTIME_NATIVE,
  enabledCount = 0,
  unmatchedEnabledCount = 0,
  sourceEnabled = false,
  entriesResolved = true,
  loadFailed = false,
} = {}) {
  if (loadFailed) return 'failed';
  const nativeCategory = textOf(group?.category) || 'inactive';
  if (mode === WORLDBOOK_RUNTIME_NATIVE) return nativeCategory;
  const enabled = Number(enabledCount) > 0 || Number(unmatchedEnabledCount) > 0;
  if (entriesResolved && !enabled) return 'inactive';
  if (!entriesResolved && !sourceEnabled && !enabled) return 'inactive';
  return nativeCategory === 'inactive' ? 'plugin' : nativeCategory;
}

export function attachWorldbookRuntimeCategory(group, items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    worldbookCategory: textOf(group?.category) || 'inactive',
  }));
}
