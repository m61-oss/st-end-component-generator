const textOf = (value) => String(value ?? '').trim();

export const CHAT_MULTI_TASK_METADATA_KEY = 'st_end_component_generator_multi_task';

export function getChatMultiTaskSchemeId(metadata) {
  return textOf(metadata?.[CHAT_MULTI_TASK_METADATA_KEY]?.schemeId);
}

export function setChatMultiTaskSchemeId(metadata, schemeId) {
  if (!metadata || typeof metadata !== 'object') return metadata;
  const id = textOf(schemeId);
  if (!id) delete metadata[CHAT_MULTI_TASK_METADATA_KEY];
  else metadata[CHAT_MULTI_TASK_METADATA_KEY] = { version: 1, schemeId: id };
  return metadata;
}
