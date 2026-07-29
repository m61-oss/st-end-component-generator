const NOTIFICATION_METHODS = new Set(['success', 'warning', 'error', 'info']);

export function getNotificationMethod(tone) {
  return NOTIFICATION_METHODS.has(tone) ? tone : 'info';
}
