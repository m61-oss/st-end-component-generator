const MISSING_TEMPLATE_API_MESSAGE = '已开启提示词模板兼容，但未检测到 ST-Prompt-Template。请先加载该插件，或关闭兼容开关。';

function getTemplateApi(targetWindow) {
  return targetWindow?.EjsTemplate ?? targetWindow?.parent?.EjsTemplate ?? globalThis.EjsTemplate ?? null;
}

export function isPromptTemplateApiAvailable(targetWindow) {
  const api = getTemplateApi(targetWindow);
  return typeof api?.prepareContext === 'function' && typeof api?.evalTemplate === 'function';
}

export async function renderPromptTemplate({ targetWindow, content, enabled = false }) {
  const source = String(content ?? '');
  if (!enabled) return source;
  const api = getTemplateApi(targetWindow);
  if (!isPromptTemplateApiAvailable(targetWindow)) throw new Error(MISSING_TEMPLATE_API_MESSAGE);
  const context = await api.prepareContext();
  return String(await api.evalTemplate(source, context));
}

export { MISSING_TEMPLATE_API_MESSAGE };
