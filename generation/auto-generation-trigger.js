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
