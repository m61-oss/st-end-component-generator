const EDGE_PANEL_BALL_ATTRIBUTE = 'data-edge-ball-id';

export function markFloatingBallCompatible(ball) {
  if (!ball) return;
  ball.classList.add('st-esg-floating-ball');
  ball.setAttribute('data-floating-ball', 'true');
}

export function isFloatingBallExternallyManaged(ball) {
  return Boolean(ball?.hasAttribute?.(EDGE_PANEL_BALL_ATTRIBUTE));
}
