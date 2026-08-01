export function clampPreviewHeight(scrollHeight, minHeight, maxHeight) {
  const measuredHeight = Number(scrollHeight);
  const minimum = Number(minHeight);
  const maximum = Number(maxHeight);
  if (!Number.isFinite(measuredHeight)) return minimum;
  return Math.max(minimum, Math.min(maximum, measuredHeight));
}

export function getPreviewLayout(scrollHeight, minHeight, maxHeight) {
  const height = clampPreviewHeight(scrollHeight, minHeight, maxHeight);
  const measuredHeight = Number(scrollHeight);
  return {
    height,
    overflowY: Number.isFinite(measuredHeight) && measuredHeight > height ? 'auto' : 'hidden',
  };
}

export function isPreviewNearBottom({ scrollTop = 0, clientHeight = 0, scrollHeight = 0 } = {}, threshold = 24) {
  const remaining = Number(scrollHeight) - Number(clientHeight) - Number(scrollTop);
  return Number.isFinite(remaining) && remaining <= Math.max(0, Number(threshold) || 0);
}
