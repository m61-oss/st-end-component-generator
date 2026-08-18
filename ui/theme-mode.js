export const THEME_MODE_DARK = 'dark';
export const THEME_MODE_LIGHT = 'light';
export const THEME_MODE_TAVERN = 'tavern';

const THEME_MODES = [THEME_MODE_DARK, THEME_MODE_LIGHT, THEME_MODE_TAVERN];

export function normalizeThemeMode(theme) {
  return THEME_MODES.includes(String(theme ?? '').trim()) ? String(theme).trim() : THEME_MODE_DARK;
}

export function nextThemeMode(theme) {
  const normalized = normalizeThemeMode(theme);
  return THEME_MODES[(THEME_MODES.indexOf(normalized) + 1) % THEME_MODES.length];
}

export function getThemeClassName(theme) {
  return `st-esg-theme-${normalizeThemeMode(theme)}`;
}

export function getThemePresentation(theme) {
  const normalized = normalizeThemeMode(theme);
  if (normalized === THEME_MODE_LIGHT) return { icon: 'fa-sun', label: '日间' };
  if (normalized === THEME_MODE_TAVERN) return { icon: 'fa-circle-half-stroke', label: '跟随酒馆' };
  return { icon: 'fa-moon', label: '夜间' };
}
