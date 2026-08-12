const textOf = (value) => String(value ?? '').trim();

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
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
  return output;
}
