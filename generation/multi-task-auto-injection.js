const PENDING = 'pending';
const READY = 'ready';
const SKIPPED = 'skipped';

export function canEnqueueTaskAutoInjection(task, expectedRunId) {
  return Boolean(task)
    && String(task.runId ?? '') === String(expectedRunId ?? '')
    && task.status === 'ready';
}

export function createTaskOrderInjectionCoordinator(taskIds = [], { enqueue } = {}) {
  if (typeof enqueue !== 'function') throw new TypeError('enqueue must be a function');
  const order = [...new Set((Array.isArray(taskIds) ? taskIds : []).map((id) => String(id ?? '')).filter(Boolean))];
  const states = new Map(order.map((id) => [id, PENDING]));
  const promises = [];
  let cursor = 0;

  const flush = () => {
    while (cursor < order.length) {
      const taskId = order[cursor];
      const state = states.get(taskId);
      if (state === PENDING) return;
      cursor += 1;
      if (state !== READY) continue;
      try {
        promises.push(Promise.resolve(enqueue(taskId)));
      } catch (error) {
        promises.push(Promise.reject(error));
      }
    }
  };

  const settleTask = (taskId, state) => {
    const id = String(taskId ?? '');
    if (!states.has(id) || states.get(id) !== PENDING) return;
    states.set(id, state);
    flush();
  };

  return {
    ready(taskId) { settleTask(taskId, READY); },
    skip(taskId) { settleTask(taskId, SKIPPED); },
    async settle() {
      const results = await Promise.allSettled(promises);
      return results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    },
  };
}
