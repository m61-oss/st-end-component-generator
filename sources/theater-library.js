export const THEATER_RANDOM_MODE_OFF = 'off';
export const THEATER_RANDOM_MODE_ALL = 'all';
export const THEATER_RANDOM_MODE_ENABLED = 'enabled';
export const THEATER_RANDOM_MODE_FIXED_ENABLED = 'fixed-enabled';
export const THEATER_RANDOM_SCOPE_GLOBAL = 'global';
export const THEATER_RANDOM_SCOPE_GROUPED = 'grouped';
export const THEATER_DEFAULT_GROUP_ID = '__theater_default_group__';

const textOf = (value) => String(value ?? '').trim();

export function normalizeTheaterRandomMode(mode) {
  return [THEATER_RANDOM_MODE_OFF, THEATER_RANDOM_MODE_ALL, THEATER_RANDOM_MODE_ENABLED, THEATER_RANDOM_MODE_FIXED_ENABLED].includes(textOf(mode))
    ? textOf(mode)
    : THEATER_RANDOM_MODE_OFF;
}

export function normalizeTheaterRandomCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

export function normalizeTheaterRandomScope(scope) {
  return textOf(scope) === THEATER_RANDOM_SCOPE_GROUPED
    ? THEATER_RANDOM_SCOPE_GROUPED
    : THEATER_RANDOM_SCOPE_GLOBAL;
}

function normalizeTheaterGroups(groups) {
  return (Array.isArray(groups) ? groups : [])
    .map((group, index) => ({
      ...group,
      id: textOf(group?.id),
      name: textOf(group?.name),
      enabled: group?.enabled !== false,
      order: Number.isFinite(Number(group?.order)) ? Number(group.order) : index,
      index,
    }))
    .filter((group) => group.id && group.name)
    .sort((left, right) => left.order - right.order || left.index - right.index);
}

export function getTheaterLibraryFolders(items, groups = [], defaultGroupEnabled = true) {
  const sourceItems = (Array.isArray(items) ? items : [])
    .map((item, index) => ({ ...item, index, groupId: textOf(item?.groupId) }));
  const validGroups = normalizeTheaterGroups(groups);
  const groupsById = new Map(validGroups.map((group) => [group.id, group]));
  const itemsForGroup = (group) => sourceItems
    .filter((item) => item.groupId === group.id)
    .sort((left, right) => left.index - right.index)
    .map((item) => ({ ...item, theaterGroupEnabled: group.enabled !== false }));
  const ungrouped = sourceItems
    .filter((item) => !item.groupId || !groupsById.has(item.groupId))
    .sort((left, right) => left.index - right.index)
    .map((item) => ({ ...item, theaterGroupEnabled: defaultGroupEnabled !== false }));
  return {
    groups: validGroups.map((group) => ({ ...group, items: itemsForGroup(group) })),
    ungrouped,
  };
}

export function getTheaterLibraryItems(items, groups = [], defaultGroupEnabled = true) {
  const folders = getTheaterLibraryFolders(items, groups, defaultGroupEnabled);
  const ordered = [...folders.groups.flatMap((group) => group.items), ...folders.ungrouped];
  return ordered.map((item, libraryOrder) => ({ ...item, libraryOrder }));
}

function chooseRandomItems(items, count, random = Math.random) {
  const pool = [...items];
  const safeRandom = typeof random === 'function' ? random : Math.random;
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const raw = Number(safeRandom());
    const normalized = Number.isFinite(raw) ? Math.min(0.999999999, Math.max(0, raw)) : 0;
    const target = Math.floor(normalized * (index + 1));
    [pool[index], pool[target]] = [pool[target], pool[index]];
  }
  const selectedIds = new Set(pool.slice(0, Math.min(normalizeTheaterRandomCount(count), pool.length)).map((item) => item.id));
  return items.filter((item) => selectedIds.has(item.id));
}

function selectTheaterPool(items, mode, count, random) {
  const normalizedMode = normalizeTheaterRandomMode(mode);
  const orderedItems = Array.isArray(items) ? items : [];
  const enabledItems = orderedItems.filter((item) => item.theaterGroupEnabled !== false && item.enabled !== false);
  if (normalizedMode === THEATER_RANDOM_MODE_OFF) return enabledItems;
  if (normalizedMode === THEATER_RANDOM_MODE_ENABLED) return chooseRandomItems(enabledItems, count, random);
  if (normalizedMode === THEATER_RANDOM_MODE_FIXED_ENABLED) {
    const disabledItems = orderedItems.filter((item) => item.theaterGroupEnabled === false || item.enabled === false);
    const randomItems = chooseRandomItems(disabledItems, count, random);
    const selectedIds = new Set([...enabledItems, ...randomItems].map((item) => item.id));
    return orderedItems.filter((item) => selectedIds.has(item.id));
  }
  return chooseRandomItems(orderedItems, count, random);
}

function getTheaterItemGroupId(item, validGroupIds) {
  const groupId = textOf(item?.groupId);
  return groupId && validGroupIds.has(groupId) ? groupId : THEATER_DEFAULT_GROUP_ID;
}

function getTheaterGroupOverrides(overrides, validGroupIds) {
  const seen = new Set();
  return (Array.isArray(overrides) ? overrides : [])
    .map((override) => ({
      groupId: textOf(override?.groupId),
      mode: normalizeTheaterRandomMode(override?.mode),
      count: normalizeTheaterRandomCount(override?.count),
    }))
    .filter((override) => {
      if (!override.groupId || (override.groupId !== THEATER_DEFAULT_GROUP_ID && !validGroupIds.has(override.groupId))) return false;
      if (seen.has(override.groupId)) return false;
      seen.add(override.groupId);
      return true;
    });
}

export function selectTheaterComponents(items, options = {}) {
  const orderedItems = getTheaterLibraryItems(items, options.groups, options.defaultGroupEnabled !== false);
  const scope = normalizeTheaterRandomScope(options.scope);
  if (scope === THEATER_RANDOM_SCOPE_GLOBAL) {
    return selectTheaterPool(orderedItems, options.mode, options.count, options.random);
  }

  const validGroups = normalizeTheaterGroups(options.groups);
  const validGroupIds = new Set(validGroups.map((group) => group.id));
  const overrides = getTheaterGroupOverrides(options.groupOverrides, validGroupIds);
  const specifiedGroupIds = new Set(overrides.map((override) => override.groupId));
  const fallbackItems = orderedItems.filter((item) => (
    !specifiedGroupIds.has(getTheaterItemGroupId(item, validGroupIds))
  ));
  const selectedIds = new Set(selectTheaterPool(
    fallbackItems,
    options.groupedFallbackMode ?? options.mode,
    options.groupedFallbackCount ?? options.count,
    options.random,
  ).map((item) => item.id));

  overrides.forEach((override) => {
    const groupItems = orderedItems.filter((item) => getTheaterItemGroupId(item, validGroupIds) === override.groupId);
    selectTheaterPool(groupItems, override.mode, override.count, options.random)
      .forEach((item) => selectedIds.add(item.id));
  });

  return orderedItems.filter((item) => selectedIds.has(item.id));
}
