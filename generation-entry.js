export function getGenerationConflictAction(isGenerating, entryType = 'manual') {
  if (!isGenerating) return 'start';
  if (entryType === 'quickReply') return 'notify';
  if (entryType === 'automatic') return 'ignore';
  return 'abort';
}
