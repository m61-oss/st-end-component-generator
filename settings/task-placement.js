export const TASK_PLACEMENT_AFTER_CHAT_HISTORY = '__st_esg_after_chat_history__';

export function resolveTaskPlacementSelection(items, storedId) {
  const candidates = Array.isArray(items) ? items : [];
  const savedId = String(storedId || '');
  const chatHistoryId = candidates.find((item) => item?.markerType === 'chatHistory')?.id || '';
  if (savedId && savedId !== TASK_PLACEMENT_AFTER_CHAT_HISTORY && candidates.some((item) => item?.id === savedId)) {
    return { selectedId: savedId, storedId: savedId };
  }
  if (chatHistoryId) {
    return { selectedId: chatHistoryId, storedId: TASK_PLACEMENT_AFTER_CHAT_HISTORY };
  }
  return { selectedId: '', storedId: '' };
}
