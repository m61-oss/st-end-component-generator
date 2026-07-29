export function clampPreviewHeight(scrollHeight, minHeight, maxHeight) {
  const measuredHeight = Number(scrollHeight);
  const minimum = Number(minHeight);
  const maximum = Number(maxHeight);
  if (!Number.isFinite(measuredHeight)) return minimum;
  return Math.max(minimum, Math.min(maximum, measuredHeight));
}
