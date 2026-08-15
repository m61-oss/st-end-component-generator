const textOf = (value) => String(value ?? '');

const normalizeLimit = (value) => {
  const numeric = Math.floor(Number(value));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 3;
};

function cloneAnchorItems(items) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({ ...item }));
}

const normalizeEntry = (entry, index = 0) => {
  if (!entry || typeof entry !== 'object') return null;
  const generatedAt = Number(entry.generatedAt);
  const safeGeneratedAt = Number.isFinite(generatedAt) ? generatedAt : 0;
  const id = textOf(entry.id).trim() || `${safeGeneratedAt}-${index}`;
  const anchorItems = cloneAnchorItems(entry.anchorItems);

  if (entry.kind === 'anchor' || anchorItems.length > 0) {
    if (!anchorItems.length) return null;
    return {
      id,
      generatedAt: safeGeneratedAt,
      kind: 'anchor',
      anchorItems,
      warnings: Array.isArray(entry.warnings) ? entry.warnings.map(textOf).filter(Boolean) : [],
    };
  }

  const content = textOf(entry.content);
  if (!content.trim()) return null;
  return { id, generatedAt: safeGeneratedAt, kind: 'text', content };
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

function normalizeResult(result) {
  if (typeof result === 'string') {
    return result.trim() ? { kind: 'text', content: result } : null;
  }
  if (!result || typeof result !== 'object') return null;
  const anchorItems = cloneAnchorItems(result.anchorItems);
  if ((result.kind === 'anchor' || anchorItems.length > 0) && anchorItems.length > 0) {
    return {
      kind: 'anchor',
      anchorItems,
      warnings: Array.isArray(result.warnings) ? result.warnings.map(textOf).filter(Boolean) : [],
    };
  }
  const content = textOf(result.content);
  return content.trim() ? { kind: 'text', content } : null;
}

export function recordGenerationResult(storage, key, result, generatedAt = Date.now(), limit = 3) {
  const normalized = normalizeResult(result);
  const current = loadGenerationHistory(storage, key, limit);
  if (!normalized) return current;
  const timestamp = Number(generatedAt);
  const safeTimestamp = Number.isFinite(timestamp) ? timestamp : Date.now();
  const entry = {
    id: `${safeTimestamp}-${Math.random().toString(36).slice(2, 9)}`,
    generatedAt: safeTimestamp,
    ...normalized,
  };
  const next = [entry, ...current].slice(0, normalizeLimit(limit));
  try {
    storage?.setItem?.(key, JSON.stringify(next));
  } catch (_) {}
  return next;
}

export function updateGenerationHistoryEntry(storage, key, id, patch, limit = 3) {
  const current = loadGenerationHistory(storage, key, limit);
  const targetId = textOf(id);
  const next = current.map((entry) => {
    if (entry.id !== targetId || !patch || typeof patch !== 'object') return entry;
    if (entry.kind === 'anchor') {
      const anchorItems = cloneAnchorItems(patch.anchorItems ?? entry.anchorItems);
      return {
        ...entry,
        anchorItems,
        warnings: Array.isArray(patch.warnings)
          ? patch.warnings.map(textOf).filter(Boolean)
          : entry.warnings,
      };
    }
    return patch.content === undefined ? entry : { ...entry, content: textOf(patch.content) };
  });
  try {
    storage?.setItem?.(key, JSON.stringify(next));
  } catch (_) {}
  return next;
}
