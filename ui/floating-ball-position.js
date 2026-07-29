const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function parseSavedCoordinate(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function resolveFloatingBallPosition({
  savedLeft,
  savedTop,
  viewportWidth,
  viewportHeight,
  ballSize,
  margin = 16,
}) {
  const width = Math.max(0, Number(viewportWidth) || 0);
  const height = Math.max(0, Number(viewportHeight) || 0);
  const size = Math.max(0, Number(ballSize) || 0);
  const inset = Math.max(0, Number(margin) || 0);
  const maxLeft = Math.max(0, width - size);
  const maxTop = Math.max(0, height - size);
  const defaultLeft = Math.max(0, width - size - inset);
  const defaultTop = Math.max(0, height - size - inset);
  const parsedLeft = parseSavedCoordinate(savedLeft);
  const parsedTop = parseSavedCoordinate(savedTop);

  return {
    left: clamp(parsedLeft ?? defaultLeft, 0, maxLeft),
    top: clamp(parsedTop ?? defaultTop, 0, maxTop),
  };
}
