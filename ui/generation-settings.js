const INJECTION_MODE_HELP = Object.freeze({
  replace: '覆盖模式仅支持成对的尖括号标签（如 <status>…</status>）。[status]、【状态】等格式无法识别，会自动改为追加。',
  append: '追加模式会把生成内容放在当前回复文末，不尝试匹配正文中的标签或锚点。',
  anchor: '锚点模式会让模型根据当前正文自行决定插入数量与 before/after 方向，每项内容独立成行。',
});

function normalizeGenerationInjectionMode(mode) {
  return Object.prototype.hasOwnProperty.call(INJECTION_MODE_HELP, mode) ? mode : 'replace';
}

function getGenerationInjectionModeHelp(mode) {
  const normalizedMode = normalizeGenerationInjectionMode(mode);
  return {
    mode: normalizedMode,
    text: INJECTION_MODE_HELP[normalizedMode],
  };
}

export { getGenerationInjectionModeHelp, normalizeGenerationInjectionMode };
