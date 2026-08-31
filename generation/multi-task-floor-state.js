import { MULTI_TASK_STATUS } from './multi-task-state.js';

const taskId = (task) => String(task?.id ?? '').trim();

const collectTaskIds = (tasks, predicate = () => true) => (Array.isArray(tasks) ? tasks : [])
  .filter((task) => taskId(task) && predicate(task))
  .map(taskId);

const hasInjectableResult = (task) => (
  Boolean(String(task?.output ?? '').trim())
  || (Array.isArray(task?.anchorItems) && task.anchorItems.length > 0)
);

export function scopeMultiTaskFloorPanelSettings(value = {}, target = {}) {
  const tasks = Array.isArray(value?.tasks) ? value.tasks : [];
  const chatId = String(target?.chatId ?? '');
  const messageIndex = Number(target?.messageIndex);
  const addressMatches = (candidateChatId, candidateMessageIndex) => (
    Boolean(candidateChatId)
    && Number.isInteger(candidateMessageIndex)
    && candidateChatId === chatId
    && candidateMessageIndex === messageIndex
  );
  const described = tasks.map((task) => {
    const targetChatId = String(task?.target?.chatId ?? '');
    const targetMessageIndex = Number(task?.target?.messageIndex);
    const recordChatId = String(task?.injectionRecord?.chatId ?? '');
    const recordMessageIndex = Number(task?.injectionRecord?.targetIndex);
    const targetMatches = addressMatches(targetChatId, targetMessageIndex);
    const recordMatches = addressMatches(recordChatId, recordMessageIndex);
    const hasAddress = (Boolean(targetChatId) && Number.isInteger(targetMessageIndex))
      || (Boolean(recordChatId) && Number.isInteger(recordMessageIndex));
    return { task, targetMatches, recordMatches, hasAddress };
  });
  const scopedTasks = described.map(({ task, targetMatches, recordMatches, hasAddress }) => {
    if (targetMatches || recordMatches) {
      return {
        ...task,
        injectionRecord: recordMatches ? task.injectionRecord : null,
      };
    }
    if (!hasAddress) return task;
    return {
      ...task,
      status: MULTI_TASK_STATUS.IDLE,
      output: '',
      thinking: [],
      resultMode: 'standard',
      anchorItems: [],
      warnings: [],
      injectionRecord: null,
      error: null,
    };
  });
  const activeTaskId = scopedTasks.some((task) => taskId(task) === String(value?.activeTaskId ?? ''))
    ? String(value.activeTaskId)
    : taskId(scopedTasks[0]);
  return {
    ...value,
    activeTaskId,
    tasks: scopedTasks,
  };
}

export function planMultiTaskFloorActions({ allTasks = [], floorTasks = [] } = {}) {
  return {
    generateTaskIds: collectTaskIds(allTasks),
    injectTaskIds: collectTaskIds(
      floorTasks,
      (task) => [MULTI_TASK_STATUS.READY, MULTI_TASK_STATUS.UNDONE].includes(task.status)
        && hasInjectableResult(task),
    ),
    undoTaskIds: collectTaskIds(floorTasks, (task) => Boolean(task.injectionRecord)),
    retryTaskIds: collectTaskIds(floorTasks, (task) => task.status === MULTI_TASK_STATUS.ERROR),
    runningTaskIds: collectTaskIds(
      floorTasks,
      (task) => [MULTI_TASK_STATUS.QUEUED, MULTI_TASK_STATUS.GENERATING].includes(task.status),
    ),
  };
}
