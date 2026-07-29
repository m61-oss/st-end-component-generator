const EXCLUDED_GENERATION_TYPES = new Set(['quiet', 'impersonate']);

function snapshotTail(chat = []) {
  const messages = Array.isArray(chat) ? chat : [];
  const lastIndex = messages.length - 1;
  const message = lastIndex >= 0 ? messages[lastIndex] : null;
  return {
    lastIndex,
    isUser: message?.is_user === true,
    isSystem: message?.is_system === true,
    content: String(message?.mes || ''),
  };
}

function isAssistantMessage(message) {
  return Boolean(
    message
    && message.is_user !== true
    && message.is_system !== true
    && String(message.mes || '').trim(),
  );
}

export function createAutoGenerationTracker() {
  const sessions = [];
  const pendingCompletions = new Set();

  return {
    start(type, dryRun = false, chat = []) {
      sessions.push({
        eligible: !dryRun && !EXCLUDED_GENERATION_TYPES.has(String(type || 'normal')),
        startTail: snapshotTail(chat),
        messageIndex: null,
        stopped: false,
      });
    },

    recordAssistantMessage(messageId, message) {
      if (messageId === null || messageId === undefined || String(messageId).trim() === '') return false;
      const messageIndex = Number(messageId);
      const session = sessions[sessions.length - 1];
      if (
        !session?.eligible
        || session.stopped
        || !Number.isInteger(messageIndex)
        || messageIndex < 0
        || !isAssistantMessage(message)
      ) {
        return false;
      }
      session.messageIndex = messageIndex;
      return true;
    },

    stop() {
      sessions.forEach((session) => { session.stopped = true; });
      pendingCompletions.forEach((completion) => { completion.stopped = true; });
    },

    end() {
      const session = sessions.pop();
      if (!session?.eligible) return null;
      pendingCompletions.add(session);
      return session;
    },

    finalize(completion, chat = []) {
      if (!completion || !pendingCompletions.delete(completion)) return null;
      if (completion.stopped || !Number.isInteger(completion.messageIndex)) return null;

      const messages = Array.isArray(chat) ? chat : [];
      const messageIndex = completion.messageIndex;
      const message = messages[messageIndex];
      if (messageIndex !== messages.length - 1 || !isAssistantMessage(message)) return null;

      const startTail = completion.startTail;
      const isNewMessage = messageIndex > startTail.lastIndex;
      const isChangedMessage = messageIndex === startTail.lastIndex
        && (startTail.isUser || startTail.isSystem || String(message.mes || '') !== startTail.content);
      return isNewMessage || isChangedMessage ? messageIndex : null;
    },
  };
}
