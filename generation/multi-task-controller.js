import { applyMultiTaskInjection, undoMultiTaskInjection } from '../injection/multi-task-injection.js';
import { containsStatusPlaceholder, normalizeStatusPlaceholder } from '../injection/inject-utils.js';
import { stripConfiguredBlocks } from '../injection/tag-rules.js';
import { recordGenerationResult } from './generation-history.js';
import { normalizeGeneratedResult } from './output-result.js';
import { normalizeStreamOutputPreview } from './stream-output-preview.js';
import {
  MULTI_TASK_INJECTION_ORDER_TASK,
  MULTI_TASK_STATUS,
  normalizeMultiTaskSettings,
} from './multi-task-state.js';
import { canEnqueueTaskAutoInjection, createTaskOrderInjectionCoordinator } from './multi-task-auto-injection.js';
import { createMultiTaskInjectionQueue } from './multi-task-injection-queue.js';
import { createMultiTaskRunPlan, runMultiTaskQueue } from './multi-task-runner.js';
import { resolveMultiTaskRuntimeSettings } from './multi-task-runtime.js';

const defaultTextOf = (value) => String(value ?? '').trim();

export function createMultiTaskController(deps = {}) {
  const {
    getSettings,
    setMultiTaskSettings,
    normalizeSettings = normalizeMultiTaskSettings,
    status = MULTI_TASK_STATUS,
    textOf = defaultTextOf,
    getContext,
    getLatestAssistantMessage,
    getAssistantMessageAtIndex,
    getCurrentChatId,
    callExternalApi,
    captureActiveView = () => {},
    renderRuntimeState = () => {},
    scheduleRender = renderRuntimeState,
    updateFloorStream = () => {},
    updateActiveStream = () => {},
    notify = () => {},
    recordHistoryView = () => {},
    getHistoryStorage = () => globalThis.localStorage,
    historyStorageKey = 'st-esg.recentGenerationHistory',
    setRecentHistory = () => {},
    containsMvuUpdateVariable = containsStatusPlaceholder,
    reprocessMvuVariables = async () => {},
    confirm = (message) => globalThis.confirm?.(message) ?? false,
    wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  } = deps;
  if (typeof getSettings !== 'function' || typeof setMultiTaskSettings !== 'function') {
    throw new TypeError('multi-task controller requires settings accessors');
  }

  const abortControllers = deps.abortControllers || new Map();
  const activeRunIds = deps.activeRunIds || new Set();
  const readState = () => normalizeSettings(getSettings().multiTaskSettings);
  const readTasks = (requestedTaskIds = null) => {
    const ids = Array.isArray(requestedTaskIds) ? new Set(requestedTaskIds.map(textOf).filter(Boolean)) : null;
    return readState().tasks.filter((task) => !ids || ids.has(task.id));
  };

  function replaceTask(taskId, patch) {
    const state = readState();
    setMultiTaskSettings({
      ...state,
      tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
    });
  }

  function cancelGeneration(taskIds = null) {
    const state = readState();
    const requestedIds = Array.isArray(taskIds) ? new Set(taskIds.map(textOf).filter(Boolean)) : null;
    const cancellable = new Set([status.QUEUED, status.GENERATING]);
    let changed = false;
    setMultiTaskSettings({
      ...state,
      tasks: state.tasks.map((task) => {
        if ((requestedIds && !requestedIds.has(task.id)) || !cancellable.has(task.status)) return task;
        abortControllers.get(task.id)?.abort();
        abortControllers.delete(task.id);
        changed = true;
        return {
          ...task,
          runId: '',
          status: task.output || task.anchorItems?.length ? status.READY : status.IDLE,
        };
      }),
    });
    if (changed) renderRuntimeState();
    return changed;
  }

  const serializeError = (error) => ({
    message: textOf(error?.message) || '生成失败。',
    code: textOf(error?.code),
  });

  function normalizeResult(rawText) {
    const normalized = normalizeGeneratedResult(rawText);
    const anchorItems = Array.isArray(normalized.anchorItems) ? normalized.anchorItems : [];
    const resultMode = normalized.mode.startsWith('anchor-') ? 'anchor' : 'standard';
    const output = normalized.usable ? normalized.content : '';
    if (!output.trim() && !anchorItems.length) throw new Error('API 返回内容无法形成可注入结果。');
    return {
      output,
      thinking: Array.isArray(normalized.thinking) ? normalized.thinking : (normalized.thinking ? [normalized.thinking] : []),
      resultMode,
      anchorItems,
      warnings: Array.isArray(normalized.warnings) ? normalized.warnings : [],
      error: null,
    };
  }

  function updateStream(taskId, text, runId) {
    const state = readState();
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task || task.runId !== runId) return;
    const streamed = normalizeStreamOutputPreview(text);
    replaceTask(taskId, {
      output: streamed.text,
      thinking: streamed.thinking ? [streamed.thinking] : [],
      error: null,
    });
    updateFloorStream(taskId);
    updateActiveStream(taskId, streamed, state);
  }

  function recordHistory(result) {
    const historyResult = result.resultMode === 'anchor'
      ? { kind: 'anchor', anchorItems: result.anchorItems, warnings: result.warnings }
      : result.output;
    const history = recordGenerationResult(getHistoryStorage(), historyStorageKey, historyResult);
    setRecentHistory(history);
    recordHistoryView();
  }

  const injectionQueue = createMultiTaskInjectionQueue({
    execute: ({ taskId, silent, expectedRunId }) => injectBatchNow([taskId], { silent, expectedRunId }),
    wait,
  });

  const enqueueInjection = (taskId, { intervalMs = 0, silent = false, expectedRunId = '' } = {}) => (
    injectionQueue.enqueue({ taskId, silent, expectedRunId }, { intervalMs })
  );

  async function persistMessageUpdates(context, messageIndexes) {
    for (const messageIndex of messageIndexes) {
      const message = context.chat?.[messageIndex];
      if (!message) continue;
      context.updateMessageBlock(messageIndex, message);
      const messageUpdatedEvent = context.eventTypes?.MESSAGE_UPDATED;
      if (messageUpdatedEvent && context.eventSource?.emit) {
        await context.eventSource.emit(messageUpdatedEvent, messageIndex);
      }
    }
    const saveResult = await context.saveChat();
    if (saveResult === false) throw new Error('聊天保存接口返回失败。');
  }

  async function generate(requestedTaskIds = null) {
    captureActiveView();
    const appSettings = getSettings();
    const multiState = readState();
    const tasks = readTasks(requestedTaskIds);
    if (!tasks.length) {
      notify('请先在设置中添加任务。', 'warning');
      return [];
    }
    if (appSettings.rollbackBeforeGeneration) {
      await undo(tasks.map((task) => task.id), { requireConfirmation: false, silent: true });
    }
    const context = getContext();
    const latest = getLatestAssistantMessage(context.chat);
    if (!latest) {
      notify('没有找到可用于生成的助手回复。', 'warning');
      return [];
    }
    const target = {
      chatId: getCurrentChatId(context),
      messageIndex: latest.index,
      messageText: String(latest.message.mes ?? ''),
    };
    const schemeLists = {
      apiSchemes: appSettings.apiSchemes,
      presetSchemes: appSettings.presetSchemes,
      worldbookSchemes: appSettings.worldbookSchemes,
      componentSchemes: appSettings.componentSchemes,
    };
    const runtimeByTaskId = new Map();
    for (const task of tasks) {
      try {
        runtimeByTaskId.set(task.id, resolveMultiTaskRuntimeSettings(appSettings, task, schemeLists));
      } catch (error) {
        replaceTask(task.id, { status: status.ERROR, error: serializeError(error) });
      }
    }
    const runnableTasks = tasks.filter((task) => runtimeByTaskId.has(task.id));
    if (!runnableTasks.length) {
      renderRuntimeState();
      notify('任务缺少 API 方案或组件方案，请先在设置中选择。', 'warning');
      return [];
    }
    runnableTasks.forEach((task) => abortControllers.get(task.id)?.abort());
    const plan = createMultiTaskRunPlan({
      tasks: runnableTasks,
      concurrency: multiState.concurrency,
      target,
      resolveTask: (task) => runtimeByTaskId.get(task.id),
    });
    activeRunIds.add(plan.runId);
    plan.entries.forEach((entry) => replaceTask(entry.task.id, {
      runId: plan.runId,
      status: status.QUEUED,
      output: '',
      thinking: [],
      resultMode: entry.runtime.injectMode === 'anchor' ? 'anchor' : 'standard',
      anchorItems: [],
      warnings: [],
      target,
      error: null,
    }));
    scheduleRender();
    const shouldAutoInject = Boolean(appSettings.autoInject);
    const autoInjectionPromises = [];
    const enqueueAutoInjection = (taskId) => {
      const currentTask = readState().tasks.find((task) => task.id === taskId);
      if (!canEnqueueTaskAutoInjection(currentTask, plan.runId)) return Promise.resolve([]);
      replaceTask(taskId, { status: status.PENDING_INJECTION });
      scheduleRender();
      const promise = enqueueInjection(taskId, {
        intervalMs: multiState.injectionIntervalSeconds * 1000,
        silent: true,
        expectedRunId: plan.runId,
      });
      autoInjectionPromises.push(promise);
      return promise;
    };
    const orderCoordinator = shouldAutoInject && multiState.injectionOrder === MULTI_TASK_INJECTION_ORDER_TASK
      ? createTaskOrderInjectionCoordinator(plan.entries.map((entry) => entry.task.id), { enqueue: enqueueAutoInjection })
      : null;
    const results = await runMultiTaskQueue(plan, {
      isCurrent: (runId) => activeRunIds.has(runId),
      onTransition: ({ taskId, status: nextStatus, value, error }) => {
        const currentTask = readState().tasks.find((task) => task.id === taskId);
        if (!currentTask || currentTask.runId !== plan.runId) {
          orderCoordinator?.skip(taskId);
          return;
        }
        if (nextStatus === 'queued' || nextStatus === 'generating') {
          replaceTask(taskId, { status: nextStatus === 'queued' ? status.QUEUED : status.GENERATING });
        } else if (nextStatus === 'ready') {
          replaceTask(taskId, { ...value, status: status.READY });
          if (shouldAutoInject) {
            if (orderCoordinator) orderCoordinator.ready(taskId);
            else enqueueAutoInjection(taskId);
          }
        } else if (nextStatus === 'error') {
          replaceTask(taskId, { status: status.ERROR, error: serializeError(error) });
          orderCoordinator?.skip(taskId);
        } else if (nextStatus === 'cancelled') {
          replaceTask(taskId, { status: currentTask.output ? status.READY : status.IDLE });
          orderCoordinator?.skip(taskId);
        }
        scheduleRender();
      },
      execute: async (entry) => {
        const currentTask = readState().tasks.find((task) => task.id === entry.task.id);
        if (currentTask?.runId !== plan.runId) {
          const error = new Error('Task generation was cancelled');
          error.name = 'AbortError';
          throw error;
        }
        const controller = new AbortController();
        abortControllers.set(entry.task.id, controller);
        try {
          let rawText = '';
          try {
            rawText = await callExternalApi(latest.message, controller.signal, entry.runtime, {
              onPreview: (text) => updateStream(entry.task.id, text, plan.runId),
              onPromptLog: () => {},
            });
          } catch (error) {
            const partial = String(error?.streamedText ?? '');
            if (!partial.trim()) throw error;
            rawText = partial;
          }
          const result = normalizeResult(rawText);
          recordHistory(result);
          return result;
        } finally {
          if (abortControllers.get(entry.task.id) === controller) abortControllers.delete(entry.task.id);
        }
      },
    });
    activeRunIds.delete(plan.runId);
    const completed = results.filter((item) => item.status === 'fulfilled').length;
    const failed = results.filter((item) => item.status === 'rejected').length;
    if (autoInjectionPromises.length) await Promise.allSettled(autoInjectionPromises);
    notify(`多任务生成结束：完成 ${completed} 个${failed ? `，失败 ${failed} 个` : ''}。`, failed ? 'warning' : 'info');
    return results;
  }

  async function inject(requestedTaskIds = null) {
    captureActiveView();
    const tasks = readTasks(requestedTaskIds)
      .filter((task) => [status.READY, status.UNDONE].includes(task.status))
      .filter((task) => String(task.output || '').trim() || task.anchorItems?.length);
    if (!tasks.length) {
      notify('没有可注入的多任务结果。', 'warning');
      return [];
    }
    const intervalMs = tasks.length > 1 ? readState().injectionIntervalSeconds * 1000 : 0;
    tasks.forEach((task) => replaceTask(task.id, { status: status.PENDING_INJECTION }));
    scheduleRender();
    const results = await Promise.allSettled(tasks.map((task) => enqueueInjection(task.id, { intervalMs, silent: true })));
    const injectedTaskIds = results.filter((result) => result.status === 'fulfilled').flatMap((result) => result.value);
    if (injectedTaskIds.length) notify(`已按顺序分批注入 ${injectedTaskIds.length} 个结果。`);
    return injectedTaskIds;
  }

  async function injectBatchNow(requestedTaskIds = null, { silent = false, expectedRunId = '' } = {}) {
    const tasks = readTasks(requestedTaskIds)
      .filter((task) => !expectedRunId || task.runId === expectedRunId)
      .filter((task) => ![status.QUEUED, status.GENERATING].includes(task.status))
      .filter((task) => String(task.output || '').trim() || task.anchorItems?.length);
    if (!tasks.length) {
      if (!silent) notify('没有可注入的多任务结果。', 'warning');
      return [];
    }
    const appSettings = getSettings();
    const context = getContext();
    const currentChatId = getCurrentChatId(context);
    const changedIndexes = new Set();
    const mvuIndexes = new Set();
    const injectedTaskIds = [];
    for (const task of tasks) {
      const targetIndex = Number(task.target?.messageIndex);
      if (textOf(task.target?.chatId) !== currentChatId || !Number.isInteger(targetIndex)) {
        replaceTask(task.id, { status: status.ERROR, error: { message: '任务目标聊天已经变化，无法注入。', code: 'target-changed' } });
        continue;
      }
      const latest = getAssistantMessageAtIndex(context.chat, targetIndex);
      if (!latest) {
        replaceTask(task.id, { status: status.ERROR, error: { message: '任务目标楼层已经不存在。', code: 'target-missing' } });
        continue;
      }
      try {
        const prepared = {
          taskId: task.id,
          targetIndex,
          resultMode: task.resultMode,
          output: stripConfiguredBlocks(task.output, appSettings.outputCleanupTags).trim(),
          anchorItems: (Array.isArray(task.anchorItems) ? task.anchorItems : []).map((item) => ({
            ...item,
            content: stripConfiguredBlocks(item?.content, appSettings.outputCleanupTags).trim(),
          })),
        };
        const injected = applyMultiTaskInjection(String(latest.message.mes ?? ''), prepared);
        latest.message.mes = appSettings.statusPlaceholderEnabled
          ? normalizeStatusPlaceholder(injected.text, true)
          : injected.text;
        if (Array.isArray(latest.message.swipes) && Number.isInteger(latest.message.swipe_id)) {
          latest.message.swipes[latest.message.swipe_id] = latest.message.mes;
        }
        const record = { ...injected.record, chatId: currentChatId, targetIndex, afterText: latest.message.mes };
        replaceTask(task.id, { status: status.INJECTED, injectionRecord: record, error: null });
        changedIndexes.add(targetIndex);
        injectedTaskIds.push(task.id);
        const insertedText = record.operations.map((operation) => operation.text).join('\n');
        if (appSettings.mvuReprocessOnInject && containsMvuUpdateVariable(insertedText)) mvuIndexes.add(targetIndex);
      } catch (error) {
        replaceTask(task.id, { status: status.ERROR, error: serializeError(error) });
      }
    }
    if (changedIndexes.size) {
      try {
        await persistMessageUpdates(context, [...changedIndexes]);
        for (const targetIndex of mvuIndexes) await reprocessMvuVariables(context, targetIndex);
      } catch (error) {
        notify(`多任务内容已经写入，但聊天保存失败：${error?.message || '未知错误'}`, 'warning');
      }
    }
    renderRuntimeState();
    if (!silent && injectedTaskIds.length) notify(`已注入 ${injectedTaskIds.length} 个结果。`);
    return injectedTaskIds;
  }

  async function undo(requestedTaskIds = null, { requireConfirmation = false, silent = false } = {}) {
    const tasks = readTasks(requestedTaskIds).filter((task) => task.injectionRecord);
    if (!tasks.length) {
      if (!silent) notify('没有可撤回的多任务注入记录。', 'warning');
      return [];
    }
    if (requireConfirmation && !confirm(`撤回 ${tasks.length} 个任务各自最新的一次注入？\n\n已经单独撤回的任务会自动跳过。`)) return [];
    const appSettings = getSettings();
    const context = getContext();
    const currentChatId = getCurrentChatId(context);
    const changedIndexes = new Set();
    const undoneTaskIds = [];
    for (const task of [...tasks].reverse()) {
      const record = task.injectionRecord;
      const targetIndex = Number(record?.targetIndex);
      const latest = getAssistantMessageAtIndex(context.chat, targetIndex);
      if (textOf(record?.chatId) !== currentChatId || !latest) continue;
      const undone = undoMultiTaskInjection(String(latest.message.mes ?? ''), record);
      if (!undone.ok) {
        replaceTask(task.id, { error: { message: '楼层中的对应注入内容已经变化，无法安全撤回。', code: undone.reason } });
        continue;
      }
      latest.message.mes = appSettings.statusPlaceholderEnabled
        ? normalizeStatusPlaceholder(undone.text, true)
        : undone.text;
      if (Array.isArray(latest.message.swipes) && Number.isInteger(latest.message.swipe_id)) {
        latest.message.swipes[latest.message.swipe_id] = latest.message.mes;
      }
      replaceTask(task.id, { status: status.UNDONE, injectionRecord: null, error: null });
      changedIndexes.add(targetIndex);
      undoneTaskIds.push(task.id);
    }
    if (changedIndexes.size) {
      try {
        await persistMessageUpdates(context, [...changedIndexes]);
        if (appSettings.mvuReprocessOnInject) {
          for (const targetIndex of changedIndexes) await reprocessMvuVariables(context, targetIndex);
        }
      } catch (error) {
        notify(`撤回已经应用，但聊天保存失败：${error?.message || '未知错误'}`, 'warning');
      }
    }
    renderRuntimeState();
    if (!silent && undoneTaskIds.length) notify(`已撤回 ${undoneTaskIds.length} 个任务各自最新的一次注入。`);
    return undoneTaskIds;
  }

  return {
    replaceTask,
    cancelGeneration,
    generate,
    inject,
    injectBatchNow,
    undo,
    enqueueInjection,
  };
}
