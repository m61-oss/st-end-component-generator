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
    messageText: String(chat[messageIndex].mes),
  };
}

export function resolveReadyAutomaticAssistantTarget(target, chat = []) {
  if (!target || target.messageIndex !== chat.length - 1) return null;
  const message = chat[target.messageIndex];
  if (
    !message
    || message.is_user === true
    || message.is_system === true
    || String(message.mes || '') !== target.messageText
    || !Number.isInteger(message.swipe_id)
    || !Array.isArray(message.swipes)
    || String(message.swipes[message.swipe_id] ?? '') !== target.messageText
  ) {
    return null;
  }
  return {
    ...target,
    swipeId: message.swipe_id,
  };
}

export function isAutomaticAssistantTargetCurrent(target, chat = []) {
  if (!target || target.messageIndex !== chat.length - 1) return false;
  const message = chat[target.messageIndex];
  return Boolean(
    message
    && message.is_user !== true
    && message.is_system !== true
    && String(message.mes || '') === target.messageText
    && Number.isInteger(message.swipe_id)
    && message.swipe_id === target.swipeId
    && Array.isArray(message.swipes)
    && String(message.swipes[message.swipe_id] ?? '') === target.messageText
  );
}
