const text = (value) => String(value ?? '');

const swipeIdOf = (value) => {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
};

export function createInjectionUndoSnapshot({
  targetIndex,
  chatLength,
  originalText,
  injectedText,
  swipeId = null,
  hadSwipe = false,
  originalSwipeText = '',
  injectedSwipeText = '',
  mvuReprocessed = false,
} = {}) {
  return {
    targetIndex: Number(targetIndex),
    chatLength: Number(chatLength),
    originalText: text(originalText),
    injectedText: text(injectedText),
    swipeId: swipeIdOf(swipeId),
    hadSwipe: Boolean(hadSwipe),
    originalSwipeText: text(originalSwipeText),
    injectedSwipeText: text(injectedSwipeText),
    mvuReprocessed: Boolean(mvuReprocessed),
  };
}

export function validateInjectionUndoSnapshot(snapshot, chat = []) {
  if (!snapshot) return { valid: false, reason: 'missing-snapshot', message: null };
  if (!Array.isArray(chat) || chat.length !== snapshot.chatLength) {
    return { valid: false, reason: 'chat-length-changed', message: null };
  }
  if (snapshot.targetIndex !== chat.length - 1) {
    return { valid: false, reason: 'target-not-latest', message: null };
  }
  const message = chat[snapshot.targetIndex];
  if (!message || message.is_user === true || message.is_system === true) {
    return { valid: false, reason: 'target-not-assistant', message: message || null };
  }
  if (text(message.mes) !== snapshot.injectedText) {
    return { valid: false, reason: 'message-changed', message };
  }
  const currentSwipeId = swipeIdOf(message.swipe_id);
  if (currentSwipeId !== snapshot.swipeId) {
    return { valid: false, reason: 'swipe-changed', message };
  }
  if (snapshot.hadSwipe && (!Array.isArray(message.swipes) || text(message.swipes[currentSwipeId]) !== snapshot.injectedSwipeText)) {
    return { valid: false, reason: 'swipe-content-changed', message };
  }
  return { valid: true, reason: '', message };
}

export function createRollbackPromptView({
  snapshot,
  chat = [],
  injectMode = '',
  targetIndex = null,
} = {}) {
  const fallback = {
    applied: false,
    chat,
    message: Array.isArray(chat) ? (chat[targetIndex] || null) : null,
    targetIndex,
  };
  if (!['rollbackAppend', 'rollbackReplace'].includes(injectMode)) return fallback;
  if (!snapshot || Number(targetIndex) !== snapshot.targetIndex) return fallback;

  const validation = validateInjectionUndoSnapshot(snapshot, chat);
  if (!validation.valid) return fallback;

  const message = { ...validation.message, mes: snapshot.originalText };
  if (snapshot.hadSwipe && Array.isArray(validation.message.swipes) && snapshot.swipeId !== null) {
    message.swipes = [...validation.message.swipes];
    message.swipes[snapshot.swipeId] = snapshot.originalSwipeText;
  }
  const promptChat = [...chat];
  promptChat[snapshot.targetIndex] = message;
  return {
    applied: true,
    chat: promptChat,
    message,
    targetIndex: snapshot.targetIndex,
  };
}
