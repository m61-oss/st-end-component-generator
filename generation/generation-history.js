const textOf = (value) => String(value ?? '');

const normalizeLimit = (value) => {
  const numeric = Math.floor(Number(value));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 3;
};

const normalizeEntry = (entry, index = 0) => {
  if (!entry || typeof entry !== 'object') return null;
  const content = textOf(entry.content);
  if (!content.trim()) return null;
  const generatedAt = Number(entry.generatedAt);
  const safeGeneratedAt = Number.isFinite(generatedAt) ? generatedAt : 0;
  const id = textOf(entry.id).trim() || `${safeGeneratedAt}-${index}`;
  return { id, generatedAt: safeGeneratedAt, content };
};

export function loadGenerationHistory(storage, key, limit = 3) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(key) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry, index) => normalizeEntry(entry, index))
      .filter(Boolean)
      .slice(0, normalizeLimit(limit));
  } catch (_) {
    return [];
  }
}

export function recordGenerationResult(storage, key, content, generatedAt = Date.now(), limit = 3) {
  const normalizedContent = textOf(content);
  const current = loadGenerationHistory(storage, key, limit);
  if (!normalizedContent.trim()) return current;
  const timestamp = Number(generatedAt);
  const safeTimestamp = Number.isFinite(timestamp) ? timestamp : Date.now();
  const entry = {
    id: `${safeTimestamp}-${Math.random().toString(36).slice(2, 9)}`,
    generatedAt: safeTimestamp,
    content: normalizedContent,
  };
  const next = [entry, ...current].slice(0, normalizeLimit(limit));
  try {
    storage?.setItem?.(key, JSON.stringify(next));
  } catch (_) {}
  return next;
}
