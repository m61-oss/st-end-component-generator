const normalizeDelay = (value) => {
  const milliseconds = Number(value);
  return Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : 0;
};

export function createMultiTaskInjectionQueue({
  execute,
  wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  now = () => Date.now(),
} = {}) {
  if (typeof execute !== 'function') throw new TypeError('execute must be a function');
  let tail = Promise.resolve();
  let lastFinishedAt = null;

  return {
    enqueue(task, { intervalMs = 0 } = {}) {
      const requestedInterval = normalizeDelay(intervalMs);
      const operation = tail.catch(() => {}).then(async () => {
        if (lastFinishedAt !== null && requestedInterval > 0) {
          const remaining = requestedInterval - Math.max(0, now() - lastFinishedAt);
          if (remaining > 0) await wait(remaining);
        }
        try {
          return await execute(task);
        } finally {
          lastFinishedAt = now();
        }
      });
      tail = operation.catch(() => {});
      return operation;
    },
  };
}
