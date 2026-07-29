const EXCLUDED_GENERATION_TYPES = new Set(['quiet', 'impersonate']);

export function createAutoGenerationTracker() {
  let cycle = null;

  return {
    start(type, dryRun = false) {
      cycle = {
        eligible: !dryRun && !EXCLUDED_GENERATION_TYPES.has(String(type || 'normal')),
        messageIndex: null,
        stopped: false,
      };
    },

    recordAssistantMessage(messageId, message) {
      if (messageId === null || messageId === undefined || String(messageId).trim() === '') return false;
      const messageIndex = Number(messageId);
      const isAssistantMessage = message
        && message.is_user !== true
        && message.is_system !== true
        && String(message.mes || '').trim();
      if (!cycle?.eligible || !Number.isInteger(messageIndex) || messageIndex < 0 || !isAssistantMessage) return false;
      cycle.messageIndex = messageIndex;
      return true;
    },

    stop() {
      if (cycle) cycle.stopped = true;
    },

    finish() {
      const completedCycle = cycle;
      cycle = null;
      if (!completedCycle || completedCycle.stopped || !Number.isInteger(completedCycle.messageIndex)) return null;
      return completedCycle.messageIndex;
    },
  };
}
