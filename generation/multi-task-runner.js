const clone = (value) => {
  if (typeof globalThis.structuredClone === 'function') return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

const clampConcurrency = (value) => {
  const count = Math.floor(Number(value));
  return Number.isFinite(count) ? Math.min(5, Math.max(1, count)) : 1;
};

const createRunId = () => (
  typeof globalThis.crypto?.randomUUID === 'function'
    ? `run-${globalThis.crypto.randomUUID()}`
    : `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
);

export function createMultiTaskRunPlan({
  tasks = [],
  concurrency = 1,
  target = {},
  resolveTask = () => ({}),
  runId = '',
} = {}) {
  const frozenTarget = clone(target && typeof target === 'object' ? target : {});
  const entries = (Array.isArray(tasks) ? tasks : []).slice(0, 5).map((task, index) => {
    const frozenTask = clone(task);
    const runtime = clone(resolveTask(frozenTask, index));
    return {
      index,
      task: frozenTask,
      target: clone(frozenTarget),
      runtime,
    };
  });
  return {
    runId: String(runId || createRunId()),
    concurrency: clampConcurrency(concurrency),
    entries,
  };
}

export async function runMultiTaskQueue(plan, {
  execute,
  onTransition = () => {},
  isCurrent = () => true,
} = {}) {
  if (typeof execute !== 'function') throw new TypeError('execute must be a function');
  const entries = Array.isArray(plan?.entries) ? plan.entries : [];
  const results = entries.map((entry) => ({ taskId: entry.task.id, status: 'queued' }));
  entries.forEach((entry) => onTransition({ runId: plan.runId, taskId: entry.task.id, status: 'queued' }));
  let cursor = 0;

  const worker = async () => {
    while (cursor < entries.length) {
      if (!isCurrent(plan.runId)) break;
      const index = cursor;
      cursor += 1;
      const entry = entries[index];
      onTransition({ runId: plan.runId, taskId: entry.task.id, status: 'generating' });
      try {
        const value = await execute(entry, plan);
        if (!isCurrent(plan.runId)) {
          results[index] = { taskId: entry.task.id, status: 'cancelled' };
          continue;
        }
        results[index] = { taskId: entry.task.id, status: 'fulfilled', value };
        onTransition({ runId: plan.runId, taskId: entry.task.id, status: 'ready', value });
      } catch (error) {
        const cancelled = error?.name === 'AbortError' || !isCurrent(plan.runId);
        results[index] = { taskId: entry.task.id, status: cancelled ? 'cancelled' : 'rejected', error };
        onTransition({
          runId: plan.runId,
          taskId: entry.task.id,
          status: cancelled ? 'cancelled' : 'error',
          error,
        });
      }
    }
  };

  const workerCount = Math.min(entries.length, clampConcurrency(plan?.concurrency));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  for (let index = cursor; index < entries.length; index += 1) {
    results[index] = { taskId: entries[index].task.id, status: 'cancelled' };
  }
  return results;
}
