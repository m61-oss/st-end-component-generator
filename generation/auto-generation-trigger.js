export function resolveAutomaticAssistantMessageIndex(messageId, chat = []) {
  if (messageId === null || messageId === undefined || String(messageId).trim() === '') return null;
  const messageIndex = Number(messageId);
  if (!Number.isInteger(messageIndex) || messageIndex < 0) return null;

  const message = Array.isArray(chat) ? chat[messageIndex] : null;
  if (
    !message
    || message.is_user === true
    || message.is_system === true
    || !String(message.mes || '').trim()
  ) {
    return null;
  }
  return messageIndex;
}

export function captureAutomaticAssistantTarget(messageId, chat = []) {
  const messageIndex = resolveAutomaticAssistantMessageIndex(messageId, chat);
  if (messageIndex === null) return null;
  return {
    messageIndex,
  };
}

export function captureAutomaticGenerationBaseline(chat = []) {
  const messages = Array.isArray(chat) ? chat : [];
  let lastAssistantIndex = -1;
  let lastAssistantText = '';
  let lastAssistantSwipeId = null;
  messages.forEach((message, index) => {
    if (!message || message.is_user === true || message.is_system === true) return;
    if (!String(message.mes || '').trim()) return;
    lastAssistantIndex = index;
    lastAssistantText = String(message.mes);
    lastAssistantSwipeId = Number.isInteger(message.swipe_id) ? message.swipe_id : null;
  });
  return {
    chatLength: messages.length,
    lastAssistantIndex,
    lastAssistantText,
    lastAssistantSwipeId,
  };
}

export function getAutomaticAssistantTargetKey(target) {
  if (!target || !Number.isInteger(target.messageIndex)) return '';
  return `${target.messageIndex}:${Number.isInteger(target.swipeId) ? target.swipeId : ''}:${String(target.messageText || '')}`;
}

export function isAutomaticTargetAfterGenerationStart(target, baseline) {
  if (!target || !Number.isInteger(target.messageIndex)) return false;
  if (!baseline || typeof baseline !== 'object') return true;
  if (target.messageIndex >= Number(baseline.chatLength || 0)) return true;
  if (target.messageIndex > Number(baseline.lastAssistantIndex ?? -1)) return true;
  if (target.messageIndex < Number(baseline.lastAssistantIndex ?? -1)) return false;
  return (
    String(target.messageText || '') !== String(baseline.lastAssistantText || '')
    || target.swipeId !== baseline.lastAssistantSwipeId
  );
}

function resolveLatestAutomaticAssistantMessageIndex(chat = []) {
  const messages = Array.isArray(chat) ? chat : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (resolveAutomaticAssistantMessageIndex(index, messages) !== null) return index;
  }
  return null;
}

export function resolveReadyAutomaticAssistantTarget(target, chat = []) {
  if (!target || target.messageIndex !== resolveLatestAutomaticAssistantMessageIndex(chat)) return null;
  const message = chat[target.messageIndex];
  if (
    !message
    || message.is_user === true
    || message.is_system === true
    || !String(message.mes || '').trim()
  ) {
    return null;
  }
  const numericSwipeId = Number(message.swipe_id);
  return {
    ...target,
    messageText: String(message.mes),
    swipeId: Number.isInteger(numericSwipeId) && numericSwipeId >= 0 ? numericSwipeId : null,
  };
}

export function isAutomaticAssistantTargetAddressable(target, chat = []) {
  if (!target || target.messageIndex !== resolveLatestAutomaticAssistantMessageIndex(chat)) return false;
  const message = chat[target.messageIndex];
  return Boolean(
    message
    && message.is_user !== true
    && message.is_system !== true
    && String(message.mes || '').trim(),
  );
}
