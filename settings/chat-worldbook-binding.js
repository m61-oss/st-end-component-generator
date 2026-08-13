const textOf = (value) => String(value ?? '').trim();

export const CHAT_WORLDBOOK_METADATA_KEY = 'st_end_component_generator_worldbook';

export function getChatWorldbookSchemeId(metadata) {
  return textOf(metadata?.[CHAT_WORLDBOOK_METADATA_KEY]?.schemeId);
}

export function setChatWorldbookSchemeId(metadata, schemeId) {
  if (!metadata || typeof metadata !== 'object') return metadata;
  const id = textOf(schemeId);
  if (!id) delete metadata[CHAT_WORLDBOOK_METADATA_KEY];
  else metadata[CHAT_WORLDBOOK_METADATA_KEY] = { version: 1, schemeId: id };
  return metadata;
}

export function normalizeChatBindingIndex(index) {
  return (Array.isArray(index) ? index : [])
    .map((item) => ({
      chatId: textOf(item?.chatId),
      chatName: textOf(item?.chatName),
      characterName: textOf(item?.characterName),
      schemeId: textOf(item?.schemeId),
      schemeName: textOf(item?.schemeName),
      updatedAt: Number(item?.updatedAt) || 0,
      cancelled: item?.cancelled === true,
    }))
    .filter((item) => item.chatId);
}

export function upsertChatBindingIndex(index, binding) {
  const next = normalizeChatBindingIndex(index);
  const item = normalizeChatBindingIndex([binding])[0];
  if (!item?.chatId || !item.schemeId) return next;
  const existingIndex = next.findIndex((candidate) => candidate.chatId === item.chatId);
  item.cancelled = false;
  if (existingIndex >= 0) next[existingIndex] = item;
  else next.push(item);
  return next;
}

export function cancelChatBindingIndex(index, chatId) {
  const id = textOf(chatId);
  return normalizeChatBindingIndex(index).map((item) => item.chatId === id
    ? { ...item, cancelled: true, updatedAt: Date.now() }
    : item);
}

export function resolveChatBinding({ metadataSchemeId, index, chatId }) {
  const id = textOf(chatId);
  const record = normalizeChatBindingIndex(index).find((item) => item.chatId === id) || null;
  if (record?.cancelled) return { status: 'cancelled', schemeId: '', record };
  const schemeId = textOf(metadataSchemeId) || textOf(record?.schemeId);
  return { status: schemeId ? 'bound' : 'unbound', schemeId, record };
}
