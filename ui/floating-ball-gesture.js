const distance = (dx, dy) => Math.hypot(Number(dx) || 0, Number(dy) || 0);

export function hasFloatingBallDragStarted({ dx, dy, threshold = 10 }) {
  return distance(dx, dy) >= Math.max(0, Number(threshold) || 0);
}

export function resolveFloatingBallDock({ left, viewportWidth, ballSize, snapZone = 56 }) {
  const x = Number(left) || 0;
  const width = Math.max(0, Number(viewportWidth) || 0);
  const size = Math.max(0, Number(ballSize) || 0);
  const zone = Math.max(0, Number(snapZone) || 0);
  const rightGap = width - (x + size);
  if (x <= zone) return 'left';
  if (rightGap <= zone) return 'right';
  return 'none';
}

export function resolveFloatingBallRestTransform({ dock, enabled }) {
  if (!enabled) return 'translate3d(0, 0, 0)';
  if (dock === 'left') return 'translate3d(-50%, 0, 0)';
  if (dock === 'right') return 'translate3d(50%, 0, 0)';
  return 'translate3d(0, 0, 0)';
}
