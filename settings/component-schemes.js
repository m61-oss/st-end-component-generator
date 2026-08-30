import {
  THEATER_DEFAULT_GROUP_ID,
  normalizeTheaterRandomCount,
  normalizeTheaterRandomMode,
  normalizeTheaterRandomScope,
} from '../sources/theater-library.js';

const textOf = (value) => String(value ?? '').trim();
const isRecord = (value) => value && typeof value === 'object' && !Array.isArray(value);

function captureEnabled(items) {
  const result = {};
  for (const item of Array.isArray(items) ? items : []) {
    const id = textOf(item?.id);
    if (id) result[id] = item?.enabled !== false;
  }
  return result;
}

function applyEnabled(items, saved) {
  const records = isRecord(saved) ? saved : {};
  return (Array.isArray(items) ? items : []).map((item) => {
    const id = textOf(item?.id);
    return id && Object.prototype.hasOwnProperty.call(records, id)
      ? { ...item, enabled: records[id] !== false }
      : { ...item };
  });
}

function normalizeCountOr(value, fallback) {
  return Number.isFinite(Number(value))
    ? normalizeTheaterRandomCount(value)
    : normalizeTheaterRandomCount(fallback);
}

function normalizeOverrides(value, theaterGroups) {
  const validIds = new Set((Array.isArray(theaterGroups) ? theaterGroups : [])
    .map((group) => textOf(group?.id))
    .filter(Boolean));
  validIds.add(THEATER_DEFAULT_GROUP_ID);
  const seen = new Set();
  return (Array.isArray(value) ? value : [])
    .map((item) => ({
      groupId: textOf(item?.groupId),
      mode: normalizeTheaterRandomMode(item?.mode),
      count: normalizeCountOr(item?.count, 0),
    }))
    .filter((item) => item.groupId && validIds.has(item.groupId) && !seen.has(item.groupId) && seen.add(item.groupId));
}

export function captureComponentSchemeSnapshot(settings = {}) {
  return {
    componentEnabled: captureEnabled(settings.components),
    componentGroupEnabled: captureEnabled(settings.componentGroups),
    defaultGroupEnabled: { ...(isRecord(settings.defaultGroupEnabled) ? settings.defaultGroupEnabled : {}) },
    theaterEnabled: captureEnabled(settings.theaterComponents),
    theaterGroupEnabled: captureEnabled(settings.theaterGroups),
    theaterDefaultGroupEnabled: settings.theaterDefaultGroupEnabled !== false,
    theaterRandomScope: normalizeTheaterRandomScope(settings.theaterRandomScope),
    theaterRandomMode: normalizeTheaterRandomMode(settings.theaterRandomMode),
    theaterRandomCount: normalizeTheaterRandomCount(settings.theaterRandomCount),
    theaterGroupedFallbackMode: normalizeTheaterRandomMode(settings.theaterGroupedFallbackMode),
    theaterGroupedFallbackCount: normalizeTheaterRandomCount(settings.theaterGroupedFallbackCount),
    theaterGroupRandomOverrides: normalizeOverrides(settings.theaterGroupRandomOverrides, settings.theaterGroups),
  };
}

export function applyComponentSchemeSnapshot(settings = {}, snapshot = {}) {
  const saved = isRecord(snapshot) ? snapshot : {};
  const currentDefaultGroups = isRecord(settings.defaultGroupEnabled) ? settings.defaultGroupEnabled : {};
  const savedDefaultGroups = isRecord(saved.defaultGroupEnabled) ? saved.defaultGroupEnabled : {};
  const defaultGroupEnabled = { ...currentDefaultGroups };
  for (const key of Object.keys(currentDefaultGroups)) {
    if (Object.prototype.hasOwnProperty.call(savedDefaultGroups, key)) {
      defaultGroupEnabled[key] = savedDefaultGroups[key] !== false;
    }
  }
  const theaterGroups = applyEnabled(settings.theaterGroups, saved.theaterGroupEnabled);
  return {
    ...settings,
    components: applyEnabled(settings.components, saved.componentEnabled),
    componentGroups: applyEnabled(settings.componentGroups, saved.componentGroupEnabled),
    defaultGroupEnabled,
    theaterComponents: applyEnabled(settings.theaterComponents, saved.theaterEnabled),
    theaterGroups,
    theaterDefaultGroupEnabled: Object.prototype.hasOwnProperty.call(saved, 'theaterDefaultGroupEnabled')
      ? saved.theaterDefaultGroupEnabled !== false
      : settings.theaterDefaultGroupEnabled !== false,
    theaterRandomScope: Object.prototype.hasOwnProperty.call(saved, 'theaterRandomScope')
      ? normalizeTheaterRandomScope(saved.theaterRandomScope)
      : normalizeTheaterRandomScope(settings.theaterRandomScope),
    theaterRandomMode: Object.prototype.hasOwnProperty.call(saved, 'theaterRandomMode')
      ? normalizeTheaterRandomMode(saved.theaterRandomMode)
      : normalizeTheaterRandomMode(settings.theaterRandomMode),
    theaterRandomCount: Object.prototype.hasOwnProperty.call(saved, 'theaterRandomCount')
      ? normalizeCountOr(saved.theaterRandomCount, settings.theaterRandomCount)
      : normalizeTheaterRandomCount(settings.theaterRandomCount),
    theaterGroupedFallbackMode: Object.prototype.hasOwnProperty.call(saved, 'theaterGroupedFallbackMode')
      ? normalizeTheaterRandomMode(saved.theaterGroupedFallbackMode)
      : normalizeTheaterRandomMode(settings.theaterGroupedFallbackMode),
    theaterGroupedFallbackCount: Object.prototype.hasOwnProperty.call(saved, 'theaterGroupedFallbackCount')
      ? normalizeCountOr(saved.theaterGroupedFallbackCount, settings.theaterGroupedFallbackCount)
      : normalizeTheaterRandomCount(settings.theaterGroupedFallbackCount),
    theaterGroupRandomOverrides: Object.prototype.hasOwnProperty.call(saved, 'theaterGroupRandomOverrides')
      ? normalizeOverrides(saved.theaterGroupRandomOverrides, theaterGroups)
      : normalizeOverrides(settings.theaterGroupRandomOverrides, theaterGroups),
  };
}
