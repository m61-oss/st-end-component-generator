const textOf = (value) => String(value ?? '').trim();

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

// Matches SillyTavern's "remove connection data" export option. These values
// describe the local API connection, not the prompt preset itself.
const CONNECTION_FIELDS = [
  'chat_completion_source',
  'group_models',
  'sort_models',
  'openai_model',
  'claude_model',
  'openrouter_model',
  'openrouter_use_fallback',
  'openrouter_providers',
  'openrouter_quantizations',
  'openrouter_allow_fallbacks',
  'openrouter_middleout',
  'ai21_model',
  'mistralai_model',
  'cohere_model',
  'perplexity_model',
  'groq_model',
  'chutes_model',
  'siliconflow_model',
  'siliconflow_endpoint',
  'minimax_model',
  'minimax_endpoint',
  'electronhub_model',
  'nanogpt_model',
  'nanogpt_provider',
  'nanogpt_payg_override',
  'deepseek_model',
  'aimlapi_model',
  'xai_model',
  'pollinations_model',
  'moonshot_model',
  'fireworks_model',
  'cometapi_model',
  'custom_model',
  'custom_url',
  'custom_include_body',
  'custom_exclude_body',
  'custom_include_headers',
  'custom_prompt_post_processing',
  'google_model',
  'vertexai_model',
  'zai_model',
  'zai_endpoint',
  'workers_ai_model',
  'workers_ai_account_id',
  'reverse_proxy',
  'show_external_models',
  'proxy_password',
  'vertexai_auth_mode',
  'vertexai_region',
  'vertexai_express_project_id',
  'bypass_status_check',
  'azure_base_url',
  'azure_deployment_name',
  'azure_api_version',
  'azure_openai_model',
];

export function sanitizePresetForPortableExport(preset) {
  const output = cloneJson(preset);
  CONNECTION_FIELDS.forEach((field) => delete output[field]);
  delete output.extensions;
  return output;
}

export function buildPresetExportFilename({ schemeName = '', dirty = false } = {}) {
  const label = dirty || !textOf(schemeName) ? '未保存方案' : textOf(schemeName);
  const safeLabel = label.replace(/[\\/:*?"<>|]/g, '_');
  return `织幕-${safeLabel}.json`;
}

export function getNativeTavernPreset(context, name) {
  const manager = context?.getPresetManager?.('openai');
  const preset = manager?.getCompletionPresetByName?.(textOf(name));
  if (!preset || !Array.isArray(preset.prompts) || !Array.isArray(preset.prompt_order)) {
    throw new Error('无法读取酒馆原生格式的当前预设。');
  }
  return cloneJson(preset);
}

function getPromptId(prompt) {
  return textOf(prompt?.identifier ?? prompt?.id ?? prompt?.name);
}

function getItemId(item) {
  return textOf(item?.sourceUid ?? item?.identifier ?? item?.id ?? item?.name);
}

function findMainPromptOrder(promptOrder, itemIds) {
  const lists = Array.isArray(promptOrder) ? promptOrder.filter((list) => Array.isArray(list?.order)) : [];
  return [...lists].sort((left, right) => {
    const score = (list) => list.order.filter((entry) => itemIds.has(textOf(entry?.identifier))).length;
    return score(right) - score(left);
  })[0] || null;
}

export function selectPresetPromptOrder(preset) {
  const prompts = Array.isArray(preset?.prompts) ? preset.prompts : [];
  const promptIds = new Set(prompts.map(getPromptId).filter(Boolean));
  return findMainPromptOrder(preset?.prompt_order, promptIds)?.order || [];
}

export function buildEditedPresetExport({ preset, items = [], contentOverrides = {}, selectionOverrides = {} } = {}) {
  if (!preset || typeof preset !== 'object' || !Array.isArray(preset.prompts)) {
    throw new Error('当前来源不是有效的酒馆预设。');
  }
  const output = cloneJson(preset);
  const itemMap = new Map((Array.isArray(items) ? items : [])
    .map((item) => [getItemId(item), item])
    .filter(([id]) => Boolean(id)));

  output.prompts = output.prompts.map((prompt) => {
    const item = itemMap.get(getPromptId(prompt));
    if (!item || item.locked || item.markerType || !item.key
      || !Object.prototype.hasOwnProperty.call(contentOverrides || {}, item.key)) return prompt;
    return { ...prompt, content: String(contentOverrides[item.key] ?? '') };
  });

  const mainOrder = findMainPromptOrder(output.prompt_order, new Set(itemMap.keys()));
  if (mainOrder) {
    mainOrder.order = mainOrder.order.map((entry) => {
      const item = itemMap.get(textOf(entry?.identifier));
      if (!item?.key) return entry;
      const enabled = Object.prototype.hasOwnProperty.call(selectionOverrides || {}, item.key)
        ? selectionOverrides[item.key] !== false
        : item.enabled !== false;
      return { ...entry, enabled };
    });
  } else {
    output.prompts = output.prompts.map((prompt) => {
      const item = itemMap.get(getPromptId(prompt));
      if (!item?.key) return prompt;
      const enabled = Object.prototype.hasOwnProperty.call(selectionOverrides || {}, item.key)
        ? selectionOverrides[item.key] !== false
        : item.enabled !== false;
      return { ...prompt, enabled };
    });
  }
  return sanitizePresetForPortableExport(output);
}
