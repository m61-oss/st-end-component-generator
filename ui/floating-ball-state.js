const FLOATING_BALL_STATES = new Set(['idle', 'generating', 'waiting', 'error']);
const MULTI_TASK_RUNNING_STATES = new Set(['queued', 'generating']);
const MULTI_TASK_WAITING_STATES = new Set(['ready', 'pending-injection', 'undone']);

export function normalizeFloatingBallVisualState(state) {
  return FLOATING_BALL_STATES.has(state) ? state : 'idle';
}

export function resolveFloatingBallRenderedState(state, animationEnabled) {
  const normalizedState = normalizeFloatingBallVisualState(state);
  if (normalizedState === 'error') return 'error';
  return animationEnabled ? normalizedState : 'idle';
}

export function resolveMultiTaskFloatingBallVisualState(tasks) {
  const statuses = Array.isArray(tasks) ? tasks.map((task) => String(task?.status || '')) : [];
  if (statuses.some((status) => MULTI_TASK_RUNNING_STATES.has(status))) return 'generating';
  if (statuses.includes('error')) return 'error';
  if (statuses.some((status) => MULTI_TASK_WAITING_STATES.has(status))) return 'waiting';
  return 'idle';
}
