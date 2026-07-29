const textOf = (value) => String(value ?? '').trim();

function stripKnownEndpoint(url) {
  return textOf(url)
    .replace(/\/+$/, '')
    .replace(/\/chat\/completions$/i, '')
    .replace(/\/models$/i, '');
}

export function normalizeChatCompletionsUrl(url) {
  const base = stripKnownEndpoint(url);
  return base ? `${base}/chat/completions` : '';
}

export function normalizeModelsUrl(url) {
  const base = stripKnownEndpoint(url);
  return base ? `${base}/models` : '';
}

export function extractModelIds(payload) {
  const list = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.models)
      ? payload.models
      : Array.isArray(payload?.data?.models)
        ? payload.data.models
        : Array.isArray(payload)
          ? payload
          : [];
  return [...new Set(list
    .map((item) => textOf(typeof item === 'string' ? item : item?.id || item?.name || item?.model))
    .filter(Boolean))];
}
