const FLOATING_BALL_STATES = new Set(['idle', 'generating', 'waiting', 'error']);

export function normalizeFloatingBallVisualState(state) {
  return FLOATING_BALL_STATES.has(state) ? state : 'idle';
}

export function resolveFloatingBallRenderedState(state, animationEnabled) {
  const normalizedState = normalizeFloatingBallVisualState(state);
  if (normalizedState === 'error') return 'error';
  return animationEnabled ? normalizedState : 'idle';
}
