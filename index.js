import { getContext } from '../../../st-context.js';
import {
  COMPONENT_SCOPE_CHARACTER,
  COMPONENT_SCOPE_GLOBAL,
  COMPONENT_SCOPE_PRESET,
  SOURCE_PRESET,
  SOURCE_WORLDBOOK,
  collectPresetImportGroups,
  collectWorldbookImportCandidates,
  collectWorldbookImportGroups,
  createComponentId,
  getActiveComponentsForContext,
  getComponentLibraryFolders,
  getComponentBindingName,
  getCurrentCharacterNameSafe,
  getCurrentPresetNameSafe,
  migrateLegacyComponentGroups,
  getPresetNamesSafe,
  normalizeComponent,
  normalizeComponentIds,
  normalizeComponentScope,
} from './sources/component-sources.js?ver=0.2.2';
import { applyComponentPositionMove } from './sources/component-order.js?ver=0.2.2';
import { extractModelIds, normalizeChatCompletionsUrl, normalizeModelsUrl } from './api/api-utils.js?ver=0.2.2';
import { containsStatusPlaceholder, injectStatusbarText, normalizeStatusPlaceholder, STATUS_PLACEHOLDER_TAG } from './injection/inject-utils.js?ver=0.2.2';
import { createInjectionUndoSnapshot, validateInjectionUndoSnapshot } from './injection/injection-undo.js?ver=0.2.2';
import { applyMultiTaskInjection, undoMultiTaskInjection } from './injection/multi-task-injection.js?ver=0.2.2';
import { buildExternalStatusbarMessages, createRuntimePromptDiagnostics, stripInternalMessageFields } from './generation/prompt-builder.js?ver=0.2.2';
import { ANCHOR_OUTPUT_PROTOCOL_SYSTEM_PROMPT, OUTPUT_PROTOCOL_SYSTEM_PROMPT } from './generation/output-protocol.js?ver=0.2.2';
import { normalizeGeneratedResult } from './generation/output-result.js?ver=0.2.2';
import { applyAnchorInsertions, buildAnchorPreviewSegments, isAnchorInsertionEnabled, locateAnchorInsertions } from './injection/anchor-insertion.js?ver=0.2.2';
import { normalizeStreamOutputPreview } from './generation/stream-output-preview.js?ver=0.2.2';
import { composeTaskInstruction } from './generation/task-instruction.js?ver=0.2.2';
import { CHAT_HISTORY_RANGE_RECENT, CHAT_HISTORY_RANGE_VISIBLE, normalizeChatHistoryRangeMode, normalizeRecentMessageCount } from './generation/chat-history-range.js?ver=0.2.2';
import { renderPromptTemplate } from './generation/template-compat.js?ver=0.2.2';
import { replaceTavernHelperMacrosInMessages } from './generation/tavern-helper-macros.js?ver=0.2.2';
import { getBaiBaiBookApi } from './sources/baibai-book.js?ver=0.2.2';
import { applyAnimaWorldbookOverrides, captureAnimaWorldbookEntries, captureAnimaWorldbookUntil, filterAnimaWorldbookEntries, getAnimaChatId, mergeAnimaWorldbookSnapshots, readLatestAnimaStatus, shouldClearAnimaSnapshotForChat } from './sources/anima-memory.js?ver=0.2.2';
import { createPromptLog, createPromptLogViewModel, mergeConsecutiveSystemMessages } from './generation/prompt-log.js?ver=0.2.2';
import {
  clearImportSelectionsForScope,
  collectSelectedPromptSourceItems,
  normalizePromptSourceType,
  syncPromptSelectionsFromGroups,
} from './sources/source-selection.js?ver=0.2.2';
import { captureSchemeSnapshot, deleteScheme, findScheme, getWorldbookSchemeSourceNames, hydrateTavernWorldbookSelections, isWorldbookSchemeSnapshotUsable, normalizeSchemeList, resolveWorldbookPromptSelectionsForLoad, saveScheme } from './settings/scheme-utils.js?ver=0.2.2';
import { applyComponentSchemeSnapshot, captureComponentSchemeSnapshot } from './settings/component-schemes.js?ver=0.2.2';
import { readOpenAiStream } from './api/stream-utils.js?ver=0.2.2';
import { normalizeApiRetryCount, withApiRetries } from './api/api-retry.js?ver=0.2.2';
import { stripConfiguredBlocks } from './injection/tag-rules.js?ver=0.2.2';
import { filterWorldbookPromptItems, normalizeWorldbookActivationMode, splitWorldbookKeywords } from './sources/worldbook-scan.js?ver=0.2.2';
import { getWorldbookGenerationIssue, getWorldbookRawName, reconcileWorldbookEntryRecords, removeWorldbookEntryRecord, removeWorldbookSourceRecords } from './sources/worldbook-identity.js?ver=0.2.2';
import { reconcilePresetEntryRecords, reconcilePresetSchemeRecords } from './sources/preset-identity.js?ver=0.2.2';
import { getWorldInfoSettings } from '../../../world-info.js?ver=0.2.2';
import { createGenerationErrorRecord, markGenerationResponseError } from './generation/generation-error.js?ver=0.2.2';
import { getNotificationMethod } from './ui/notification-utils.js?ver=0.2.2';
import {
  FLOOR_PANEL_STATUS,
  canEditFloorPanelResult,
  createFloorPanelState,
  createFloorPanelTarget,
  createMultiTaskFloorPanelView,
  getEndedFloorPanelStatus,
  getFloorPanelActionModels,
  getFloorPanelStatusStage,
  hasInjectableFloorPanelResult,
  isFloorPanelGenerationCurrent,
  isFloorPanelTargetAddressable,
  nextFloorPanelGeneration,
  scopeMultiTaskFloorPanelSettings,
} from './ui/message-floor-panel.js?ver=0.2.2';
import { getGenerationConflictAction } from './generation/generation-entry.js?ver=0.2.2';
import { loadGenerationHistory, recordGenerationResult, updateGenerationHistoryEntry } from './generation/generation-history.js?ver=0.2.2';
import {
  MULTI_TASK_INJECTION_ORDER_TASK,
  MULTI_TASK_STATUS,
  createMultiTask,
  deleteMultiTask,
  mergeMultiTaskWorkspaceView,
  normalizeMultiTaskSettings,
  renameMultiTask,
  selectMultiTask,
} from './generation/multi-task-state.js?ver=0.2.2';
import { createMultiTaskRunPlan, runMultiTaskQueue } from './generation/multi-task-runner.js?ver=0.2.2';
import { createMultiTaskInjectionQueue } from './generation/multi-task-injection-queue.js?ver=0.2.2';
import { canEnqueueTaskAutoInjection, createTaskOrderInjectionCoordinator } from './generation/multi-task-auto-injection.js?ver=0.2.2';
import { resolveMultiTaskRuntimeSettings } from './generation/multi-task-runtime.js?ver=0.2.2';
import { renderGenerationModeSwitch, renderMultiTaskWorkspace } from './ui/multi-task-workspace.js?ver=0.2.2';
import {
  THEATER_DEFAULT_GROUP_ID,
  THEATER_RANDOM_MODE_ALL,
  THEATER_RANDOM_MODE_ENABLED,
  THEATER_RANDOM_MODE_FIXED_ENABLED,
  THEATER_RANDOM_MODE_OFF,
  THEATER_RANDOM_SCOPE_GLOBAL,
  THEATER_RANDOM_SCOPE_GROUPED,
  getTheaterLibraryFolders,
  normalizeTheaterRandomCount,
  normalizeTheaterRandomMode,
  normalizeTheaterRandomScope,
  selectTheaterComponents,
} from './sources/theater-library.js?ver=0.2.2';
import {
  captureAutomaticAssistantTarget,
  captureAutomaticGenerationBaseline,
  getAutomaticAssistantTargetKey,
  isAutomaticAssistantTargetAddressable,
  isAutomaticAssistantMessageTypeEligible,
  isAutomaticTargetAfterGenerationStart,
  matchesAutomaticGenerationTrigger,
  resolveReadyAutomaticAssistantTarget,
} from './generation/auto-generation-trigger.js?ver=0.2.2';
import { resolveFloatingBallPosition } from './ui/floating-ball-position.js?ver=0.2.2';
import { hasFloatingBallDragStarted, resolveFloatingBallDock } from './ui/floating-ball-gesture.js?ver=0.2.2';
import { normalizeFloatingBallVisualState, resolveFloatingBallRenderedState } from './ui/floating-ball-state.js?ver=0.2.2';
import { isFloatingBallExternallyManaged, markFloatingBallCompatible } from './ui/floating-ball-compat.js?ver=0.2.2';
import { renderBrandMark } from './ui/brand-mark.js?ver=0.2.2';
import { getGenerationInjectionModeHelp } from './ui/generation-settings.js?ver=0.2.2';
import { getThemeClassName, getThemePresentation, nextThemeMode, normalizeThemeMode } from './ui/theme-mode.js?ver=0.2.2';
import {
  buildApiRequestParts,
  parseApiAdditionalParameters,
  parseApiNumericSettings,
  serializeRequestHeadersYaml,
} from './api/api-request-parameters.js?ver=0.2.2';
import {
  createPromptSourceCacheState,
  loadWorldbookSourceGroups,
  markPromptSourceStructureDirty,
  markWorldbookSourceDirty,
  takeDirtyWorldbookSources,
} from './sources/prompt-source-cache.js?ver=0.2.2';
import { TASK_PLACEMENT_AFTER_CHAT_HISTORY, resolveTaskPlacementSelection } from './settings/task-placement.js?ver=0.2.2';
import { createStreamPreviewController } from './ui/stream-preview.js?ver=0.2.2';
import { getPreviewLayout, isPreviewNearBottom } from './ui/preview-sizing.js?ver=0.2.2';
import {
  WORLDBOOK_RUNTIME_DRAFT,
  WORLDBOOK_RUNTIME_NATIVE,
  WORLDBOOK_RUNTIME_SCHEME,
  attachWorldbookRuntimeCategory,
  isWorldbookSourceEnabled,
  resolveWorldbookEntryRuntimeState,
  resolveWorldbookSourceDisplayCategory,
} from './sources/worldbook-runtime-state.js?ver=0.2.2';
import { buildLibraryExportFilename, createLibraryExportPackage, importLibraryPackage, toggleLibraryExportSelection } from './sources/library-transfer.js?ver=0.2.2';
import { buildEditedPresetExport, buildPresetExportFilename, getNativeTavernPreset } from './sources/preset-export.js?ver=0.2.2';
import { resolveTavernProfile } from './generation/tavern-profile.js?ver=0.2.2';
import {
  cancelChatBindingIndex,
  getChatWorldbookSchemeId,
  normalizeChatBindingIndex,
  resolveChatBinding,
  setChatWorldbookSchemeId,
  upsertChatBindingIndex,
} from './settings/chat-worldbook-binding.js?ver=0.2.2';
import { buildDataManagementModel, clearSettingsDataCategory, formatByteSize } from './settings/data-management.js?ver=0.2.2';
import { buildTagCleanupImportSummary, createTagCleanupExportPackage, mergeTagCleanupImport } from './settings/tag-cleanup-transfer.js?ver=0.2.2';

const EXTENSION_ID = 'st-end-component-generator';
const EXTENSION_VERSION = '0.2.2';
const BRAND_NAME = '织幕';
const BRAND_SUBTITLE = '外置组件生成器';
const PROMPT_TEMPLATE_COMPAT_STORAGE_KEY = `${EXTENSION_ID}.promptTemplateCompatEnabled`;
const GENERATION_HISTORY_STORAGE_KEY = `${EXTENSION_ID}.recentGenerationHistory`;
// 生成页当前结果只属于本次页面运行会话；跨刷新查看应使用最近生成记录。
const TRANSIENT_GENERATION_SETTING_KEYS = Object.freeze([
  'lastGenerated',
  'lastGeneratedAnchorItems',
  'lastGeneratedAnchorWarnings',
  'lastGeneratedResultMode',
  'lastGeneratedAnchorTargetIndex',
  'lastGeneratedStatusPlaceholderPresent',
  'lastGeneratedThinking',
  'lastGenerationError',
]);
const SOURCE_MODE_PROMPT = 'prompt';
const SOURCE_MODE_IMPORT = 'import';
const WORLD_BOOK_FOLLOW_TAVERN = '__follow_tavern__';
const DEFAULT_COMPONENT_GROUP_VALUE = '__default_group__';
const ANIMA_WORLD_BOOK_CAPTURE_RETRY_DELAY_MS = 100;
const MAX_OUTPUT_TOKENS = 65535;
const FLOATING_BALL_MIN_SIZE = 28;
const FLOATING_BALL_MAX_SIZE = 72;
const FLOATING_BALL_MIN_OPACITY = 0.2;
const FLOATING_BALL_MAX_OPACITY = 1;
const QR_SHORTCUT_SET_NAME = '织幕快捷键';
const QR_SHORTCUT_ACTIONS_KEY = '__stEsgQuickReplyActions';
const WORLDBOOK_CATEGORY_ORDER = [
  ['global', '全局世界书'],
  ['character', '角色世界书'],
  ['chat', '聊天世界书'],
  ['plugin', '插件启用'],
  ['failed', '读取失败'],
  ['inactive', '未启用世界书'],
];

const DEFAULT_SETTINGS = {
  enabled: false,
  mode: 'manual',
  autoGenerate: null,
  automaticGenerationTriggerText: '',
  autoInject: null,
  activeTab: 'workspace',
  generationMode: 'single',
  multiTaskSettings: { concurrency: 1, injectionIntervalSeconds: 1, injectionOrder: 'completion', activeTaskId: '', tasks: [] },
  taskPrompt: [
    '现在停止生成正文，为最新的正文补充下面这些内容。',
    '{{external_components}}',
    '上方为需要补充的内容，现在开始输出思考过程并按规则和格式输出需要补充的内容，禁止额外生成正文。',
  ].join('\n'),
  standardOutputProtocol: OUTPUT_PROTOCOL_SYSTEM_PROMPT,
  standardOutputProtocolRole: 'assistant',
  anchorOutputProtocol: ANCHOR_OUTPUT_PROTOCOL_SYSTEM_PROMPT,
  anchorOutputProtocolRole: 'assistant',
  outputProtocolAssistantDefaultApplied: false,
  apiUrl: '',
  apiKey: '',
  apiModel: '',
  apiMode: 'custom',
  useMainApi: false,
  tavernProfile: '',
  apiModelOptions: [],
  maxTokens: String(MAX_OUTPUT_TOKENS),
  temperature: '1',
  additionalBodyYaml: '',
  excludedBodyYaml: '',
  additionalHeadersYaml: '',
  streamingEnabled: false,
  apiRetryCount: 0,
  promptTemplateCompatEnabled: false,
  injectMode: 'replace',
  rollbackBeforeGeneration: false,
  statusPlaceholderEnabled: false,
  mvuReprocessOnInject: true,
  historyCleanupTags: '',
  historyCleanupRules: [],
  historyRangeMode: CHAT_HISTORY_RANGE_VISIBLE,
  recentMessageCount: 10,
  outputCleanupTags: '',
  lastGenerated: '',
  lastGeneratedAnchorItems: [],
  lastGeneratedAnchorWarnings: [],
  lastGeneratedResultMode: 'standard',
  lastGeneratedAnchorTargetIndex: null,
  lastGeneratedStatusPlaceholderPresent: false,
  lastGeneratedThinking: [],
  lastGenerationError: null,
  lastPromptLog: '',
  compressSystemMessages: false,
  taskPlacementEnabled: true,
  taskPlacementAfterSourceId: TASK_PLACEMENT_AFTER_CHAT_HISTORY,
  replaceLastUserMessageWithTask: true,
  omitOriginalUserMessages: false,
  baiBaiBookHistoryEnabled: false,
  baiBaiBookStateEnabled: false,
  memorySource: 'none',
  combinedMemorySourcesMigrated: false,
  animaWorldbookEnabled: false,
  animaStatusVariableEnabled: false,
  animaStatusAfterMessageEnabled: false,
  ballX: null,
  ballY: null,
  ballPositionVersion: 2,
  ballVisible: false,
  ballSize: 38,
  ballOpacity: 0.82,
  ballAnimationEnabled: true,
  ballSnapEnabled: false,
  ballDock: 'none',
  qrGenerateEnabled: false,
  qrInjectEnabled: false,
  messageFloorPanelEnabled: true,
  messageFloorPanelDefaultApplied: false,
  theme: 'dark',
  activeSourcePreset: '',
  sourceMode: SOURCE_MODE_PROMPT,
  sourceModes: { preset: SOURCE_MODE_PROMPT, worldbook: SOURCE_MODE_PROMPT },
  promptSelections: {},
  importSelections: {},
  sourceContentOverrides: {},
  worldbookActivationOverrides: {},
  worldbookKeywordOverrides: {},
  worldbookInitialized: false,
  worldbookDraftSources: [],
  apiSchemes: [],
  taskSchemes: [],
  presetSchemes: [],
  worldbookSchemes: [],
  componentSchemes: [],
  chatWorldbookBindings: [],
  selectedApiSchemeId: '',
  selectedTaskSchemeId: '',
  selectedPresetSchemeId: '',
  selectedWorldbookSchemeId: '',
  selectedComponentSchemeId: '',
  activeSchemeIds: {},
  dirtySchemeTypes: {},
  components: [],
  componentGroups: [],
  defaultGroupEnabled: {},
  componentGroupsMigrated: false,
  theaterComponents: [],
  theaterGroups: [],
  theaterDefaultGroupEnabled: true,
  theaterRandomScope: THEATER_RANDOM_SCOPE_GLOBAL,
  theaterRandomMode: THEATER_RANDOM_MODE_OFF,
  theaterRandomCount: 1,
  theaterGroupedFallbackMode: THEATER_RANDOM_MODE_OFF,
  theaterGroupedFallbackCount: 1,
  theaterGroupRandomOverrides: [],
};

const targetWindow = (() => {
  try { return window.parent?.document?.body ? window.parent : window; } catch (_) { return window; }
})();
const targetDoc = targetWindow.document;
let initialized = false;
let settings = { ...DEFAULT_SETTINGS };
let outputProtocolEditorMode = 'standard';
let importCandidates = [];
let importGroups = [];
const promptSourceCache = createPromptSourceCacheState();
let activeWorldbookGroupIndex = null;
let generationAbortController = null;
const multiTaskAbortControllers = new Map();
const activeMultiTaskRunIds = new Set();
const multiTaskInjectionQueue = createMultiTaskInjectionQueue({
  execute: ({ taskId, silent, expectedRunId }) => injectMultiTaskBatchNow([taskId], { silent, expectedRunId }),
  wait: (milliseconds) => new Promise((resolve) => targetWindow.setTimeout(resolve, milliseconds)),
});
let floatingBallVisualState = 'idle';
let activeAutomaticTarget = null;
let automaticGenerationRevision = 0;
const pendingAutomaticTargets = new Map();
let automaticGenerationBaseline = null;
let automaticGenerationEndTimer = null;
let lastAutomaticTargetKey = '';
let automaticGenerationLogActive = false;
const automaticGenerationLogEntries = [];
let lastRuntimeDiagnostics = {};
let lastPromptLogText = '';
let promptLogBuilding = false;
let lastGeneratedThinking = [];
let recentGenerationHistory = [];
let singleTaskWorkspaceSnapshot = null;
let multiTaskFrameworkRenderScheduled = false;
let activeGenerationHistoryId = null;
let anchorEditSaveTimer = null;
let settingsSaveTimer = null;
let latestInjectionUndoSnapshot = null;
let animaWorldbookSnapshotPromise = null;
let animaWorldbookSnapshot = [];
let animaWorldbookSnapshotChatId = '';
let animaWorldbookCaptureRun = null;
let tavernSyncTimer = null;
let lastTavernSourceSignature = '';
let listSearchQuery = '';
let listFilterMode = 'all';
let componentSearchQuery = '';
let componentFilterMode = 'all';
let componentListFilterScheduled = false;
let componentEditMode = false;
let componentMoveState = null;
let selectedComponentIds = new Set();
let componentLibraryOpen = true;
let componentLibraryContextKey = '';
let theaterSearchQuery = '';
let theaterFilterMode = 'all';
let theaterLibraryFilterScheduled = false;
let theaterEditMode = false;
let theaterMoveState = null;
let selectedTheaterIds = new Set();
let theaterLibraryOpen = true;
let theaterRandomSettingsOpen = false;
let libraryExportMode = false;
let exportSelectedComponentIds = new Set();
let exportSelectedTheaterIds = new Set();
let quickReplySyncTimer = null;
let worldbookCountRevision = 0;
let magicWandMenuTimer = null;
let yamlParserPromise = null;
let temporaryTaskInstruction = '';
let messageFloorPanelState = createFloorPanelState();
let messageFloorPanelRefreshTimer = null;
let messageFloorPanelFollowBottom = true;
let messageFloorPanelResizeObserver = null;
let messageFloorPanelSuppressRefresh = false;

const $t = (selectorOrHtml) => $(selectorOrHtml, targetDoc);
const textOf = (value) => String(value ?? '').trim();
const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const VISIBLE_GENERATION_LOG_STAGES = new Set([
  'api-start',
  'api-retry',
  'api-returned',
  'generation-error',
  'generation-skip',
  'inject-skip',
  'inject-finished',
  'inject-save-warning',
  'inject-error',
  'undo-skip',
  'undo-finished',
  'undo-save-warning',
  '等待渲染',
  '等待结束结果',
  '找到 assistant',
  '跳过重复',
]);

function logAutomaticGenerationStage(stage, details = '') {
  const stageLabels = {
    'api-retry': '请求失败，准备重试',
    'generation-start': '开始生成',
    'target-ready': '找到目标回复',
    'api-start': '开始调用外置 API',
    'prompt-build-start': '开始组装提示词',
    'api-returned': '生成完成',
    'generation-error': '生成失败',
    'api-finished': 'API 调用结束',
    'generation-skip': '跳过生成',
    'result-apply': '更新生成预览',
    'inject-queued': '准备注入',
    'generation-finished': '生成完成',
    'inject-start': '开始注入',
    'inject-skip': '跳过注入',
    'inject-snapshot': '保存注入前快照',
    'mvu-reprocess': '处理 MVU 变量',
    'chat-save': '保存聊天记录',
    'inject-finished': '注入完成',
    'inject-save-warning': '注入保存警告',
    'inject-error': '注入失败',
    'undo-start': '开始撤回',
    'undo-skip': '跳过撤回',
    'undo-restore': '恢复注入前内容',
    'undo-save-warning': '撤回保存警告',
    'undo-finished': '撤回完成',
    'generation-started': '收到生成开始事件',
    'generation-ended': '收到生成结束事件',
    'message-received': '收到 assistant 消息',
    'message-rendered': 'assistant 消息已渲染',
    '等待渲染': '等待生成条件',
    '等待结束结果': '等待最新 assistant',
    '找到 assistant': '检测到 assistant',
    '跳过重复': '跳过重复',
  };
  const detailText = String(details || '')
    .replaceAll('automatic', '自动生成')
    .replaceAll('manual', '手动生成')
    .replaceAll('quickReply', '快捷回复')
    .replaceAll('latest assistant', '最新 assistant')
    .replaceAll('received content', '已收到内容')
    .replaceAll('empty response', '返回为空')
    .replaceAll('response handling complete', '响应处理完成')
    .replaceAll('no generated content', '没有生成内容')
    .replaceAll('preparing target', '准备目标回复')
    .replaceAll('updating preview', '正在更新预览')
    .replaceAll('auto-inject enabled', '已开启自动注入')
    .replaceAll('waiting for manual injection', '等待手动注入')
    .replaceAll('injection complete', '注入完成')
    .replaceAll('injection failed', '注入失败')
    .replaceAll('restore complete, chat save failed', '恢复完成，但聊天保存失败')
    .replaceAll('message changed during confirmation', '确认期间消息发生变化')
    .replaceAll('invalid snapshot', '快照无效')
    .replaceAll('API address or model is missing', 'API 地址或模型未填写')
    .replace(/^message (\d+)/, '楼层 $1')
    .replace(/^message (\d+); /, '楼层 $1；');
  const suffix = detailText ? `：${detailText}` : '';
  const line = `${new Date().toLocaleTimeString()} ${stageLabels[stage] || stage}${suffix}`;
  console.log(`[${EXTENSION_ID}] ${line}`);
  if (!VISIBLE_GENERATION_LOG_STAGES.has(stage)) return;
  automaticGenerationLogEntries.push(line);
  if (automaticGenerationLogEntries.length > 40) automaticGenerationLogEntries.shift();
  const logElement = targetDoc.getElementById('st-esg-generation-log');
  if (logElement) {
    logElement.textContent = automaticGenerationLogEntries.join('\n');
    logElement.scrollTop = logElement.scrollHeight;
  }
}

function clearAutomaticGenerationLog() {
  automaticGenerationLogEntries.length = 0;
  automaticGenerationLogActive = true;
  const logElement = targetDoc.getElementById('st-esg-generation-log');
  if (logElement) logElement.textContent = '';
}

async function runConfiguredApiRequest(operation, signal, sourceSettings = settings, onPreview = updateStreamedPreview) {
  const maxRetries = normalizeApiRetryCount(sourceSettings.apiRetryCount);
  return withApiRetries(operation, {
    maxRetries,
    signal,
    onRetry: ({ retryNumber, delayMs, classification }) => {
      const seconds = Math.max(0, Math.ceil(delayMs / 1000));
      logAutomaticGenerationStage('api-retry', `第 ${retryNumber}/${maxRetries} 次，${seconds} 秒后重试（${classification.reason}）`);
      notifyStatus(`【织幕】失败自动重试中...（${retryNumber}/${maxRetries}）`, 'warning');
      onPreview('');
    },
  });
}

async function getYamlParser() {
  if (!yamlParserPromise) {
    yamlParserPromise = import('../../../../lib.js').then((yamlModule) => {
      const yamlParser = yamlModule.yaml
        ?? yamlModule.default?.yaml
        ?? targetWindow.yaml
        ?? targetWindow.jsyaml;
      return yamlParser && typeof yamlParser.parse === 'function' ? yamlParser : null;
    });
  }
  return await yamlParserPromise;
}

function getHostRequestHeaders() {
  try {
    const headers = getContext()?.getRequestHeaders?.();
    return headers && typeof headers === 'object' ? headers : {};
  } catch {
    return {};
  }
}

function getQuickReplyApi() {
  return targetWindow.quickReplyApi ?? globalThis.quickReplyApi;
}

function getQuickReplyShortcutEntries() {
  return [
    {
      enabled: settings.qrGenerateEnabled,
      label: '点击生成',
      title: '生成组件',
      message: '生成组件快捷操作',
      action: 'generate',
    },
    {
      enabled: settings.qrInjectEnabled,
      label: '点击注入',
      title: '注入回复',
      message: '注入组件快捷操作',
      action: 'inject',
    },
  ];
}

function updateQuickReplyShortcutActions() {
  targetWindow[QR_SHORTCUT_ACTIONS_KEY] = {
    generate: () => settings.generationMode === 'multi' ? generateMultiTasks() : generateStatusbar('quickReply'),
    inject: () => settings.generationMode === 'multi' ? injectMultiTasks() : injectGeneratedStatusbar(),
  };
}

async function syncQuickReplyShortcuts({ attempt = 0, notifyOnUnavailable = false } = {}) {
  const enabled = settings.qrGenerateEnabled || settings.qrInjectEnabled;
  const quickReplyApi = getQuickReplyApi();
  if (!enabled) {
    if (quickReplyApi?.removeGlobalSet) quickReplyApi.removeGlobalSet(QR_SHORTCUT_SET_NAME);
    return true;
  }
  if (!quickReplyApi?.getSetByName) {
    if (attempt < 8) {
      targetWindow.clearTimeout(quickReplySyncTimer);
      quickReplySyncTimer = targetWindow.setTimeout(() => {
        void syncQuickReplyShortcuts({ attempt: attempt + 1, notifyOnUnavailable });
      }, 500);
    } else if (notifyOnUnavailable) {
      notifyStatus('未检测到酒馆 Quick Replies，请先在扩展设置中启用它。', 'warning');
    }
    return false;
  }
  try {
    updateQuickReplyShortcutActions();
    if (!quickReplyApi.getSetByName(QR_SHORTCUT_SET_NAME)) await quickReplyApi.createSet(QR_SHORTCUT_SET_NAME);
    for (const shortcut of getQuickReplyShortcutEntries()) {
      const existing = quickReplyApi.getQrByLabel(QR_SHORTCUT_SET_NAME, shortcut.label);
      const props = {
        icon: '',
        showLabel: true,
        title: shortcut.title,
        message: shortcut.message,
        isHidden: !shortcut.enabled,
      };
      const quickReply = existing
        ? quickReplyApi.updateQuickReply(QR_SHORTCUT_SET_NAME, shortcut.label, props)
        : shortcut.enabled
          ? quickReplyApi.createQuickReply(QR_SHORTCUT_SET_NAME, shortcut.label, props)
          : null;
      if (quickReply) quickReply.onExecute = async () => await targetWindow[QR_SHORTCUT_ACTIONS_KEY]?.[shortcut.action]?.();
    }
    quickReplyApi.addGlobalSet(QR_SHORTCUT_SET_NAME, true);
    return true;
  } catch (error) {
    console.error(`[${EXTENSION_ID}] failed to sync Quick Replies`, error);
    if (notifyOnUnavailable) notifyStatus('同步 Quick Replies 失败，请确认酒馆 QR 扩展可用。', 'error');
    return false;
  }
}

function getSettingsStore() {
  const context = getContext();
  context.extensionSettings[EXTENSION_ID] ??= {};
  return context.extensionSettings[EXTENSION_ID];
}

function resetTransientGenerationState(target) {
  target.lastGenerated = '';
  target.lastGeneratedAnchorItems = [];
  target.lastGeneratedAnchorWarnings = [];
  target.lastGeneratedResultMode = 'standard';
  target.lastGeneratedAnchorTargetIndex = null;
  target.lastGeneratedStatusPlaceholderPresent = false;
  target.lastGeneratedThinking = [];
  target.lastGenerationError = null;
}

function removeTransientGenerationSettings(store) {
  let changed = false;
  for (const key of TRANSIENT_GENERATION_SETTING_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(store, key)) continue;
    delete store[key];
    changed = true;
  }
  return changed;
}

function loadSettings() {
  const storedSettings = getSettingsStore();
  const isFreshInstall = Object.keys(storedSettings).length === 0;
  const hadActiveSchemeIds = Object.prototype.hasOwnProperty.call(storedSettings, 'activeSchemeIds');
  const hadTransientGenerationState = removeTransientGenerationSettings(storedSettings);
  const shouldApplyMessageFloorPanelDefault = !Object.prototype.hasOwnProperty.call(storedSettings, 'messageFloorPanelDefaultApplied');
  const shouldApplyOutputProtocolAssistantDefault = !Object.prototype.hasOwnProperty.call(storedSettings, 'outputProtocolAssistantDefaultApplied');
  settings = Object.assign({ ...DEFAULT_SETTINGS }, storedSettings);
  resetTransientGenerationState(settings);
  // Prompt-source snapshots were only a bridge for the old import-mode generator.
  // Import mode is now isolated from prompt editing, so discard the obsolete legacy
  // setting instead of allowing it to influence a scheme load.
  delete settings.promptSourceSnapshots;
  delete storedSettings.promptSourceSnapshots;
  if (!isFreshInstall && !Object.prototype.hasOwnProperty.call(storedSettings, 'taskPlacementEnabled')) settings.taskPlacementEnabled = false;
  if (!isFreshInstall && !Object.prototype.hasOwnProperty.call(storedSettings, 'taskPlacementAfterSourceId')) settings.taskPlacementAfterSourceId = '';
  if (!isFreshInstall && !Object.prototype.hasOwnProperty.call(storedSettings, 'replaceLastUserMessageWithTask')) settings.replaceLastUserMessageWithTask = false;
  settings.ballSize = normalizeFloatingBallSize(settings.ballSize);
  settings.ballOpacity = normalizeFloatingBallOpacity(settings.ballOpacity);
  if (typeof settings.ballAnimationEnabled !== 'boolean') settings.ballAnimationEnabled = true;
  if (typeof settings.ballSnapEnabled !== 'boolean') settings.ballSnapEnabled = false;
  if (!['left', 'right', 'none'].includes(settings.ballDock)) settings.ballDock = 'none';
  if (settings.injectMode === 'rollbackAppend' || settings.injectMode === 'rollbackReplace') {
    settings.rollbackBeforeGeneration = true;
    settings.injectMode = settings.injectMode === 'rollbackAppend' ? 'append' : 'replace';
  }
  if (!['replace', 'append', 'anchor'].includes(settings.injectMode)) settings.injectMode = 'replace';
  if (typeof settings.standardOutputProtocol !== 'string') settings.standardOutputProtocol = OUTPUT_PROTOCOL_SYSTEM_PROMPT;
  if (typeof settings.anchorOutputProtocol !== 'string') settings.anchorOutputProtocol = ANCHOR_OUTPUT_PROTOCOL_SYSTEM_PROMPT;
  settings.standardOutputProtocolRole = normalizeOutputProtocolRole(settings.standardOutputProtocolRole);
  settings.anchorOutputProtocolRole = normalizeOutputProtocolRole(settings.anchorOutputProtocolRole);
  if (shouldApplyOutputProtocolAssistantDefault) {
    settings.standardOutputProtocolRole = 'assistant';
    settings.anchorOutputProtocolRole = 'assistant';
    settings.outputProtocolAssistantDefaultApplied = true;
    storedSettings.standardOutputProtocolRole = 'assistant';
    storedSettings.anchorOutputProtocolRole = 'assistant';
    storedSettings.outputProtocolAssistantDefaultApplied = true;
  }
  if (typeof settings.rollbackBeforeGeneration !== 'boolean') settings.rollbackBeforeGeneration = false;
  if (!Array.isArray(settings.lastGeneratedAnchorItems)) settings.lastGeneratedAnchorItems = [];
  if (!Array.isArray(settings.lastGeneratedAnchorWarnings)) settings.lastGeneratedAnchorWarnings = [];
  if (!['standard', 'anchor'].includes(settings.lastGeneratedResultMode)) {
    settings.lastGeneratedResultMode = settings.lastGeneratedAnchorItems.length ? 'anchor' : 'standard';
  }
  if (!Number.isInteger(settings.lastGeneratedAnchorTargetIndex)) settings.lastGeneratedAnchorTargetIndex = null;
  try {
    const localValue = targetWindow.localStorage?.getItem(PROMPT_TEMPLATE_COMPAT_STORAGE_KEY);
    if (localValue === 'true' || localValue === 'false') settings.promptTemplateCompatEnabled = localValue === 'true';
  } catch (_) {}
  if (typeof settings.autoGenerate !== 'boolean') settings.autoGenerate = settings.mode !== 'manual';
  if (typeof settings.automaticGenerationTriggerText !== 'string') settings.automaticGenerationTriggerText = '';
  if (typeof settings.promptTemplateCompatEnabled !== 'boolean') settings.promptTemplateCompatEnabled = false;
  if (typeof settings.autoInject !== 'boolean') settings.autoInject = settings.mode === 'autoInject';
  settings.apiMode = ['custom', 'tavern'].includes(settings.apiMode) ? settings.apiMode : 'custom';
  settings.useMainApi = false;
  if (typeof settings.tavernProfile !== 'string') settings.tavernProfile = '';
  if (typeof settings.mvuReprocessOnInject !== 'boolean') settings.mvuReprocessOnInject = true;
  settings.historyRangeMode = normalizeChatHistoryRangeMode(settings.historyRangeMode);
  settings.recentMessageCount = normalizeRecentMessageCount(settings.recentMessageCount);
  lastPromptLogText = textOf(settings.lastPromptLog);
  lastGeneratedThinking = [];
  settings.lastPromptLog = '';
  if (!Array.isArray(settings.components)) settings.components = [];
  if (!Array.isArray(settings.componentGroups)) settings.componentGroups = [];
  if (!Array.isArray(settings.theaterComponents)) settings.theaterComponents = [];
  if (!Array.isArray(settings.theaterGroups)) settings.theaterGroups = [];
  settings.theaterDefaultGroupEnabled = settings.theaterDefaultGroupEnabled !== false;
  const hasStoredTheaterGroupedFallbackMode = Object.prototype.hasOwnProperty.call(storedSettings, 'theaterGroupedFallbackMode');
  const hasStoredTheaterGroupedFallbackCount = Object.prototype.hasOwnProperty.call(storedSettings, 'theaterGroupedFallbackCount');
  settings.theaterRandomScope = normalizeTheaterRandomScope(settings.theaterRandomScope);
  settings.theaterRandomMode = normalizeTheaterRandomMode(settings.theaterRandomMode);
  settings.theaterRandomCount = normalizeTheaterRandomCount(settings.theaterRandomCount);
  settings.theaterGroupedFallbackMode = normalizeTheaterRandomMode(
    hasStoredTheaterGroupedFallbackMode ? settings.theaterGroupedFallbackMode : settings.theaterRandomMode,
  );
  settings.theaterGroupedFallbackCount = normalizeTheaterRandomCount(
    hasStoredTheaterGroupedFallbackCount ? settings.theaterGroupedFallbackCount : settings.theaterRandomCount,
  );
  if (!Array.isArray(settings.theaterGroupRandomOverrides)) settings.theaterGroupRandomOverrides = [];
  if (!settings.defaultGroupEnabled || typeof settings.defaultGroupEnabled !== 'object' || Array.isArray(settings.defaultGroupEnabled)) settings.defaultGroupEnabled = {};
  settings.componentGroups = settings.componentGroups
    .map((group, index) => ({ ...group, id: textOf(group?.id), name: textOf(group?.name), scope: normalizeComponentScope(group?.scope), enabled: group?.enabled !== false, order: Number.isFinite(Number(group?.order)) ? Number(group.order) : index }))
    .filter((group) => group.id && group.name);
  if (settings.componentGroupsMigrated !== true) {
    const migrated = migrateLegacyComponentGroups(settings.components, settings.componentGroups, storedSettings.componentFolderEnabled, targetWindow.crypto);
    settings.components = migrated.components;
    settings.componentGroups = migrated.componentGroups;
    settings.componentGroupsMigrated = true;
  }
  if (!Array.isArray(settings.apiModelOptions)) settings.apiModelOptions = [];
  settings.apiSchemes = normalizeSchemeList(settings.apiSchemes);
  settings.taskSchemes = normalizeSchemeList(settings.taskSchemes);
  settings.presetSchemes = normalizeSchemeList(settings.presetSchemes);
  settings.worldbookSchemes = normalizeSchemeList(settings.worldbookSchemes);
  settings.componentSchemes = normalizeSchemeList(settings.componentSchemes);
  settings.generationMode = settings.generationMode === 'multi' ? 'multi' : 'single';
  settings.multiTaskSettings = normalizeMultiTaskSettings(settings.multiTaskSettings);
  settings.chatWorldbookBindings = normalizeChatBindingIndex(settings.chatWorldbookBindings);
  if (!settings.promptSelections || typeof settings.promptSelections !== 'object') settings.promptSelections = {};
  if (!settings.importSelections || typeof settings.importSelections !== 'object') settings.importSelections = {};
  if (!settings.sourceContentOverrides || typeof settings.sourceContentOverrides !== 'object') settings.sourceContentOverrides = {};
  if (!settings.worldbookActivationOverrides || typeof settings.worldbookActivationOverrides !== 'object') settings.worldbookActivationOverrides = {};
  if (!settings.worldbookKeywordOverrides || typeof settings.worldbookKeywordOverrides !== 'object') settings.worldbookKeywordOverrides = {};
  settings.worldbookDraftSources = [...new Set((Array.isArray(settings.worldbookDraftSources) ? settings.worldbookDraftSources : [])
    .map(getWorldbookRawName)
    .filter((name) => name.trim()))];
  if (![SOURCE_MODE_PROMPT, SOURCE_MODE_IMPORT].includes(settings.sourceMode)) settings.sourceMode = SOURCE_MODE_PROMPT;
  if (!settings.sourceModes || typeof settings.sourceModes !== 'object') settings.sourceModes = {};
  for (const type of ['preset', 'worldbook']) {
    if (![SOURCE_MODE_PROMPT, SOURCE_MODE_IMPORT].includes(settings.sourceModes[type])) settings.sourceModes[type] = settings.sourceMode;
  }
  settings.streamingEnabled = Boolean(settings.streamingEnabled);
  settings.apiRetryCount = normalizeApiRetryCount(settings.apiRetryCount);
  settings.theme = normalizeThemeMode(settings.theme);
  if (settings.historyCleanupTags === undefined) settings.historyCleanupTags = String(settings.cleanupTags || '');
  if (!Array.isArray(storedSettings.historyCleanupRules)) {
    settings.historyCleanupRules = String(settings.historyCleanupTags || '').split('\n')
      .map((rule) => textOf(rule))
      .filter(Boolean)
      .map((rule) => ({ rule, keep: 0 }));
  }
  settings.historyCleanupRules = settings.historyCleanupRules
    .map((item) => ({ rule: textOf(item?.rule), keep: Math.max(0, Math.floor(Number(item?.keep) || 0)) }))
    .filter((item) => item.rule);
  if (settings.outputCleanupTags === undefined) settings.outputCleanupTags = '';
  if (!hadActiveSchemeIds || !settings.activeSchemeIds || typeof settings.activeSchemeIds !== 'object') {
    settings.activeSchemeIds = {
      api: textOf(settings.selectedApiSchemeId),
      task: textOf(settings.selectedTaskSchemeId),
      preset: textOf(settings.selectedPresetSchemeId),
      worldbook: textOf(settings.selectedWorldbookSchemeId),
      component: textOf(settings.selectedComponentSchemeId),
    };
  }
  if (!settings.dirtySchemeTypes || typeof settings.dirtySchemeTypes !== 'object') settings.dirtySchemeTypes = {};
  if (settings.worldbookInitialized !== true) {
    const hasExistingWorldbookConfiguration = settings.worldbookSchemes.length
      || settings.selectedWorldbookSchemeId
      || settings.activeSchemeIds.worldbook
      || settings.worldbookDraftSources.length
      || [settings.promptSelections, settings.importSelections, settings.sourceContentOverrides, settings.worldbookActivationOverrides, settings.worldbookKeywordOverrides]
        .some((store) => Object.keys(store).some((key) => key.includes('::worldbook::')));
    if (!hasExistingWorldbookConfiguration) {
      setSelectedSchemeId('worldbook', WORLD_BOOK_FOLLOW_TAVERN);
      setActiveSchemeId('worldbook', WORLD_BOOK_FOLLOW_TAVERN);
      settings.dirtySchemeTypes.worldbook = false;
    }
    settings.worldbookInitialized = true;
  }
  settings.taskPlacementEnabled = Boolean(settings.taskPlacementEnabled);
  settings.taskPlacementAfterSourceId = textOf(settings.taskPlacementAfterSourceId);
  settings.replaceLastUserMessageWithTask = Boolean(settings.replaceLastUserMessageWithTask);
  settings.omitOriginalUserMessages = Boolean(settings.omitOriginalUserMessages);
  settings.baiBaiBookHistoryEnabled = Boolean(settings.baiBaiBookHistoryEnabled);
  settings.baiBaiBookStateEnabled = Boolean(settings.baiBaiBookStateEnabled);
  if (!Object.prototype.hasOwnProperty.call(storedSettings, 'memorySource')) {
    settings.memorySource = settings.baiBaiBookHistoryEnabled || settings.baiBaiBookStateEnabled ? 'baibai' : 'none';
  }
  if (!['baibai', 'anima', 'none'].includes(settings.memorySource)) settings.memorySource = 'none';
  const legacyAnimaEnabled = Boolean(storedSettings.animaMemoryEnabled);
  if (!Object.prototype.hasOwnProperty.call(storedSettings, 'animaWorldbookEnabled')) settings.animaWorldbookEnabled = legacyAnimaEnabled;
  if (!Object.prototype.hasOwnProperty.call(storedSettings, 'animaStatusVariableEnabled')) settings.animaStatusVariableEnabled = legacyAnimaEnabled;
  settings.animaWorldbookEnabled = Boolean(settings.animaWorldbookEnabled);
  settings.animaStatusVariableEnabled = Boolean(settings.animaStatusVariableEnabled);
  const shouldMigrateCombinedMemorySources = settings.combinedMemorySourcesMigrated !== true;
  if (settings.combinedMemorySourcesMigrated !== true) {
    if (settings.memorySource !== 'baibai') {
      settings.baiBaiBookHistoryEnabled = false;
      settings.baiBaiBookStateEnabled = false;
    }
    if (settings.memorySource !== 'anima') {
      settings.animaWorldbookEnabled = false;
      settings.animaStatusVariableEnabled = false;
    }
    settings.combinedMemorySourcesMigrated = true;
    Object.assign(storedSettings, {
      baiBaiBookHistoryEnabled: settings.baiBaiBookHistoryEnabled,
      baiBaiBookStateEnabled: settings.baiBaiBookStateEnabled,
      animaWorldbookEnabled: settings.animaWorldbookEnabled,
      animaStatusVariableEnabled: settings.animaStatusVariableEnabled,
      combinedMemorySourcesMigrated: true,
    });
  }
  settings.animaStatusAfterMessageEnabled = Boolean(settings.animaStatusAfterMessageEnabled);
  settings.qrGenerateEnabled = Boolean(settings.qrGenerateEnabled);
  settings.qrInjectEnabled = Boolean(settings.qrInjectEnabled);
  if (!Object.prototype.hasOwnProperty.call(storedSettings, 'messageFloorPanelDefaultApplied')) {
    settings.messageFloorPanelEnabled = true;
    settings.messageFloorPanelDefaultApplied = true;
    storedSettings.messageFloorPanelEnabled = true;
    storedSettings.messageFloorPanelDefaultApplied = true;
  }
  settings.messageFloorPanelEnabled = Boolean(settings.messageFloorPanelEnabled);
  if (settings.ballPositionVersion !== 2) {
    settings.ballX = null;
    settings.ballY = null;
    settings.ballPositionVersion = 2;
  }
  settings.components = normalizeComponentIds(
    settings.components.map((item) => normalizeComponent(item, targetWindow, getContext())),
    targetWindow.crypto,
  );
  settings.theaterComponents = normalizeComponentIds(
    settings.theaterComponents.map((item) => ({ ...item, groupId: textOf(item?.groupId), enabled: item?.enabled !== false })),
    targetWindow.crypto,
  );
  const theaterGroupIds = new Set([THEATER_DEFAULT_GROUP_ID]);
  settings.theaterGroups = settings.theaterGroups
    .map((group, index) => {
      let id = textOf(group?.id);
      if (!id || theaterGroupIds.has(id)) id = createComponentId(theaterGroupIds, targetWindow.crypto);
      theaterGroupIds.add(id);
      return { ...group, id, name: textOf(group?.name), enabled: group?.enabled !== false, order: Number.isFinite(Number(group?.order)) ? Number(group.order) : index };
    })
    .filter((group) => group.name);
  const validTheaterGroupIds = new Set(settings.theaterGroups.map((group) => textOf(group.id)));
  validTheaterGroupIds.add(THEATER_DEFAULT_GROUP_ID);
  const seenTheaterRandomOverrideIds = new Set();
  settings.theaterGroupRandomOverrides = settings.theaterGroupRandomOverrides
    .map((override) => ({
      groupId: textOf(override?.groupId),
      mode: normalizeTheaterRandomMode(override?.mode),
      count: normalizeTheaterRandomCount(override?.count),
    }))
    .filter((override) => {
      if (!validTheaterGroupIds.has(override.groupId) || seenTheaterRandomOverrideIds.has(override.groupId)) return false;
      seenTheaterRandomOverrideIds.add(override.groupId);
      return true;
    });
  normalizePresetComponentBindings();
  if (
    hadTransientGenerationState
    || shouldApplyMessageFloorPanelDefault
    || shouldApplyOutputProtocolAssistantDefault
    || shouldMigrateCombinedMemorySources
  ) getContext().saveSettingsDebounced();
}

function saveSettings() {
  if (settingsSaveTimer !== null) {
    targetWindow.clearTimeout(settingsSaveTimer);
    settingsSaveTimer = null;
  }
  const componentSchemeId = textOf(settings.activeSchemeIds?.component);
  const componentScheme = componentSchemeId
    ? findScheme(settings.componentSchemes, componentSchemeId)
    : null;
  if (componentScheme) {
    const projected = applyComponentSchemeSnapshot(settings, componentScheme.snapshot || {});
    settings.dirtySchemeTypes.component = JSON.stringify(captureComponentSchemeSnapshot(settings))
      !== JSON.stringify(captureComponentSchemeSnapshot(projected));
    if (initialized) renderCurrentScheme('component');
  }
  const store = getSettingsStore();
  Object.assign(store, settings);
  removeTransientGenerationSettings(store);
  const multiTaskState = normalizeMultiTaskSettings(settings.multiTaskSettings);
  store.multiTaskSettings = {
    concurrency: multiTaskState.concurrency,
    injectionIntervalSeconds: multiTaskState.injectionIntervalSeconds,
    injectionOrder: multiTaskState.injectionOrder,
    activeTaskId: multiTaskState.activeTaskId,
    tasks: multiTaskState.tasks.map((task) => ({
      id: task.id,
      name: task.name,
      apiSchemeId: task.apiSchemeId,
      taskSchemeId: task.taskSchemeId,
      presetSchemeId: task.presetSchemeId,
      worldbookSchemeId: task.worldbookSchemeId,
      componentSchemeId: task.componentSchemeId,
      injectMode: task.injectMode,
      extraInstruction: task.extraInstruction,
      status: MULTI_TASK_STATUS.IDLE,
    })),
  };
  try {
    targetWindow.localStorage?.setItem(PROMPT_TEMPLATE_COMPAT_STORAGE_KEY, String(Boolean(settings.promptTemplateCompatEnabled)));
  } catch (_) {}
  getContext().saveSettingsDebounced();
}

function isAnimaMemoryEnabled() {
  return settings.animaWorldbookEnabled || settings.animaStatusVariableEnabled;
}

function isAnimaWorldbookEnabled() {
  return settings.animaWorldbookEnabled === true;
}

function isAnimaStatusVariableEnabled() {
  return settings.animaStatusVariableEnabled === true;
}

function stopAnimaWorldbookCapture() {
  if (animaWorldbookCaptureRun) animaWorldbookCaptureRun.active = false;
  animaWorldbookCaptureRun = null;
  animaWorldbookSnapshotPromise = null;
}

function getCurrentAnimaChatId() {
  return getAnimaChatId(getContext());
}

function clearAnimaWorldbookSnapshot() {
  animaWorldbookSnapshotPromise = null;
  animaWorldbookSnapshot = [];
  animaWorldbookSnapshotChatId = '';
  stopAnimaWorldbookCapture();
}

function captureAnimaWorldbookSnapshot() {
  if (!isAnimaWorldbookEnabled()) {
    stopAnimaWorldbookCapture();
    return Promise.resolve({ entries: [], found: false });
  }

  const currentChatId = getCurrentAnimaChatId();
  if (shouldClearAnimaSnapshotForChat(animaWorldbookSnapshotChatId, currentChatId)) {
    clearAnimaWorldbookSnapshot();
  }
  if (currentChatId) animaWorldbookSnapshotChatId = currentChatId;

  stopAnimaWorldbookCapture();
  const run = { active: true };
  animaWorldbookCaptureRun = run;
  const promise = captureAnimaWorldbookUntil({
    read: () => captureAnimaWorldbookEntries(targetWindow),
    isActive: () => run.active && isAnimaWorldbookEnabled(),
    wait: () => new Promise((resolve) => targetWindow.setTimeout(resolve, ANIMA_WORLD_BOOK_CAPTURE_RETRY_DELAY_MS)),
  }).then((result) => {
    if (animaWorldbookSnapshotPromise === promise && result?.found) {
      animaWorldbookSnapshot = mergeAnimaWorldbookSnapshots(animaWorldbookSnapshot, result.entries);
    }
    if (animaWorldbookCaptureRun === run) {
      run.active = false;
      animaWorldbookCaptureRun = null;
    }
    return result;
  }).catch(() => {
    if (animaWorldbookCaptureRun === run) animaWorldbookCaptureRun = null;
    return { entries: [], found: false };
  });
  animaWorldbookSnapshotPromise = promise;
  return promise;
}

async function getAnimaWorldbookSnapshotForPrompt() {
  if (!isAnimaMemoryEnabled()) return [];
  if (isAnimaWorldbookEnabled()) {
    if (animaWorldbookSnapshotPromise && !animaWorldbookCaptureRun?.active) {
      try {
        await animaWorldbookSnapshotPromise;
      } catch (_) {}
    }
  }
  return filterAnimaWorldbookEntries(animaWorldbookSnapshot, {
    includeWorldbook: isAnimaWorldbookEnabled(),
    includeStatus: isAnimaStatusVariableEnabled(),
  });
}

function getAnimaStatusSnapshotForPrompt(context) {
  if (!isAnimaStatusVariableEnabled()) return null;
  return readLatestAnimaStatus({ targetWindow, chat: context?.chat }) || null;
}

function getLatestAssistantMessage(chat) {
  for (let i = chat.length - 1; i >= 0; i -= 1) {
    const item = chat[i];
    if (!item?.is_user && item?.mes) return { index: i, message: item };
  }
  return null;
}

function getAssistantMessageAtIndex(chat, messageIndex) {
  const index = Number(messageIndex);
  if (!Number.isInteger(index) || index < 0) return null;
  const item = chat?.[index];
  if (!item || item.is_user === true || item.is_system === true || !String(item.mes || '').trim()) return null;
  return { index, message: item };
}

function normalizeOutputProtocolRole(value) {
  return ['system', 'user', 'assistant'].includes(value) ? value : 'system';
}

function getOutputProtocolSettingKeys(mode = outputProtocolEditorMode) {
  return mode === 'anchor'
    ? { text: 'anchorOutputProtocol', role: 'anchorOutputProtocolRole' }
    : { text: 'standardOutputProtocol', role: 'standardOutputProtocolRole' };
}

function getActiveOutputProtocolSettings(outputMode, sourceSettings = settings) {
  const keys = getOutputProtocolSettingKeys(outputMode);
  return {
    content: typeof sourceSettings[keys.text] === 'string' ? sourceSettings[keys.text] : DEFAULT_SETTINGS[keys.text],
    role: normalizeOutputProtocolRole(sourceSettings[keys.role]),
  };
}

function renderOutputProtocolEditor() {
  const keys = getOutputProtocolSettingKeys();
  const $t = targetWindow.jQuery || targetWindow.$;
  $t?.('[data-output-protocol-mode]').removeClass('active').attr('aria-pressed', 'false');
  $t?.(`[data-output-protocol-mode="${outputProtocolEditorMode}"]`).addClass('active').attr('aria-pressed', 'true');
  $t?.('#st-esg-output-protocol-role').val(normalizeOutputProtocolRole(settings[keys.role]));
  $t?.('#st-esg-output-protocol-text').val(
    typeof settings[keys.text] === 'string' ? settings[keys.text] : DEFAULT_SETTINGS[keys.text],
  );
}

function getMessageFloorPanelElement(messageIndex) {
  const index = Number(messageIndex);
  if (!Number.isInteger(index)) return null;
  return [...targetDoc.querySelectorAll('.st-esg-message-floor-panel')]
    .find((element) => Number(element.dataset.messageIndex) === index) || null;
}

function getMessageElementForFloorPanel(messageIndex) {
  const index = Number(messageIndex);
  if (!Number.isInteger(index)) return null;
  const messages = [...targetDoc.querySelectorAll('.mes')];
  const attrNames = ['mesid', 'data-mesid', 'data-message-index', 'data-mes-index'];
  const byAttribute = messages.find((element) => attrNames.some((name) => Number(element.getAttribute(name)) === index));
  return byAttribute || messages[index] || null;
}

function removeMessageFloorPanels() {
  messageFloorPanelResizeObserver?.disconnect();
  messageFloorPanelResizeObserver = null;
  targetDoc.querySelectorAll('.st-esg-message-floor-panel').forEach((element) => element.remove());
}

function getHorizontalContentBounds(element) {
  if (!element) return null;
  const rect = element.getBoundingClientRect?.();
  if (!rect) return null;
  const styles = targetWindow.getComputedStyle?.(element);
  const borderLeft = Number.parseFloat(styles?.borderLeftWidth) || 0;
  const borderRight = Number.parseFloat(styles?.borderRightWidth) || 0;
  const paddingLeft = Number.parseFloat(styles?.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(styles?.paddingRight) || 0;
  return {
    left: rect.left + borderLeft + paddingLeft,
    right: rect.right - borderRight - paddingRight,
  };
}

function syncMessageFloorPanelWidth(panel, messageText) {
  if (!panel || !messageText) return;
  const parent = panel.parentElement;
  if (!parent) return;
  const targetRect = messageText.getBoundingClientRect?.();
  const parentRect = parent.getBoundingClientRect?.();
  if (!targetRect || !parentRect) return;
  const messageHost = messageText.closest?.('.mes');
  const targetBounds = getHorizontalContentBounds(messageText) || { left: targetRect.left, right: targetRect.right };
  const parentBounds = getHorizontalContentBounds(parent) || targetBounds;
  const messageBounds = getHorizontalContentBounds(messageHost) || targetBounds;
  const boundedLeft = Math.max(targetBounds.left, parentBounds.left, messageBounds.left);
  const boundedRight = Math.min(targetBounds.right, parentBounds.right, messageBounds.right);
  const inlineOffset = Math.max(0, Math.round(boundedLeft - parentBounds.left));
  const width = Math.max(0, Math.floor(boundedRight - boundedLeft));
  panel.style.setProperty('box-sizing', 'border-box', 'important');
  panel.style.setProperty('margin-left', `${inlineOffset}px`, 'important');
  panel.style.setProperty('margin-right', '0', 'important');
  if (width > 0) {
    panel.style.setProperty('width', `${width}px`, 'important');
    panel.style.setProperty('max-width', `${width}px`, 'important');
  }
}

function resizeMessageFloorTextarea(textarea) {
  if (!textarea) return;
  const styles = targetWindow.getComputedStyle?.(textarea);
  const minHeight = Math.max(0, Number.parseFloat(styles?.minHeight) || 0);
  const parsedMaxHeight = Number.parseFloat(styles?.maxHeight);
  const maxHeight = Number.isFinite(parsedMaxHeight) && parsedMaxHeight > 0 ? parsedMaxHeight : Number.POSITIVE_INFINITY;
  textarea.style.height = 'auto';
  const contentHeight = Math.max(minHeight, Number(textarea.scrollHeight || 0));
  const nextHeight = Math.min(contentHeight, maxHeight);
  if (Number.isFinite(nextHeight) && nextHeight > 0) textarea.style.height = `${Math.ceil(nextHeight)}px`;
  textarea.style.setProperty(
    'overflow-y',
    contentHeight > maxHeight + 1 ? 'auto' : 'hidden',
    'important',
  );
}

function resizeMessageFloorAnchorTextarea(textarea) {
  if (!textarea) return;
  const styles = targetWindow.getComputedStyle?.(textarea);
  const minHeight = Number.parseFloat(styles?.minHeight) || 31;
  const maxHeight = Number.parseFloat(styles?.maxHeight) || 72;
  textarea.style.setProperty('height', 'auto', 'important');
  const contentHeight = Math.max(minHeight, Number(textarea.scrollHeight || 0));
  const nextHeight = Math.min(contentHeight, maxHeight);
  textarea.style.setProperty('height', `${Math.ceil(nextHeight)}px`, 'important');
  textarea.style.setProperty('overflow-y', contentHeight > maxHeight + 1 ? 'auto' : 'hidden', 'important');
}

function getCurrentFloorPanelTarget() {
  const context = getContext();
  const latest = getLatestAssistantMessage(context.chat);
  if (!latest) return null;
  return createFloorPanelTarget({
    chatId: getCurrentChatIdSafe(context),
    messageIndex: latest.index,
    messageText: latest.message.mes,
  });
}

function isSameFloorPanelTarget(left, right) {
  return isFloorPanelTargetAddressable(left, right);
}

function scheduleMessageFloorPanelRefresh() {
  if (!settings.messageFloorPanelEnabled) return;
  if (messageFloorPanelRefreshTimer !== null) targetWindow.clearTimeout(messageFloorPanelRefreshTimer);
  messageFloorPanelRefreshTimer = targetWindow.setTimeout(() => {
    messageFloorPanelRefreshTimer = null;
    refreshMessageFloorPanelTarget();
  }, 80);
}

function buildMessageFloorAnchorMarkup(items) {
  const { target, matches, skipped } = resolveAnchorPlanForDisplay(items);
  return (Array.isArray(items) ? items : []).map((item, index) => {
    if (!item || !item.content) return '';
    const enabled = isAnchorInsertionEnabled(item);
    const matchState = describeAnchorMatch(item, matches.get(index), skipped.get(index), Boolean(target));
    const position = item.position === 'start' ? '文首' : item.position === 'end' ? '文末' : item.position === 'before' ? '锚点前' : '锚点后';
    const readonly = canEditFloorPanelResult(messageFloorPanelState) ? '' : ' readonly';
    const disabledClass = enabled ? '' : ' st-esg-floor-anchor-disabled';
    return `<details class="st-esg-floor-anchor-item${disabledClass}" data-floor-anchor-index="${index}" data-floor-anchor-position="${escapeHtml(item.position || 'after')}"${enabled ? '' : ' data-injection-disabled="true"'} open>
      <summary><span>#${index + 1} · ${escapeHtml(position)}</span><span class="st-esg-floor-anchor-summary-controls"><span data-floor-anchor-match class="st-esg-floor-anchor-match st-esg-floor-anchor-match-${escapeHtml(matchState.className)}">${escapeHtml(matchState.label)}</span><button type="button" class="st-esg-floor-anchor-toggle" data-floor-anchor-toggle aria-label="${enabled ? '标记为不注入' : '恢复注入'}" title="${enabled ? '标记为不注入' : '恢复注入'}"><i class="fa-solid ${enabled ? 'fa-link' : 'fa-link-slash'}" aria-hidden="true"></i></button></span></summary>
      <div class="st-esg-floor-anchor-fields">
        ${item.position === 'before' || item.position === 'after' ? `<label>锚点<textarea class="text_pole" data-floor-anchor-field="anchor" rows="1"${readonly}>${escapeHtml(item.anchor || '')}</textarea></label>` : ''}
        <label>插入内容<textarea class="text_pole" data-floor-anchor-field="content" rows="3"${readonly}>${escapeHtml(item.content || '')}</textarea></label>
      </div>
    </details>`;
  }).join('');
}

function renderFloorActionIcon(action) {
  let glyph = '';
  if (action === 'generate') {
    glyph = '<path d="m4 20 10.5-10.5"></path><path d="m12.5 5.5 6 6"></path><path d="M18 2v3M22 6h-3M6 2v2M8 4H4"></path>';
  } else if (action === 'stop') {
    glyph = '<rect x="7" y="7" width="10" height="10" rx="1"></rect>';
  } else if (action === 'inject') {
    glyph = '<path d="M12 3v12M7 10l5 5 5-5M5 20h14"></path>';
  } else if (action === 'undo') {
    glyph = '<path d="m9 7-5 5 5 5M5 12h8a6 6 0 0 1 6 6"></path>';
  } else {
    glyph = '<path d="M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7"></path>';
  }
  return `<svg class="st-esg-floor-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${glyph}</svg>`;
}

function buildMessageFloorPanelMarkup() {
  const state = messageFloorPanelState;
  const statusStage = getFloorPanelStatusStage(state.status);
  const compactActions = getFloorPanelActionModels(state.status);
  const canEdit = canEditFloorPanelResult(state);
  const output = state.output || '';
  const anchorMode = state.resultMode === 'anchor';
  const errorHtml = state.error
    ? `<div class="st-esg-floor-error"><strong>生成失败</strong><span>${escapeHtml(state.error)}</span></div>`
    : '';
  const thinkingHtml = state.thinking
    ? `<details class="st-esg-floor-thinking"><summary><span><i class="fa-solid fa-brain" aria-hidden="true"></i> 思考过程</span><em>不会注入</em></summary><pre>${escapeHtml(state.thinking)}</pre></details>`
    : '';
  const multiTaskHtml = state.mode === 'multi'
    ? `<div class="st-esg-floor-multi-task">${renderMultiTaskWorkspace(state.multiTaskSettings || settings.multiTaskSettings)}</div>`
    : '';
  const resultHtml = anchorMode
    ? `<div class="st-esg-floor-anchor-list">${buildMessageFloorAnchorMarkup(state.anchorItems)}</div>`
    : `<textarea class="text_pole st-esg-floor-output" data-floor-output rows="3"${canEdit ? '' : ' readonly'} placeholder="生成后的组件会显示在这里。">${escapeHtml(output)}</textarea>`;
  const compactActionHtml = compactActions.map((action) => {
    const label = state.mode === 'multi'
      ? ({ generate: '生成全部', retry: '重试全部', stop: '停止全部', inject: '注入全部', undo: '撤回全部' }[action.action] || action.label)
      : action.label;
    return `<button type="button" class="st-esg-floor-compact-action${action.action === 'inject' ? ' st-esg-floor-compact-action-primary' : ''}" data-floor-action="${action.action}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${renderFloorActionIcon(action.action)}</button>`;
  }).join('');
  const stagePattern = [statusStage.lead, statusStage.tail].filter(Boolean).join(' ');
  const stagePatternRun = Array.from({ length: 10 }, () => stagePattern).join('  ');
  return `<div class="st-esg-floor-compact" data-floor-compact-toggle role="group" tabindex="0" aria-expanded="${state.expanded}" aria-label="织幕楼层面板">
    <span class="st-esg-floor-brand">${renderBrandMark('floor')}</span>
    <span class="st-esg-floor-stage" data-floor-stage data-floor-stage-motion="${escapeHtml(statusStage.motion)}" role="status" aria-label="${escapeHtml(statusStage.label)}">
      <span class="st-esg-floor-stage-track st-esg-floor-stage-track-left" data-floor-stage-pattern="${escapeHtml(stagePattern)}" aria-hidden="true"><span class="st-esg-floor-stage-lead">${escapeHtml(stagePatternRun)}</span></span>
      <span class="st-esg-floor-stage-shuttle" aria-hidden="true">${escapeHtml(statusStage.shuttle)}</span>
      <span class="st-esg-floor-stage-core" aria-hidden="true"><span class="st-esg-floor-stage-text">${escapeHtml(statusStage.text)}</span><span class="st-esg-floor-stage-face">${escapeHtml(statusStage.face)}</span></span>
      <span class="st-esg-floor-stage-track st-esg-floor-stage-track-right" data-floor-stage-pattern="${escapeHtml(stagePattern)}" aria-hidden="true"><span class="st-esg-floor-stage-tail">${escapeHtml(stagePatternRun)}</span></span>
    </span>
    <span class="st-esg-floor-action-group" data-floor-action-group>${compactActionHtml}</span>
  </div>
  <div class="st-esg-floor-expanded"${state.expanded ? '' : ' hidden'}>
    ${multiTaskHtml}
    ${thinkingHtml}
    ${errorHtml}
    ${state.status === FLOOR_PANEL_STATUS.ERROR ? '' : resultHtml}
    <button type="button" class="st-esg-floor-collapse" data-floor-collapse aria-label="收起楼层面板" title="收起"><i class="fa-solid fa-chevron-up" aria-hidden="true"></i></button>
  </div>`;
}

function placeMessageFloorPanelAfterText(panel, messageText) {
  if (!panel || !messageText || panel.previousElementSibling === messageText) return;
  messageText.insertAdjacentElement('afterend', panel);
}

function renderMessageFloorPanel({ force = false } = {}) {
  if (!settings.messageFloorPanelEnabled || !messageFloorPanelState.target) return;
  const host = getMessageElementForFloorPanel(messageFloorPanelState.target.messageIndex);
  if (!host) {
    scheduleMessageFloorPanelRefresh();
    return;
  }
  const messageText = host.querySelector('.mes_text, .mes_text_inner') || host;
  let panel = getMessageFloorPanelElement(messageFloorPanelState.target.messageIndex);
  const thinkingWasOpen = Boolean(panel?.querySelector('.st-esg-floor-thinking')?.open);
  if (!panel) {
    removeMessageFloorPanels();
    panel = targetDoc.createElement('section');
    panel.className = 'st-esg-message-floor-panel';
    panel.dataset.messageIndex = String(messageFloorPanelState.target.messageIndex);
    if (typeof targetWindow.ResizeObserver === 'function') {
      messageFloorPanelResizeObserver?.disconnect();
      messageFloorPanelResizeObserver = new targetWindow.ResizeObserver(() => syncMessageFloorPanelWidth(panel, messageText));
      messageFloorPanelResizeObserver.observe(messageText);
    }
    force = true;
  }
  placeMessageFloorPanelAfterText(panel, messageText);
  syncMessageFloorPanelWidth(panel, messageText);
  applyThemeClass(panel, settings.theme);
  if (force || !panel.dataset.rendered) {
    panel.innerHTML = buildMessageFloorPanelMarkup();
    panel.dataset.rendered = 'true';
  }
  if (thinkingWasOpen) {
    const thinking = panel.querySelector('.st-esg-floor-thinking');
    if (thinking) thinking.open = true;
  }
  bindMessageFloorPanel(panel);
  panel.dataset.status = messageFloorPanelState.status;
  panel.dataset.expanded = String(messageFloorPanelState.expanded);
  panel.querySelector('[data-floor-compact-toggle]')?.setAttribute('aria-expanded', String(messageFloorPanelState.expanded));
  panel.querySelector('.st-esg-floor-expanded')?.toggleAttribute('hidden', !messageFloorPanelState.expanded);
  panel.querySelectorAll('[data-floor-output]').forEach(resizeMessageFloorTextarea);
  panel.querySelectorAll('[data-floor-anchor-field="anchor"]').forEach(resizeMessageFloorAnchorTextarea);
  const output = panel.querySelector('[data-floor-output]');
  if (output && messageFloorPanelState.expanded && messageFloorPanelFollowBottom) {
    const scrollToBottom = () => { output.scrollTop = output.scrollHeight; };
    if (typeof targetWindow.requestAnimationFrame === 'function') targetWindow.requestAnimationFrame(scrollToBottom);
    else scrollToBottom();
  }
}

function setMessageFloorPanelExpanded(expanded) {
  messageFloorPanelState.expanded = Boolean(expanded);
  if (messageFloorPanelState.expanded) messageFloorPanelFollowBottom = true;
  renderMessageFloorPanel();
}

function syncMessageFloorPanelResult({ status = FLOOR_PANEL_STATUS.READY } = {}) {
  if (!settings.messageFloorPanelEnabled || !messageFloorPanelState.target) return;
  const currentTarget = status === FLOOR_PANEL_STATUS.INJECTED ? getCurrentFloorPanelTarget() : null;
  messageFloorPanelState = {
    ...messageFloorPanelState,
    status,
    resultMode: settings.lastGeneratedResultMode === 'anchor' ? 'anchor' : 'standard',
    thinking: Array.isArray(lastGeneratedThinking) ? lastGeneratedThinking.join('\n\n') : '',
    output: String(settings.lastGenerated || ''),
    anchorItems: Array.isArray(settings.lastGeneratedAnchorItems) ? settings.lastGeneratedAnchorItems.map((item) => ({ ...item })) : [],
    error: null,
    streaming: false,
    injected: status === FLOOR_PANEL_STATUS.INJECTED,
    target: currentTarget?.messageIndex === messageFloorPanelState.target.messageIndex ? currentTarget : messageFloorPanelState.target,
  };
  renderMessageFloorPanel({ force: true });
}

function syncMessageFloorPanelFromMultiTasks({ force = true } = {}) {
  if (!settings.messageFloorPanelEnabled || settings.generationMode !== 'multi') return;
  const target = getCurrentFloorPanelTarget();
  if (!target) return;
  const scopedSettings = scopeMultiTaskFloorPanelSettings(normalizeMultiTaskSettings(settings.multiTaskSettings), target);
  const view = createMultiTaskFloorPanelView(scopedSettings);
  messageFloorPanelState = {
    ...messageFloorPanelState,
    ...view,
    enabled: true,
    target,
    multiTaskSettings: scopedSettings,
  };
  renderMessageFloorPanel({ force });
}

function syncMessageFloorPanelTaskSelection() {
  if (!settings.messageFloorPanelEnabled || settings.generationMode !== 'multi') return;
  syncMessageFloorPanelFromMultiTasks({ force: false });
  const panel = getMessageFloorPanelElement(messageFloorPanelState.target?.messageIndex);
  if (!panel) return;
  const taskHost = panel.querySelector('.st-esg-floor-multi-task');
  if (taskHost) taskHost.innerHTML = renderMultiTaskWorkspace(messageFloorPanelState.multiTaskSettings || settings.multiTaskSettings);
  const hasThinking = Boolean(messageFloorPanelState.thinking);
  const thinkingStructureMatches = Boolean(panel.querySelector('.st-esg-floor-thinking')) === hasThinking;
  const output = panel.querySelector('[data-floor-output]');
  if (messageFloorPanelState.error || messageFloorPanelState.resultMode === 'anchor' || !thinkingStructureMatches || !output) {
    renderMessageFloorPanel({ force: true });
    return;
  }
  output.readOnly = !canEditFloorPanelResult(messageFloorPanelState);
  refreshMessageFloorPanelStreamContent();
}

function refreshMessageFloorPanelStreamContent() {
  const existingPanel = getMessageFloorPanelElement(messageFloorPanelState.target?.messageIndex);
  const needsThinkingStructure = messageFloorPanelState.expanded && Boolean(messageFloorPanelState.thinking) && !existingPanel?.querySelector('.st-esg-floor-thinking');
  renderMessageFloorPanel({ force: needsThinkingStructure });
  const panel = getMessageFloorPanelElement(messageFloorPanelState.target?.messageIndex);
  if (!panel || !messageFloorPanelState.expanded) return;
  const thinking = panel.querySelector('.st-esg-floor-thinking pre');
  if (thinking) thinking.textContent = messageFloorPanelState.thinking;
  const output = panel.querySelector('[data-floor-output]');
  if (output && output.value !== messageFloorPanelState.output) {
    const previousScrollTop = output.scrollTop;
    const followBottom = messageFloorPanelFollowBottom;
    output.value = messageFloorPanelState.output;
    resizeMessageFloorTextarea(output);
    const restoreScroll = () => {
      if (followBottom) output.scrollTop = output.scrollHeight;
      else output.scrollTop = previousScrollTop;
    };
    if (typeof targetWindow.requestAnimationFrame === 'function') targetWindow.requestAnimationFrame(restoreScroll);
    else restoreScroll();
  }
}

function refreshMessageFloorPanelAnchorItem(index) {
  const panel = getMessageFloorPanelElement(messageFloorPanelState.target?.messageIndex);
  const item = messageFloorPanelState.anchorItems?.[index];
  const card = panel?.querySelector(`[data-floor-anchor-index="${index}"]`);
  if (!item || !card) return;
  for (const fieldName of ['anchor', 'content']) {
    const field = card.querySelector(`[data-floor-anchor-field="${fieldName}"]`);
    if (!field) continue;
    const value = String(item[fieldName] || '');
    if (field.value !== value) field.value = value;
    if (fieldName === 'anchor') resizeMessageFloorAnchorTextarea(field);
  }
  const { target, matches, skipped } = resolveAnchorPlanForDisplay(messageFloorPanelState.anchorItems);
  const matchState = describeAnchorMatch(item, matches.get(index), skipped.get(index), Boolean(target));
  const matchLabel = card.querySelector('[data-floor-anchor-match]');
  if (matchLabel) {
    matchLabel.className = `st-esg-floor-anchor-match st-esg-floor-anchor-match-${matchState.className}`;
    matchLabel.textContent = matchState.label;
  }
}

function updateMessageFloorPanelStream(streamed) {
  if (!settings.messageFloorPanelEnabled || messageFloorPanelState.status !== FLOOR_PANEL_STATUS.GENERATING) return;
  const value = normalizeStreamOutputPreview(streamed);
  messageFloorPanelState.thinking = String(value.thinking || '');
  messageFloorPanelState.output = String(value.text || '');
  refreshMessageFloorPanelStreamContent();
}

function updateMessageFloorPanelMultiTaskStream(taskId) {
  if (!settings.messageFloorPanelEnabled || settings.generationMode !== 'multi') return;
  const scopedSettings = scopeMultiTaskFloorPanelSettings(
    normalizeMultiTaskSettings(settings.multiTaskSettings),
    messageFloorPanelState.target,
  );
  const view = createMultiTaskFloorPanelView(scopedSettings);
  if (view.activeTaskId !== taskId) return;
  messageFloorPanelState = { ...messageFloorPanelState, ...view, multiTaskSettings: scopedSettings };
  refreshMessageFloorPanelStreamContent();
}

function setMessageFloorPanelError(error) {
  if (!settings.messageFloorPanelEnabled || !messageFloorPanelState.target) return;
  messageFloorPanelState = {
    ...messageFloorPanelState,
    status: FLOOR_PANEL_STATUS.ERROR,
    error: String(error?.message || error || '未知错误'),
    streaming: false,
  };
  renderMessageFloorPanel({ force: true });
}

function prepareMessageFloorPanelGeneration(latest) {
  if (!settings.messageFloorPanelEnabled || !latest) return null;
  const target = createFloorPanelTarget({
    chatId: getCurrentChatIdSafe(getContext()),
    messageIndex: latest.index,
    messageText: latest.message.mes,
  });
  messageFloorPanelState = nextFloorPanelGeneration(messageFloorPanelState, target);
  messageFloorPanelFollowBottom = true;
  messageFloorPanelState.enabled = true;
  renderMessageFloorPanel({ force: true });
  return { generation: messageFloorPanelState.generation, target };
}

function isCurrentMessageFloorPanelGeneration(generation, target) {
  return settings.messageFloorPanelEnabled
    && isFloorPanelGenerationCurrent(messageFloorPanelState, generation, target);
}

function refreshMessageFloorPanelTarget() {
  if (messageFloorPanelSuppressRefresh) return;
  if (!settings.messageFloorPanelEnabled) {
    removeMessageFloorPanels();
    messageFloorPanelState = createFloorPanelState();
    return;
  }
  const target = getCurrentFloorPanelTarget();
  if (!target) {
    removeMessageFloorPanels();
    messageFloorPanelState = createFloorPanelState({ enabled: true });
    return;
  }
  if (!isSameFloorPanelTarget(messageFloorPanelState.target, target)) {
    if (messageFloorPanelState.status === FLOOR_PANEL_STATUS.GENERATING) generationAbortController?.abort();
    const previousGeneration = Number(messageFloorPanelState.generation || 0);
    messageFloorPanelState = { ...createFloorPanelState({ enabled: true }), target, generation: previousGeneration + 1 };
    removeMessageFloorPanels();
  }
  if (settings.generationMode === 'multi') {
    syncMessageFloorPanelFromMultiTasks({ force: !getMessageFloorPanelElement(target.messageIndex) });
  } else {
    renderMessageFloorPanel({ force: !getMessageFloorPanelElement(target.messageIndex) });
  }
}

function getMessageFloorPanelActionTarget() {
  const context = getContext();
  const target = messageFloorPanelState.target;
  if (!target) return null;
  const latest = getAssistantMessageAtIndex(context.chat, target.messageIndex);
  const currentTarget = latest ? createFloorPanelTarget({
    chatId: getCurrentChatIdSafe(context),
    messageIndex: latest.index,
    messageText: latest.message.mes,
  }) : null;
  if (!latest || !isFloorPanelTargetAddressable(target, currentTarget)) {
    setMessageFloorPanelError('目标楼层已变化，请重新生成');
    return null;
  }
  messageFloorPanelState.target = currentTarget;
  return latest;
}

async function runMessageFloorPanelAction(action) {
  if (messageFloorPanelState.mode === 'multi') {
    const latest = getMessageFloorPanelActionTarget();
    if (!latest) return;
    const allTasks = normalizeMultiTaskSettings(settings.multiTaskSettings).tasks;
    const allTaskIds = allTasks.map((task) => task.id);
    const scoped = scopeMultiTaskFloorPanelSettings({ ...settings.multiTaskSettings, tasks: allTasks }, messageFloorPanelState.target);
    const floorInjectTaskIds = scoped.tasks
      .filter((task) => [MULTI_TASK_STATUS.READY, MULTI_TASK_STATUS.UNDONE].includes(task.status))
      .filter((task) => String(task.output || '').trim() || task.anchorItems?.length)
      .map((task) => task.id);
    const floorUndoTaskIds = scoped.tasks.filter((task) => task.injectionRecord).map((task) => task.id);
    if (action === 'stop') {
      const runningTaskIds = scoped.tasks
        .filter((task) => [MULTI_TASK_STATUS.QUEUED, MULTI_TASK_STATUS.GENERATING].includes(task.status))
        .map((task) => task.id);
      cancelMultiTaskGeneration(runningTaskIds);
      return;
    }
    if (action === 'generate') await generateMultiTasks(allTaskIds);
    else if (action === 'retry') {
      const failedTaskIds = scoped.tasks
        .filter((task) => task.status === MULTI_TASK_STATUS.ERROR)
        .map((task) => task.id);
      await generateMultiTasks(failedTaskIds);
    } else if (action === 'inject') await injectMultiTasks(floorInjectTaskIds);
    else if (action === 'undo') await undoMultiTaskInjections(floorUndoTaskIds, { requireConfirmation: true });
    return;
  }
  if (action === 'stop') {
    generationAbortController?.abort();
    return;
  }
  const latest = getMessageFloorPanelActionTarget();
  if (!latest) return;
  if (action === 'generate' || action === 'retry') {
    await generateStatusbar('floor', latest.index);
  } else if (action === 'inject') {
    await injectGeneratedStatusbar(latest.index);
  } else if (action === 'undo') {
    const undone = await restoreLatestInjection({ targetMessageIndex: latest.index });
    if (undone) syncMessageFloorPanelResult({ status: FLOOR_PANEL_STATUS.READY });
  }
}

function bindMessageFloorPanel(panel) {
  if (panel.dataset.bound === 'true') return;
  panel.dataset.bound = 'true';
  panel.addEventListener('click', (event) => {
    const collapse = event.target.closest('[data-floor-collapse]');
    if (collapse) {
      event.preventDefault();
      setMessageFloorPanelExpanded(false);
      return;
    }
    const multiTaskAction = event.target.closest('[data-multi-task-action]');
    if (multiTaskAction && messageFloorPanelState.mode === 'multi') {
      event.preventDefault();
      event.stopPropagation();
      const taskId = multiTaskAction.closest('[data-active-multi-task-id]')?.getAttribute('data-active-multi-task-id') || '';
      void handleMultiTaskAction(String(multiTaskAction.getAttribute('data-multi-task-action') || ''), false, taskId);
      return;
    }
    const multiTaskTab = event.target.closest('[data-multi-task-id]');
    if (multiTaskTab && messageFloorPanelState.mode === 'multi') {
      event.preventDefault();
      event.stopPropagation();
      selectActiveMultiTaskView(String(multiTaskTab.getAttribute('data-multi-task-id') || ''));
      return;
    }
    const actionButton = event.target.closest('[data-floor-action]');
    if (actionButton) {
      event.preventDefault();
      event.stopPropagation();
      actionButton.blur?.();
      void runMessageFloorPanelAction(String(actionButton.dataset.floorAction || ''));
      return;
    }
    if (event.target.closest('[data-floor-compact-toggle]')) {
      setMessageFloorPanelExpanded(!messageFloorPanelState.expanded);
    }
  });
  panel.addEventListener('scroll', (event) => {
    const output = event.target.closest?.('[data-floor-output]');
    if (output) messageFloorPanelFollowBottom = isPreviewNearBottom(output);
  }, true);
  panel.addEventListener('keydown', (event) => {
    const compact = event.target.closest?.('[data-floor-compact-toggle]');
    if (!compact || event.target !== compact || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    setMessageFloorPanelExpanded(!messageFloorPanelState.expanded);
  });
  panel.addEventListener('input', (event) => {
    if (!canEditFloorPanelResult(messageFloorPanelState)) return;
    const output = event.target.closest('[data-floor-output]');
    if (output) {
      if (messageFloorPanelState.mode === 'multi') {
        const value = String(output.value || '');
        replaceMultiTask(messageFloorPanelState.activeTaskId, {
          output: value,
          resultMode: 'standard',
          anchorItems: [],
          warnings: [],
        });
        messageFloorPanelState.output = value;
        messageFloorPanelState.resultMode = 'standard';
        messageFloorPanelState.anchorItems = [];
        settings.lastGenerated = value;
        settings.lastGeneratedResultMode = 'standard';
        settings.lastGeneratedAnchorItems = [];
        settings.lastGeneratedAnchorWarnings = [];
        $t('#st-esg-preview').val(value);
        renderAnchorInsertionPlan([], []);
        resizeMessageFloorTextarea(output);
        return;
      }
      settings.lastGeneratedResultMode = 'standard';
      settings.lastGenerated = String(output.value || '');
      settings.lastGeneratedAnchorItems = [];
      settings.lastGeneratedAnchorWarnings = [];
      messageFloorPanelState.output = settings.lastGenerated;
      $t('#st-esg-preview').val(settings.lastGenerated);
      renderAnchorInsertionPlan([], []);
      resizeMessageFloorTextarea(output);
      return;
    }
    const field = event.target.closest('[data-floor-anchor-field]');
    if (!field) return;
    const card = field.closest('[data-floor-anchor-index]');
    const index = Number(card?.dataset.floorAnchorIndex);
    const activeMultiTask = messageFloorPanelState.mode === 'multi' ? getActiveMultiTask() : null;
    const sourceAnchorItems = activeMultiTask?.anchorItems || settings.lastGeneratedAnchorItems;
    const item = sourceAnchorItems?.[index];
    const fieldName = String(field.dataset.floorAnchorField || '');
    if (!item || !['anchor', 'content'].includes(fieldName)) return;
    item[fieldName] = String(field.value || '');
    if (activeMultiTask) {
      replaceMultiTask(activeMultiTask.id, { anchorItems: sourceAnchorItems });
      settings.lastGeneratedAnchorItems = sourceAnchorItems.map((entry) => ({ ...entry }));
    }
    if (fieldName === 'anchor') resizeMessageFloorAnchorTextarea(field);
    messageFloorPanelState.anchorItems = sourceAnchorItems.map((entry) => ({ ...entry }));
    const { target, matches, skipped } = resolveAnchorPlanForDisplay(sourceAnchorItems);
    const matchState = describeAnchorMatch(item, matches.get(index), skipped.get(index), Boolean(target));
    const matchLabel = card.querySelector('[data-floor-anchor-match]');
    if (matchLabel) {
      matchLabel.className = `st-esg-floor-anchor-match st-esg-floor-anchor-match-${matchState.className}`;
      matchLabel.textContent = matchState.label;
    }
    updateAnchorPlanStatusUi();
    scheduleAnchorEditPersistence();
  });
  panel.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-floor-anchor-toggle]');
    if (!toggle || !canEditFloorPanelResult(messageFloorPanelState)) return;
    event.preventDefault();
    event.stopPropagation();
    const card = toggle.closest('[data-floor-anchor-index]');
    const index = Number(card?.dataset.floorAnchorIndex);
    const activeMultiTask = messageFloorPanelState.mode === 'multi' ? getActiveMultiTask() : null;
    const sourceAnchorItems = activeMultiTask?.anchorItems || settings.lastGeneratedAnchorItems;
    const item = sourceAnchorItems?.[index];
    if (!item) return;
    item.injectionEnabled = !isAnchorInsertionEnabled(item);
    if (activeMultiTask) {
      replaceMultiTask(activeMultiTask.id, { anchorItems: sourceAnchorItems });
      settings.lastGeneratedAnchorItems = sourceAnchorItems.map((entry) => ({ ...entry }));
    }
    messageFloorPanelState.anchorItems = sourceAnchorItems.map((entry) => ({ ...entry }));
    updateAnchorPlanStatusUi();
    scheduleAnchorEditPersistence();
    renderMessageFloorPanel({ force: true });
  });
}

function getEnabledComponents(sourceSettings = settings) {
  const componentOptions = {
    presetSchemeId: sourceSettings.presetSchemeId || getActiveSchemeId('preset'),
    componentGroups: sourceSettings.componentGroups,
    defaultGroupEnabled: sourceSettings.defaultGroupEnabled,
  };
  if (sourceSettings.presetRuntimeMode === 'tavern') delete componentOptions.presetSchemeId;
  return getActiveComponentsForContext(sourceSettings.components, targetWindow, getContext(), componentOptions);
}

function getEnabledTheaterComponents(sourceSettings = settings) {
  return selectTheaterComponents(sourceSettings.theaterComponents, {
    scope: sourceSettings.theaterRandomScope,
    mode: sourceSettings.theaterRandomMode,
    count: sourceSettings.theaterRandomCount,
    groupedFallbackMode: sourceSettings.theaterGroupedFallbackMode,
    groupedFallbackCount: sourceSettings.theaterGroupedFallbackCount,
    groupOverrides: sourceSettings.theaterGroupRandomOverrides,
    groups: sourceSettings.theaterGroups,
    defaultGroupEnabled: sourceSettings.theaterDefaultGroupEnabled,
  });
}

function createNewComponentId() {
  return createComponentId(new Set(settings.components.map((component) => textOf(component?.id)).filter(Boolean)), targetWindow.crypto);
}

function createNewComponentGroupId() {
  return createComponentId(new Set(settings.componentGroups.map((group) => textOf(group?.id)).filter(Boolean)), targetWindow.crypto);
}

function createNewTheaterId() {
  return createComponentId(new Set(settings.theaterComponents.map((item) => textOf(item?.id)).filter(Boolean)), targetWindow.crypto);
}

function createNewTheaterGroupId() {
  return createComponentId(new Set(settings.theaterGroups.map((group) => textOf(group?.id)).filter(Boolean)), targetWindow.crypto);
}

function createTrackedLibraryIdFactory(items) {
  const usedIds = new Set((Array.isArray(items) ? items : []).map((item) => textOf(item?.id)).filter(Boolean));
  return () => {
    const id = createComponentId(usedIds, targetWindow.crypto);
    usedIds.add(id);
    return id;
  };
}

function findComponentById(id) {
  const componentId = textOf(id);
  if (!componentId) return null;
  return settings.components.find((component) => textOf(component?.id) === componentId) || null;
}

function getPresetSchemeById(id) {
  return findScheme(settings.presetSchemes, id);
}

function normalizePresetComponentBindings() {
  const schemes = getSchemeList('preset');
  settings.components = settings.components.map((component) => {
    if (component.scope !== COMPONENT_SCOPE_PRESET) return component;
    if (textOf(component.presetSchemeId) && schemes.some((scheme) => scheme.id === component.presetSchemeId)) {
      const scheme = getPresetSchemeById(component.presetSchemeId);
      return { ...component, bindName: scheme?.name || component.bindName };
    }
    const matches = schemes.filter((scheme) => textOf(scheme.snapshot?.activeSourcePreset) === textOf(component.bindName));
    if (matches.length !== 1) return { ...component, presetSchemeId: '' };
    return { ...component, presetSchemeId: matches[0].id, bindName: matches[0].name };
  });
}

function getPresetBindingOptions(selectedId = '') {
  return `<option value="">选择预设方案</option>${getSchemeList('preset').map((scheme) => `<option value="${escapeHtml(scheme.id)}" ${scheme.id === selectedId ? 'selected' : ''}>${escapeHtml(scheme.name)}</option>`).join('')}`;
}

function renderPresetBindingControls() {
  const selectors = [
    { scope: '#st-esg-import-target-scope', binding: '#st-esg-import-preset-scheme', label: '绑定预设方案' },
    { scope: '#st-esg-worldbook-import-target-scope', binding: '#st-esg-worldbook-import-preset-scheme', label: '绑定预设方案' },
    { scope: '#st-esg-component-scope', binding: '#st-esg-component-preset-scheme', label: '绑定预设方案' },
  ];
  selectors.forEach(({ scope, binding, label }) => {
    const scopeElement = $t(scope);
    if (!scopeElement.length) return;
    if (!$t(binding).length) scopeElement.closest('label').after(`<label class="st-esg-preset-binding-label">${label}<select id="${binding.slice(1)}" class="text_pole st-esg-preset-binding-select"></select></label>`);
    const bindingElement = $t(binding);
    const selectedId = textOf(bindingElement.val());
    bindingElement.html(getPresetBindingOptions(selectedId));
    bindingElement.val(getPresetSchemeById(selectedId) ? selectedId : '');
    bindingElement.closest('label').toggle(scopeElement.val() === COMPONENT_SCOPE_PRESET);
  });
  if ($t('#st-esg-component-target-library').length || $t('#st-esg-import-target-library').length || $t('#st-esg-worldbook-import-target-library').length) renderComponentLibraryTargetVisibility();
}

function cleanGeneratedText(text) {
  return stripConfiguredBlocks(text, settings.outputCleanupTags).trim();
}

function containsMvuUpdateVariable(text) {
  return /<UpdateVariable\b/i.test(String(text || ''));
}

async function reprocessMvuVariables(context, messageIndex) {
  const mvu = targetWindow.Mvu ?? globalThis.Mvu;
  if (!mvu?.getMvuData || !mvu?.parseMessage || !mvu?.replaceMvuData) return false;

  let baseline = null;
  for (let index = messageIndex - 1; index >= 0; index -= 1) {
    const candidate = await mvu.getMvuData({ type: 'message', message_id: index });
    if (candidate?.stat_data && typeof candidate.stat_data === 'object') {
      baseline = candidate;
      break;
    }
  }
  if (!baseline) return false;

  const message = context.chat?.[messageIndex]?.mes;
  if (typeof message !== 'string') return false;
  const nextData = await mvu.parseMessage(message, baseline);
  await mvu.replaceMvuData(nextData, { type: 'message', message_id: messageIndex });
  return true;
}

function resizeGeneratedPreview({ followBottom = false, preserveScrollTop = null } = {}) {
  const preview = $t('#st-esg-preview').get(0);
  if (!preview || preview.classList.contains('st-esg-hidden')) return;
  const requestedScrollTop = preserveScrollTop === null ? preview.scrollTop : Number(preserveScrollTop);
  const previousScrollTop = Number.isFinite(requestedScrollTop) ? requestedScrollTop : preview.scrollTop;
  const computed = targetWindow.getComputedStyle(preview);
  const minHeight = Math.max(160, parseFloat(computed.minHeight) || 0);
  const viewportHeight = Number(targetWindow.innerHeight) || 720;
  const maxHeight = Math.max(minHeight, Math.min(520, Math.floor(viewportHeight * 0.55)));
  preview.style.setProperty('height', '0px', 'important');
  preview.style.setProperty('min-height', '0px', 'important');
  const layout = getPreviewLayout(Math.ceil(preview.scrollHeight) + 12, minHeight, maxHeight);
  preview.style.setProperty('min-height', `${minHeight}px`, 'important');
  preview.style.setProperty('max-height', `${maxHeight}px`, 'important');
  preview.style.setProperty('height', `${layout.height}px`, 'important');
  preview.style.setProperty('overflow-y', layout.overflowY, 'important');
  preview.scrollTop = followBottom ? preview.scrollHeight : previousScrollTop;
}

function updateStreamedPreview(text) {
  const preview = $t('#st-esg-preview').get(0);
  const streamed = normalizeStreamOutputPreview(text);
  updateMessageFloorPanelStream(text);
  if (!preview) return;
  updateStreamedThinking(streamed.thinking);
  if (preview.value === streamed.text) return;
  const followBottom = isPreviewNearBottom(preview);
  const previousScrollTop = preview.scrollTop;
  preview.value = streamed.text;
  resizeGeneratedPreview({ followBottom, preserveScrollTop: previousScrollTop });
}

function scheduleGeneratedPreviewResize() {
  if (typeof targetWindow.requestAnimationFrame === 'function') {
    targetWindow.requestAnimationFrame(() => resizeGeneratedPreview());
  } else {
    resizeGeneratedPreview();
  }
}

function capturePanelScrollTop() {
  const panelBody = targetDoc.querySelector('.st-esg-panel-body');
  return panelBody ? panelBody.scrollTop : null;
}

function restorePanelScrollTop(scrollTop) {
  if (!Number.isFinite(scrollTop)) return;
  const restore = () => {
    const panelBody = targetDoc.querySelector('.st-esg-panel-body');
    if (panelBody) panelBody.scrollTop = scrollTop;
  };
  if (typeof targetWindow.requestAnimationFrame === 'function') targetWindow.requestAnimationFrame(restore);
  else restore();
}

function renderPromptLogIfVisible() {
  if (settings.activeTab === 'debug') renderPromptLog();
}

function renderGeneratedThinking(blocks = lastGeneratedThinking) {
  const box = $t('#st-esg-thinking-panel');
  if (!box.length) return;
  const entries = Array.isArray(blocks) ? blocks.filter(Boolean) : [];
  if (!entries.length) { box.empty().addClass('st-esg-hidden'); return; }
  box.html(`<details class="st-esg-thinking-details"><summary><span class="st-esg-thinking-title"><i class="fa-solid fa-brain"></i>思维链</span><em>不会注入</em></summary><pre>${escapeHtml(entries.join('\n\n'))}</pre></details>`).removeClass('st-esg-hidden');
}

function updateStreamedThinking(text) {
  const value = String(text ?? '');
  const box = $t('#st-esg-thinking-panel');
  if (!box.length) return;
  if (!value) {
    if (box.find('pre').length || !box.hasClass('st-esg-hidden')) box.empty().addClass('st-esg-hidden');
    return;
  }
  const pre = box.find('pre').get(0);
  if (!pre) {
    renderGeneratedThinking([value]);
    return;
  }
  if (pre.textContent !== value) pre.textContent = value;
  box.removeClass('st-esg-hidden');
}

function clearGeneratedThinking() {
  lastGeneratedThinking = [];
  settings.lastGeneratedThinking = [];
  const thinkingPanel = targetDoc.getElementById('st-esg-thinking-panel');
  thinkingPanel?.replaceChildren();
  thinkingPanel?.classList.add('st-esg-hidden');
}

function clearGeneratedResultState() {
  settings.lastGenerated = '';
  settings.lastGeneratedAnchorItems = [];
  settings.lastGeneratedAnchorWarnings = [];
  settings.lastGeneratedResultMode = 'standard';
  settings.lastGeneratedAnchorTargetIndex = null;
  settings.lastGeneratedStatusPlaceholderPresent = false;
  settings.lastGenerationError = null;
  activeGenerationHistoryId = null;
  clearGeneratedThinking();
  $t('#st-esg-preview').val('').removeClass('st-esg-hidden');
  renderAnchorInsertionPlan([], []);
  renderGenerationResultPanel();
}

function getAnchorTargetMessage() {
  const context = getContext();
  if (Number.isInteger(settings.lastGeneratedAnchorTargetIndex)) {
    return getAssistantMessageAtIndex(context.chat, settings.lastGeneratedAnchorTargetIndex);
  }
  return getLatestAssistantMessage(context.chat);
}

function resolveAnchorPlanForDisplay(items = settings.lastGeneratedAnchorItems) {
  const target = getAnchorTargetMessage();
  const text = String(target?.message?.mes ?? '');
  const resolution = locateAnchorInsertions(text, items);
  const matches = new Map(resolution.matches.map((match) => [match.itemIndex, match]));
  const skipped = new Map(resolution.skipped.map((entry) => [entry.itemIndex, entry]));
  return { text, target, matches, skipped };
}

function describeAnchorMatch(item, match, skipped, hasTarget) {
  if (!hasTarget) return { label: '等待目标正文', className: 'pending' };
  if (match?.matchType === 'boundary') {
    return {
      label: item.position === 'start' ? '文首定位' : '文末定位',
      className: 'boundary',
    };
  }
  if (match?.matchType === 'exact') return { label: '精确匹配', className: 'exact' };
  if (match?.matchType === 'loose') return { label: '宽松匹配', className: 'loose' };
  if (match?.matchType === 'fuzzy') return { label: '模糊匹配', className: 'fuzzy' };
  if (skipped?.status === 'multiple') return { label: '多处匹配', className: 'multiple' };
  if (skipped?.status === 'invalid') return { label: '格式无效', className: 'invalid' };
  return { label: '未匹配', className: 'missing' };
}

function updateAnchorInjectionToggleUi(card, item) {
  const enabled = isAnchorInsertionEnabled(item);
  const label = enabled ? '标记为不注入' : '恢复注入';
  card.attr('data-injection-enabled', String(enabled));
  const toggle = card.find('[data-anchor-toggle]');
  toggle
    .attr('data-injection-enabled', String(enabled))
    .attr('aria-label', label)
    .attr('title', label)
    .attr('aria-pressed', String(enabled));
  toggle.find('i').attr('class', `fa-solid ${enabled ? 'fa-link' : 'fa-link-slash'}`);
}

function updateAnchorPlanStatusUi() {
  const box = $t('#st-esg-anchor-plan');
  if (!box.length) return;
  const items = Array.isArray(settings.lastGeneratedAnchorItems) ? settings.lastGeneratedAnchorItems : [];
  const { text, target, matches, skipped } = resolveAnchorPlanForDisplay(items);
  box.find('.st-esg-anchor-plan-item').each(function () {
    const card = $(this);
    const index = Number(card.attr('data-anchor-item-index'));
    const item = items[index];
    if (!item) return;
    const state = describeAnchorMatch(item, matches.get(index), skipped.get(index), Boolean(target && text));
    card.attr('data-match-status', state.className);
    card.find('[data-anchor-status]').attr('class', `st-esg-anchor-status st-esg-anchor-status-${state.className}`).text(state.label);
    updateAnchorInjectionToggleUi(card, item);
  });
}

function renderAnchorInsertionPlan(items = settings.lastGeneratedAnchorItems, warnings = []) {
  const preview = $t('#st-esg-preview');
  if (!preview.length) return;
  let box = $t('#st-esg-anchor-plan');
  const contentCard = preview.closest('.st-esg-generation-content');
  if (!box.length) {
    const anchorMarkup = '<div id="st-esg-anchor-plan" class="st-esg-anchor-plan st-esg-hidden"></div>';
    preview.before(anchorMarkup);
    box = $t('#st-esg-anchor-plan');
  } else if (contentCard.length && !contentCard[0].contains(box[0])) {
    // 兼容旧版已渲染的独立计划：重新放回生成内容卡片内，保持嵌套层级稳定。
    preview.before(box);
  }
  const sourceItems = Array.isArray(items) ? items : [];
  const entries = sourceItems.map((item, sourceIndex) => ({ item, sourceIndex })).filter(({ item }) => item && item.content);
  if (!entries.length && !warnings.length) {
    box.empty().addClass('st-esg-hidden');
    return;
  }
  const warningHtml = warnings.length
    ? `<div class="st-esg-anchor-plan-warnings">${warnings.map((warning) => `<div>${escapeHtml(warning)}</div>`).join('')}</div>`
    : '';
  const resolved = resolveAnchorPlanForDisplay(sourceItems);
  const itemHtml = entries.map(({ item, sourceIndex }, index) => {
    const match = resolved.matches.get(sourceIndex);
    const skipped = resolved.skipped.get(sourceIndex);
    const state = describeAnchorMatch(item, match, skipped, Boolean(resolved.target && resolved.text));
    const isBoundary = item.position === 'start' || item.position === 'end';
    const injectionEnabled = isAnchorInsertionEnabled(item);
    const injectionToggleLabel = injectionEnabled ? '标记为不注入' : '恢复注入';
    const injectionToggleIcon = injectionEnabled ? 'fa-link' : 'fa-link-slash';
    const positionLabel = item.position === 'start'
      ? '插入到整条消息开头'
      : item.position === 'end'
        ? '插入到整条消息末尾'
        : item.position === 'before'
          ? '插入到锚点前'
          : '插入到锚点后';
    return `<details class="st-esg-anchor-plan-item" data-anchor-item-index="${sourceIndex}" data-match-status="${state.className}" data-injection-enabled="${injectionEnabled}" open>
      <summary><span>#${index + 1} · ${escapeHtml(positionLabel)}</span><span class="st-esg-anchor-summary-controls"><span data-anchor-status class="st-esg-anchor-status st-esg-anchor-status-${state.className}">${escapeHtml(state.label)}</span><button type="button" class="st-esg-anchor-toggle" data-anchor-toggle data-injection-enabled="${injectionEnabled}" aria-label="${injectionToggleLabel}" aria-pressed="${injectionEnabled}" title="${injectionToggleLabel}"><i class="fa-solid ${injectionToggleIcon}" aria-hidden="true"></i></button></span></summary>
      <div class="st-esg-anchor-plan-fields">
        <label class="st-esg-anchor-field${isBoundary ? ' st-esg-hidden' : ''}">锚点<textarea class="text_pole textarea_compact st-esg-anchor-input" data-anchor-field="anchor" rows="2">${escapeHtml(item.anchor || '')}</textarea></label>
        <label>插入内容<textarea class="text_pole textarea_compact st-esg-anchor-content" data-anchor-field="content" rows="4">${escapeHtml(item.content || '')}</textarea></label>
      </div>
    </details>`;
  }).join('');
  box.html(`<div class="st-esg-anchor-plan-head"><div><strong>锚点插入计划</strong><span>${entries.length} 项</span></div><button type="button" class="menu_button menu_button_icon st-esg-anchor-preview-button" aria-label="预览插入效果" title="预览插入效果"><i class="fa-solid fa-eye" aria-hidden="true"></i></button></div>${warningHtml}${itemHtml}`).removeClass('st-esg-hidden');
}

function showAnchorInsertionPreviewDialog() {
  targetDoc.getElementById('st-esg-anchor-preview-dialog')?.remove();
  const dialog = targetDoc.createElement('dialog');
  dialog.id = 'st-esg-anchor-preview-dialog';
  dialog.className = `st-esg-anchor-preview-dialog ${getThemeClassName(settings.theme)}`;

  const target = getAnchorTargetMessage();
  const targetText = String(target?.message?.mes ?? '');
  const items = Array.isArray(settings.lastGeneratedAnchorItems) ? settings.lastGeneratedAnchorItems : [];
  const preview = buildAnchorPreviewSegments(targetText, items);
  const hasTarget = Boolean(target && targetText);
  const segmentHtml = preview.segments.length
    ? preview.segments.map((segment) => segment.type === 'insert'
      ? `<mark class="st-esg-anchor-preview-insert" data-anchor-preview-item-index="${Number(segment.itemIndex)}">${escapeHtml(segment.text)}</mark>`
      : escapeHtml(segment.text)).join('')
    : escapeHtml(hasTarget ? targetText : '未找到本次生成记录对应的最新 assistant 楼层。');
  const skippedHtml = preview.skipped.length
    ? `<div class="st-esg-anchor-preview-skipped">${preview.skipped.length} 项未能定位，已按原文保留。请回到计划卡片编辑锚点。</div>`
    : '';
  const disabledHtml = preview.disabled.length
    ? `<div class="st-esg-anchor-preview-skipped st-esg-anchor-preview-disabled">${preview.disabled.length} 项已标记为不注入，本次预览中保留原文。</div>`
    : '';
  const targetLabel = hasTarget ? `第 ${Number(target.index) + 1} 层 assistant` : '未找到目标楼层';

  dialog.innerHTML = `
    <form method="dialog">
      <header class="st-esg-anchor-preview-header">
        <div>
          <div class="st-esg-card-title">插入效果预览</div>
          <div class="st-esg-card-desc">目标：${escapeHtml(targetLabel)} · 高亮部分为本次插入内容</div>
        </div>
        <button class="st-esg-icon-btn" type="button" data-anchor-preview-close aria-label="关闭预览"><i class="fa-solid fa-xmark"></i></button>
      </header>
      <div class="st-esg-anchor-preview-body">
        <div class="st-esg-anchor-preview-meta">已定位 ${preview.applied.length} 项${preview.disabled.length ? `，排除 ${preview.disabled.length} 项` : ''}${preview.skipped.length ? `，跳过 ${preview.skipped.length} 项` : ''}</div>
        ${skippedHtml}
        ${disabledHtml}
        <pre class="st-esg-anchor-preview-text">${segmentHtml}</pre>
      </div>
      <footer class="st-esg-actions-row st-esg-anchor-preview-footer">
        <button class="menu_button st-esg-primary-action" type="button" data-anchor-preview-close>关闭</button>
      </footer>
    </form>`;

  const closeDialog = () => {
    if (dialog.open && typeof dialog.close === 'function') dialog.close();
    dialog.remove();
  };
  dialog.querySelectorAll('[data-anchor-preview-close]').forEach((button) => button.addEventListener('click', closeDialog));
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); closeDialog(); });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) closeDialog(); });
  targetDoc.body.appendChild(dialog);
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function formatGenerationHistoryTime(value) {
  const date = new Date(Number(value));
  if (!Number.isFinite(date.getTime())) return '时间未知';
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function getGenerationHistoryStorage() {
  try {
    return targetWindow.localStorage;
  } catch (_) {
    return null;
  }
}

function renderGenerationHistory() {
  const list = $t('#st-esg-generation-history');
  if (!list.length) return;
  if (!recentGenerationHistory.length) {
    list.html('<div class="st-esg-generation-history-empty">还没有成功生成的记录。</div>');
    return;
  }
   list.html(recentGenerationHistory.map((entry) => {
     const isAnchor = entry.kind === 'anchor';
     const countLabel = isAnchor ? `${entry.anchorItems.length} 项锚点` : `${entry.content.length} 字`;
     const body = isAnchor
       ? `<div class="st-esg-generation-history-anchor-list">${entry.anchorItems.map((item, index) => `<div><span>#${index + 1} · ${escapeHtml(item.position === 'start' ? '文首' : item.position === 'end' ? '文末' : item.position === 'before' ? '锚点前' : '锚点后')}</span><pre>${escapeHtml(item.content)}</pre></div>`).join('')}</div>`
       : `<pre>${escapeHtml(entry.content)}</pre>`;
     return `
       <details class="st-esg-generation-history-entry" data-history-id="${escapeHtml(entry.id)}">
         <summary><span>${escapeHtml(formatGenerationHistoryTime(entry.generatedAt))}</span><em>${countLabel}</em></summary>
         ${body}
         <div class="st-esg-actions-row"><button class="menu_button menu_button_icon st-esg-secondary-action st-esg-load-generation-history" type="button" data-history-id="${escapeHtml(entry.id)}"><i class="fa-solid fa-arrow-up-from-bracket"></i><span>载入</span></button></div>
       </details>
     `;
   }).join(''));
}

function loadGenerationHistoryEntry(id) {
  const entry = recentGenerationHistory.find((item) => item.id === String(id || ''));
  if (!entry) return false;
  activeGenerationHistoryId = entry.id;
  settings.lastGeneratedResultMode = entry.kind === 'anchor' ? 'anchor' : 'standard';
  settings.lastGenerated = entry.kind === 'anchor' ? '' : entry.content;
  settings.lastGeneratedAnchorItems = entry.kind === 'anchor' ? entry.anchorItems.map((item) => ({ ...item })) : [];
  settings.lastGeneratedAnchorWarnings = entry.kind === 'anchor' ? [...entry.warnings] : [];
  settings.lastGeneratedStatusPlaceholderPresent = containsStatusPlaceholder(settings.lastGenerated)
    || settings.lastGeneratedAnchorItems.some((item) => containsStatusPlaceholder(item?.content));
  settings.lastGenerationError = null;
  setFloatingBallVisualState('waiting');
  clearGeneratedThinking();
  $t('#st-esg-preview').val(settings.lastGenerated);
  renderAnchorInsertionPlan(settings.lastGeneratedAnchorItems, settings.lastGeneratedAnchorWarnings);
  renderGenerationResultPanel();
  resizeGeneratedPreview();
  syncMessageFloorPanelResult({ status: FLOOR_PANEL_STATUS.READY });
  saveSettings();
  notifyStatus('已载入最近生成记录。');
  return true;
}

function scheduleAnchorEditPersistence() {
  if (anchorEditSaveTimer) targetWindow.clearTimeout(anchorEditSaveTimer);
  anchorEditSaveTimer = targetWindow.setTimeout(() => {
    anchorEditSaveTimer = null;
    if (activeGenerationHistoryId) {
      recentGenerationHistory = updateGenerationHistoryEntry(
        getGenerationHistoryStorage(),
        GENERATION_HISTORY_STORAGE_KEY,
        activeGenerationHistoryId,
        {
          anchorItems: settings.lastGeneratedAnchorItems,
          warnings: settings.lastGeneratedAnchorWarnings,
        },
      );
      renderGenerationHistory();
    }
    saveSettings();
  }, 220);
}

function applyGeneratedResult(rawText) {
  const normalized = normalizeGeneratedResult(rawText);
  const raw = String(rawText ?? '');
  settings.lastGeneratedResultMode = normalized.mode.startsWith('anchor-') ? 'anchor' : 'standard';
  settings.lastGeneratedAnchorItems = Array.isArray(normalized.anchorItems) ? normalized.anchorItems : [];
  settings.lastGeneratedAnchorWarnings = Array.isArray(normalized.warnings) ? normalized.warnings : [];
  settings.lastGenerated = normalized.usable ? normalized.content : '';
  settings.lastGeneratedStatusPlaceholderPresent = containsStatusPlaceholder(settings.lastGenerated)
    || settings.lastGeneratedAnchorItems.some((item) => containsStatusPlaceholder(item?.content));
  lastGeneratedThinking = normalized.thinking;
  settings.lastGeneratedThinking = normalized.thinking;
  settings.lastGenerationError = null;
  $t('#st-esg-preview').val(settings.lastGeneratedResultMode === 'anchor' ? '' : (normalized.usable ? settings.lastGenerated : raw));
  renderAnchorInsertionPlan(settings.lastGeneratedAnchorItems, normalized.warnings || []);
  renderGeneratedThinking();
  renderGenerationResultPanel();
  resizeGeneratedPreview();
  const floorResult = {
    resultMode: settings.lastGeneratedResultMode,
    output: settings.lastGenerated,
    anchorItems: settings.lastGeneratedAnchorItems,
  };
  if (messageFloorPanelState.status === FLOOR_PANEL_STATUS.GENERATING) {
    syncMessageFloorPanelResult({ status: getEndedFloorPanelStatus(floorResult) });
  }
  return settings.lastGenerated;
}

async function buildMessages(latestMessage, sourceSettings = settings, { onDiagnostics = null } = {}) {
  const context = getContext();
  const components = getEnabledComponents(sourceSettings);
  const theaterComponents = getEnabledTheaterComponents(sourceSettings);
  const animaEnabled = sourceSettings.animaWorldbookEnabled || sourceSettings.animaStatusVariableEnabled;
  const animaWorldbookEntries = animaEnabled ? await getAnimaWorldbookSnapshotForPrompt() : [];
  const animaStatusSnapshot = getAnimaStatusSnapshotForPrompt(context);
  const animaStatus = animaStatusSnapshot?.data || null;
  const animaStatusMessageIndex = sourceSettings.animaStatusAfterMessageEnabled
    ? animaStatusSnapshot?.messageIndex ?? null
    : null;
  const isTaskRuntime = sourceSettings !== settings;
  const promptSourceItems = isTaskRuntime
    ? await ensureRuntimePromptSourceItemsForGeneration(sourceSettings, { animaWorldbookEntries })
    : animaEnabled
      ? await ensurePromptSourceItemsForGeneration({ animaWorldbookEntries })
      : await ensurePromptSourceItemsForGeneration();
  const templateStats = { enabled: Boolean(sourceSettings.promptTemplateCompatEnabled), renderCount: 0, changedCount: 0 };
  const outputMode = sourceSettings.injectMode === 'anchor' ? 'anchor' : 'standard';
  const messages = await buildExternalStatusbarMessages({
    targetWindow,
    context,
    latestMessage,
    taskPrompt: composeTaskInstruction(sourceSettings.taskPrompt, isTaskRuntime ? sourceSettings.extraInstruction : temporaryTaskInstruction),
    components,
    theaterComponents,
    promptSourceItems,
    worldbookSourceControlled: true,
    historyCleanupTags: sourceSettings.historyCleanupRules,
    historyRangeMode: sourceSettings.historyRangeMode,
    recentMessageCount: sourceSettings.recentMessageCount,
    substituteParams: context.substituteParams,
    taskPlacement: { enabled: sourceSettings.taskPlacementEnabled, afterSourceId: sourceSettings.taskPlacementAfterSourceId },
    replaceLastUserMessageWithTask: sourceSettings.replaceLastUserMessageWithTask,
    omitOriginalUserMessages: sourceSettings.omitOriginalUserMessages,
    renderTemplate: null,
    animaStatus,
    animaStatusMessageIndex,
    animaWorldbookEntries,
    animaYaml: targetWindow?.jsyaml || targetWindow?.yaml || null,
    baiBaiBook: sourceSettings.baiBaiBookHistoryEnabled || sourceSettings.baiBaiBookStateEnabled ? {
      api: getBaiBaiBookApi(targetWindow),
      context,
      substituteParams: context.substituteParams,
      includeHistory: sourceSettings.baiBaiBookHistoryEnabled,
      includeState: sourceSettings.baiBaiBookStateEnabled,
      } : null,
    outputMode,
    outputProtocol: getActiveOutputProtocolSettings(outputMode, sourceSettings),
   });
  if (sourceSettings.promptTemplateCompatEnabled) {
    for (const message of messages) {
      const source = String(message?.content ?? '');
      const rendered = await renderPromptTemplate({ targetWindow, content: source, enabled: true });
      templateStats.renderCount += 1;
      if (rendered !== source) templateStats.changedCount += 1;
      message.content = rendered;
    }
  }
  let tavernHelperYamlLibrary = targetWindow?.jsyaml || targetWindow?.yaml || null;
  try {
    tavernHelperYamlLibrary = await getYamlParser() || tavernHelperYamlLibrary;
  } catch (_) {}
  const tavernHelperMacroWarnings = replaceTavernHelperMacrosInMessages(messages, {
    getVariables: targetWindow?.TavernHelper?.getVariables?.bind(targetWindow.TavernHelper),
    chat: context?.chat,
    yamlLibrary: tavernHelperYamlLibrary,
    lodashLike: targetWindow?._,
  });
  stripInternalMessageFields(messages);
  if (tavernHelperMacroWarnings.length) {
    const helperUnavailable = tavernHelperMacroWarnings.some((warning) => warning.code === 'helper-unavailable');
    notifyStatus(
      helperUnavailable
        ? '检测到酒馆助手变量宏，但酒馆助手不可用，已保留原宏。'
        : '部分酒馆助手变量宏解析失败，已保留原宏。',
      'warning',
    );
  }
  const runtimeDiagnostics = createRuntimePromptDiagnostics({ context, promptSourceItems: messages.promptSourceItems || promptSourceItems, runtimeInsertions: messages.runtimeInsertions });
  runtimeDiagnostics.tavernHelperMacros = {
    status: tavernHelperMacroWarnings.length ? 'warning' : 'ok',
    warnings: tavernHelperMacroWarnings.map((warning) => ({ code: warning.code, scope: warning.scope })),
  };
  runtimeDiagnostics.promptTemplateCompat = {
    ...templateStats,
    status: !templateStats.enabled
      ? 'disabled'
      : (templateStats.changedCount > 0 ? 'rendered' : 'rendered-unchanged'),
    scope: 'allMessages',
  };
  if (typeof onDiagnostics === 'function') onDiagnostics(runtimeDiagnostics);
  else lastRuntimeDiagnostics = runtimeDiagnostics;
  messages.runtimeDiagnostics = runtimeDiagnostics;
  return messages;
}

function setGeneratingState(isGenerating) {
  const button = $t('#st-esg-generate');
  if (button.length) {
    button.attr('aria-busy', String(isGenerating));
    button.toggleClass('st-esg-action-running', isGenerating);
    button.find('i').attr('class', isGenerating ? 'fa-solid fa-stop' : 'fa-solid fa-sparkles');
    button.find('span').text(isGenerating ? '停止生成' : '生成组件');
  }
  if (isGenerating) setFloatingBallVisualState('generating');
  else if (floatingBallVisualState === 'generating') setFloatingBallVisualState('idle');
  renderGenerationModeSwitchControl();
}

function waitForInteractionPaint() {
  return new Promise((resolve) => {
    targetWindow.requestAnimationFrame(() => {
      targetWindow.requestAnimationFrame(resolve);
    });
  });
}

async function buildExternalApiRequestContext(latestMessage, sourceSettings = settings, options = {}) {
  const apiMode = ['custom', 'tavern'].includes(sourceSettings.apiMode) ? sourceSettings.apiMode : 'custom';
  const tavernProfile = apiMode === 'tavern'
    ? resolveTavernProfile(getTavernProfiles(), sourceSettings.tavernProfile)
    : null;
  const apiUrl = apiMode === 'custom'
    ? normalizeChatCompletionsUrl(sourceSettings.apiUrl)
    : 'https://tavern.internal';
  const model = apiMode === 'tavern' ? textOf(tavernProfile?.model) : textOf(sourceSettings.apiModel);
  if (!apiUrl || !model) throw new Error('请先在“API 设置”里填写 API 地址和模型名称。');
  const numeric = parseApiNumericSettings(sourceSettings);
  const additional = parseApiAdditionalParameters(sourceSettings, await getYamlParser());
  const builtMessages = await buildMessages(latestMessage, sourceSettings, options);
  const runtimeDiagnostics = builtMessages.runtimeDiagnostics;
  delete builtMessages.runtimeDiagnostics;
  const messages = sourceSettings.compressSystemMessages ? mergeConsecutiveSystemMessages(builtMessages) : builtMessages;
  return { apiUrl, model, apiMode, numeric, additional, messages, tavernProfile, sourceSettings, runtimeDiagnostics, options };
}

async function callExternalApi(latestMessage, signal, sourceSettings = settings, options = {}) {
  const requestContext = await buildExternalApiRequestContext(latestMessage, sourceSettings, options);
  return runConfiguredApiRequest(
    () => callExternalApiOnce(requestContext, signal),
    signal,
    sourceSettings,
    options.onPreview || updateStreamedPreview,
  );
}

async function callExternalApiOnce(requestContext, signal) {
  const { apiUrl, model, apiMode, numeric, additional, messages, tavernProfile, sourceSettings, runtimeDiagnostics, options } = requestContext;
  const onPreview = options?.onPreview || updateStreamedPreview;
  const publishPromptLog = (value) => {
    if (typeof options?.onPromptLog === 'function') {
      options.onPromptLog(value, runtimeDiagnostics);
      return;
    }
    lastPromptLogText = value;
    promptLogBuilding = false;
    settings.lastPromptLog = '';
    saveSettings();
    renderPromptLogIfVisible();
  };
  if (apiMode === 'tavern') {
    const tavernNumeric = parseApiNumericSettings(sourceSettings);
    const promptLogApi = `酒馆预设：${tavernProfile?.profile?.name || sourceSettings.tavernProfile || '未选择'}`;
    publishPromptLog(createPromptLog({ apiUrl: promptLogApi, apiKey: '', model, maxTokens: String(tavernNumeric.maxTokens), temperature: String(tavernNumeric.temperature), messages, extensionVersion: EXTENSION_VERSION, runtimeDiagnostics, compressSystemMessages: sourceSettings.compressSystemMessages }));
    const service = targetWindow?.SillyTavern?.ConnectionManagerRequestService
      || targetWindow?.ConnectionManagerRequestService
      || getContext()?.ConnectionManagerRequestService;
    const profileId = textOf(tavernProfile?.profileId);
    if (!profileId || typeof service?.sendRequest !== 'function') throw new Error('未选择可用的酒馆预设。');
    const response = await service.sendRequest(profileId, messages, Number(sourceSettings.maxTokens) || MAX_OUTPUT_TOKENS, {
      extractData: true,
      includePreset: true,
      stream: Boolean(sourceSettings.streamingEnabled),
      signal,
    });
    if (sourceSettings.streamingEnabled && typeof response === 'function') {
      const streamPreview = createStreamPreviewController({ intervalMs: 80, onPreview });
      let streamedText = '';
      try {
        for await (const chunk of response()) {
          const nextText = chunk?.text ?? chunk?.content ?? '';
          if (typeof nextText === 'string') {
            streamedText = nextText;
            streamPreview.push(streamedText);
          }
        }
        streamPreview.flush();
        if (!streamedText.trim()) throw markGenerationResponseError(new Error('酒馆预设 API 返回为空。'));
        return streamedText.trim();
      } catch (error) {
        streamPreview.flush();
        if (error && typeof error === 'object') error.streamedText = streamPreview.getText();
        throw error;
      } finally {
        streamPreview.dispose();
      }
    }
    const content = response?.result?.choices?.[0]?.message?.content ?? response?.content ?? '';
    if (typeof content !== 'string' || !content.trim()) throw markGenerationResponseError(new Error('酒馆预设 API 返回为空。'));
    return content.trim();
  }
  const tavernChatService = targetWindow?.SillyTavern?.ChatCompletionService
    || targetWindow?.ChatCompletionService
    || getContext()?.ChatCompletionService;
  if (typeof tavernChatService?.processRequest === 'function') {
    const customHeadersYaml = serializeRequestHeadersYaml({
      ...(sourceSettings.apiKey ? { Authorization: `Bearer ${sourceSettings.apiKey}` } : {}),
      ...additional.additionalHeaders,
    });
    const requestData = {
      stream: Boolean(sourceSettings.streamingEnabled),
      messages,
      model,
      chat_completion_source: 'custom',
      max_tokens: numeric.maxTokens,
      temperature: numeric.temperature,
      custom_url: sourceSettings.apiUrl,
      custom_include_headers: customHeadersYaml,
      custom_include_body: sourceSettings.additionalBodyYaml,
      custom_exclude_body: sourceSettings.excludedBodyYaml,
    };
    publishPromptLog(createPromptLog({ apiUrl, apiKey: sourceSettings.apiKey, model, maxTokens: String(numeric.maxTokens), temperature: String(numeric.temperature), messages, extensionVersion: EXTENSION_VERSION, runtimeDiagnostics, compressSystemMessages: sourceSettings.compressSystemMessages }));
    const response = await tavernChatService.processRequest(requestData, {}, true, signal);
    if (sourceSettings.streamingEnabled && typeof response === 'function') {
      const streamPreview = createStreamPreviewController({ intervalMs: 80, onPreview });
      let streamedText = '';
      try {
        for await (const chunk of response()) {
          const nextText = chunk?.text ?? chunk?.content ?? '';
          if (typeof nextText === 'string') {
            streamedText = nextText;
            streamPreview.push(streamedText);
          }
        }
        streamPreview.flush();
        if (!streamedText.trim()) throw markGenerationResponseError(new Error('API 返回为空。'));
        return streamedText.trim();
      } catch (error) {
        streamPreview.flush();
        if (error && typeof error === 'object') error.streamedText = streamPreview.getText();
        throw error;
      } finally {
        streamPreview.dispose();
      }
    }
    const content = response?.content ?? response?.result?.choices?.[0]?.message?.content ?? '';
    if (typeof content !== 'string' || !content.trim()) throw markGenerationResponseError(new Error('API 返回为空。'));
    return content.trim();
  }
  const { body, headers } = buildApiRequestParts(
    {
      model,
      messages,
      max_tokens: numeric.maxTokens,
      temperature: numeric.temperature,
      stream: Boolean(sourceSettings.streamingEnabled),
    },
    {
      'Content-Type': 'application/json',
      ...(sourceSettings.apiKey ? { Authorization: `Bearer ${sourceSettings.apiKey}` } : {}),
    },
    additional,
  );
  const streamingEnabled = Boolean(body.stream);
  publishPromptLog(createPromptLog({ apiUrl, apiKey: sourceSettings.apiKey, model, maxTokens: String(numeric.maxTokens), temperature: String(numeric.temperature), messages, extensionVersion: EXTENSION_VERSION, runtimeDiagnostics, compressSystemMessages: sourceSettings.compressSystemMessages }));
  if (typeof options?.onPromptLog !== 'function') {
    console.log(`[${EXTENSION_ID}] prompt log`, { summary: createPromptLogViewModel(lastPromptLogText).summary, diagnostics: runtimeDiagnostics });
  }
  const response = await fetch(apiUrl, {
    method: 'POST',
    signal,
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) throw createApiHttpError(response, await response.text().catch(() => ''));
  if (streamingEnabled) {
    const streamPreview = createStreamPreviewController({
      intervalMs: 80,
      onPreview,
    });
    try {
      const streamed = await readOpenAiStream(response, (_, fullText) => {
        streamPreview.push(fullText);
      });
      streamPreview.flush();
      if (!streamed.trim()) throw markGenerationResponseError(new Error('API 返回为空。'));
      return streamed;
    } catch (error) {
      streamPreview.flush();
      if (error && typeof error === 'object') error.streamedText = streamPreview.getText();
      throw error;
    } finally {
      streamPreview.dispose();
    }
  }
  const data = await response.json().catch((error) => { throw markGenerationResponseError(error); });
  const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';
  if (!content.trim()) throw markGenerationResponseError(new Error('API 返回为空。'));
  return content;
}

function createApiHttpError(response, body = '') {
  const error = markGenerationResponseError(new Error(`API 请求失败：${response?.status || '未知'} ${String(body || '').slice(0, 160)}`));
  const status = Number(response?.status);
  if (Number.isInteger(status)) {
    error.status = status;
    error.statusCode = status;
    error.responseStatus = status;
  }
  const retryAfter = typeof response?.headers?.get === 'function' ? response.headers.get('retry-after') : null;
  if (retryAfter != null) error.retryAfter = retryAfter;
  return error;
}

function injectStatusbar(message, text, mode = settings.injectMode) {
  const rawStatusbarText = settings.lastGeneratedStatusPlaceholderPresent
    ? `${text}\n${STATUS_PLACEHOLDER_TAG}`
    : text;
  message.mes = injectStatusbarText(message.mes, text, {
    mode,
    normalizeStatusPlaceholder: settings.statusPlaceholderEnabled,
    rawStatusbarText,
  });
}

async function generateStatusbar(entryType = 'manual', targetMessageIndex = null, automaticTarget = null) {
  if (settings.generationMode === 'multi') {
    const runningTaskIds = normalizeMultiTaskSettings(settings.multiTaskSettings).tasks
      .filter((task) => [MULTI_TASK_STATUS.QUEUED, MULTI_TASK_STATUS.GENERATING].includes(task.status))
      .map((task) => task.id);
    if (runningTaskIds.length) {
      if (entryType !== 'automatic') cancelMultiTaskGeneration(runningTaskIds);
      return '';
    }
    await generateMultiTasks();
    return '';
  }
  const conflictAction = getGenerationConflictAction(Boolean(generationAbortController), entryType);
  if (conflictAction === 'ignore') return '';
  if (conflictAction === 'notify') {
    notifyStatus('已在生成中', 'warning');
    return '';
  }
  if (conflictAction === 'abort') {
    generationAbortController.abort();
    return '';
  }
  const importModeSourceType = ['preset', 'worldbook'].find((type) => getSourceMode(type) === SOURCE_MODE_IMPORT);
  if (importModeSourceType) {
    const message = `当前处于“导入到组件”模式，请先切换${importModeSourceType === 'worldbook' ? '世界书' : '预设'}到“提示词编辑”后再生成。`;
    logAutomaticGenerationStage('generation-skip', message);
    if (entryType !== 'automatic') notifyStatus(message, 'warning');
    return '';
  }
  if (entryType !== 'automatic' || !automaticGenerationLogActive) clearAutomaticGenerationLog();
  logAutomaticGenerationStage('generation-start', '准备目标回复');
  const context = getContext();
  const latest = targetMessageIndex === null
    ? getLatestAssistantMessage(context.chat)
    : getAssistantMessageAtIndex(context.chat, targetMessageIndex);
  if (!latest) {
    const error = new Error('没有找到可用于生成的助手回复。');
    logAutomaticGenerationStage('generation-skip', error.message);
    notifyStatus(error.message, 'warning');
    return '';
  }
  const panelScrollTop = capturePanelScrollTop();
  let floorGeneration = prepareMessageFloorPanelGeneration(latest);
  clearGeneratedResultState();
  settings.lastGeneratedAnchorTargetIndex = latest.index;
  saveSettings();
  notifyStatus('正在生成组件……', 'info');
  const requestController = new AbortController();
  generationAbortController = requestController;
  stopAnimaWorldbookCapture();
  if (entryType === 'automatic') activeAutomaticTarget = automaticTarget;
  setGeneratingState(true);
  await waitForInteractionPaint();
  let result = '';
  try {
    if (settings.rollbackBeforeGeneration) {
      messageFloorPanelSuppressRefresh = true;
      try {
        await restoreLatestInjection({ targetMessageIndex: latest.index });
      } finally {
        messageFloorPanelSuppressRefresh = false;
      }
      const rolledBackLatest = getAssistantMessageAtIndex(getContext().chat, latest.index);
      if (rolledBackLatest) floorGeneration = prepareMessageFloorPanelGeneration(rolledBackLatest);
    }
    clearGeneratedThinking();
    restorePanelScrollTop(panelScrollTop);
    logAutomaticGenerationStage('target-ready', `message ${latest.index}`);
    logAutomaticGenerationStage('api-start', `楼层 ${latest.index}`);
    const apiMode = settings.apiMode || 'custom';
    if (apiMode === 'custom' && (!settings.apiUrl || !settings.apiModel)) {
      const error = new Error('请先在“API 配置”里填写 API 地址和模型名称。');
      logAutomaticGenerationStage('generation-error');
      if (!floorGeneration || isCurrentMessageFloorPanelGeneration(floorGeneration.generation, floorGeneration.target)) {
        recordGenerationError('生成', error);
      }
      notifyStatus(error.message, 'warning');
      return '';
    }
    if (apiMode === 'tavern' && !settings.tavernProfile) {
      const error = new Error('请先选择酒馆预设。');
      logAutomaticGenerationStage('generation-error');
      if (!floorGeneration || isCurrentMessageFloorPanelGeneration(floorGeneration.generation, floorGeneration.target)) {
        recordGenerationError('生成', error);
      }
      notifyStatus(error.message, 'warning');
      return '';
    }
    logAutomaticGenerationStage('prompt-build-start');
    beginPromptLogBuild();
    result = await callExternalApi(latest.message, requestController.signal);
    if (floorGeneration && !isCurrentMessageFloorPanelGeneration(floorGeneration.generation, floorGeneration.target)) return '';
    logAutomaticGenerationStage('api-returned', result ? 'received content' : 'empty response');
  }
  catch (error) {
    const partialStreamText = String(error?.streamedText ?? '');
    if (partialStreamText.trim()) {
      const partialResultPanelScrollTop = capturePanelScrollTop();
      applyGeneratedResult(partialStreamText);
      restorePanelScrollTop(partialResultPanelScrollTop);
      saveSettings();
    }
    const retainedFloorResult = {
      resultMode: settings.lastGeneratedResultMode,
      output: settings.lastGenerated,
      anchorItems: settings.lastGeneratedAnchorItems,
    };
    const retainedPartialResult = hasInjectableFloorPanelResult(retainedFloorResult);
    if (floorGeneration && isCurrentMessageFloorPanelGeneration(floorGeneration.generation, floorGeneration.target)) {
      messageFloorPanelState.streaming = false;
      messageFloorPanelState.status = getEndedFloorPanelStatus(retainedFloorResult, {
        failed: error?.name !== 'AbortError',
      });
      if (retainedPartialResult) messageFloorPanelState.error = null;
      renderMessageFloorPanel({ force: true });
    }
    if (error?.name === 'AbortError') {
      notifyStatus('已停止生成。提示词查看器内容已保留。', 'warning');
    } else if (retainedPartialResult) {
      logAutomaticGenerationStage('generation-error', 'request ended; partial result retained');
      notifyStatus('生成请求异常结束，已保留当前可注入内容。', 'warning');
    } else {
      logAutomaticGenerationStage('generation-error');
      if (!floorGeneration || isCurrentMessageFloorPanelGeneration(floorGeneration.generation, floorGeneration.target)) {
        recordGenerationError('生成', error);
      }
      notifyStatus(error?.message || '生成失败。', 'error');
    }
    return '';
  } finally {
    if (promptLogBuilding) {
      promptLogBuilding = false;
      renderPromptLogIfVisible();
    }
    if (generationAbortController === requestController) {
      generationAbortController = null;
      if (entryType === 'automatic') activeAutomaticTarget = null;
      logAutomaticGenerationStage('api-finished', result ? 'response handling complete' : 'no generated content');
      setGeneratingState(false);
    }
  }
  if (floorGeneration && !isCurrentMessageFloorPanelGeneration(floorGeneration.generation, floorGeneration.target)) return '';
  logAutomaticGenerationStage('result-apply', 'updating preview');
  const resultPanelScrollTop = capturePanelScrollTop();
  applyGeneratedResult(result);
  setFloatingBallVisualState(result ? 'waiting' : 'idle');
  const historyResult = settings.lastGeneratedResultMode === 'anchor'
    ? { kind: 'anchor', anchorItems: settings.lastGeneratedAnchorItems, warnings: settings.lastGeneratedAnchorWarnings }
    : settings.lastGenerated;
  const previousHistoryHead = recentGenerationHistory[0]?.id || null;
  recentGenerationHistory = recordGenerationResult(getGenerationHistoryStorage(), GENERATION_HISTORY_STORAGE_KEY, historyResult);
  activeGenerationHistoryId = recentGenerationHistory[0]?.id !== previousHistoryHead
    ? recentGenerationHistory[0]?.id || null
    : null;
  renderGenerationHistory();
  restorePanelScrollTop(resultPanelScrollTop);
  saveSettings();
  if (settings.autoInject && result && (settings.lastGenerated || settings.lastGeneratedAnchorItems?.length)) {
    if (automaticTarget && !isAutomaticAssistantTargetAddressable(automaticTarget, getContext().chat)) {
      logAutomaticGenerationStage('inject-skip', '目标已不是最新 assistant，结果保留在预览中');
      notifyStatus('组件已经生成，但原目标已不是最新 assistant，已保留结果并跳过自动注入。', 'warning');
      return settings.lastGenerated;
    }
    logAutomaticGenerationStage('inject-queued', 'auto-inject enabled');
    await injectGeneratedStatusbar(latest.index);
  }
  else notifyStatus('已生成组件内容，等待检查或注入。');
  return settings.lastGenerated;
}

async function injectGeneratedStatusbar(targetMessageIndex = null) {
  let context = getContext();
  logAutomaticGenerationStage('inject-start', targetMessageIndex === null ? 'latest assistant' : `message ${targetMessageIndex}`);
  let latest = targetMessageIndex === null
    ? getLatestAssistantMessage(context.chat)
    : getAssistantMessageAtIndex(context.chat, targetMessageIndex);
  if (!latest) {
    const error = new Error('没有找到可注入的助手回复。');
    logAutomaticGenerationStage('inject-skip', error.message);
    notifyStatus(error.message, 'warning');
    return;
  }
  if (settings.messageFloorPanelEnabled && messageFloorPanelState.target && targetMessageIndex !== null) {
    const currentTarget = createFloorPanelTarget({
      chatId: getCurrentChatIdSafe(context),
      messageIndex: latest.index,
      messageText: latest.message.mes,
    });
    if (!isFloorPanelTargetAddressable(messageFloorPanelState.target, currentTarget)) {
      setMessageFloorPanelError('目标楼层已变化，请重新生成');
      notifyStatus('目标楼层已变化，请重新生成', 'warning');
      return;
    }
    messageFloorPanelState.target = currentTarget;
  }
  try {
    let text = settings.lastGenerated || $t('#st-esg-preview').val();
    let anchorItems = Array.isArray(settings.lastGeneratedAnchorItems) ? settings.lastGeneratedAnchorItems : [];
    if (!text && !anchorItems.length) {
      await generateStatusbar('manual', targetMessageIndex);
      text = settings.lastGenerated || $t('#st-esg-preview').val();
      anchorItems = Array.isArray(settings.lastGeneratedAnchorItems) ? settings.lastGeneratedAnchorItems : [];
    }
    if (!text && !anchorItems.length) {
      logAutomaticGenerationStage('inject-skip', '没有可注入的生成内容');
      return;
    }
    let injectedText = '';
    const originalText = String(latest.message.mes ?? '');
    const swipeId = Number.isInteger(latest.message.swipe_id) ? latest.message.swipe_id : null;
    const hadSwipe = swipeId !== null && Array.isArray(latest.message.swipes);
    const originalSwipeText = hadSwipe ? String(latest.message.swipes[swipeId] ?? originalText) : '';
    logAutomaticGenerationStage('inject-snapshot', `message ${latest.index}; snapshot saved`);
    if (anchorItems.length) {
      const cleanedItems = anchorItems.map((item) => ({ ...item, content: cleanGeneratedText(item.content) }));
      const anchorResult = applyAnchorInsertions(originalText, cleanedItems);
      if (!anchorResult.applied.length) {
        if (anchorResult.disabled.length) {
          logAutomaticGenerationStage('inject-skip', '所有锚点项目均已标记为不注入');
          notifyStatus(`本次没有启用的锚点项目可注入${anchorResult.skipped.length ? `，另有 ${anchorResult.skipped.length} 项未匹配` : ''}。`, 'warning');
          return;
        }
        const details = anchorResult.skipped.map((entry) => entry.reason).join('；');
        throw new Error(`锚点插入失败：${details || '没有可用的唯一锚点'}`);
      }
      latest.message.mes = anchorResult.text;
      injectedText = anchorResult.applied.map((entry) => entry.item.content).join('\n');
      if (settings.statusPlaceholderEnabled && (containsStatusPlaceholder(originalText) || containsStatusPlaceholder(injectedText))) {
        latest.message.mes = normalizeStatusPlaceholder(latest.message.mes, true);
      }
      if (anchorResult.skipped.length || anchorResult.disabled.length) {
        const notices = [];
        if (anchorResult.disabled.length) notices.push(`排除 ${anchorResult.disabled.length} 项`);
        if (anchorResult.skipped.length) notices.push(`跳过 ${anchorResult.skipped.length} 个无效锚点`);
        notifyStatus(`已注入 ${anchorResult.applied.length} 项，${notices.join('，')}`, 'warning');
      }
    } else {
      injectedText = cleanGeneratedText(text);
      injectStatusbar(latest.message, injectedText, settings.injectMode);
    }
    if (Array.isArray(latest.message.swipes) && Number.isInteger(latest.message.swipe_id)) latest.message.swipes[latest.message.swipe_id] = latest.message.mes;
    let mvuReprocessed = false;
    if (settings.mvuReprocessOnInject && containsMvuUpdateVariable(injectedText)) {
      logAutomaticGenerationStage('mvu-reprocess', 'UpdateVariable detected');
      try {
        mvuReprocessed = await reprocessMvuVariables(context, latest.index);
      } catch (error) {
        console.warn(`[${EXTENSION_ID}] failed to reprocess MVU variables after injection`, error);
      }
    }
    latestInjectionUndoSnapshot = latest.index === context.chat.length - 1
      ? createInjectionUndoSnapshot({
        targetIndex: latest.index,
        chatLength: context.chat.length,
        originalText,
        injectedText: latest.message.mes,
        swipeId,
        hadSwipe,
        originalSwipeText,
        injectedSwipeText: hadSwipe ? String(latest.message.swipes[swipeId] ?? latest.message.mes) : '',
        mvuReprocessed,
      })
      : null;
    refreshInjectionUndoState();
    context.updateMessageBlock(latest.index, latest.message);
    const messageUpdatedEvent = context.eventTypes?.MESSAGE_UPDATED;
    if (messageUpdatedEvent && context.eventSource?.emit) {
      await context.eventSource.emit(messageUpdatedEvent, latest.index);
    }
    try {
      logAutomaticGenerationStage('chat-save', 'saving injected chat');
      const saveResult = await context.saveChat();
      if (saveResult === false) throw new Error('聊天保存接口返回失败');
      notifyStatus('已注入到最新助手回复。');
      logAutomaticGenerationStage('inject-finished', 'injection complete');
    } catch (saveError) {
      logAutomaticGenerationStage('inject-save-warning', 'injection complete, chat save failed');
      notifyStatus('已注入，但聊天保存失败，刷新后可能丢失。', 'warning');
    }
    setFloatingBallVisualState('idle');
    syncMessageFloorPanelResult({ status: FLOOR_PANEL_STATUS.INJECTED });
  } catch (error) {
    logAutomaticGenerationStage('inject-error', error?.message || 'injection failed');
    recordGenerationError('注入', error);
    notifyStatus(error?.message || '注入失败。', 'error');
  }
}

function refreshInjectionUndoState() {
  const context = getContext();
  const validation = validateInjectionUndoSnapshot(latestInjectionUndoSnapshot, context.chat);
  if (!validation.valid) latestInjectionUndoSnapshot = null;
  $t('#st-esg-undo-injection').toggleClass('st-esg-hidden', !validation.valid);
  return validation;
}

function clearInjectionUndoSnapshot() {
  latestInjectionUndoSnapshot = null;
  refreshInjectionUndoState();
}

async function restoreLatestInjection({ requireConfirmation = false, targetMessageIndex = null } = {}) {
  let context = getContext();
  logAutomaticGenerationStage('undo-start');
  let validation = refreshInjectionUndoState();
  if (!validation.valid || (targetMessageIndex !== null && latestInjectionUndoSnapshot?.targetIndex !== targetMessageIndex)) {
    logAutomaticGenerationStage('undo-skip', validation.reason || 'invalid snapshot');
    if (requireConfirmation) notifyStatus('本次注入已不在最新楼层，或消息内容已经变化，无法安全撤回。', 'warning');
    return false;
  }
  if (requireConfirmation && !targetWindow.confirm('撤回本次注入？\n\n将把最新一条助手回复恢复到注入前的完整内容，本次注入结果会被移除。')) return false;

  context = getContext();
  validation = validateInjectionUndoSnapshot(latestInjectionUndoSnapshot, context.chat);
  if (!validation.valid || (targetMessageIndex !== null && latestInjectionUndoSnapshot?.targetIndex !== targetMessageIndex)) {
    logAutomaticGenerationStage('undo-skip', 'message changed during confirmation');
    clearInjectionUndoSnapshot();
    if (requireConfirmation) notifyStatus('确认期间消息发生了变化，已取消撤回。', 'warning');
    return false;
  }

  const snapshot = latestInjectionUndoSnapshot;
  logAutomaticGenerationStage('undo-restore', `message ${snapshot.targetIndex}`);
  const message = validation.message;
  message.mes = snapshot.originalText;
  if (snapshot.hadSwipe && snapshot.swipeId !== null && Array.isArray(message.swipes)) {
    message.swipes[snapshot.swipeId] = snapshot.originalSwipeText;
  }
  latestInjectionUndoSnapshot = null;
  refreshInjectionUndoState();

  if (snapshot.mvuReprocessed) {
    try {
      await reprocessMvuVariables(context, snapshot.targetIndex);
    } catch (error) {
      console.warn(`[${EXTENSION_ID}] failed to reprocess MVU variables after undo`, error);
    }
  }

  context.updateMessageBlock(snapshot.targetIndex, message);
  const messageUpdatedEvent = context.eventTypes?.MESSAGE_UPDATED;
  if (messageUpdatedEvent && context.eventSource?.emit) {
    await context.eventSource.emit(messageUpdatedEvent, snapshot.targetIndex);
  }
  try {
    const saveResult = await context.saveChat();
    if (saveResult === false) throw new Error('聊天保存接口返回失败');
    if (requireConfirmation) notifyStatus('已撤回本次注入，最新回复已恢复。');
  } catch (saveError) {
    notifyStatus('已恢复注入前内容，但聊天保存失败，刷新后可能丢失。', 'warning');
    logAutomaticGenerationStage('undo-save-warning', 'restore complete, chat save failed');
  }
  logAutomaticGenerationStage('undo-finished', 'undo complete');
  if (settings.messageFloorPanelEnabled && messageFloorPanelState.target?.messageIndex === snapshot.targetIndex) {
    syncMessageFloorPanelResult({ status: FLOOR_PANEL_STATUS.READY });
  }
  return true;
}

async function undoLatestInjection() {
  await restoreLatestInjection({ requireConfirmation: true });
}

function registerInjectionUndoInvalidation(context) {
  const bind = (eventName, handler) => {
    const eventType = context.eventTypes?.[eventName];
    if (eventType && context.eventSource?.on) context.eventSource.on(eventType, handler);
  };
  ['MESSAGE_SENT', 'MESSAGE_RECEIVED', 'MESSAGE_EDITED', 'MESSAGE_UPDATED', 'MESSAGE_DELETED', 'MESSAGE_SWIPED', 'MESSAGE_SWIPE_DELETED'].forEach((eventName) => {
    bind(eventName, () => {
      if (eventName === 'MESSAGE_SENT' || eventName === 'MESSAGE_RECEIVED') clearInjectionUndoSnapshot();
      else refreshInjectionUndoState();
    });
  });
  bind('CHAT_CHANGED', clearInjectionUndoSnapshot);
}

function registerMessageFloorPanelEvents(context) {
  const bind = (eventName) => {
    const eventType = context.eventTypes?.[eventName];
    if (eventType && context.eventSource?.on) context.eventSource.on(eventType, () => {
      refreshMessageFloorPanelTarget();
      scheduleMessageFloorPanelRefresh();
    });
  };
  ['MESSAGE_SENT', 'MESSAGE_RECEIVED', 'MESSAGE_EDITED', 'MESSAGE_UPDATED', 'MESSAGE_DELETED', 'MESSAGE_SWIPED', 'MESSAGE_SWIPE_DELETED', 'CHARACTER_MESSAGE_RENDERED'].forEach(bind);
  const chatChanged = context.eventTypes?.CHAT_CHANGED;
  if (chatChanged && context.eventSource?.on) context.eventSource.on(chatChanged, () => {
    messageFloorPanelState = createFloorPanelState({ enabled: settings.messageFloorPanelEnabled });
    removeMessageFloorPanels();
    refreshMessageFloorPanelTarget();
    scheduleMessageFloorPanelRefresh();
  });
}

function invalidatePendingAutomaticGeneration({ abortActive = false } = {}) {
  automaticGenerationRevision += 1;
  pendingAutomaticTargets.clear();
  if (automaticGenerationEndTimer !== null) {
    targetWindow.clearTimeout(automaticGenerationEndTimer);
    automaticGenerationEndTimer = null;
  }
  if (abortActive && activeAutomaticTarget && generationAbortController) generationAbortController.abort();
}

function seedLastAutomaticTargetFromCurrentChat() {
  const context = getContext();
  const latest = getLatestAssistantMessage(context.chat);
  const target = latest
    ? resolveReadyAutomaticAssistantTarget({ messageIndex: latest.index }, context.chat)
    : null;
  lastAutomaticTargetKey = getAutomaticAssistantTargetKey(target);
}

function buildAutomaticGenerationWaitDiagnostics(target, chat) {
  const targetIndex = Number(target?.messageIndex);
  const targetMessage = Number.isInteger(targetIndex) ? chat?.[targetIndex] : null;
  const latestAssistant = getLatestAssistantMessage(chat);
  return [
    `目标楼层=${Number.isInteger(targetIndex) ? targetIndex : '无'}`,
    `最新 assistant=${latestAssistant?.index ?? '无'}`,
    `正文存在=${String(targetMessage?.mes || '').trim() ? '是' : '否'}`,
    `已有外置生成=${generationAbortController ? '是' : '否'}`,
  ].join('，');
}

async function runDeferredAutomaticGeneration(pendingTarget, revision, attempt = 0) {
  const context = getContext();
  if (!settings.autoGenerate || revision !== automaticGenerationRevision) return;
  const readyTarget = resolveReadyAutomaticAssistantTarget(pendingTarget, context.chat);
  if (!readyTarget || generationAbortController) {
    if (attempt === 0) logAutomaticGenerationStage('等待渲染', '最新 assistant 尚未可用或已有外置生成');
    if (attempt < 400) {
      targetWindow.setTimeout(() => {
        void runDeferredAutomaticGeneration(pendingTarget, revision, attempt + 1);
      }, 25);
    } else {
      logAutomaticGenerationStage('generation-skip', `等待最新 assistant 超时；${buildAutomaticGenerationWaitDiagnostics(pendingTarget, context.chat)}`);
    }
    return;
  }
  const targetKey = getAutomaticAssistantTargetKey(readyTarget);
  if (!targetKey || targetKey === lastAutomaticTargetKey) {
    logAutomaticGenerationStage('跳过重复', `楼层 ${readyTarget.messageIndex}`);
    return;
  }
  const triggerText = String(settings.automaticGenerationTriggerText ?? '');
  if (!matchesAutomaticGenerationTrigger(readyTarget.messageText, triggerText)) {
    logAutomaticGenerationStage('等待触发字符串', `楼层 ${readyTarget.messageIndex}；未检测到“${triggerText}”`);
    return;
  }
  lastAutomaticTargetKey = targetKey;
  logAutomaticGenerationStage('找到 assistant', `楼层 ${readyTarget.messageIndex}`);
  await generateStatusbar('automatic', readyTarget.messageIndex, readyTarget);
}

async function runGenerationEndedAutomaticGeneration(baseline, revision, attempt = 0) {
  const context = getContext();
  if (!settings.autoGenerate || revision !== automaticGenerationRevision) return;
  if (!baseline) {
    logAutomaticGenerationStage('generation-skip', '没有匹配的正文生成开始事件');
    return;
  }
  if (generationAbortController) {
    if (attempt < 20) {
      automaticGenerationEndTimer = targetWindow.setTimeout(() => {
        automaticGenerationEndTimer = null;
        void runGenerationEndedAutomaticGeneration(baseline, revision, attempt + 1);
      }, 100);
    } else {
      logAutomaticGenerationStage('generation-skip', `等待当前外置生成结束超时；${buildAutomaticGenerationWaitDiagnostics(null, context.chat)}`);
    }
    return;
  }

  const latest = getLatestAssistantMessage(context.chat);
  const pendingTarget = latest ? captureAutomaticAssistantTarget(latest.index, context.chat) : null;
  const readyTarget = pendingTarget
    ? resolveReadyAutomaticAssistantTarget(pendingTarget, context.chat)
    : null;
  if (!readyTarget || !isAutomaticTargetAfterGenerationStart(readyTarget, baseline)) {
    if (attempt === 0) logAutomaticGenerationStage('等待结束结果', '最新 assistant 尚未可用或不是本轮正文');
    if (attempt < 20) {
      automaticGenerationEndTimer = targetWindow.setTimeout(() => {
        automaticGenerationEndTimer = null;
        void runGenerationEndedAutomaticGeneration(baseline, revision, attempt + 1);
      }, 100);
    } else {
      logAutomaticGenerationStage('generation-skip', `等待最新 assistant 超时；${buildAutomaticGenerationWaitDiagnostics(pendingTarget, context.chat)}`);
    }
    return;
  }

  const targetKey = getAutomaticAssistantTargetKey(readyTarget);
  if (!targetKey || targetKey === lastAutomaticTargetKey) {
    logAutomaticGenerationStage('跳过重复', `楼层 ${readyTarget?.messageIndex ?? '未知'}`);
    return;
  }
  const triggerText = String(settings.automaticGenerationTriggerText ?? '');
  if (!matchesAutomaticGenerationTrigger(readyTarget.messageText, triggerText)) {
    const triggerPreview = triggerText.length > 30 ? `${triggerText.slice(0, 30)}…` : triggerText;
    logAutomaticGenerationStage('generation-skip', `楼层 ${readyTarget.messageIndex}；未检测到触发字符串“${triggerText}”`);
    notifyStatus(`未检测到触发字符串“${triggerPreview}”，已跳过本轮自动生成。`, 'warning');
    return;
  }
  lastAutomaticTargetKey = targetKey;
  logAutomaticGenerationStage('找到 assistant', `楼层 ${readyTarget.messageIndex}`);
  await generateStatusbar('automatic', readyTarget.messageIndex, readyTarget);
}

function handleGenerationStarted() {
  if (generationAbortController) {
    stopAnimaWorldbookCapture();
    return;
  }
  if (isAnimaWorldbookEnabled()) void captureAnimaWorldbookSnapshot();
  else stopAnimaWorldbookCapture();
  if (!settings.autoGenerate) return;
  automaticGenerationLogActive = false;
  logAutomaticGenerationStage('generation-started');
  invalidatePendingAutomaticGeneration();
  automaticGenerationBaseline = captureAutomaticGenerationBaseline(getContext().chat);
}

function handleGenerationEnded() {
  stopAnimaWorldbookCapture();
  if (!settings.autoGenerate || generationAbortController) return;
  if (!automaticGenerationLogActive) clearAutomaticGenerationLog();
  logAutomaticGenerationStage('generation-ended', '等待 500ms 检查最终消息');
  const baseline = automaticGenerationBaseline;
  automaticGenerationBaseline = null;
  if (!baseline) {
    logAutomaticGenerationStage('generation-skip', '没有匹配的正文生成开始事件');
    return;
  }
  const revision = automaticGenerationRevision;
  if (automaticGenerationEndTimer !== null) targetWindow.clearTimeout(automaticGenerationEndTimer);
  automaticGenerationEndTimer = targetWindow.setTimeout(() => {
    automaticGenerationEndTimer = null;
    void runGenerationEndedAutomaticGeneration(baseline, revision);
  }, 500);
}

function handleGenerationStopped() {
  stopAnimaWorldbookCapture();
}

function handleAssistantMessageReceived(messageId, messageType) {
  const context = getContext();
  if (!settings.autoGenerate) return;
  if (!isAutomaticAssistantMessageTypeEligible(messageType)) return;
  const pendingTarget = captureAutomaticAssistantTarget(messageId, context.chat);
  if (!pendingTarget) return;
  clearAutomaticGenerationLog();
  logAutomaticGenerationStage('message-received', `楼层 ${pendingTarget.messageIndex}`);
  invalidatePendingAutomaticGeneration();
  const revision = automaticGenerationRevision;
  pendingAutomaticTargets.set(pendingTarget.messageIndex, { pendingTarget, revision });
}

function handleAssistantMessageRendered(messageId) {
  const messageIndex = Number(messageId);
  const pending = pendingAutomaticTargets.get(messageIndex);
  if (!pending) return;
  logAutomaticGenerationStage('message-rendered', `楼层 ${messageIndex}`);
  pendingAutomaticTargets.delete(messageIndex);
  targetWindow.setTimeout(() => {
    void runDeferredAutomaticGeneration(pending.pendingTarget, pending.revision);
  }, 0);
}

function setStatus(text, { silent = false } = {}) {
  $t('#st-esg-status').text(text);
  if (!silent && !/^(正在|已同步|已列出|已加载 .+：)/.test(String(text || ''))) showOperationNotice(text);
}

function notifyStatus(text, tone = 'success') {
  $t('#st-esg-status').text(text);
  showOperationNotice(text, tone);
}

function showOperationNotice(text, tone = 'success') {
  const toastr = targetWindow.toastr || window.toastr;
  const method = getNotificationMethod(tone);
  if (typeof toastr?.[method] !== 'function') return;
  toastr[method](String(text || ''), '', { timeOut: 2200, extendedTimeOut: 600, preventDuplicates: true });
}

function recordGenerationError(action, error) {
  settings.lastGenerationError = createGenerationErrorRecord(action, error);
  setFloatingBallVisualState('error');
  saveSettings();
  renderGenerationResultPanel();
  setMessageFloorPanelError(error);
}

function renderGenerationResultPanel() {
  const error = settings.lastGenerationError;
  const preview = $t('#st-esg-preview');
  const thinking = $t('#st-esg-thinking-panel');
  const panel = $t('#st-esg-generation-error');
  if (!preview.length || !panel.length) return;
  renderAnchorInsertionPlan(settings.lastGeneratedAnchorItems || [], settings.lastGeneratedAnchorWarnings || []);
  preview.toggleClass('st-esg-hidden', Boolean(error) || settings.lastGeneratedResultMode === 'anchor');
  thinking.toggleClass('st-esg-hidden', Boolean(error) || !lastGeneratedThinking.length);
  if (!error) {
    panel.empty().addClass('st-esg-hidden');
    resizeGeneratedPreview();
    return;
  }
  const createdAt = new Date(error.createdAt).toLocaleString('zh-CN', { hour12: false });
  panel.html(`<div class="st-esg-error-meta">${escapeHtml(error.action)}失败 · ${escapeHtml(createdAt)}</div><pre>${escapeHtml(error.message)}</pre><button id="st-esg-show-generated-content" class="menu_button menu_button_icon st-esg-secondary-action" type="button"><i class="fa-solid fa-arrow-left"></i><span>返回</span></button>`).removeClass('st-esg-hidden');
}

async function copyTextToClipboard(text) {
  const value = String(text || '');
  if (!value) return false;
  try {
    await targetWindow.navigator?.clipboard?.writeText?.(value);
    return true;
  } catch (_) {
    const field = targetDoc.createElement('textarea');
    field.value = value;
    field.style.position = 'fixed';
    field.style.opacity = '0';
    targetDoc.body.appendChild(field);
    field.focus();
    field.select();
    setTimeout(() => field.remove(), 0);
    return false;
  }
}

function renderPromptLog() {
  const hiddenField = $t('#st-esg-prompt-log');
  const summaryBox = $t('#st-esg-prompt-log-summary');
  const viewBox = $t('#st-esg-prompt-log-view');
  if (!summaryBox.length || !viewBox.length) return;
  hiddenField.val('');
  if (promptLogBuilding) {
    summaryBox.html('<span>正在组装本次提示词…</span>');
    viewBox.html('<div class="st-esg-empty st-esg-empty-small">正在读取本次生成所需的聊天记录、预设和世界书，组装完成后会立即显示最终提示词。</div>');
    return;
  }
  if (!lastPromptLogText) {
    summaryBox.html('<span>暂无提示词查看记录</span>');
    viewBox.html('<div class="st-esg-empty st-esg-empty-small">生成一次组件后，这里会按消息分栏显示最终发送给 API 的提示词。</div>');
    return;
  }
  const viewModel = createPromptLogViewModel(lastPromptLogText);
  summaryBox.html([
    `<span>模型：${escapeHtml(viewModel.summary.model || '未知')}</span>`,
    `<span>${viewModel.summary.messageCount} 条消息</span>`,
    `<span>${escapeHtml(viewModel.summary.tokenEstimateLabel)}</span>`,
    viewModel.summary.compressedSystemMessages ? '<span>已压缩 system</span>' : '',
    viewModel.summary.promptTemplateCompat.status === 'disabled'
      ? '<span>模板兼容：关闭</span>'
      : viewModel.summary.promptTemplateCompat.status === 'rendered'
        ? `<span>模板兼容：已执行，替换 ${viewModel.summary.promptTemplateCompat.changedCount} 处</span>`
        : '<span>模板兼容：已执行，无可替换模板</span>',
  ].filter(Boolean).join(''));
  viewBox.html(viewModel.messages.map((message) => {
    const roleClass = ['system', 'assistant', 'user'].includes(message.role) ? message.role : 'other';
    return `<details class="st-esg-prompt-message st-esg-prompt-role-${roleClass}" data-message-index="${message.index}"><summary><span>${escapeHtml(message.role)}</span><em>${escapeHtml(message.tokenEstimateLabel)}</em><button class="menu_button st-esg-copy-message" type="button" data-message-index="${message.index}" title="复制本条"><i class="fa-solid fa-copy"></i></button></summary><pre data-message-index="${message.index}"></pre></details>`;
  }).join('') || '<div class="st-esg-empty st-esg-empty-small">日志里没有 messages。</div>');
  const hydrateMessagePreview = (index) => {
    const message = viewModel.messages[Number(index)];
    const pre = $t(`.st-esg-prompt-message pre[data-message-index="${Number(index)}"]`);
    if (!pre.length || pre.data('hydrated')) return;
    pre.text(message?.content || '');
    pre.data('hydrated', true);
  };
  $t('.st-esg-prompt-message').on('toggle', function () {
    if (this.open) hydrateMessagePreview($(this).data('message-index'));
  });
  $t('.st-esg-copy-message').on('click', async function (event) {
    event.preventDefault();
    event.stopPropagation();
    const message = viewModel.messages[Number($(this).data('message-index'))];
    const copied = await copyTextToClipboard(message?.content || '');
    setStatus(copied ? '已复制本条提示词。' : '已选中本条提示词，可以手动复制。');
  });
}

function beginPromptLogBuild() {
  lastPromptLogText = '';
  settings.lastPromptLog = '';
  promptLogBuilding = true;
  renderPromptLogIfVisible();
}

function renderModelOptions() {
  const options = Array.isArray(settings.apiModelOptions) ? settings.apiModelOptions : [];
  const input = $t('#st-esg-api-model');
  const picker = $t('#st-esg-api-model-picker');
  $t('#st-esg-model-options').html(options.map((model) => `<option value="${escapeHtml(model)}"></option>`).join(''));
  if (options.length && picker.length) {
    const currentModel = textOf(settings.apiModel);
    const usingManualModel = currentModel && !options.includes(currentModel);
    picker.html(`${options.map((model) => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`).join('')}<option value="__manual__">手动填写模型名称</option>`);
    picker.val(usingManualModel ? '__manual__' : (currentModel || options[0]));
    picker.toggle(!usingManualModel);
    input.toggle(usingManualModel);
  } else {
    picker.hide();
    input.show();
  }
  $t('#st-esg-api-model-feedback').text(options.length ? `已拉取 ${options.length} 个模型，可在模型名称中选择或继续手动填写。` : '');
}

const TAG_RULE_CONFIG = {
  history: { setting: 'historyCleanupTags', title: '聊天记录清理', description: '拼接提示词前，从聊天历史中移除匹配标签包裹的内容。' },
  output: { setting: 'outputCleanupTags', title: '生成内容剥离', description: '生成结果中的匹配区块会单独显示为思维链，并从注入正文中剥离。' },
};

function getTagRuleEntries(type) {
  if (type === 'history') return settings.historyCleanupRules;
  const key = TAG_RULE_CONFIG[type]?.setting;
  return String(settings[key] || '').split('\n').map((item) => item.trim()).filter(Boolean);
}

function saveTagRuleEntries(type, entries) {
  if (type === 'history') {
    settings.historyCleanupRules = entries
      .map((item) => typeof item === 'string' ? { rule: item, keep: 0 } : item)
      .map((item) => ({ rule: textOf(item?.rule), keep: Math.max(0, Math.floor(Number(item?.keep) || 0)) }))
      .filter((item) => item.rule);
    saveSettings();
    return;
  }
  const key = TAG_RULE_CONFIG[type]?.setting;
  settings[key] = entries.join('\n');
  saveSettings();
}

function buildTagRuleManager(type) {
  const config = TAG_RULE_CONFIG[type];
  const help = type === 'history'
    ? `${config.description} 普通标签匹配成对标签；正则匹配完整内容。\n“保留”只作用于当前规则，表示最近保留多少条角色回复不执行清理；填 0 表示不保留。\n仅计数角色回复（assistant），用户和 system 消息不计数。`
    : `${config.description} 普通标签匹配成对标签；正则匹配完整内容。`;
  return `<div class="st-esg-tag-rule-manager" data-tag-rule-type="${type}"><div class="st-esg-tag-rule-head"><span>${config.title}</span><i class="fa-solid fa-circle-question" title="${help}"></i></div><div class="st-esg-tag-rule-add"><select id="st-esg-${type}-rule-mode" class="text_pole"><option value="tag">标签</option><option value="regex">正则</option></select><input id="st-esg-${type}-rule-input" class="text_pole" type="text" placeholder="thinking" /><button id="st-esg-${type}-rule-add" class="menu_button st-esg-secondary-action st-esg-tag-rule-add-button" type="button" title="添加规则"><i class="fa-solid fa-plus"></i></button></div><div id="st-esg-${type}-rule-list" class="st-esg-tag-rule-list"></div></div>`;
}

function renderTagRuleManager(type) {
  const list = $t(`#st-esg-${type}-rule-list`);
  if (!list.length) return;
  const entries = getTagRuleEntries(type);
  list.html(entries.map((rawEntry, index) => {
    const entry = type === 'history' ? rawEntry.rule : rawEntry;
    const isRegex = entry.startsWith('re:');
    const display = isRegex ? entry.slice(3) : `<${entry}>...</${entry}>`;
    const keep = type === 'history' ? `<span class="st-esg-history-rule-keep">保留 <input class="text_pole" type="number" min="0" step="1" value="${rawEntry.keep}" data-rule-index="${index}" /></span>` : '';
    return `<div class="st-esg-tag-rule-item ${type === 'history' ? 'st-esg-history-tag-rule-item' : ''}"><span class="st-esg-tag-rule-kind">${isRegex ? '正则' : '标签'}</span><code>${escapeHtml(display)}</code>${keep}<button class="menu_button st-esg-tag-rule-delete" type="button" data-rule-index="${index}" title="删除规则"><i class="fa-solid fa-trash"></i></button></div>`;
  }).join('') || '<div class="st-esg-tag-rule-empty">尚未添加规则</div>');
}

function addTagRule(type) {
  const input = $t(`#st-esg-${type}-rule-input`);
  const mode = String($t(`#st-esg-${type}-rule-mode`).val() || 'tag');
  let value = String(input.val() || '').trim();
  if (!value) return;
  if (mode === 'tag') {
    if (!/^[^\s<>/]+$/u.test(value)) { setStatus('标签名不能包含空白、尖括号或斜杠。'); return; }
  } else {
    value = value.startsWith('re:') ? value.slice(3) : value;
    try { new RegExp(value, 'gi'); } catch { setStatus('正则表达式无效。'); return; }
    value = `re:${value}`;
  }
  const entries = getTagRuleEntries(type);
  if (type === 'history') {
    if (!entries.some((item) => item.rule === value)) entries.push({ rule: value, keep: 0 });
  } else if (!entries.includes(value)) entries.push(value);
  saveTagRuleEntries(type, entries);
  input.val('');
  renderTagRuleManager(type);
}

function exportTagCleanupRules() {
  const bundle = createTagCleanupExportPackage({
    historyRules: getTagRuleEntries('history'),
    outputRules: getTagRuleEntries('output'),
  });
  downloadJsonFile('织幕-标签清理规则.json', bundle);
  notifyStatus('已导出标签清理规则。');
}

async function importTagCleanupRules(file) {
  if (!file) return;
  try {
    const bundle = JSON.parse(await file.text());
    const merged = mergeTagCleanupImport(bundle, {
      historyRules: getTagRuleEntries('history'),
      outputRules: getTagRuleEntries('output'),
    });
    settings.historyCleanupRules = merged.historyRules;
    settings.outputCleanupTags = merged.outputRules.join('\n');
    saveSettings();
    renderTagRuleManager('history');
    renderTagRuleManager('output');
    notifyStatus(buildTagCleanupImportSummary(merged));
  } catch (error) {
    notifyStatus(`导入失败：${error?.message || '文件内容不正确。'}`, 'error');
  }
}

async function fetchApiModels() {
  const modelsUrl = normalizeModelsUrl(settings.apiUrl);
  if (!modelsUrl) {
    const message = '请先填写 API 地址。';
    $t('#st-esg-api-model-feedback').text(message);
    setStatus(message);
    return;
  }
  $t('#st-esg-api-model-feedback').text('正在拉取模型列表...');
  setStatus('正在拉取模型列表……');
  try {
    const additional = parseApiAdditionalParameters(settings, await getYamlParser());
    const apiBaseUrl = modelsUrl.replace(/\/models$/i, '');
    const customHeadersYaml = serializeRequestHeadersYaml({
      ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
      ...additional.additionalHeaders,
    });
    const response = await fetch('/api/backends/chat-completions/status', {
      method: 'POST',
      headers: {
        ...getHostRequestHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reverse_proxy: apiBaseUrl,
        proxy_password: '',
        chat_completion_source: 'custom',
        custom_url: apiBaseUrl,
        custom_include_headers: customHeadersYaml,
      }),
    });
    if (!response.ok) throw new Error(`拉取模型失败：${response.status} ${(await response.text().catch(() => '')).slice(0, 160)}`);
    const models = extractModelIds(await response.json());
    if (!models.length) throw new Error('没有从接口返回中识别到模型。');
    settings.apiModelOptions = models;
    settings.apiModel = models[0];
    saveSettings();
    renderModelOptions();
    $t('#st-esg-api-model').val(settings.apiModel);
    setStatus(`已拉取 ${models.length} 个模型。`);
  } catch (error) {
    const message = error?.message || '拉取模型失败。';
    $t('#st-esg-api-model-feedback').text(message);
    setStatus(message);
  }
}

const SCHEME_CONFIG = {
  api: { listKey: 'apiSchemes', selectedKey: 'selectedApiSchemeId', label: 'API' },
  task: { listKey: 'taskSchemes', selectedKey: 'selectedTaskSchemeId', label: '任务指令' },
  preset: { listKey: 'presetSchemes', selectedKey: 'selectedPresetSchemeId', label: '预设' },
  worldbook: { listKey: 'worldbookSchemes', selectedKey: 'selectedWorldbookSchemeId', label: '世界书' },
  component: { listKey: 'componentSchemes', selectedKey: 'selectedComponentSchemeId', label: '组件库' },
};

function isWorldbookGroup(group) {
  return group?.scope === SOURCE_WORLDBOOK;
}

function renderSchemeManager(type) {
  const label = SCHEME_CONFIG[type]?.label || '方案';
  return `<div class="st-esg-scheme-group" data-scheme-type="${type}"><label class="st-esg-scheme-picker"><span>方案：</span><select id="st-esg-${type}-scheme" class="text_pole st-esg-scheme-select" data-scheme-type="${type}"></select></label><div class="st-esg-scheme-actions"><button class="st-esg-icon-btn st-esg-load-scheme" type="button" title="载入方案" aria-label="载入方案" data-scheme-type="${type}"><i class="fa-solid fa-download"></i></button><button class="st-esg-icon-btn st-esg-save-scheme-new" type="button" title="另存方案" aria-label="另存方案" data-scheme-type="${type}"><i class="fa-solid fa-plus"></i></button><button class="st-esg-icon-btn st-esg-overwrite-scheme" type="button" title="覆盖方案" aria-label="覆盖方案" data-scheme-type="${type}"><i class="fa-solid fa-file-pen"></i></button><button class="st-esg-icon-btn st-esg-delete-scheme st-esg-icon-danger" type="button" title="删除方案" aria-label="删除方案" data-scheme-type="${type}"><i class="fa-solid fa-trash"></i></button></div></div>`;
}

function renderApiRetrySettings() {
  return '<div class="st-esg-api-retry-settings"><div class="st-esg-api-retry-row"><span>失败重试次数：</span><input id="st-esg-api-retry-count" class="text_pole" type="number" min="0" max="10" step="1" inputmode="numeric" value="0" /><span>（为0时关闭自动重试）</span></div><div class="st-esg-api-retry-note">仅对临时网络错误、服务端错误和空响应进行重试；鉴权、配额、模型不存在等错误不会重试。</div></div>';
}

function getSchemeList(type) {
  const config = SCHEME_CONFIG[type];
  return config ? normalizeSchemeList(settings[config.listKey]) : [];
}

function setSchemeList(type, list) {
  const config = SCHEME_CONFIG[type];
  if (config) settings[config.listKey] = normalizeSchemeList(list);
}

function getSelectedSchemeId(type) {
  const config = SCHEME_CONFIG[type];
  return config ? textOf(settings[config.selectedKey]) : '';
}

function setSelectedSchemeId(type, id) {
  const config = SCHEME_CONFIG[type];
  if (config) settings[config.selectedKey] = textOf(id);
}

function getActiveSchemeId(type) {
  return textOf(settings.activeSchemeIds?.[type]);
}

function setActiveSchemeId(type, id) {
  if (!settings.activeSchemeIds || typeof settings.activeSchemeIds !== 'object') settings.activeSchemeIds = {};
  settings.activeSchemeIds[type] = textOf(id);
}

function renderCurrentScheme(type) {
  const id = getActiveSchemeId(type);
  const select = targetDoc.querySelector(`#st-esg-${type}-scheme`);
  if (!select) return;
  let current = targetDoc.querySelector(`#st-esg-${type}-current-scheme`);
  if (!current) {
    current = targetDoc.createElement('div');
    current.id = `st-esg-${type}-current-scheme`;
    current.className = 'st-esg-current-scheme';
    (select.closest('.st-esg-scheme-group') || select.closest('label'))?.append(current);
  }
  const label = settings.dirtySchemeTypes?.[type]
    ? '未保存方案'
    : id === WORLD_BOOK_FOLLOW_TAVERN
      ? '酒馆默认'
      : findScheme(getSchemeList(type), id)?.name || '未选择方案';
  current.textContent = `当前方案：${label}`;
}

function markSchemeDirty(type) {
  if (!SCHEME_CONFIG[type]) return;
  settings.dirtySchemeTypes[type] = true;
  renderSchemeOptions(type);
  saveSettings();
}

function markSchemeDirtyDeferred(type) {
  if (!SCHEME_CONFIG[type]) return;
  if (!settings.dirtySchemeTypes[type]) {
    settings.dirtySchemeTypes[type] = true;
    renderSchemeOptions(type);
  }
  scheduleSettingsSave();
}

function markSchemeClean(type, id) {
  setActiveSchemeId(type, id);
  settings.dirtySchemeTypes[type] = false;
  if (type === 'preset' && initialized) renderComponentList();
}

function getCurrentChatIdSafe(context = getContext()) {
  try {
    return textOf(context?.getCurrentChatId?.()) || textOf(context?.chatId);
  } catch (_) {
    return textOf(context?.chatId);
  }
}

function isCurrentChatGroup(context = getContext()) {
  return Boolean(context?.groupId || context?.group?.id || targetWindow?.selected_group);
}

function getCurrentChatMetadata(context = getContext()) {
  const metadata = context?.chatMetadata || context?.chat_metadata || targetWindow?.chat_metadata;
  return metadata && typeof metadata === 'object' ? metadata : null;
}

async function persistCurrentChatMetadata(context = getContext()) {
  if (typeof context?.saveMetadata === 'function') await context.saveMetadata();
  else if (typeof context?.saveMetadataDebounced === 'function') context.saveMetadataDebounced();
  else if (typeof context?.saveChat === 'function') await context.saveChat();
}

function getAvailableCharacterNames(context = getContext()) {
  return (Array.isArray(context?.characters) ? context.characters : [])
    .map((character) => textOf(character?.name || character?.data?.name))
    .filter(Boolean);
}

let chatWorldbookRestoreQueue = Promise.resolve();

async function applyWorldbookSchemeToCurrentChat() {
  const activeId = getActiveSchemeId('worldbook');
  const selectedId = getSelectedSchemeId('worldbook');
  if (!activeId || activeId === WORLD_BOOK_FOLLOW_TAVERN) {
    notifyStatus('请先将当前世界书配置保存为方案，再应用到当前聊天。', 'warning');
    return;
  }
  if (settings.dirtySchemeTypes?.worldbook) {
    notifyStatus('当前世界书配置尚未保存，请先保存方案。', 'warning');
    return;
  }
  if (selectedId !== activeId) {
    notifyStatus('当前选择的世界书方案尚未载入，请先载入方案，再应用到当前聊天。', 'warning');
    return;
  }
  const scheme = findScheme(getSchemeList('worldbook'), activeId);
  if (!scheme) {
    notifyStatus('找不到当前世界书方案，请重新保存后再试。', 'error');
    return;
  }
  const context = getContext();
  if (isCurrentChatGroup(context)) {
    notifyStatus('当前版本暂不支持为群聊绑定世界书方案。', 'warning');
    return;
  }
  const chatId = getCurrentChatIdSafe(context);
  const metadata = getCurrentChatMetadata(context);
  if (!chatId || !metadata) {
    notifyStatus('当前没有可绑定的聊天。', 'warning');
    return;
  }
  setChatWorldbookSchemeId(metadata, activeId);
  settings.chatWorldbookBindings = upsertChatBindingIndex(settings.chatWorldbookBindings, {
    chatId,
    chatName: chatId,
    characterName: getCurrentCharacterNameSafe(context),
    schemeId: activeId,
    schemeName: scheme.name,
    updatedAt: Date.now(),
  });
  await persistCurrentChatMetadata(context);
  saveSettings();
  renderDataManagement();
  notifyStatus(`已将世界书方案“${scheme.name}”应用到当前聊天。`);
}

function restoreBoundWorldbookSchemeForCurrentChat() {
  chatWorldbookRestoreQueue = chatWorldbookRestoreQueue
    .catch(() => {})
    .then(() => restoreBoundWorldbookSchemeForCurrentChatNow());
  return chatWorldbookRestoreQueue;
}

async function restoreBoundWorldbookSchemeForCurrentChatNow() {
  const context = getContext();
  if (isCurrentChatGroup(context)) return;
  const chatId = getCurrentChatIdSafe(context);
  if (!chatId) return;
  const metadata = getCurrentChatMetadata(context);
  const binding = resolveChatBinding({
    metadataSchemeId: getChatWorldbookSchemeId(metadata),
    index: settings.chatWorldbookBindings,
    chatId,
  });
  if (binding.status === 'cancelled') {
    if (chatId !== getCurrentChatIdSafe()) return;
    if (metadata && getChatWorldbookSchemeId(metadata)) {
      setChatWorldbookSchemeId(metadata, '');
      await persistCurrentChatMetadata(context);
    }
    return;
  }
  if (binding.status !== 'bound') return;
  const scheme = findScheme(getSchemeList('worldbook'), binding.schemeId);
  if (!scheme) {
    renderDataManagement();
    return;
  }
  if (chatId !== getCurrentChatIdSafe()) return;
  if (getActiveSchemeId('worldbook') === scheme.id && !settings.dirtySchemeTypes?.worldbook) return;
  try {
    setSelectedSchemeId('worldbook', scheme.id);
    await applyScheme('worldbook', scheme.snapshot || {});
    markSchemeClean('worldbook', scheme.id);
    saveSettings();
    renderSchemeOptions('worldbook');
    notifyStatus(`已按当前聊天载入世界书方案：${scheme.name}`);
  } catch (error) {
    notifyStatus(`自动载入当前聊天的世界书方案失败：${error?.message || '未知错误'}`, 'error');
  }
}

function requestTextInputDialog({ title, label, placeholder = '', value = '', options = null }) {
  return new Promise((resolve) => {
    const dialog = targetDoc.createElement('dialog');
    dialog.className = `st-esg-scheme-name-dialog ${getThemeClassName(settings.theme)}`;
    const field = Array.isArray(options)
      ? `<select class="text_pole" name="text-input">${options.map((option) => `<option value="${escapeHtml(option.value)}" ${textOf(option.value) === textOf(value) ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select>`
      : `<input class="text_pole" type="text" name="text-input" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(value)}" />`;
    dialog.innerHTML = `<form method="dialog"><div class="st-esg-card-title">${escapeHtml(title)}</div><label>${escapeHtml(label)}${field}</label><div class="st-esg-actions-row"><button class="menu_button st-esg-secondary-action" type="button" data-text-input-cancel>取消</button><button class="menu_button st-esg-primary-action" type="submit">确定</button></div></form>`;
    const form = dialog.querySelector('form');
    const input = dialog.querySelector('[name="text-input"]');
    const finish = (value) => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      dialog.remove();
      resolve(textOf(value));
    };
    form.addEventListener('submit', (event) => { event.preventDefault(); finish(input.value); });
    dialog.querySelector('[data-text-input-cancel]').addEventListener('click', () => finish(''));
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(''); });
    targetDoc.body.appendChild(dialog);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    input.focus();
    input.select?.();
  });
}

function renderApiAdditionalParameterError(dialog, error) {
  dialog.querySelectorAll('[data-api-parameter-error]').forEach((element) => {
    element.textContent = '';
  });
  const field = textOf(error?.field);
  const errorElement = dialog.querySelector(`[data-api-parameter-error="${field}"]`)
    || dialog.querySelector('[data-api-parameter-error="general"]');
  if (errorElement) errorElement.textContent = error?.message || '附加参数格式不正确，请检查后重试。';
}

function showApiAdditionalParametersDialog() {
  targetDoc.getElementById('st-esg-api-additional-dialog')?.remove();
  const dialog = targetDoc.createElement('dialog');
  dialog.id = 'st-esg-api-additional-dialog';
  dialog.className = `st-esg-api-additional-dialog ${getThemeClassName(settings.theme)}`;
  dialog.innerHTML = `
    <form>
      <header class="st-esg-api-additional-header">
        <div>
          <div class="st-esg-card-title">附加参数</div>
          <div class="st-esg-card-desc">使用 YAML 添加或排除请求参数，也可以加入自定义请求头。</div>
        </div>
        <button class="st-esg-icon-btn" type="button" data-api-additional-close aria-label="关闭附加参数"><i class="fa-solid fa-xmark"></i></button>
      </header>
      <div class="st-esg-api-additional-body">
        <section>
          <label for="st-esg-api-include-body">追加请求体参数</label>
          <p>合并到 API 请求体中；同名字段会覆盖温度、最大 Token 等基础值。</p>
          <textarea id="st-esg-api-include-body" class="text_pole" spellcheck="false" placeholder="top_p: 0.9&#10;frequency_penalty: 0"></textarea>
          <div class="st-esg-api-parameter-error" data-api-parameter-error="追加请求体参数" role="alert"></div>
        </section>
        <section>
          <label for="st-esg-api-exclude-body">排除请求体参数</label>
          <p>填写字段名列表；这些字段会在请求发送前从请求体中移除。</p>
          <textarea id="st-esg-api-exclude-body" class="text_pole" spellcheck="false" placeholder="- frequency_penalty&#10;- presence_penalty"></textarea>
          <div class="st-esg-api-parameter-error" data-api-parameter-error="排除请求体参数" role="alert"></div>
        </section>
        <section>
          <label for="st-esg-api-include-headers">追加请求头</label>
          <p>会用于生成请求和拉取模型请求。敏感值不会写入提示词日志。</p>
          <textarea id="st-esg-api-include-headers" class="text_pole" spellcheck="false" placeholder="X-Custom-Header: value"></textarea>
          <div class="st-esg-api-parameter-error" data-api-parameter-error="追加请求头" role="alert"></div>
        </section>
        <div class="st-esg-api-parameter-error" data-api-parameter-error="general" role="alert"></div>
      </div>
      <footer class="st-esg-actions-row">
        <button id="st-esg-api-additional-cancel" class="menu_button st-esg-secondary-action" type="button">取消</button>
        <button id="st-esg-api-additional-save" class="menu_button st-esg-primary-action" type="submit">保存</button>
      </footer>
    </form>`;

  const includeBody = dialog.querySelector('#st-esg-api-include-body');
  const excludeBody = dialog.querySelector('#st-esg-api-exclude-body');
  const includeHeaders = dialog.querySelector('#st-esg-api-include-headers');
  includeBody.value = textOf(settings.additionalBodyYaml);
  excludeBody.value = textOf(settings.excludedBodyYaml);
  includeHeaders.value = textOf(settings.additionalHeadersYaml);

  const closeDialog = (returnValue) => {
    if (dialog.open && typeof dialog.close === 'function') dialog.close(returnValue);
    dialog.remove();
  };
  dialog.querySelector('form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const draft = {
      additionalBodyYaml: includeBody.value,
      excludedBodyYaml: excludeBody.value,
      additionalHeadersYaml: includeHeaders.value,
    };
    try {
      parseApiAdditionalParameters(draft, await getYamlParser());
      Object.assign(settings, draft);
      markSchemeDirty('api');
      closeDialog('save');
      notifyStatus('附加参数已保存。');
    } catch (error) {
      renderApiAdditionalParameterError(dialog, error);
    }
  });
  dialog.querySelector('#st-esg-api-additional-cancel').addEventListener('click', () => closeDialog('cancel'));
  dialog.querySelector('[data-api-additional-close]').addEventListener('click', () => closeDialog('cancel'));
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeDialog('cancel');
  });
  targetDoc.body.appendChild(dialog);
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  includeBody.focus();
}

function requestSchemeName(type) {
  const label = SCHEME_CONFIG[type]?.label || '方案';
  return requestTextInputDialog({ title: `另存${label}方案`, label: '方案名', placeholder: '输入方案名' });
}

function isFollowingTavernWorldbook() {
  return getActiveSchemeId('worldbook') === WORLD_BOOK_FOLLOW_TAVERN && !settings.dirtySchemeTypes?.worldbook;
}

// The Tavern default is a mirror rather than a scheme: it owns no snapshot, so entry checkboxes must
// come from Tavern's own enabled flags. This stays true after the draft turns dirty, which is why it
// cannot be folded into isFollowingTavernWorldbook.
function isTavernDefaultWorldbookScheme() {
  return getActiveSchemeId('worldbook') === WORLD_BOOK_FOLLOW_TAVERN;
}

function isFollowingTavernPreset() {
  return getActiveSchemeId('preset') === WORLD_BOOK_FOLLOW_TAVERN && !settings.dirtySchemeTypes?.preset;
}

function renderSchemeOptions(type) {
  const config = SCHEME_CONFIG[type];
  if (!config) return;
  const list = getSchemeList(type);
  const selectedId = getSelectedSchemeId(type);
  const followOption = ['preset', 'worldbook'].includes(type) ? '<option value="__follow_tavern__">酒馆默认</option>' : '';
  const select = $t(`#st-esg-${type}-scheme`);
  if (!select.length) return;
  select.html(`<option value="">未选择方案</option>${followOption}${list.map((scheme) => `<option value="${escapeHtml(scheme.id)}">${escapeHtml(scheme.name)}</option>`).join('')}`);
  select.val(selectedId === WORLD_BOOK_FOLLOW_TAVERN || list.some((scheme) => scheme.id === selectedId) ? selectedId : '');
  renderCurrentScheme(type);
  if (type === 'preset') renderPresetBindingControls();
}

function renderAllSchemeOptions() {
  Object.keys(SCHEME_CONFIG).forEach(renderSchemeOptions);
}

function currentSchemeSnapshot(type) {
  if (type === 'component') return captureComponentSchemeSnapshot(settings);
  return captureSchemeSnapshot(type, settings, importGroups, { isWorldbookGroup });
}

async function prepareTavernWorldbookSchemeSnapshot() {
  const activeGroups = importGroups.filter((group) => isWorldbookGroup(group) && group.category !== 'inactive');
  if (!activeGroups.length) return;
  let completed = activeGroups.filter((group) => group.loaded && Array.isArray(group.items)).length;
  setStatus(`正在读取世界书并保存方案：${completed}/${activeGroups.length}`);
  settings.promptSelections = await hydrateTavernWorldbookSelections(
    activeGroups,
    settings.promptSelections,
    async (group) => {
      const items = await readWorldbookItemsForGroup(group);
      completed += 1;
      setStatus(`正在读取世界书并保存方案：${completed}/${activeGroups.length}`);
      return items;
    },
  );
  saveSettings();
}

function applyApiScheme(snapshot) {
  Object.assign(settings, {
    apiMode: ['custom', 'tavern'].includes(snapshot.apiMode) ? snapshot.apiMode : 'custom',
    useMainApi: false,
    tavernProfile: snapshot.tavernProfile || '',
    apiUrl: snapshot.apiUrl || '',
    apiKey: snapshot.apiKey || '',
    apiModel: snapshot.apiModel || '',
    apiModelOptions: Array.isArray(snapshot.apiModelOptions) ? [...snapshot.apiModelOptions] : [],
    maxTokens: snapshot.maxTokens || String(MAX_OUTPUT_TOKENS),
    temperature: snapshot.temperature || '1',
    additionalBodyYaml: snapshot.additionalBodyYaml || '',
    excludedBodyYaml: snapshot.excludedBodyYaml || '',
    additionalHeadersYaml: snapshot.additionalHeadersYaml || '',
    streamingEnabled: Boolean(snapshot.streamingEnabled),
    apiRetryCount: normalizeApiRetryCount(snapshot.apiRetryCount),
  });
  $t('#st-esg-api-url').val(settings.apiUrl);
  $t('#st-esg-api-key').val(settings.apiKey);
  $t('#st-esg-api-model').val(settings.apiModel);
  $t('#st-esg-max-tokens').val(settings.maxTokens);
  $t('#st-esg-temperature').val(settings.temperature);
  $t('#st-esg-streaming-enabled').prop('checked', settings.streamingEnabled);
  $t('#st-esg-api-retry-count').val(settings.apiRetryCount);
  $t('#st-esg-prompt-template-compat').prop('checked', settings.promptTemplateCompatEnabled);
  renderModelOptions();
  renderApiModeUi();
  refreshTavernProfiles({ notify: false });
}

function renderApiModeUi() {
  const mode = ['custom', 'tavern'].includes(settings.apiMode)
    ? settings.apiMode
    : 'custom';
  settings.apiMode = mode;
  settings.useMainApi = false;
  $t('.st-esg-api-tab').each(function () { $(this).toggleClass('is-active', String($(this).data('api-mode')) === mode); });
  $t('.st-esg-api-mode-panel').addClass('st-esg-hidden');
  $t(`#st-esg-api-${mode}-panel`).removeClass('st-esg-hidden');
  $t('.st-esg-api-custom-fields').toggleClass('st-esg-hidden', mode !== 'custom');
  $t('#st-esg-streaming-enabled').closest('label').removeClass('st-esg-hidden');
  $t('#st-esg-max-tokens, #st-esg-temperature').closest('label').toggleClass('st-esg-hidden', mode === 'tavern');
}

function renderMemorySettingsUi() {
  $t('#st-esg-baibai-history-enabled').prop('checked', settings.baiBaiBookHistoryEnabled === true);
  $t('#st-esg-baibai-state-enabled').prop('checked', settings.baiBaiBookStateEnabled === true);
  $t('#st-esg-anima-worldbook-enabled').prop('checked', settings.animaWorldbookEnabled === true);
  $t('#st-esg-anima-status-enabled').prop('checked', settings.animaStatusVariableEnabled === true);
  $t('#st-esg-anima-status-after-message-option').toggleClass('st-esg-hidden', settings.animaStatusVariableEnabled !== true);
  $t('#st-esg-anima-status-after-message-enabled').prop('checked', settings.animaStatusAfterMessageEnabled === true);
}

function getTavernProfiles() {
  const rawProfiles = getContext()?.extensionSettings?.connectionManager?.profiles || [];
  const profiles = Array.isArray(rawProfiles)
    ? rawProfiles
    : Object.entries(rawProfiles).map(([id, profile]) => ({ ...(profile || {}), id: profile?.id || id }));
  return profiles.filter((profile) => profile?.id);
}

function refreshTavernProfiles({ notify = true } = {}) {
  const profiles = getTavernProfiles();
  const select = $t('#st-esg-tavern-profile');
  if (!select.length) return;
  select.empty().append('<option value="">请选择酒馆预设</option>');
  profiles.forEach((profile) => {
    select.append($('<option>').val(String(profile.id)).text(String(profile.name || profile.id)));
  });
  if (settings.tavernProfile && !profiles.some((profile) => String(profile?.id || '') === String(settings.tavernProfile))) {
    select.append($('<option>').val(String(settings.tavernProfile)).text(`当前方案（未找到：${settings.tavernProfile}）`));
  }
  select.val(settings.tavernProfile || '');
  if (notify) setStatus(`已刷新酒馆预设（${profiles.length} 个）`);
}

function applyTaskScheme(snapshot) {
  settings.taskPrompt = String(snapshot.taskPrompt || '');
  $t('#st-esg-task').val(settings.taskPrompt);
}

async function applyPresetScheme(snapshot) {
  // Saved schemes represent prompt editing. Import mode is a temporary library view
  // and must not be restored from an old or accidentally captured snapshot.
  setSourceMode('preset', SOURCE_MODE_PROMPT);
  renderSourceModeUi();
  settings.activeSourcePreset = textOf(snapshot.activeSourcePreset);
  settings.taskPlacementEnabled = Boolean(snapshot.taskPlacementEnabled);
  settings.taskPlacementAfterSourceId = textOf(snapshot.taskPlacementAfterSourceId);
  settings.replaceLastUserMessageWithTask = Boolean(snapshot.replaceLastUserMessageWithTask);
  settings.omitOriginalUserMessages = Boolean(snapshot.omitOriginalUserMessages);
  renderSourcePresetSelect();
  if (settings.activeSourcePreset) $t('#st-esg-source-preset').val(settings.activeSourcePreset);
  await scanImportCandidates();
  settings.promptSelections = clearImportSelectionsForScope(settings.promptSelections, COMPONENT_SCOPE_PRESET);
  settings.importSelections = clearImportSelectionsForScope(settings.importSelections, COMPONENT_SCOPE_PRESET);
  settings.sourceContentOverrides = clearImportSelectionsForScope(settings.sourceContentOverrides, COMPONENT_SCOPE_PRESET);
  Object.assign(settings.promptSelections, snapshot.promptSelections || {});
  Object.assign(settings.sourceContentOverrides, snapshot.sourceContentOverrides || {});
  reconcileLoadedPresetGroups(importGroups);
  $t('#st-esg-replace-last-user-message').prop('checked', settings.replaceLastUserMessageWithTask);
  $t('#st-esg-omit-original-user-messages').prop('checked', settings.omitOriginalUserMessages);
  renderImportCandidates();
  renderTaskPlacementOptions();
}

async function applyWorldbookScheme(snapshot) {
  if (!isWorldbookSchemeSnapshotUsable(snapshot)) {
    throw new Error('该世界书方案没有可恢复的世界书来源或条目记录，已阻止载入以保护当前配置。');
  }
  const restoredPromptSelections = resolveWorldbookPromptSelectionsForLoad(snapshot);

  // Saved schemes represent prompt editing. Import mode is a temporary library view
  // and must not be restored from an old or accidentally captured snapshot.
  setSourceMode('worldbook', SOURCE_MODE_PROMPT);
  renderSourceModeUi();
  settings.worldbookDraftSources = getWorldbookSchemeSourceNames(snapshot);
  settings.promptSelections = clearImportSelectionsForScope(settings.promptSelections, SOURCE_WORLDBOOK);
  settings.importSelections = clearImportSelectionsForScope(settings.importSelections, SOURCE_WORLDBOOK);
  settings.sourceContentOverrides = clearImportSelectionsForScope(settings.sourceContentOverrides, SOURCE_WORLDBOOK);
  settings.worldbookActivationOverrides = clearImportSelectionsForScope(settings.worldbookActivationOverrides, SOURCE_WORLDBOOK);
  settings.worldbookKeywordOverrides = clearImportSelectionsForScope(settings.worldbookKeywordOverrides, SOURCE_WORLDBOOK);
  // The scheme's prompt selections are authoritative. The only fallback above is a
  // one-time recovery for old import-mode snapshots, using the separately stored
  // prompt snapshot rather than the import checkboxes.
  Object.assign(settings.promptSelections, restoredPromptSelections);
  Object.assign(settings.sourceContentOverrides, snapshot.sourceContentOverrides || {});
  Object.assign(settings.worldbookActivationOverrides, snapshot.worldbookActivationOverrides || {});
  Object.assign(settings.worldbookKeywordOverrides, snapshot.worldbookKeywordOverrides || {});
  // Do not eagerly load every book while applying a scheme. Lazy loading restores entry details
  // when they are opened or needed for generation, avoiding a mobile UI freeze on large libraries.
  await scanImportCandidates();
}

async function applyFollowTavernWorldbook() {
  settings.worldbookDraftSources = [];
  settings.promptSelections = clearImportSelectionsForScope(settings.promptSelections, SOURCE_WORLDBOOK);
  settings.importSelections = clearImportSelectionsForScope(settings.importSelections, SOURCE_WORLDBOOK);
  settings.sourceContentOverrides = clearImportSelectionsForScope(settings.sourceContentOverrides, SOURCE_WORLDBOOK);
  settings.worldbookActivationOverrides = {};
  settings.worldbookKeywordOverrides = {};
  await scanImportCandidates();
}

async function applyFollowTavernPreset() {
  settings.activeSourcePreset = getCurrentPresetNameSafe(targetWindow, getContext());
  renderSourcePresetSelect();
  await scanImportCandidates();
  renderImportCandidates({ renderWorldbook: false });
}

function getTavernSourceSignature() {
  const preset = isFollowingTavernPreset() ? getCurrentPresetNameSafe(targetWindow, getContext()) : '';
  const worldbooks = isFollowingTavernWorldbook()
    ? collectWorldbookImportGroups({ targetWindow, context: getContext(), selectedWorldNames: getSelectedGlobalWorldbookNamesFromDom() }).map((group) => group.source)
    : [];
  return JSON.stringify({ preset, worldbooks });
}

function invalidateWorldbookSourceCache(worldbookName) {
  markWorldbookSourceDirty(promptSourceCache, worldbookName);
  const name = getWorldbookRawName(worldbookName);
  if (!name.trim()) return;
  importGroups
    .filter((group) => group?.scope === SOURCE_WORLDBOOK && group.source === name)
    .forEach((group) => {
      group.loaded = false;
      group.loading = false;
      group.items = [];
      group.error = '';
    });
}

function registerPromptSourceCacheInvalidation(context) {
  const bind = (eventName, handler) => {
    const eventType = context.eventTypes?.[eventName];
    if (eventType && context.eventSource?.on) context.eventSource.on(eventType, handler);
  };
  const invalidateStructure = () => markPromptSourceStructureDirty(promptSourceCache);
  bind('WORLDINFO_UPDATED', (worldbookName) => invalidateWorldbookSourceCache(worldbookName));
  bind('WORLDINFO_SETTINGS_UPDATED', invalidateStructure);
  bind('PRESET_CHANGED', invalidateStructure);
  bind('PRESET_DELETED', invalidateStructure);
  bind('PRESET_RENAMED', invalidateStructure);
  bind('OAI_PRESET_CHANGED_AFTER', invalidateStructure);
  bind('CHAT_CHANGED', invalidateStructure);
  bind('GROUP_UPDATED', invalidateStructure);
  bind('CHARACTER_EDITED', invalidateStructure);
}

async function syncTavernDefaultSources() {
  if (!getDialog()?.open || (!isFollowingTavernPreset() && !isFollowingTavernWorldbook())) return;
  const signature = getTavernSourceSignature();
  if (signature === lastTavernSourceSignature) return;
  lastTavernSourceSignature = signature;
  markPromptSourceStructureDirty(promptSourceCache);
}

function startTavernDefaultSync() {
  if (tavernSyncTimer) return;
  tavernSyncTimer = targetWindow.setInterval(() => {
    syncTavernDefaultSources().catch(() => {});
  }, 800);
}

async function applyScheme(type, snapshot) {
  if (type === 'api') applyApiScheme(snapshot);
  else if (type === 'task') applyTaskScheme(snapshot);
  else if (type === 'preset') await applyPresetScheme(snapshot);
  else if (type === 'worldbook') await applyWorldbookScheme(snapshot);
  else if (type === 'component') {
    settings = applyComponentSchemeSnapshot(settings, snapshot);
    renderComponentList();
  }
  saveSettings();
}

function isSchemeMutationLocked(type, action) {
  return ['preset', 'worldbook'].includes(type)
    && ['new', 'overwrite', 'delete'].includes(action)
    && getSourceMode(type) === SOURCE_MODE_IMPORT;
}

async function handleSchemeAction(type, action) {
  const config = SCHEME_CONFIG[type];
  if (!config) return;
  if (isSchemeMutationLocked(type, action)) {
    notifyStatus('导入到组件时不能修改方案。', 'warning');
    return;
  }
  const list = getSchemeList(type);
  const selectedId = textOf($t(`#st-esg-${type}-scheme`).val());
  if (action === 'new') {
    const name = await requestSchemeName(type);
    if (!name) { notifyStatus('请先输入方案名。', 'warning'); return; }
    if (type === 'worldbook' && isTavernDefaultWorldbookScheme()) {
      try {
        await prepareTavernWorldbookSchemeSnapshot();
      } catch (error) {
        notifyStatus(`读取酒馆世界书失败，方案未保存：${error?.message || '未知错误'}`, 'error');
        return;
      }
    }
    const snapshot = currentSchemeSnapshot(type);
    const next = saveScheme(list, name, snapshot);
    if (type === 'worldbook') settings.worldbookDraftSources = getWorldbookSchemeSourceNames(snapshot);
    setSchemeList(type, next);
    setSelectedSchemeId(type, next.at(-1)?.id || '');
    markSchemeClean(type, next.at(-1)?.id || '');
    saveSettings();
    renderSchemeOptions(type);
    notifyStatus(`已保存${config.label}方案。`);
  } else if (action === 'overwrite') {
    if (!selectedId) { notifyStatus('请先选择要覆盖的方案。', 'warning'); return; }
    if (selectedId === WORLD_BOOK_FOLLOW_TAVERN) { notifyStatus('酒馆默认不能覆盖，请使用另存。', 'warning'); return; }
    const name = findScheme(list, selectedId)?.name || '';
    if (!name) { notifyStatus('找不到要覆盖的方案。', 'error'); return; }
    if (!targetWindow.confirm(`确认用当前内容覆盖方案“${name}”？`)) return;
    setSchemeList(type, saveScheme(list, name, currentSchemeSnapshot(type), selectedId));
    setSelectedSchemeId(type, selectedId);
    markSchemeClean(type, selectedId);
    saveSettings();
    renderSchemeOptions(type);
    notifyStatus(`已覆盖${config.label}方案。`);
  } else if (action === 'delete') {
    if (!selectedId) { notifyStatus('请先选择要删除的方案。', 'warning'); return; }
    if (selectedId === WORLD_BOOK_FOLLOW_TAVERN) { notifyStatus('酒馆默认不能删除。', 'warning'); return; }
    const name = findScheme(list, selectedId)?.name || '';
    if (!name) { notifyStatus('找不到要删除的方案。', 'error'); return; }
    const boundComponentCount = type === 'preset'
      ? settings.components.filter((component) => component.scope === COMPONENT_SCOPE_PRESET && textOf(component.presetSchemeId) === selectedId).length
      : 0;
    const boundComponentNotice = boundComponentCount
      ? `\n\n同时会一并删除该方案的 ${boundComponentCount} 个绑定组件。`
      : '';
    if (!targetWindow.confirm(`确认删除方案“${name}”？此操作无法恢复。${boundComponentNotice}`)) return;
    setSchemeList(type, deleteScheme(list, selectedId));
    if (type === 'preset') settings.components = settings.components.filter((component) => !(component.scope === COMPONENT_SCOPE_PRESET && textOf(component.presetSchemeId) === selectedId));
    setSelectedSchemeId(type, '');
    if (getActiveSchemeId(type) === selectedId) markSchemeClean(type, '');
    saveSettings();
    renderSchemeOptions(type);
    if (type === 'preset') { renderPresetBindingControls(); renderComponentList(); }
    notifyStatus(`已删除${config.label}方案。`);
  } else if (action === 'load') {
    if (type === 'preset' && selectedId === WORLD_BOOK_FOLLOW_TAVERN) {
      if (!targetWindow.confirm('确认载入预设酒馆默认？当前未保存的修改将丢失。')) return;
      setSelectedSchemeId(type, selectedId);
      await applyFollowTavernPreset();
      markSchemeClean(type, selectedId);
      saveSettings();
      renderSchemeOptions(type);
      notifyStatus('已载入预设酒馆默认。');
      return;
    }
    if (type === 'worldbook' && selectedId === WORLD_BOOK_FOLLOW_TAVERN) {
      if (!targetWindow.confirm('确认载入世界书酒馆默认？当前未保存的修改将丢失。')) return;
      setSelectedSchemeId(type, selectedId);
      markSchemeClean(type, selectedId);
      await applyFollowTavernWorldbook();
      saveSettings();
      renderSchemeOptions(type);
      notifyStatus('已载入世界书酒馆默认。');
      return;
    }
    const scheme = findScheme(list, selectedId);
    if (!scheme) { notifyStatus('请先选择要载入的方案。', 'warning'); return; }
    if (type === 'worldbook' && !isWorldbookSchemeSnapshotUsable(scheme.snapshot || {})) {
      notifyStatus(`世界书方案“${scheme.name}”没有可恢复的数据，已阻止载入；当前配置未改变。`, 'error');
      return;
    }
    if (!targetWindow.confirm(`确认载入方案“${scheme.name}”？当前未保存的修改将丢失。`)) return;
    setSelectedSchemeId(type, selectedId);
    markSchemeClean(type, selectedId);
    await applyScheme(type, scheme.snapshot || {});
    renderSchemeOptions(type);
    notifyStatus(`已载入${config.label}方案：${scheme.name}`);
  }
}

function switchTab(tabName) {
  const aliases = { sources: 'preset', api: 'runtime', output: 'workspace' };
  const availableTabs = new Set(['workspace', 'task', 'preset', 'worldbook', 'runtime', 'components', 'debug']);
  const requestedTab = aliases[tabName] || tabName || 'workspace';
  const nextTab = availableTabs.has(requestedTab) ? requestedTab : 'workspace';
  const nextTabButton = $t(`.st-esg-tab[data-tab="${nextTab}"]`);
  if (settings.activeTab === nextTab && nextTabButton.hasClass('active')) return;
  const leavingComponentLibrary = nextTab !== 'components';
  const shouldRefreshComponentLibrary = leavingComponentLibrary
    && (componentEditMode || componentMoveState || theaterMoveState || componentSearchQuery || componentFilterMode !== 'all');
  if (leavingComponentLibrary) {
    resetComponentEditMode();
    resetComponentLibraryFilters();
  }
  $t('.st-esg-tab').removeClass('active');
  $t(`.st-esg-tab[data-tab="${nextTab}"]`).addClass('active');
  $t('.st-esg-tab-panel').removeClass('active');
  $t(`.st-esg-tab-panel[data-tab-panel="${nextTab}"]`).addClass('active');
  settings.activeTab = nextTab;
  saveSettings();
  if ((nextTab === 'preset' || nextTab === 'worldbook') && (!importGroups.length || promptSourceCache.structureDirty)) scanImportCandidates();
  else if (nextTab === 'worldbook') renderImportCandidates({ renderPreset: false });
  else if (nextTab === 'preset') renderImportCandidates({ renderWorldbook: false });
  if (nextTab === 'debug') renderPromptLog();
  if (nextTab === 'workspace') scheduleGeneratedPreviewResize();
  if (shouldRefreshComponentLibrary) renderComponentList();
}

function getDialog() { return targetDoc.getElementById('st-esg-dialog'); }

function closeSillyTavernOverlays() {
  // The magic-wand menu is a Popper dropdown on mobile. If it stays open, it can sit above
  // extension UI and make our panel look "covered" even when the panel itself opened.
  const wandMenu = targetDoc.getElementById('extensionsMenu') || targetDoc.getElementById('extensions_menu');
  if (wandMenu) {
    $(wandMenu).stop(true, true).hide();
  }

  // Close unpinned navbar drawers that may occupy the mobile viewport.
  $t('.openIcon:not(.drawerPinnedOpen)').removeClass('openIcon').addClass('closedIcon');
  $t('.openDrawer').not('.drawerPinnedOpen').removeClass('openDrawer').addClass('closedDrawer');
}

function togglePanel(forceOpen) {
  const dialog = getDialog();
  if (!dialog) return;
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !dialog.open;
  const shouldRefreshComponentList = Boolean(
    componentEditMode || componentMoveState || theaterMoveState || componentSearchQuery || componentFilterMode !== 'all',
  );
  targetDoc.getElementById('st-esg-ball')?.classList.toggle('st-esg-ball-under-panel', shouldOpen);
  applyTheme();
  if (shouldOpen) {
    resetComponentEditMode();
    resetComponentLibraryFilters();
    const componentList = targetDoc.getElementById('st-esg-component-list');
    if (shouldRefreshComponentList || !componentList?.children.length || componentLibraryContextKey !== getComponentLibraryContextKey()) renderComponentList();
    closeSillyTavernOverlays();
    targetDoc.body.appendChild(dialog);
    if (typeof dialog.show === 'function') {
      if (!dialog.open) dialog.show();
    } else {
      dialog.setAttribute('open', '');
    }
    dialog.focus({ preventScroll: true });
    if (!importGroups.length || promptSourceCache.structureDirty) scanImportCandidates().catch(() => {});
    if (settings.activeTab === 'workspace') scheduleGeneratedPreviewResize();
  } else if (dialog.open && typeof dialog.close === 'function') {
    resetComponentEditMode();
    resetComponentLibraryFilters();
    if (shouldRefreshComponentList) renderComponentList();
    dialog.close();
  } else {
    resetComponentEditMode();
    resetComponentLibraryFilters();
    if (shouldRefreshComponentList) renderComponentList();
    dialog.removeAttribute('open');
  }
  $t('#st-esg-menu-button').toggleClass('selected', shouldOpen);
  $t('#st-esg-ball').toggleClass('selected', shouldOpen);
}

function renderMagicWandMenuButton() {
  if (targetDoc.getElementById('st-esg-menu-button')) return;
  const menu = targetDoc.getElementById('extensions_menu') || targetDoc.getElementById('extensionsMenu');
  if (!menu) {
    if (magicWandMenuTimer) return;
    magicWandMenuTimer = targetWindow.setInterval(() => {
      renderMagicWandMenuButton();
    }, 500);
    return;
  }
  if (magicWandMenuTimer) {
    targetWindow.clearInterval(magicWandMenuTimer);
    magicWandMenuTimer = null;
  }
  const button = targetDoc.createElement('div');
  button.id = 'st-esg-menu-button';
  button.className = 'list-group-item flex-container flexGap5 interactable';
  button.tabIndex = 0;
  button.title = `${BRAND_NAME} · ${BRAND_SUBTITLE}`;
  button.innerHTML = `<span class="extensionsMenuExtensionButton st-esg-menu-brand-icon">${renderBrandMark('menu')}</span><span>${BRAND_NAME}</span>`;
  button.addEventListener('click', () => togglePanel(true));
  menu.prepend(button);
}

function setFloatingBallVisualState(state) {
  const previousState = floatingBallVisualState;
  floatingBallVisualState = normalizeFloatingBallVisualState(state);
  const ball = targetDoc.getElementById('st-esg-ball');
  if (!ball) return;
  const visualState = resolveFloatingBallRenderedState(floatingBallVisualState, settings.ballAnimationEnabled);
  ball.dataset.visualState = visualState;
  ball.classList.remove('st-esg-ball-error-pulse');
  if (visualState === 'error' && previousState !== 'error' && settings.ballAnimationEnabled) {
    void ball.offsetWidth;
    ball.classList.add('st-esg-ball-error-pulse');
  }
  ball.setAttribute('aria-label', visualState === 'generating'
    ? `${BRAND_NAME}：正在生成`
    : visualState === 'waiting'
      ? `${BRAND_NAME}：等待注入`
      : visualState === 'error'
        ? `${BRAND_NAME}：执行失败，点击查看错误`
        : `${BRAND_NAME}：空闲`);
}

function openPanelFromFloatingBall() {
  if (floatingBallVisualState === 'error') {
    switchTab('workspace');
    renderGenerationResultPanel();
    setFloatingBallVisualState('idle');
  }
  togglePanel(true);
}

function renderFloatingBall() {
  if (!settings.ballVisible) { $t('#st-esg-ball').remove(); return; }
  const existingBall = targetDoc.getElementById('st-esg-ball');
  if (existingBall) {
    markFloatingBallCompatible(existingBall);
    applyFloatingBallAppearance(existingBall);
    applyFloatingBallPosition(existingBall);
    setFloatingBallVisualState(floatingBallVisualState);
    existingBall.classList.toggle('st-esg-ball-under-panel', Boolean(getDialog()?.open));
    return;
  }
  const ball = targetDoc.createElement('div');
  ball.id = 'st-esg-ball';
  markFloatingBallCompatible(ball);
  ball.title = `${BRAND_NAME} · ${BRAND_SUBTITLE}`;
  ball.innerHTML = renderBrandMark('ball');
  applyThemeClass(ball, settings.theme);
  applyFloatingBallAppearance(ball);
  applyFloatingBallPosition(ball);
  ball.classList.toggle('st-esg-ball-under-panel', Boolean(getDialog()?.open));
  targetDoc.body.appendChild(ball);
  setFloatingBallVisualState(floatingBallVisualState);
  let dragging = false, moved = false, suppressClick = false, activePointerId = null, startX = 0, startY = 0, originLeft = 0, originTop = 0;
  const applyDockState = () => {
    const dock = settings.ballSnapEnabled && ['left', 'right'].includes(settings.ballDock) ? settings.ballDock : 'none';
    ball.dataset.dock = dock;
  };
  applyDockState();
  const onMove = (event) => {
    if (activePointerId === null || event.pointerId !== activePointerId) return;
    if (isFloatingBallExternallyManaged(ball)) return;
    const dx = event.clientX - startX, dy = event.clientY - startY;
    if (!dragging && !hasFloatingBallDragStarted({ dx, dy, threshold: 8 })) return;
    if (!dragging) {
      dragging = true;
      moved = true;
      settings.ballDock = 'none';
      applyDockState();
      ball.classList.add('st-esg-ball-dragging');
    }
    ball.style.left = `${clamp(originLeft + dx, 0, targetWindow.innerWidth - getFloatingBallSize())}px`;
    ball.style.top = `${clamp(originTop + dy, 0, targetWindow.innerHeight - getFloatingBallSize())}px`;
  };
  const onUp = (event) => {
    if (activePointerId === null || event.pointerId !== activePointerId) return;
    const cancelled = event.type === 'pointercancel';
    ball.removeEventListener('pointermove', onMove);
    ball.removeEventListener('pointerup', onUp);
    ball.removeEventListener('pointercancel', onUp);
    if (activePointerId !== null && ball.hasPointerCapture?.(activePointerId)) ball.releasePointerCapture(activePointerId);
    activePointerId = null;
    ball.classList.remove('st-esg-ball-awake');
    if (moved) {
      dragging = false;
      ball.classList.remove('st-esg-ball-dragging');
      const size = getFloatingBallSize();
      let left = clamp(Number.parseFloat(ball.style.left), 0, targetWindow.innerWidth - size);
      const top = clamp(Number.parseFloat(ball.style.top), 0, targetWindow.innerHeight - size);
      if (settings.ballSnapEnabled) {
        settings.ballDock = resolveFloatingBallDock({ left, viewportWidth: targetWindow.innerWidth, ballSize: size, snapZone: 56 });
        if (settings.ballDock === 'left') left = 0;
        if (settings.ballDock === 'right') left = Math.max(0, targetWindow.innerWidth - size);
        if (settings.ballDock !== 'none') {
          ball.classList.add('st-esg-ball-settling');
          void ball.offsetWidth;
          ball.style.left = `${left}px`;
          targetWindow.setTimeout(() => ball.classList.remove('st-esg-ball-settling'), 220);
        }
      } else {
        settings.ballDock = 'none';
      }
      settings.ballX = left;
      settings.ballY = top;
      applyDockState();
      saveSettings();
      suppressClick = true;
      targetWindow.setTimeout(() => { suppressClick = false; }, 300);
    } else if (!cancelled) {
      dragging = false;
      targetWindow.setTimeout(() => openPanelFromFloatingBall(), 0);
    }
  };
  ball.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); dragging = false; moved = false; suppressClick = false; activePointerId = event.pointerId;
    startX = event.clientX; startY = event.clientY;
    const left = Number.parseFloat(ball.style.left);
    const top = Number.parseFloat(ball.style.top);
    originLeft = Number.isFinite(left) ? left : 16;
    originTop = Number.isFinite(top) ? top : 16;
    ball.classList.add('st-esg-ball-awake');
    ball.setPointerCapture?.(event.pointerId);
    ball.addEventListener('pointermove', onMove);
    ball.addEventListener('pointerup', onUp);
    ball.addEventListener('pointercancel', onUp);
  });
  ball.addEventListener('click', (event) => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClick = false;
  });
  ball.addEventListener('pointerenter', () => ball.classList.add('st-esg-ball-awake'));
  ball.addEventListener('pointerleave', () => {
    if (activePointerId === null) ball.classList.remove('st-esg-ball-awake');
  });
  ball.addEventListener('focus', () => ball.classList.add('st-esg-ball-awake'));
  ball.addEventListener('blur', () => ball.classList.remove('st-esg-ball-awake'));
  ball.tabIndex = 0;
  ball.setAttribute('role', 'button');
}

function normalizeFloatingBallSize(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? Math.round(clamp(numeric, FLOATING_BALL_MIN_SIZE, FLOATING_BALL_MAX_SIZE))
    : DEFAULT_SETTINGS.ballSize;
}

function normalizeFloatingBallOpacity(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? clamp(numeric, FLOATING_BALL_MIN_OPACITY, FLOATING_BALL_MAX_OPACITY)
    : DEFAULT_SETTINGS.ballOpacity;
}

function getFloatingBallSize() {
  return normalizeFloatingBallSize(settings.ballSize);
}

function getFloatingBallOpacity() {
  return normalizeFloatingBallOpacity(settings.ballOpacity);
}

function applyFloatingBallAppearance(ball) {
  ball.style.setProperty('--st-esg-ball-size', `${getFloatingBallSize()}px`);
  ball.style.setProperty('--st-esg-ball-opacity', String(getFloatingBallOpacity()));
}

function getComponentPositionMoveResult() {
  if (!componentMoveState) return { moved: false, components: settings.components };
  return applyComponentPositionMove(
    settings.components,
    settings.componentGroups,
    componentMoveState.sourceIds,
    componentMoveState.target,
    { eligibleComponentIds: componentMoveState.eligibleComponentIds },
  );
}

function getTheaterPositionMoveResult() {
  if (!theaterMoveState) return { moved: false, components: settings.theaterComponents };
  return applyComponentPositionMove(
    settings.theaterComponents,
    settings.theaterGroups,
    theaterMoveState.sourceIds,
    theaterMoveState.target,
  );
}

function getComponentPositionEligibleIds(source) {
  const sourceScope = normalizeComponentScope(source?.scope);
  return settings.components
    .filter((component) => {
      if (normalizeComponentScope(component?.scope) !== sourceScope) return false;
      if (sourceScope === COMPONENT_SCOPE_PRESET) return textOf(component?.presetSchemeId) === textOf(source?.presetSchemeId);
      if (sourceScope === COMPONENT_SCOPE_CHARACTER) return textOf(component?.bindName) === textOf(source?.bindName);
      return true;
    })
    .map((component) => textOf(component?.id))
    .filter(Boolean);
}

function renderComponentPositionMoveFooter() {
  const footer = $t('.st-esg-panel-footer');
  if (!footer.length) return;
  footer.find('.st-esg-component-position-footer').remove();
  const activeLibrary = componentMoveState ? 'components' : theaterMoveState ? 'theater' : '';
  footer.toggleClass('st-esg-component-position-footer-active', Boolean(activeLibrary));
  if (!activeLibrary) return;

  const moveResult = activeLibrary === 'components' ? getComponentPositionMoveResult() : getTheaterPositionMoveResult();
  footer.append(`<div class="st-esg-footer-actions st-esg-component-position-footer"><button class="menu_button st-esg-secondary-action st-esg-component-position-cancel" type="button">取消移动</button><button class="menu_button st-esg-primary-action st-esg-component-position-confirm" type="button" ${moveResult.moved ? '' : 'disabled'}>确认移动</button></div>`);
  footer.find('.st-esg-component-position-cancel').on('click', () => {
    if (activeLibrary === 'components') {
      componentMoveState = null;
      renderComponentList();
    } else {
      theaterMoveState = null;
      renderTheaterLibrary();
    }
  });
  footer.find('.st-esg-component-position-confirm').on('click', () => {
    const confirmedResult = activeLibrary === 'components' ? getComponentPositionMoveResult() : getTheaterPositionMoveResult();
    if (!confirmedResult.moved) return;
    if (activeLibrary === 'components') {
      settings.components = confirmedResult.components;
      if (componentMoveState?.batch) {
        selectedComponentIds.clear();
        componentEditMode = false;
      }
      componentMoveState = null;
      saveSettings();
      renderComponentList();
    } else {
      settings.theaterComponents = confirmedResult.components;
      if (theaterMoveState?.batch) {
        selectedTheaterIds.clear();
        theaterEditMode = false;
      }
      theaterMoveState = null;
      saveSettings();
      renderTheaterLibrary();
    }
  });
}

function renderComponentListToolbar(componentMoveActive = false) {
  const disabled = componentMoveActive ? 'disabled' : '';
  return `<div class="st-esg-list-toolbar st-esg-component-list-toolbar"><input type="text" class="st-esg-search-input st-esg-component-search-input text_pole" placeholder="搜索组件..." value="${escapeHtml(componentSearchQuery)}" ${disabled}><select class="st-esg-filter-select st-esg-component-filter-select text_pole" ${disabled}><option value="all" ${componentFilterMode === 'all' ? 'selected' : ''}>全部</option><option value="enabled" ${componentFilterMode === 'enabled' ? 'selected' : ''}>仅启用</option><option value="disabled" ${componentFilterMode === 'disabled' ? 'selected' : ''}>仅禁用</option></select><span class="st-esg-list-count"></span></div>`;
}

function getFloatingBallPosition() {
  return resolveFloatingBallPosition({
    savedLeft: settings.ballX,
    savedTop: settings.ballY,
    viewportWidth: targetWindow.innerWidth,
    viewportHeight: targetWindow.innerHeight,
    ballSize: getFloatingBallSize(),
  });
}

function applyFloatingBallPosition(ball) {
  if (isFloatingBallExternallyManaged(ball)) return;
  const position = getFloatingBallPosition();
  ball.style.left = `${position.left}px`;
  ball.style.top = `${position.top}px`;
  ball.style.removeProperty('bottom');
  ball.dataset.dock = settings.ballSnapEnabled && ['left', 'right'].includes(settings.ballDock) ? settings.ballDock : 'none';
  if (settings.ballX !== position.left || settings.ballY !== position.top) {
    settings.ballX = position.left;
    settings.ballY = position.top;
    scheduleSettingsSave();
  }
}

function getComponentLibraryContextKey() {
  const context = getContext();
  return `${textOf(getActiveSchemeId('preset'))}::${textOf(getCurrentCharacterNameSafe(context))}`;
}

function componentMatchesLibraryFilter(item) {
  const query = componentSearchQuery.trim().toLocaleLowerCase();
  const searchableText = `${item.name || ''}\n${item.content || ''}`.toLocaleLowerCase();
  const matchesQuery = !query || searchableText.includes(query);
  const matchesFilter = componentFilterMode === 'all'
    || (componentFilterMode === 'enabled' && item.enabled !== false)
    || (componentFilterMode === 'disabled' && item.enabled === false);
  return matchesQuery && matchesFilter;
}

function applyComponentListFilters() {
  const list = $t('#st-esg-component-list');
  if (!list.length) return;
  const filterActive = Boolean(componentSearchQuery.trim()) || componentFilterMode !== 'all';
  const items = list.find('.st-esg-component-item');
  let visibleCount = 0;
  items.each(function () {
    const row = $(this);
    const item = findComponentById(row.attr('data-component-id'));
    const visible = Boolean(item) && componentMatchesLibraryFilter(item);
    row.toggleClass('st-esg-hidden', !visible);
    if (visible) visibleCount += 1;
  });
  // Empty groups remain available as drop targets until the user actively filters the library.
  list.find('.st-esg-component-folder').each(function () {
    const folder = $(this);
    const visibleItems = folder.find('.st-esg-component-item').not('.st-esg-hidden').length;
    const keepEmptyGroup = !filterActive;
    folder.toggleClass('st-esg-hidden', visibleItems === 0 && !keepEmptyGroup);
  });
  list.find('.st-esg-component-list-toolbar .st-esg-list-count').text(`${visibleCount} / ${items.length}`);
  updateComponentEditSelectionUi();
}

function scheduleComponentListFilters() {
  if (componentListFilterScheduled) return;
  componentListFilterScheduled = true;
  const flush = () => {
    componentListFilterScheduled = false;
    applyComponentListFilters();
  };
  if (typeof targetWindow.requestAnimationFrame === 'function') targetWindow.requestAnimationFrame(flush);
  else targetWindow.setTimeout(flush, 0);
}

function renderComponentList() {
  ensureComponentLibraryEnhancements();
  const list = $t('#st-esg-component-list');
  if (!list.length) return;
  const nextComponentLibraryContextKey = getComponentLibraryContextKey();
  if (componentLibraryContextKey && componentLibraryContextKey !== nextComponentLibraryContextKey) {
    componentMoveState = null;
    theaterMoveState = null;
  }
  componentLibraryContextKey = nextComponentLibraryContextKey;
  const moveSources = componentMoveState?.sourceIds?.map(findComponentById).filter(Boolean) || [];
  if (componentMoveState && moveSources.length !== componentMoveState.sourceIds.length) componentMoveState = null;
  const componentMoveActive = Boolean(componentMoveState && moveSources.length);
  const moveSourceScope = componentMoveActive ? normalizeComponentScope(moveSources[0].scope) : '';
  const moveSourceName = componentMoveActive ? (moveSources[0].name || '未命名组件') : '';
  const moveSourceIdSet = new Set(componentMoveState?.sourceIds || []);
  const moveSourceLabel = componentMoveState?.batch ? `${componentMoveState.sourceIds.length} 个选中条目` : `「${moveSourceName}」`;
  pruneSelectedComponentIds();
  const componentViewState = captureComponentLibraryViewState();
  const currentLibraryOpen = list.find('.st-esg-component-library-card').prop('open');
  if (typeof currentLibraryOpen === 'boolean') componentLibraryOpen = currentLibraryOpen;
  const openFolderStateIds = componentViewState.openFolders;
  const openComponentIds = componentViewState.openItems;
  const editButton = componentEditMode || libraryExportMode ? '' : '<button class="menu_button menu_button_icon st-esg-secondary-action st-esg-component-edit-toggle" type="button"><i class="fa-solid fa-pen-to-square"></i><span>编辑</span></button>';
  const editToolbar = componentMoveActive ? '' : componentEditMode ? '<div class="st-esg-component-edit-toolbar"><span class="st-esg-component-edit-selection-count">未选择项目</span><span class="st-esg-component-batch-actions"><button class="menu_button menu_button_icon st-esg-secondary-action st-esg-component-batch-move" type="button" title="移动到指定位置" aria-label="移动到指定位置" disabled><i class="fa-solid fa-arrow-down-wide-short"></i><span>移动到</span></button><button class="menu_button menu_button_icon st-esg-secondary-action st-esg-icon-danger st-esg-component-batch-delete" type="button" title="删除选中组件" aria-label="删除选中组件" disabled><i class="fa-solid fa-trash"></i><span>删除</span></button><button class="menu_button menu_button_icon st-esg-secondary-action st-esg-component-edit-exit" type="button" title="退出编辑" aria-label="退出编辑"><i class="fa-solid fa-check"></i><span>退出</span></button></span></div>' : '';
  const wrapLibrary = (content) => `<details class="st-esg-card st-esg-component-library-card st-esg-library-collapsible${componentMoveActive ? ' st-esg-component-position-mode' : ''}" ${componentLibraryOpen ? 'open' : ''}><summary class="st-esg-library-card-summary"><div class="st-esg-card-head"><div><div class="st-esg-card-title">组件库</div></div>${editButton}</div></summary><div class="st-esg-library-card-body">${editToolbar}${renderComponentListToolbar(componentMoveActive)}${content}</div></details>`;
  const sections = [
    { scope: COMPONENT_SCOPE_GLOBAL, title: '全局组件', desc: '启用后始终参与组件生成。' },
    { scope: COMPONENT_SCOPE_PRESET, title: '预设组件', desc: '仅当前已绑定预设方案时参与生成；未保存方案不会显示预设组件。' },
    { scope: COMPONENT_SCOPE_CHARACTER, title: '角色组件', desc: '仅当前角色卡绑定的组件会参与生成。' },
  ];
  list.html(wrapLibrary(sections.map((section) => {
    const library = getComponentLibraryFolders(settings.components, section.scope, {
      presetSchemeId: getActiveSchemeId('preset'),
      characterName: getCurrentCharacterNameSafe(getContext()),
      componentGroups: settings.componentGroups,
    });
    const count = library.groups.reduce((sum, group) => sum + group.items.length, library.ungrouped.length);
    const renderComponentItem = (item) => {
      const { sourceIndex, siblingIndexes } = getComponentSiblingIndexes(item.id);
      const siblingPosition = siblingIndexes.indexOf(sourceIndex);
      const isOpen = !componentMoveActive && openComponentIds.has(item.id);
      const itemScopeMatches = componentMoveActive && normalizeComponentScope(item.scope) === moveSourceScope;
      const canSelectPosition = itemScopeMatches && !moveSourceIdSet.has(textOf(item.id));
      const isPositionTarget = canSelectPosition
        && componentMoveState?.target?.kind === 'after'
        && textOf(componentMoveState.target.componentId) === textOf(item.id);
      const itemPositionClasses = componentMoveActive
        ? ` ${canSelectPosition ? 'is-position-candidate' : 'is-position-unavailable'}${isPositionTarget ? ' is-position-target' : ''}`
        : '';
      const positionAttribute = canSelectPosition ? ` data-component-position-after="${escapeHtml(item.id)}"` : '';
      const control = componentMoveActive ? '' : libraryExportMode
        ? `<label class="st-esg-checkbox st-esg-library-export-select-label" title="选择导出"><input class="st-esg-library-export-component" type="checkbox" data-component-id="${escapeHtml(item.id)}" aria-label="选择导出" ${exportSelectedComponentIds.has(item.id) ? 'checked' : ''} /></label>`
        : componentEditMode
          ? `<label class="st-esg-checkbox st-esg-component-select-label" title="选择组件"><input class="st-esg-component-select" type="checkbox" data-component-id="${escapeHtml(item.id)}" aria-label="选择组件" ${selectedComponentIds.has(item.id) ? 'checked' : ''} /></label>`
          : `<label class="st-esg-switch st-esg-switch-sm"><input class="st-esg-component-enabled" type="checkbox" ${item.enabled === false ? '' : 'checked'} /><span></span></label>`;
      const actions = componentMoveActive ? '' : componentEditMode
        ? `<span class="st-esg-component-item-actions"><button class="st-esg-icon-btn st-esg-component-move-up" type="button" title="上移" aria-label="上移" ${siblingPosition <= 0 ? 'disabled' : ''}><i class="fa-solid fa-chevron-up"></i></button><button class="st-esg-icon-btn st-esg-component-move-down" type="button" title="下移" aria-label="下移" ${siblingPosition < 0 || siblingPosition >= siblingIndexes.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-down"></i></button><button class="st-esg-icon-btn st-esg-component-move-to" type="button" title="移动到指定位置" aria-label="移动到指定位置"><i class="fa-solid fa-arrow-down-wide-short"></i></button><button class="st-esg-icon-btn st-esg-icon-danger st-esg-component-delete" type="button" title="删除组件" aria-label="删除组件"><i class="fa-solid fa-trash"></i></button></span>`
        : '';
      const positionPreview = isPositionTarget ? `<div class="st-esg-component-position-preview">↓ ${escapeHtml(moveSourceLabel)}将插入到这里</div>` : '';
      return `<details class="st-esg-component-item${itemPositionClasses}" data-component-id="${escapeHtml(item.id)}" ${isOpen ? 'open' : ''}><summary class="st-esg-component-item-head"${positionAttribute}><span class="st-esg-component-name">${escapeHtml(item.name || '未命名组件')}</span>${control}${actions}</summary><div class="st-esg-component-preview" data-loaded="${isOpen ? 'true' : 'false'}">${isOpen ? renderComponentPreview(item) : ''}</div></details>${positionPreview}`;
    };
    const defaultGroup = { groupId: '', name: '默认分组', enabled: settings.defaultGroupEnabled?.[section.scope] !== false, items: library.ungrouped, isDefault: true };
    const groupHtml = [...library.groups, defaultGroup].map((group) => {
      const folderStateId = `${section.scope}::${group.isDefault ? '__default__' : group.groupId}`;
      const groupEnabled = group.enabled !== false;
      const enabledCount = group.items.filter((item) => item.enabled !== false).length;
      const groupScopeMatches = componentMoveActive && normalizeComponentScope(section.scope) === moveSourceScope;
      const groupStartSelected = groupScopeMatches
        && componentMoveState?.target?.kind === 'group-start'
        && normalizeComponentScope(componentMoveState.target.scope) === moveSourceScope
        && textOf(componentMoveState.target.groupId) === textOf(group.groupId);
      const control = componentMoveActive ? '' : libraryExportMode
        ? `<label class="st-esg-checkbox st-esg-library-export-select-label" title="选择本组导出"><input class="st-esg-library-export-component-group" type="checkbox" data-group-id="${escapeHtml(group.groupId)}" aria-label="选择本组导出" /></label>`
        : componentEditMode
          ? `<label class="st-esg-checkbox st-esg-component-select-label" title="选择本组"><input class="st-esg-component-group-select" type="checkbox" data-group-id="${escapeHtml(group.groupId)}" data-default-group-scope="${group.isDefault ? escapeHtml(section.scope) : ''}" aria-label="选择本组" /></label>`
          : group.isDefault
          ? `<label class="st-esg-switch st-esg-switch-sm" title="启用默认分组"><input class="st-esg-component-default-group-enabled" type="checkbox" data-scope="${escapeHtml(section.scope)}" ${groupEnabled ? 'checked' : ''} /><span></span></label>`
          : `<label class="st-esg-switch st-esg-switch-sm" title="启用此分组"><input class="st-esg-component-group-enabled" type="checkbox" data-group-id="${escapeHtml(group.groupId)}" ${groupEnabled ? 'checked' : ''} /><span></span></label>`;
      const { groupPosition, siblingGroups } = group.isDefault ? { groupPosition: -1, siblingGroups: [] } : getComponentGroupSiblingGroups(group.groupId);
      const actions = componentMoveActive ? '' : componentEditMode ? (group.isDefault ? '' : `<span class="st-esg-component-group-actions"><button class="st-esg-icon-btn st-esg-component-group-move-up" type="button" data-group-id="${escapeHtml(group.groupId)}" title="上移分组" aria-label="上移分组" ${groupPosition <= 0 ? 'disabled' : ''}><i class="fa-solid fa-chevron-up"></i></button><button class="st-esg-icon-btn st-esg-component-group-move-down" type="button" data-group-id="${escapeHtml(group.groupId)}" title="下移分组" aria-label="下移分组" ${groupPosition < 0 || groupPosition >= siblingGroups.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-down"></i></button><button class="st-esg-icon-btn st-esg-component-group-rename" type="button" data-group-id="${escapeHtml(group.groupId)}" title="重命名分组" aria-label="重命名分组"><i class="fa-solid fa-pen"></i></button><button class="st-esg-icon-btn st-esg-icon-danger st-esg-component-group-delete" type="button" data-group-id="${escapeHtml(group.groupId)}" title="删除分组" aria-label="删除分组"><i class="fa-solid fa-trash"></i></button></span>`) : '';
      const body = group.items.length ? group.items.map(renderComponentItem).join('') : '<div class="st-esg-empty st-esg-empty-small">暂无组件</div>';
      const allItemsEnabled = group.items.length > 0 && enabledCount === group.items.length;
      const toggleItemsButton = group.items.length
        && !libraryExportMode && !componentMoveActive ? `<button class="menu_button menu_button_icon st-esg-secondary-action st-esg-component-group-toggle-items" type="button" data-group-id="${escapeHtml(group.groupId)}"><i class="fa-solid ${allItemsEnabled ? 'fa-toggle-off' : 'fa-toggle-on'}"></i><span>${allItemsEnabled ? '关闭全部条目' : '开启全部条目'}</span></button>`
        : '';
      const groupStartPreview = groupStartSelected ? `<div class="st-esg-component-position-preview">↓ ${escapeHtml(moveSourceLabel)}将插入到这里</div>` : '';
      const groupStartTarget = groupScopeMatches ? `<button class="st-esg-component-position-target st-esg-component-position-target-top${groupStartSelected ? ' is-position-target' : ''}" type="button" data-component-position-group-start="${escapeHtml(group.groupId)}" data-component-position-scope="${escapeHtml(section.scope)}">插入到本组顶部</button>${groupStartPreview}` : '';
      const groupContent = `<div class="st-esg-component-group-content"><div class="st-esg-component-group-toolbar">${toggleItemsButton}</div><div class="st-esg-component-group-items">${groupStartTarget}${body}</div></div>`;
      return `<details class="st-esg-component-folder${groupEnabled ? '' : ' st-esg-component-folder-is-disabled'}" data-group-id="${escapeHtml(group.groupId)}" data-default-group="${group.isDefault ? 'true' : 'false'}" data-folder-state-id="${escapeHtml(folderStateId)}" ${openFolderStateIds.has(folderStateId) ? 'open' : ''}><summary class="st-esg-component-folder-head"><span class="st-esg-component-folder-title">${escapeHtml(group.name)}</span><em class="st-esg-component-folder-count${groupEnabled ? '' : ' is-disabled'}">${enabledCount}/${group.items.length}</em>${control}${actions}<i class="fa-solid fa-chevron-down st-esg-component-folder-caret"></i></summary><div class="st-esg-component-folder-body">${groupContent}</div></details>`;
    }).join('');
    const sectionContent = groupHtml;
    const createGroupButton = componentMoveActive ? '' : componentEditMode ? `<button class="st-esg-icon-btn st-esg-component-group-create" type="button" data-scope="${escapeHtml(section.scope)}" title="新建分组" aria-label="新建分组"><i class="fa-solid fa-folder-plus"></i></button>` : '';
    const unavailableClass = componentMoveActive && normalizeComponentScope(section.scope) !== moveSourceScope ? ' is-position-unavailable' : '';
    return `<details class="st-esg-component-section${unavailableClass}" open><summary class="st-esg-component-section-head"><div><span class="st-esg-import-group-title">${section.title}</span><i class="fa-solid fa-circle-question st-esg-component-section-info" title="${escapeHtml(section.desc)}"></i>${createGroupButton}</div><em>${count} 个</em></summary><div class="st-esg-component-section-body">${sectionContent}</div></details>`;
  }).join('')));
  list.find('.st-esg-component-section-info').remove();
  const currentPresetSchemeName = getPresetSchemeById(getActiveSchemeId('preset'))?.name || '未保存方案';
  list.find('.st-esg-component-section').eq(1).find('.st-esg-import-group-title').after(`<small class="st-esg-component-section-context">当前预设：${escapeHtml(currentPresetSchemeName)}</small>`);
  const currentCharacterName = getCurrentCharacterNameSafe(getContext()) || '未选择角色';
  list.find('.st-esg-component-section').eq(2).find('.st-esg-import-group-title').after(`<small class="st-esg-component-section-context">当前角色：${escapeHtml(currentCharacterName)}</small>`);
  list.find('.st-esg-component-library-card').on('toggle', function () { componentLibraryOpen = this.open; });
  list.find('.st-esg-library-export-component, .st-esg-library-export-component-group').on('click', (event) => event.stopPropagation());
  list.find('.st-esg-library-export-component').on('change', function () {
    const id = textOf($(this).attr('data-component-id'));
    if ($(this).prop('checked')) exportSelectedComponentIds.add(id); else exportSelectedComponentIds.delete(id);
    renderComponentList();
  });
  list.find('.st-esg-library-export-component-group').on('change', function () {
    const ids = $(this).closest('.st-esg-component-folder').find('.st-esg-component-item').map((_, item) => textOf($(item).attr('data-component-id'))).get().filter(Boolean);
    const allSelected = ids.length > 0 && ids.every((id) => exportSelectedComponentIds.has(id));
    ids.forEach((id) => { if (allSelected) exportSelectedComponentIds.delete(id); else exportSelectedComponentIds.add(id); });
    renderComponentList();
  });
  list.find('.st-esg-library-export-component-group').each(function () {
    const ids = $(this).closest('.st-esg-component-folder').find('.st-esg-component-item').map((_, item) => textOf($(item).attr('data-component-id'))).get().filter(Boolean);
    const selectedCount = ids.filter((id) => exportSelectedComponentIds.has(id)).length;
    $(this).prop('checked', ids.length > 0 && selectedCount === ids.length).prop('indeterminate', selectedCount > 0 && selectedCount < ids.length);
  });
  list.find('.st-esg-component-edit-toggle').on('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    componentEditMode = true;
    renderComponentList();
  });
  list.find('.st-esg-component-edit-exit').on('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    resetComponentEditMode();
    renderComponentList();
  });
  list.find('.st-esg-component-search-input').on('input', function () {
    componentSearchQuery = String($(this).val() || '');
    scheduleComponentListFilters();
  });
  list.find('.st-esg-component-filter-select').on('change', function () {
    componentFilterMode = String($(this).val() || 'all');
    applyComponentListFilters();
  });
  list.find('[data-component-position-after]').on('click', function (event) {
    if (!componentMoveState) return;
    event.preventDefault();
    event.stopPropagation();
    componentMoveState.target = { kind: 'after', componentId: textOf($(this).attr('data-component-position-after')) };
    renderComponentList();
  });
  list.find('[data-component-position-group-start]').on('click', function (event) {
    if (!componentMoveState) return;
    event.preventDefault();
    event.stopPropagation();
    componentMoveState.target = {
      kind: 'group-start',
      scope: normalizeComponentScope($(this).attr('data-component-position-scope')),
      groupId: textOf($(this).attr('data-component-position-group-start')),
    };
    renderComponentList();
  });
  list.find('.st-esg-component-batch-move').on('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    pruneSelectedComponentIds();
    const selectedComponents = settings.components.filter((component) => selectedComponentIds.has(textOf(component?.id)));
    const scopes = new Set(selectedComponents.map((component) => normalizeComponentScope(component.scope)));
    if (!selectedComponents.length) return;
    if (scopes.size !== 1) { notifyStatus('所选组件属于不同归属，请分别移动。', 'warning'); return; }
    const eligibleComponentIds = getComponentPositionEligibleIds(selectedComponents[0]);
    const eligibleComponentIdSet = new Set(eligibleComponentIds);
    if (selectedComponents.some((component) => !eligibleComponentIdSet.has(textOf(component.id)))) {
      notifyStatus('所选组件属于不同归属，请分别移动。', 'warning');
      return;
    }
    resetComponentLibraryFilters();
    theaterMoveState = null;
    componentMoveState = {
      sourceIds: selectedComponents.map((component) => textOf(component.id)),
      target: null,
      eligibleComponentIds,
      batch: true,
    };
    renderComponentList();
  });
  list.find('.st-esg-component-batch-delete').on('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    pruneSelectedComponentIds();
    if (!selectedComponentIds.size) return;
    if (!targetWindow.confirm(`确认删除选中的 ${selectedComponentIds.size} 个组件？此操作无法恢复。`)) return;
    settings.components = settings.components.filter((component) => !selectedComponentIds.has(textOf(component?.id)));
    selectedComponentIds.clear();
    saveSettings();
    renderComponentList();
    notifyStatus('已删除选中的组件。');
  });
  list.find('.st-esg-component-group-create').on('click', async function (event) {
    event.preventDefault();
    event.stopPropagation();
    const scope = normalizeComponentScope($(this).attr('data-scope'));
    const name = await requestTextInputDialog({ title: '新建分组', label: '分组名', placeholder: '输入分组名' });
    if (!name) { notifyStatus('请先输入分组名。', 'warning'); return; }
    if (settings.componentGroups.some((group) => group.scope === scope && group.name === name)) notifyStatus('该归属下已有同名分组，仍将新建独立分组。', 'warning');
    const order = settings.componentGroups.filter((group) => group.scope === scope).reduce((max, group) => Math.max(max, Number(group.order) || 0), -1) + 1;
    settings.componentGroups.push({ id: createNewComponentGroupId(), name, scope, enabled: true, order });
    saveSettings();
    renderComponentList();
  });
  list.find('.st-esg-component-group-actions button').on('click', (event) => event.stopPropagation());
  list.find('.st-esg-component-group-move-up').on('click', function (event) {
    event.preventDefault();
    const groupId = textOf($(this).attr('data-group-id'));
    if (!moveComponentGroupWithinScope(groupId, -1)) return;
    saveSettings();
    renderComponentList();
  });
  list.find('.st-esg-component-group-move-down').on('click', function (event) {
    event.preventDefault();
    const groupId = textOf($(this).attr('data-group-id'));
    if (!moveComponentGroupWithinScope(groupId, 1)) return;
    saveSettings();
    renderComponentList();
  });
  list.find('.st-esg-component-group-rename').on('click', async function (event) {
    event.preventDefault();
    event.stopPropagation();
    const groupId = textOf($(this).attr('data-group-id'));
    if (!groupId) return;
    const group = settings.componentGroups.find((item) => textOf(item?.id) === groupId);
    if (!group) return;
    const name = await requestTextInputDialog({ title: '重命名分组', label: '分组名', placeholder: '输入分组名', value: group.name });
    if (!name) return;
    group.name = name;
    saveSettings();
    renderComponentList();
  });
  list.find('.st-esg-component-group-delete').on('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    const groupId = textOf($(this).attr('data-group-id'));
    if (!groupId) return;
    const group = settings.componentGroups.find((item) => textOf(item?.id) === groupId);
    if (!group) return;
    const memberCount = settings.components.filter((component) => textOf(component?.groupId) === groupId).length;
    const message = memberCount
      ? `确认删除分组「${group.name}」？组内 ${memberCount} 个组件将移到未分组。`
      : `确认删除分组「${group.name}」？`;
    if (!targetWindow.confirm(message)) return;
    settings.components.forEach((component) => {
      if (textOf(component?.groupId) === groupId) component.groupId = '';
    });
    settings.componentGroups = settings.componentGroups.filter((item) => textOf(item?.id) !== groupId);
    saveSettings();
    renderComponentList();
  });
  list.find('.st-esg-component-select, .st-esg-component-group-select').on('click', (event) => event.stopPropagation());
  list.find('.st-esg-component-select').on('change', function (event) {
    event.stopPropagation();
    const componentId = textOf($(this).attr('data-component-id'));
    if (!componentId) return;
    if ($(this).prop('checked')) selectedComponentIds.add(componentId);
    else selectedComponentIds.delete(componentId);
    updateComponentEditSelectionUi();
  });
  list.find('.st-esg-component-group-select').on('change', function (event) {
    event.stopPropagation();
    const componentIds = $(this).closest('.st-esg-component-folder').find('.st-esg-component-item').map((_, item) => textOf($(item).attr('data-component-id'))).get().filter(Boolean);
    const allSelected = componentIds.length > 0 && componentIds.every((id) => selectedComponentIds.has(id));
    componentIds.forEach((id) => {
      if (allSelected) selectedComponentIds.delete(id);
      else selectedComponentIds.add(id);
    });
    updateComponentEditSelectionUi();
  });
  list.find('.st-esg-component-group-toggle-items').on('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    const ids = $(this).closest('.st-esg-component-folder').find('.st-esg-component-item').map((_, item) => textOf($(item).attr('data-component-id'))).get().filter(Boolean);
    const groupItems = ids.map((id) => findComponentById(id)).filter(Boolean);
    if (!groupItems.length) return;
    const allEnabled = groupItems.every((item) => item.enabled !== false);
    groupItems.forEach((item) => { item.enabled = !allEnabled; });
    saveSettings();
    renderComponentList();
  });
  list.find('.st-esg-component-item-actions button').on('click', (event) => event.stopPropagation());
  list.find('.st-esg-component-move-up').on('click', function (event) {
    event.preventDefault();
    const componentId = textOf($(this).closest('.st-esg-component-item').attr('data-component-id'));
    if (!moveComponentWithinGroup(componentId, -1)) return;
    saveSettings();
    renderComponentList();
  });
  list.find('.st-esg-component-move-down').on('click', function (event) {
    event.preventDefault();
    const componentId = textOf($(this).closest('.st-esg-component-item').attr('data-component-id'));
    if (!moveComponentWithinGroup(componentId, 1)) return;
    saveSettings();
    renderComponentList();
  });
  list.find('.st-esg-component-move-to').on('click', function (event) {
    event.preventDefault();
    const componentId = textOf($(this).closest('.st-esg-component-item').attr('data-component-id'));
    const component = findComponentById(componentId);
    if (!component) return;
    selectedComponentIds.clear();
    resetComponentLibraryFilters();
    theaterMoveState = null;
    componentMoveState = {
      sourceIds: [componentId],
      target: null,
      eligibleComponentIds: getComponentPositionEligibleIds(component),
      batch: false,
    };
    renderComponentList();
  });
  $t('.st-esg-component-folder-head .st-esg-switch').on('click', (event) => event.stopPropagation());
  $t('.st-esg-component-group-enabled').on('click', (event) => event.stopPropagation());
  $t('.st-esg-component-group-enabled').on('change', function () {
    const groupId = textOf($(this).attr('data-group-id'));
    if (!groupId) return;
    const group = settings.componentGroups.find((item) => textOf(item?.id) === groupId);
    if (!group) return;
    group.enabled = Boolean($(this).prop('checked'));
    saveSettings();
    renderComponentList();
  });
  $t('.st-esg-component-default-group-enabled').on('click', (event) => event.stopPropagation());
  $t('.st-esg-component-default-group-enabled').on('change', function () {
    const scope = normalizeComponentScope($(this).attr('data-scope'));
    settings.defaultGroupEnabled[scope] = Boolean($(this).prop('checked'));
    saveSettings();
    renderComponentList();
  });
  $t('.st-esg-component-item-head .st-esg-switch').on('click', (event) => event.stopPropagation());
  $t('.st-esg-component-enabled').on('click', (event) => event.stopPropagation());
  $t('.st-esg-component-enabled').on('change', function () {
    const component = findComponentById($(this).closest('.st-esg-component-item').attr('data-component-id'));
    if (!component) return;
    component.enabled = Boolean($(this).prop('checked'));
    saveSettings();
    renderComponentList();
  });
  $t('.st-esg-component-delete').on('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    const componentId = textOf($(this).closest('.st-esg-component-item').attr('data-component-id'));
    const component = findComponentById(componentId);
    if (!component) return;
    const name = component.name || '未命名组件';
    if (!targetWindow.confirm(`确认删除组件“${name}”？此操作无法恢复。`)) return;
    settings.components = settings.components.filter((item) => textOf(item?.id) !== componentId);
    selectedComponentIds.delete(componentId);
    saveSettings();
    renderComponentList();
    notifyStatus('已删除组件。');
  });
  $t('.st-esg-component-item').on('toggle', function () {
    if (componentMoveState) { this.open = false; return; }
    if (!this.open) return;
    const preview = this.querySelector('.st-esg-component-preview');
    if (!preview || preview.dataset.loaded === 'true') return;
    const item = findComponentById($(this).attr('data-component-id'));
    if (!item) return;
    preview.innerHTML = renderComponentPreview(item);
    preview.dataset.loaded = 'true';
  });
  list.off('.stEsgComponentEditor');
  list.on('click.stEsgComponentEditor', '.st-esg-component-name-input, .st-esg-component-content', (event) => event.stopPropagation());
  list.on('click.stEsgComponentEditor', '.st-esg-component-edit-confirm', function (event) {
    event.preventDefault();
    event.stopPropagation();
    const item = findComponentById($(this).closest('.st-esg-component-item').attr('data-component-id'));
    if (!item) return;
    const editor = $(this).closest('.st-esg-component-editor');
    item.name = textOf(editor.find('.st-esg-component-name-input').val());
    item.content = String(editor.find('.st-esg-component-content').val() || '');
    saveSettings();
    notifyStatus('已保存组件内容。');
    updateComponentEditorSummary(editor, item);
    applyComponentListFilters();
  });
  list.on('click.stEsgComponentEditor', '.st-esg-component-edit-cancel', function (event) {
    event.preventDefault();
    event.stopPropagation();
    const item = findComponentById($(this).closest('.st-esg-component-item').attr('data-component-id'));
    if (!item) return;
    const editor = $(this).closest('.st-esg-component-editor');
    editor.find('.st-esg-component-name-input').val(item.name || '');
    editor.find('.st-esg-component-content').val(item.content || '');
    notifyStatus('已取消编辑。');
  });
  restoreComponentLibraryViewState(componentViewState);
  applyComponentListFilters();
  renderComponentPositionMoveFooter();
  renderTheaterLibrary();
  bindLibraryTransferControls();
}

function updateComponentEditorSummary(editor, item) {
  editor.closest('.st-esg-component-item').find('.st-esg-component-name').first().text(item.name || '未命名组件');
}

function ensureComponentLibraryEnhancements() {
  const componentList = $t('#st-esg-component-list');
  if (!componentList.length) return;
  const componentPanel = componentList.closest('[data-tab-panel="components"]');
  componentPanel.find('.st-esg-library-transfer-toolbar, #st-esg-library-import-file').remove();
  if (componentPanel.length) componentList.before(renderLibraryTransferToolbar());
  if (!$t('#st-esg-theater-list').length) componentList.after('<div id="st-esg-theater-list" class="st-esg-component-list st-esg-theater-list"></div>');
  const manualCard = $t('#st-esg-component-name').closest('.st-esg-card');
  if (manualCard.length && !$t('#st-esg-component-target-library').length) {
    const scopeLabel = $t('#st-esg-component-scope').closest('label');
    scopeLabel.before('<label>添加到<select id="st-esg-component-target-library" class="text_pole"><option value="components">组件库</option><option value="theater">小剧场库</option></select></label>');
  }
  [
    ['#st-esg-import-target-scope', 'st-esg-import-target-library'],
    ['#st-esg-worldbook-import-target-scope', 'st-esg-worldbook-import-target-library'],
  ].forEach(([scopeSelector, libraryId]) => {
    const scope = $t(scopeSelector);
    if (!scope.length || $t(`#${libraryId}`).length) return;
    scope.closest('label').before(`<label>导入到<select id="${libraryId}" class="text_pole"><option value="components">组件库</option><option value="theater">小剧场库</option></select></label>`);
  });
  renderComponentLibraryTargetVisibility();
}

function renderComponentLibraryTargetVisibility() {
  const manualTheater = textOf($t('#st-esg-component-target-library').val()) === 'theater';
  const manualScope = $t('#st-esg-component-scope');
  manualScope.closest('label').toggle(!manualTheater);
  $t('#st-esg-component-preset-scheme').closest('label').toggle(!manualTheater && manualScope.val() === COMPONENT_SCOPE_PRESET);
  $t('#st-esg-add-component span').text(manualTheater ? '添加到小剧场库' : '添加到组件库');
  [
    ['#st-esg-import-target-library', '#st-esg-import-target-scope', '#st-esg-import-preset-scheme'],
    ['#st-esg-worldbook-import-target-library', '#st-esg-worldbook-import-target-scope', '#st-esg-worldbook-import-preset-scheme'],
  ].forEach(([librarySelector, scopeSelector, bindingSelector]) => {
    const theater = textOf($t(librarySelector).val()) === 'theater';
    const scope = $t(scopeSelector);
    scope.closest('label').toggle(!theater);
    $t(bindingSelector).closest('label').toggle(!theater && scope.val() === COMPONENT_SCOPE_PRESET);
  });
}

function findTheaterItemById(id) {
  const itemId = textOf(id);
  return itemId ? settings.theaterComponents.find((item) => textOf(item?.id) === itemId) || null : null;
}

function getTheaterSiblingIndexes(itemId) {
  const sourceIndex = settings.theaterComponents.findIndex((item) => textOf(item?.id) === textOf(itemId));
  const item = settings.theaterComponents[sourceIndex];
  if (!item) return { sourceIndex: -1, siblingIndexes: [] };
  const groupId = textOf(item.groupId);
  const siblingIndexes = settings.theaterComponents.reduce((indexes, candidate, index) => {
    if (textOf(candidate?.groupId) === groupId) indexes.push(index);
    return indexes;
  }, []);
  return { sourceIndex, siblingIndexes };
}

function moveTheaterItemWithinGroup(itemId, direction) {
  const { sourceIndex, siblingIndexes } = getTheaterSiblingIndexes(itemId);
  const siblingPosition = siblingIndexes.indexOf(sourceIndex);
  const targetIndex = siblingIndexes[siblingPosition + direction];
  if (sourceIndex < 0 || !Number.isInteger(targetIndex)) return false;
  [settings.theaterComponents[sourceIndex], settings.theaterComponents[targetIndex]] = [settings.theaterComponents[targetIndex], settings.theaterComponents[sourceIndex]];
  return true;
}

function moveTheaterGroupWithinLibrary(groupId, direction) {
  const groups = [...settings.theaterGroups].sort((left, right) => Number(left.order) - Number(right.order));
  const position = groups.findIndex((group) => textOf(group?.id) === textOf(groupId));
  const target = groups[position + direction];
  const group = groups[position];
  if (!group || !target) return false;
  [group.order, target.order] = [target.order, group.order];
  return true;
}

function moveTheaterItemToGroup(itemId, targetGroupId) {
  const sourceIndex = settings.theaterComponents.findIndex((item) => textOf(item?.id) === textOf(itemId));
  const item = settings.theaterComponents[sourceIndex];
  if (!item) return false;
  const groupId = textOf(targetGroupId);
  if (groupId && !settings.theaterGroups.some((group) => textOf(group?.id) === groupId)) return false;
  if (textOf(item.groupId) === groupId) return false;
  settings.theaterComponents.splice(sourceIndex, 1);
  item.groupId = groupId;
  let insertIndex = settings.theaterComponents.length;
  settings.theaterComponents.forEach((candidate, index) => {
    if (textOf(candidate?.groupId) === groupId) insertIndex = index + 1;
  });
  settings.theaterComponents.splice(insertIndex, 0, item);
  return true;
}

function renderTheaterPreview(item) {
  if (!theaterEditMode) return `<pre>${escapeHtml(item.content || '')}</pre>`;
  return `<div class="st-esg-component-editor"><input class="text_pole st-esg-theater-name-input" type="text" value="${escapeHtml(item.name || '')}" placeholder="小剧场名称" /><textarea class="text_pole textarea_compact st-esg-textarea st-esg-theater-content" rows="7">${escapeHtml(item.content || '')}</textarea><div class="st-esg-source-actions"><button class="menu_button st-esg-source-confirm st-esg-theater-edit-confirm" type="button">确认</button><button class="menu_button st-esg-source-cancel st-esg-theater-edit-cancel" type="button">取消</button></div></div>`;
}

function theaterMatchesFilter(item) {
  const query = theaterSearchQuery.trim().toLocaleLowerCase();
  const searchableText = `${item.name || ''}\n${item.content || ''}`.toLocaleLowerCase();
  return (!query || searchableText.includes(query))
    && (theaterFilterMode === 'all' || (theaterFilterMode === 'enabled' && item.enabled !== false) || (theaterFilterMode === 'disabled' && item.enabled === false));
}

function applyTheaterLibraryFilters() {
  const host = $t('#st-esg-theater-list');
  if (!host.length) return;
  const filtering = Boolean(theaterSearchQuery.trim()) || theaterFilterMode !== 'all';
  let visible = 0;
  host.find('.st-esg-theater-item').each(function () {
    const item = findTheaterItemById($(this).attr('data-component-id'));
    const matches = Boolean(item) && theaterMatchesFilter(item);
    $(this).toggleClass('st-esg-hidden', !matches);
    if (matches) visible += 1;
  });
  host.find('.st-esg-theater-folder').each(function () {
    const folder = $(this);
    const visibleItems = folder.find('.st-esg-theater-item').not('.st-esg-hidden').length;
    folder.toggleClass('st-esg-hidden', visibleItems === 0 && filtering);
  });
  host.find('.st-esg-theater-count').text(`${visible} / ${settings.theaterComponents.length}`);
  const visibleIds = new Set(host.find('.st-esg-theater-item').not('.st-esg-hidden').map((_, item) => textOf($(item).attr('data-component-id'))).get());
  const hiddenCount = [...selectedTheaterIds].filter((id) => !visibleIds.has(id)).length;
  host.find('.st-esg-theater-selection-count').text(selectedTheaterIds.size ? `已选 ${selectedTheaterIds.size} 项${hiddenCount ? `（${hiddenCount} 项已筛选隐藏）` : ''}` : '未选择项目');
  host.find('.st-esg-theater-batch-move, .st-esg-theater-batch-delete').prop('disabled', selectedTheaterIds.size === 0);
}

function scheduleTheaterLibraryFilters() {
  if (theaterLibraryFilterScheduled) return;
  theaterLibraryFilterScheduled = true;
  const flush = () => {
    theaterLibraryFilterScheduled = false;
    applyTheaterLibraryFilters();
  };
  if (typeof targetWindow.requestAnimationFrame === 'function') targetWindow.requestAnimationFrame(flush);
  else targetWindow.setTimeout(flush, 0);
}

function getTheaterRandomModeLabel(mode) {
  const normalized = normalizeTheaterRandomMode(mode);
  if (normalized === THEATER_RANDOM_MODE_OFF) return '关闭随机';
  if (normalized === THEATER_RANDOM_MODE_ALL) return '全部随机';
  if (normalized === THEATER_RANDOM_MODE_ENABLED) return '已启用条目随机';
  return '启用固定 + 未启用随机';
}

function getTheaterRandomModeDescription(mode) {
  const normalized = normalizeTheaterRandomMode(mode);
  if (normalized === THEATER_RANDOM_MODE_OFF) return '关闭随机时只发送已启用的条目。';
  if (normalized === THEATER_RANDOM_MODE_ALL) return '从当前随机池的全部条目中抽取。';
  if (normalized === THEATER_RANDOM_MODE_ENABLED) return '只从当前随机池的已启用条目中抽取。';
  return '已启用内容固定发送，再从未启用内容中随机抽取。';
}

function renderTheaterRandomModeOptions(mode) {
  const normalized = normalizeTheaterRandomMode(mode);
  return [
    [THEATER_RANDOM_MODE_OFF, '关闭随机'],
    [THEATER_RANDOM_MODE_ALL, '全部随机'],
    [THEATER_RANDOM_MODE_ENABLED, '已启用条目随机'],
    [THEATER_RANDOM_MODE_FIXED_ENABLED, '启用固定 + 未启用随机'],
  ].map(([value, label]) => `<option value="${value}" ${normalized === value ? 'selected' : ''}>${label}</option>`).join('');
}

function theaterRandomCountMarkup(mode, count, className, dataAttributes = '', prefix = '') {
  const normalized = normalizeTheaterRandomMode(mode);
  if (normalized === THEATER_RANDOM_MODE_OFF) return '<span class="st-esg-theater-random-count-placeholder">无需设置数量</span>';
  return `<span class="st-esg-theater-random-count-value">${prefix ? `<span>${escapeHtml(prefix)}</span>` : ''}<input class="text_pole st-esg-theater-random-count ${className}" type="number" min="0" step="1" value="${normalizeTheaterRandomCount(count)}" ${dataAttributes} /><span>条</span></span>`;
}

function getTheaterRandomOverride(groupId) {
  const cleanId = textOf(groupId);
  return settings.theaterGroupRandomOverrides.find((override) => textOf(override?.groupId) === cleanId) || null;
}

function getTheaterGroupRandomDisplayName(group) {
  return group?.name || '默认分组';
}

function getTheaterRandomGroupCandidates(groups) {
  const used = new Set(settings.theaterGroupRandomOverrides.map((override) => textOf(override?.groupId)));
  return groups.filter((group) => {
    const groupId = group.isDefault ? THEATER_DEFAULT_GROUP_ID : textOf(group.id);
    return groupId && !used.has(groupId);
  });
}

function renderTheaterLibrary() {
  const host = $t('#st-esg-theater-list');
  if (!host.length) return;
  const moveSources = theaterMoveState?.sourceIds?.map(findTheaterItemById).filter(Boolean) || [];
  if (theaterMoveState && moveSources.length !== theaterMoveState.sourceIds.length) theaterMoveState = null;
  const theaterMoveActive = Boolean(theaterMoveState && moveSources.length);
  const moveSourceName = theaterMoveActive ? (moveSources[0].name || '未命名小剧场') : '';
  const moveSourceIdSet = new Set(theaterMoveState?.sourceIds || []);
  const moveSourceLabel = theaterMoveState?.batch ? `${theaterMoveState.sourceIds.length} 个选中条目` : `「${moveSourceName}」`;
  const openFolders = new Set(host.find('.st-esg-theater-folder[open]').map((_, item) => textOf($(item).attr('data-folder-state-id'))).get());
  const openItems = new Set(host.find('.st-esg-theater-item[open]').map((_, item) => textOf($(item).attr('data-component-id'))).get());
  const currentLibraryOpen = host.find('.st-esg-theater-library-card').prop('open');
  if (typeof currentLibraryOpen === 'boolean') theaterLibraryOpen = currentLibraryOpen;
  const randomSettingsOpen = host.find('.st-esg-theater-random-settings').prop('open');
  if (typeof randomSettingsOpen === 'boolean') theaterRandomSettingsOpen = randomSettingsOpen;
  const folders = getTheaterLibraryFolders(settings.theaterComponents, settings.theaterGroups, settings.theaterDefaultGroupEnabled);
  const groups = [...folders.groups, { id: '', name: '默认分组', enabled: settings.theaterDefaultGroupEnabled !== false, items: folders.ungrouped, isDefault: true }];
  const editButton = theaterMoveActive || theaterEditMode || libraryExportMode ? '' : '<button class="menu_button menu_button_icon st-esg-secondary-action st-esg-theater-edit-toggle" type="button"><i class="fa-solid fa-pen-to-square"></i><span>编辑</span></button>';
  const editToolbar = theaterMoveActive ? '' : theaterEditMode
    ? '<div class="st-esg-component-edit-toolbar"><span class="st-esg-theater-selection-count">未选择项目</span><span class="st-esg-component-batch-actions"><button class="menu_button menu_button_icon st-esg-secondary-action st-esg-theater-batch-move" type="button" disabled><i class="fa-solid fa-arrow-down-wide-short"></i><span>移动</span></button><button class="menu_button menu_button_icon st-esg-secondary-action st-esg-icon-danger st-esg-theater-batch-delete" type="button" disabled><i class="fa-solid fa-trash"></i><span>删除</span></button><button class="menu_button menu_button_icon st-esg-secondary-action st-esg-theater-edit-exit" type="button"><i class="fa-solid fa-check"></i><span>退出</span></button></span></div>'
    : '';
  const randomScope = normalizeTheaterRandomScope(settings.theaterRandomScope);
  const globalMode = normalizeTheaterRandomMode(settings.theaterRandomMode);
  const groupedFallbackMode = normalizeTheaterRandomMode(settings.theaterGroupedFallbackMode);
  const overrideGroups = groups
    .map((group) => ({ ...group, randomGroupId: group.isDefault ? THEATER_DEFAULT_GROUP_ID : textOf(group.id) }))
    .filter((group) => getTheaterRandomOverride(group.randomGroupId));
  const groupCandidates = getTheaterRandomGroupCandidates(groups);
  const globalRandomSettingsMarkup = `<div class="st-esg-theater-random-panel st-esg-theater-random-panel-global${randomScope === THEATER_RANDOM_SCOPE_GLOBAL ? '' : ' st-esg-hidden'}"><div class="st-esg-theater-random-fields"><span class="st-esg-theater-random-label">随机模式</span><select class="text_pole st-esg-theater-global-mode">${renderTheaterRandomModeOptions(globalMode)}</select><span class="st-esg-theater-random-label">随机数量</span>${theaterRandomCountMarkup(globalMode, settings.theaterRandomCount, 'st-esg-theater-global-count')}</div><span class="st-esg-card-desc st-esg-theater-random-description">${getTheaterRandomModeDescription(globalMode)}</span></div>`;
  const overrideRows = overrideGroups.map((group) => {
    const override = getTheaterRandomOverride(group.randomGroupId);
    const groupLabel = getTheaterGroupRandomDisplayName(group);
     return `<div class="st-esg-theater-random-group-row" data-group-id="${escapeHtml(group.randomGroupId)}"><span class="st-esg-theater-random-group-name">${escapeHtml(groupLabel)}</span><select class="text_pole st-esg-theater-group-mode" data-group-id="${escapeHtml(group.randomGroupId)}">${renderTheaterRandomModeOptions(override.mode)}</select><span class="st-esg-theater-random-group-count">${theaterRandomCountMarkup(override.mode, override.count, 'st-esg-theater-group-count', `data-group-id="${escapeHtml(group.randomGroupId)}"`, '随机')}</span><button class="st-esg-icon-btn st-esg-icon-danger st-esg-theater-random-remove-group" type="button" data-group-id="${escapeHtml(group.randomGroupId)}" title="移除指定规则" aria-label="移除指定规则"><i class="fa-solid fa-trash"></i></button></div>`;
  }).join('');
  const addGroupMarkup = groupCandidates.length
    ? `<div class="st-esg-theater-random-add-group"><select class="text_pole st-esg-theater-random-add-group-select"><option value="">选择要单独设置的分组</option>${groupCandidates.map((group) => `<option value="${escapeHtml(group.isDefault ? THEATER_DEFAULT_GROUP_ID : textOf(group.id))}">${escapeHtml(getTheaterGroupRandomDisplayName(group))}</option>`).join('')}</select><button class="menu_button st-esg-secondary-action st-esg-theater-random-add-group-button" type="button"><i class="fa-solid fa-plus"></i><span>添加指定组</span></button></div>`
    : '<span class="st-esg-card-desc st-esg-theater-random-empty-groups">所有分组都已单独设置。</span>';
  const groupedRandomSettingsMarkup = `<div class="st-esg-theater-random-panel st-esg-theater-random-panel-grouped${randomScope === THEATER_RANDOM_SCOPE_GROUPED ? '' : ' st-esg-hidden'}"><div class="st-esg-theater-random-subsection"><strong>非指定组</strong><span>所有未单独设置的分组合并为一个随机池。</span></div><div class="st-esg-theater-random-fields"><span class="st-esg-theater-random-label">随机模式</span><select class="text_pole st-esg-theater-grouped-fallback-mode">${renderTheaterRandomModeOptions(groupedFallbackMode)}</select><span class="st-esg-theater-random-label">随机数量</span>${theaterRandomCountMarkup(groupedFallbackMode, settings.theaterGroupedFallbackCount, 'st-esg-theater-grouped-fallback-count')}</div><span class="st-esg-card-desc st-esg-theater-random-description">${getTheaterRandomModeDescription(groupedFallbackMode)}</span><div class="st-esg-theater-random-subsection st-esg-theater-random-subsection-specified"><strong>指定组</strong><span>单独设置的分组会从非指定组池中移出。</span></div>${addGroupMarkup}<div class="st-esg-theater-random-group-list">${overrideRows || '<span class="st-esg-card-desc st-esg-theater-random-empty-groups">暂未添加指定组。</span>'}</div></div>`;
  const mode = globalMode;
  const modeLabel = getTheaterRandomModeLabel(globalMode);
  const modeDescription = getTheaterRandomModeDescription(globalMode);
  const theaterRandomSettingsV2ScopeMarkup = `<div class="st-esg-theater-random-scope-row"><span class="st-esg-theater-random-label">计算方式</span><div class="st-esg-theater-random-scope-options" role="radiogroup" aria-label="计算方式"><label class="st-esg-theater-random-scope-option"><input class="st-esg-theater-random-scope" type="radio" name="st-esg-theater-random-scope" value="global" ${randomScope === THEATER_RANDOM_SCOPE_GLOBAL ? 'checked' : ''} /><span>全局随机</span></label><label class="st-esg-theater-random-scope-option"><input class="st-esg-theater-random-scope" type="radio" name="st-esg-theater-random-scope" value="grouped" ${randomScope === THEATER_RANDOM_SCOPE_GROUPED ? 'checked' : ''} /><span>按组随机</span></label></div></div>`;
  const theaterRandomSettingsMarkupV2 = `<details class="st-esg-theater-random-settings" ${theaterRandomSettingsOpen ? 'open' : ''}><summary class="st-esg-theater-random-summary"><span>随机设置</span><em>${randomScope === THEATER_RANDOM_SCOPE_GLOBAL ? '全局随机' : '按组随机'}</em><i class="fa-solid fa-chevron-down st-esg-theater-random-caret"></i></summary><div class="st-esg-theater-random-body">${theaterRandomSettingsV2ScopeMarkup}${globalRandomSettingsMarkup}${groupedRandomSettingsMarkup}</div></details>`;
  const renderItem = (item) => {
    const isOpen = !theaterMoveActive && openItems.has(item.id);
    const canSelectPosition = theaterMoveActive && !moveSourceIdSet.has(textOf(item.id));
    const isPositionTarget = canSelectPosition
      && theaterMoveState?.target?.kind === 'after'
      && textOf(theaterMoveState.target.componentId) === textOf(item.id);
    const positionClasses = theaterMoveActive
      ? ` ${canSelectPosition ? 'is-position-candidate' : 'is-position-unavailable'}${isPositionTarget ? ' is-position-target' : ''}`
      : '';
    const positionAttribute = canSelectPosition ? ` data-theater-position-after="${escapeHtml(item.id)}"` : '';
    const controls = theaterMoveActive ? '' : libraryExportMode
      ? `<label class="st-esg-checkbox st-esg-library-export-select-label" title="选择导出"><input class="st-esg-library-export-theater" type="checkbox" data-component-id="${escapeHtml(item.id)}" aria-label="选择导出" ${exportSelectedTheaterIds.has(item.id) ? 'checked' : ''} /></label>`
      : theaterEditMode
        ? `<label class="st-esg-checkbox st-esg-component-select-label" title="选择小剧场"><input class="st-esg-theater-select" type="checkbox" data-component-id="${escapeHtml(item.id)}" ${selectedTheaterIds.has(item.id) ? 'checked' : ''} /></label>`
        : `<label class="st-esg-switch st-esg-switch-sm"><input class="st-esg-theater-enabled" type="checkbox" ${item.enabled === false ? '' : 'checked'} /><span></span></label>`;
    const { sourceIndex, siblingIndexes } = getTheaterSiblingIndexes(item.id);
    const siblingPosition = siblingIndexes.indexOf(sourceIndex);
    const actions = theaterMoveActive ? '' : theaterEditMode
      ? `<span class="st-esg-component-item-actions"><button class="st-esg-icon-btn st-esg-theater-move-up" type="button" data-component-id="${escapeHtml(item.id)}" ${siblingPosition <= 0 ? 'disabled' : ''}><i class="fa-solid fa-chevron-up"></i></button><button class="st-esg-icon-btn st-esg-theater-move-down" type="button" data-component-id="${escapeHtml(item.id)}" ${siblingPosition < 0 || siblingPosition >= siblingIndexes.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-down"></i></button><button class="st-esg-icon-btn st-esg-theater-move-to" type="button" data-component-id="${escapeHtml(item.id)}"><i class="fa-solid fa-arrow-down-wide-short"></i></button><button class="st-esg-icon-btn st-esg-icon-danger st-esg-theater-delete" type="button" data-component-id="${escapeHtml(item.id)}"><i class="fa-solid fa-trash"></i></button></span>`
      : '';
    const positionPreview = isPositionTarget ? `<div class="st-esg-component-position-preview">↓ ${escapeHtml(moveSourceLabel)}将插入到这里</div>` : '';
    return `<details class="st-esg-component-item st-esg-theater-item${positionClasses}" data-component-id="${escapeHtml(item.id)}" ${isOpen ? 'open' : ''}><summary class="st-esg-component-item-head"${positionAttribute}><span class="st-esg-component-name">${escapeHtml(item.name || '未命名小剧场')}</span>${controls}${actions}</summary><div class="st-esg-component-preview" data-loaded="${isOpen ? 'true' : 'false'}">${isOpen ? renderTheaterPreview(item) : ''}</div></details>${positionPreview}`;
  };
  const folderHtml = groups.map((group) => {
    const groupId = textOf(group.id);
    const folderStateId = `theater::${group.isDefault ? '__default__' : groupId}`;
    const groupEnabled = group.enabled !== false;
    const enabledCount = group.items.filter((item) => item.enabled !== false).length;
    const allItemsEnabled = group.items.length > 0 && enabledCount === group.items.length;
    const orderedGroups = [...settings.theaterGroups].sort((left, right) => Number(left.order) - Number(right.order));
    const groupPosition = orderedGroups.findIndex((item) => textOf(item?.id) === groupId);
    const groupStartSelected = theaterMoveActive
      && theaterMoveState?.target?.kind === 'group-start'
      && textOf(theaterMoveState.target.groupId) === groupId;
    const controls = theaterMoveActive ? '' : libraryExportMode
      ? `<label class="st-esg-checkbox st-esg-library-export-select-label" title="选择本组导出"><input class="st-esg-library-export-theater-group" type="checkbox" aria-label="选择本组导出" /></label>`
      : theaterEditMode
        ? `<label class="st-esg-checkbox st-esg-component-group-select-label"><input class="st-esg-theater-group-select" type="checkbox" /></label>`
        : group.isDefault
        ? `<label class="st-esg-switch st-esg-switch-sm"><input class="st-esg-theater-default-enabled" type="checkbox" ${groupEnabled ? 'checked' : ''} /><span></span></label>`
        : `<label class="st-esg-switch st-esg-switch-sm"><input class="st-esg-theater-group-enabled" type="checkbox" data-group-id="${escapeHtml(groupId)}" ${groupEnabled ? 'checked' : ''} /><span></span></label>`;
    const actions = !theaterMoveActive && theaterEditMode && !group.isDefault
      ? `<span class="st-esg-component-group-actions"><button class="st-esg-icon-btn st-esg-theater-group-up" type="button" data-group-id="${escapeHtml(groupId)}" ${groupPosition <= 0 ? 'disabled' : ''}><i class="fa-solid fa-chevron-up"></i></button><button class="st-esg-icon-btn st-esg-theater-group-down" type="button" data-group-id="${escapeHtml(groupId)}" ${groupPosition < 0 || groupPosition >= orderedGroups.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-down"></i></button><button class="st-esg-icon-btn st-esg-theater-group-rename" type="button" data-group-id="${escapeHtml(groupId)}"><i class="fa-solid fa-pen"></i></button><button class="st-esg-icon-btn st-esg-icon-danger st-esg-theater-group-delete" type="button" data-group-id="${escapeHtml(groupId)}"><i class="fa-solid fa-trash"></i></button></span>`
      : '';
    const createGroupButton = !theaterMoveActive && theaterEditMode && group.isDefault ? '<button class="st-esg-icon-btn st-esg-theater-group-create" type="button"><i class="fa-solid fa-folder-plus"></i></button>' : '';
    const body = group.items.length ? group.items.map(renderItem).join('') : '<div class="st-esg-empty st-esg-empty-small">暂无小剧场</div>';
    const toggleItemsButton = group.items.length
      && !libraryExportMode && !theaterMoveActive ? `<button class="menu_button menu_button_icon st-esg-secondary-action st-esg-theater-group-toggle-items" type="button" data-group-id="${escapeHtml(groupId)}"><i class="fa-solid ${allItemsEnabled ? 'fa-toggle-off' : 'fa-toggle-on'}"></i><span>${allItemsEnabled ? '关闭全部条目' : '开启全部条目'}</span></button>`
      : '';
    const groupStartPreview = groupStartSelected ? `<div class="st-esg-component-position-preview">↓ ${escapeHtml(moveSourceLabel)}将插入到这里</div>` : '';
    const groupStartTarget = theaterMoveActive ? `<button class="st-esg-component-position-target st-esg-component-position-target-top${groupStartSelected ? ' is-position-target' : ''}" type="button" data-theater-position-group-start="${escapeHtml(groupId)}">插入到本组顶部</button>${groupStartPreview}` : '';
    const groupContent = `<div class="st-esg-theater-group-content"><div class="st-esg-theater-group-toolbar">${toggleItemsButton}</div><div class="st-esg-theater-group-items">${groupStartTarget}${body}</div></div>`;
    return `<details class="st-esg-component-folder st-esg-theater-folder${groupEnabled ? '' : ' st-esg-component-folder-is-disabled'}" data-group-id="${escapeHtml(groupId)}" data-folder-state-id="${escapeHtml(folderStateId)}" ${openFolders.has(folderStateId) ? 'open' : ''}><summary class="st-esg-component-folder-head"><span class="st-esg-component-folder-title">${escapeHtml(group.name)}</span><em class="st-esg-component-folder-count${groupEnabled ? '' : ' is-disabled'}">${enabledCount}/${group.items.length}</em>${controls}${actions}${createGroupButton}<i class="fa-solid fa-chevron-down st-esg-component-folder-caret"></i></summary><div class="st-esg-component-folder-body">${groupContent}</div></details>`;
  }).join('');
  const theaterRandomSettingsMarkup = `<details class="st-esg-theater-random-settings" ${theaterRandomSettingsOpen ? 'open' : ''}><summary class="st-esg-theater-random-summary"><span>随机设置</span><em>${modeLabel}</em><i class="fa-solid fa-chevron-down st-esg-theater-random-caret"></i></summary><div class="st-esg-theater-random-body"><div class="st-esg-theater-random-fields"><span class="st-esg-theater-random-label">随机模式</span><select class="text_pole st-esg-theater-random-mode"><option value="off" ${mode === THEATER_RANDOM_MODE_OFF ? 'selected' : ''}>关闭随机</option><option value="all" ${mode === THEATER_RANDOM_MODE_ALL ? 'selected' : ''}>全部随机</option><option value="enabled" ${mode === THEATER_RANDOM_MODE_ENABLED ? 'selected' : ''}>已启用条目随机</option><option value="fixed-enabled" ${mode === THEATER_RANDOM_MODE_FIXED_ENABLED ? 'selected' : ''}>启用固定 + 未启用随机</option></select><span class="st-esg-theater-random-label">随机数量</span><input class="text_pole st-esg-theater-random-count" type="number" min="0" step="1" value="${settings.theaterRandomCount}" /></div><span class="st-esg-card-desc st-esg-theater-random-description">${modeDescription}</span></div></details>`;
  const toolbarDisabled = theaterMoveActive ? 'disabled' : '';
  host.html(`<details class="st-esg-card st-esg-component-library-card st-esg-library-collapsible st-esg-theater-library-card${theaterMoveActive ? ' st-esg-component-position-mode' : ''}" ${theaterLibraryOpen ? 'open' : ''}><summary class="st-esg-library-card-summary"><div class="st-esg-card-head"><div><div class="st-esg-card-title">小剧场库</div><div class="st-esg-card-desc">独立管理格式要求和剧情小剧场；启用状态可用于随机抽取。</div></div>${editButton}</div></summary><div class="st-esg-library-card-body">${editToolbar}${theaterMoveActive ? '' : theaterRandomSettingsMarkup}<div class="st-esg-list-toolbar st-esg-component-list-toolbar"><input type="text" class="st-esg-search-input st-esg-theater-search-input text_pole" placeholder="搜索条目..." value="${escapeHtml(theaterSearchQuery)}" ${toolbarDisabled}><select class="st-esg-filter-select st-esg-theater-filter-select text_pole" ${toolbarDisabled}><option value="all" ${theaterFilterMode === 'all' ? 'selected' : ''}>全部</option><option value="enabled" ${theaterFilterMode === 'enabled' ? 'selected' : ''}>仅启用</option><option value="disabled" ${theaterFilterMode === 'disabled' ? 'selected' : ''}>仅禁用</option></select><span class="st-esg-theater-count"></span></div><div class="st-esg-theater-folders">${folderHtml}</div></div></details>`);

  host.find('.st-esg-theater-random-settings').replaceWith(theaterRandomSettingsMarkupV2);
  host.find('.st-esg-theater-library-card').on('toggle', function () { theaterLibraryOpen = this.open; });
  host.find('.st-esg-library-export-theater, .st-esg-library-export-theater-group').on('click', (event) => event.stopPropagation());
  host.find('.st-esg-library-export-theater').on('change', function () {
    const id = textOf($(this).attr('data-component-id'));
    if ($(this).prop('checked')) exportSelectedTheaterIds.add(id); else exportSelectedTheaterIds.delete(id);
    renderComponentList();
  });
  host.find('.st-esg-library-export-theater-group').on('change', function () {
    const ids = $(this).closest('.st-esg-theater-folder').find('.st-esg-theater-item').map((_, item) => textOf($(item).attr('data-component-id'))).get().filter(Boolean);
    const allSelected = ids.length > 0 && ids.every((id) => exportSelectedTheaterIds.has(id));
    ids.forEach((id) => { if (allSelected) exportSelectedTheaterIds.delete(id); else exportSelectedTheaterIds.add(id); });
    renderComponentList();
  });
  host.find('.st-esg-library-export-theater-group').each(function () {
    const ids = $(this).closest('.st-esg-theater-folder').find('.st-esg-theater-item').map((_, item) => textOf($(item).attr('data-component-id'))).get().filter(Boolean);
    const selectedCount = ids.filter((id) => exportSelectedTheaterIds.has(id)).length;
    $(this).prop('checked', ids.length > 0 && selectedCount === ids.length).prop('indeterminate', selectedCount > 0 && selectedCount < ids.length);
  });
  host.find('.st-esg-theater-random-settings').on('toggle', function () { theaterRandomSettingsOpen = this.open; });
  host.find('.st-esg-theater-random-scope').on('change', function () { settings.theaterRandomScope = normalizeTheaterRandomScope($(this).val()); saveSettings(); renderTheaterLibrary(); });
  host.find('.st-esg-theater-global-mode').on('change', function () { settings.theaterRandomMode = normalizeTheaterRandomMode($(this).val()); saveSettings(); renderTheaterLibrary(); });
  host.find('.st-esg-theater-global-count').on('change', function () { settings.theaterRandomCount = normalizeTheaterRandomCount($(this).val()); $(this).val(settings.theaterRandomCount); saveSettings(); renderTheaterLibrary(); });
  host.find('.st-esg-theater-grouped-fallback-mode').on('change', function () { settings.theaterGroupedFallbackMode = normalizeTheaterRandomMode($(this).val()); saveSettings(); renderTheaterLibrary(); });
  host.find('.st-esg-theater-grouped-fallback-count').on('change', function () { settings.theaterGroupedFallbackCount = normalizeTheaterRandomCount($(this).val()); $(this).val(settings.theaterGroupedFallbackCount); saveSettings(); renderTheaterLibrary(); });
  host.find('.st-esg-theater-group-mode').on('change', function () { const groupId = textOf($(this).attr('data-group-id')); const override = getTheaterRandomOverride(groupId); if (!override) return; override.mode = normalizeTheaterRandomMode($(this).val()); saveSettings(); renderTheaterLibrary(); });
  host.find('.st-esg-theater-group-count').on('change', function () { const groupId = textOf($(this).attr('data-group-id')); const override = getTheaterRandomOverride(groupId); if (!override) return; override.count = normalizeTheaterRandomCount($(this).val()); saveSettings(); renderTheaterLibrary(); });
  host.find('.st-esg-theater-random-add-group-button').on('click', function (event) { event.preventDefault(); event.stopPropagation(); const select = host.find('.st-esg-theater-random-add-group-select'); const groupId = textOf(select.val()); if (!groupId || getTheaterRandomOverride(groupId)) return; settings.theaterGroupRandomOverrides.push({ groupId, mode: settings.theaterGroupedFallbackMode, count: settings.theaterGroupedFallbackCount }); saveSettings(); renderTheaterLibrary(); });
  host.find('.st-esg-theater-random-remove-group').on('click', function (event) { event.preventDefault(); event.stopPropagation(); const groupId = textOf($(this).attr('data-group-id')); settings.theaterGroupRandomOverrides = settings.theaterGroupRandomOverrides.filter((override) => textOf(override?.groupId) !== groupId); saveSettings(); renderTheaterLibrary(); });
  host.find('.st-esg-theater-search-input').on('input', function () { theaterSearchQuery = String($(this).val() || ''); scheduleTheaterLibraryFilters(); });
  host.find('.st-esg-theater-filter-select').on('change', function () { theaterFilterMode = String($(this).val() || 'all'); applyTheaterLibraryFilters(); });
  host.find('[data-theater-position-after]').on('click', function (event) {
    if (!theaterMoveState) return;
    event.preventDefault();
    event.stopPropagation();
    theaterMoveState.target = { kind: 'after', componentId: textOf($(this).attr('data-theater-position-after')) };
    renderTheaterLibrary();
  });
  host.find('[data-theater-position-group-start]').on('click', function (event) {
    if (!theaterMoveState) return;
    event.preventDefault();
    event.stopPropagation();
    theaterMoveState.target = {
      kind: 'group-start',
      scope: '',
      groupId: textOf($(this).attr('data-theater-position-group-start')),
    };
    renderTheaterLibrary();
  });
  host.find('.st-esg-theater-edit-toggle').on('click', (event) => { event.preventDefault(); event.stopPropagation(); theaterEditMode = true; renderTheaterLibrary(); });
  host.find('.st-esg-theater-edit-exit').on('click', (event) => { event.preventDefault(); event.stopPropagation(); theaterEditMode = false; theaterMoveState = null; selectedTheaterIds.clear(); renderTheaterLibrary(); });
  host.find('.st-esg-theater-select, .st-esg-theater-group-select').on('click', (event) => event.stopPropagation());
  host.find('.st-esg-theater-select').on('change', function (event) { event.stopPropagation(); const id = textOf($(this).attr('data-component-id')); if ($(this).prop('checked')) selectedTheaterIds.add(id); else selectedTheaterIds.delete(id); applyTheaterLibraryFilters(); });
  host.find('.st-esg-theater-group-select').on('change', function (event) { event.stopPropagation(); const ids = $(this).closest('.st-esg-theater-folder').find('.st-esg-theater-item').map((_, item) => textOf($(item).attr('data-component-id'))).get(); const allSelected = ids.length > 0 && ids.every((id) => selectedTheaterIds.has(id)); ids.forEach((id) => { if (allSelected) selectedTheaterIds.delete(id); else selectedTheaterIds.add(id); }); applyTheaterLibraryFilters(); });
  host.find('.st-esg-theater-group-toggle-items').on('click', function (event) { event.preventDefault(); event.stopPropagation(); const ids = $(this).closest('.st-esg-theater-folder').find('.st-esg-theater-item').map((_, item) => textOf($(item).attr('data-component-id'))).get(); const groupItems = ids.map((id) => findTheaterItemById(id)).filter(Boolean); if (!groupItems.length) return; const allEnabled = groupItems.every((item) => item.enabled !== false); groupItems.forEach((item) => { item.enabled = !allEnabled; }); saveSettings(); renderTheaterLibrary(); });
  host.find('.st-esg-theater-batch-delete').on('click', () => { if (!selectedTheaterIds.size || !targetWindow.confirm(`确认删除选中的 ${selectedTheaterIds.size} 个小剧场？此操作无法恢复。`)) return; settings.theaterComponents = settings.theaterComponents.filter((item) => !selectedTheaterIds.has(textOf(item?.id))); selectedTheaterIds.clear(); saveSettings(); renderComponentList(); notifyStatus('已删除选中的小剧场。'); });
  host.find('.st-esg-theater-batch-move').on('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const selectedItems = settings.theaterComponents.filter((item) => selectedTheaterIds.has(textOf(item?.id)));
    if (!selectedItems.length) return;
    theaterSearchQuery = '';
    theaterFilterMode = 'all';
    componentMoveState = null;
    theaterMoveState = {
      sourceIds: selectedItems.map((item) => textOf(item.id)),
      target: null,
      batch: true,
    };
    renderTheaterLibrary();
  });
  host.find('.st-esg-theater-group-create').on('click', async (event) => { event.preventDefault(); event.stopPropagation(); const name = await requestTextInputDialog({ title: '新建小剧场分组', label: '分组名', placeholder: '输入分组名' }); if (!name) return; const order = settings.theaterGroups.reduce((max, group) => Math.max(max, Number(group.order) || 0), -1) + 1; settings.theaterGroups.push({ id: createNewTheaterGroupId(), name, enabled: true, order }); saveSettings(); renderComponentList(); });
  host.find('.st-esg-theater-group-up, .st-esg-theater-group-down').on('click', function (event) { event.preventDefault(); event.stopPropagation(); if (moveTheaterGroupWithinLibrary($(this).attr('data-group-id'), $(this).hasClass('st-esg-theater-group-up') ? -1 : 1)) { saveSettings(); renderComponentList(); } });
  host.find('.st-esg-theater-group-rename').on('click', async function (event) { event.preventDefault(); event.stopPropagation(); const group = settings.theaterGroups.find((item) => textOf(item?.id) === textOf($(this).attr('data-group-id'))); if (!group) return; const name = await requestTextInputDialog({ title: '重命名小剧场分组', label: '分组名', value: group.name, placeholder: '输入分组名' }); if (!name) return; group.name = name; saveSettings(); renderComponentList(); });
  host.find('.st-esg-theater-group-delete').on('click', function (event) { event.preventDefault(); event.stopPropagation(); const groupId = textOf($(this).attr('data-group-id')); const group = settings.theaterGroups.find((item) => textOf(item?.id) === groupId); if (!group || !targetWindow.confirm(`确认删除分组“${group.name}”？组内小剧场将移到默认分组。`)) return; settings.theaterComponents.forEach((item) => { if (textOf(item.groupId) === groupId) item.groupId = ''; }); settings.theaterGroups = settings.theaterGroups.filter((item) => textOf(item?.id) !== groupId); settings.theaterGroupRandomOverrides = settings.theaterGroupRandomOverrides.filter((override) => textOf(override?.groupId) !== groupId); saveSettings(); renderComponentList(); });
  host.find('.st-esg-theater-group-enabled').on('click', (event) => event.stopPropagation()).on('change', function () { const group = settings.theaterGroups.find((item) => textOf(item?.id) === textOf($(this).attr('data-group-id'))); if (!group) return; group.enabled = Boolean($(this).prop('checked')); saveSettings(); renderTheaterLibrary(); });
  host.find('.st-esg-theater-default-enabled').on('click', (event) => event.stopPropagation()).on('change', function () { settings.theaterDefaultGroupEnabled = Boolean($(this).prop('checked')); saveSettings(); renderTheaterLibrary(); });
  host.find('.st-esg-theater-enabled').on('click', (event) => event.stopPropagation()).on('change', function () { const item = findTheaterItemById($(this).closest('.st-esg-theater-item').attr('data-component-id')); if (!item) return; item.enabled = Boolean($(this).prop('checked')); saveSettings(); renderTheaterLibrary(); });
  host.find('.st-esg-theater-move-up, .st-esg-theater-move-down').on('click', function (event) { event.preventDefault(); event.stopPropagation(); if (moveTheaterItemWithinGroup($(this).attr('data-component-id'), $(this).hasClass('st-esg-theater-move-up') ? -1 : 1)) { saveSettings(); renderComponentList(); } });
  host.find('.st-esg-theater-move-to').on('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    const item = findTheaterItemById($(this).attr('data-component-id'));
    if (!item) return;
    selectedTheaterIds.clear();
    theaterSearchQuery = '';
    theaterFilterMode = 'all';
    componentMoveState = null;
    theaterMoveState = { sourceIds: [item.id], target: null, batch: false };
    renderTheaterLibrary();
  });
  host.find('.st-esg-theater-delete').on('click', function (event) { event.preventDefault(); event.stopPropagation(); const id = textOf($(this).attr('data-component-id')); const item = findTheaterItemById(id); if (!item || !targetWindow.confirm(`确认删除小剧场“${item.name || '未命名'}”？此操作无法恢复。`)) return; settings.theaterComponents = settings.theaterComponents.filter((candidate) => textOf(candidate?.id) !== id); selectedTheaterIds.delete(id); saveSettings(); renderComponentList(); });
  host.find('.st-esg-theater-item').on('toggle', function () { if (theaterMoveState) { this.open = false; return; } if (!this.open) return; const preview = this.querySelector('.st-esg-component-preview'); if (!preview || preview.dataset.loaded === 'true') return; const item = findTheaterItemById($(this).attr('data-component-id')); if (!item) return; preview.innerHTML = renderTheaterPreview(item); preview.dataset.loaded = 'true'; });
  host.off('.stEsgTheaterEditor');
  host.on('click.stEsgTheaterEditor', '.st-esg-theater-name-input, .st-esg-theater-content', (event) => event.stopPropagation());
  host.on('click.stEsgTheaterEditor', '.st-esg-theater-edit-confirm', function (event) { event.preventDefault(); event.stopPropagation(); const item = findTheaterItemById($(this).closest('.st-esg-theater-item').attr('data-component-id')); if (!item) return; const editor = $(this).closest('.st-esg-component-editor'); item.name = textOf(editor.find('.st-esg-theater-name-input').val()) || '未命名小剧场'; item.content = String(editor.find('.st-esg-theater-content').val() || ''); saveSettings(); notifyStatus('已保存小剧场内容。'); editor.closest('.st-esg-theater-item').find('.st-esg-component-name').first().text(item.name); applyTheaterLibraryFilters(); });
  host.on('click.stEsgTheaterEditor', '.st-esg-theater-edit-cancel', function (event) { event.preventDefault(); event.stopPropagation(); const item = findTheaterItemById($(this).closest('.st-esg-theater-item').attr('data-component-id')); if (!item) return; const editor = $(this).closest('.st-esg-component-editor'); editor.find('.st-esg-theater-name-input').val(item.name || ''); editor.find('.st-esg-theater-content').val(item.content || ''); notifyStatus('已取消编辑。'); });
  applyTheaterLibraryFilters();
  renderComponentPositionMoveFooter();
}

function addComponent() {
  const name = textOf($t('#st-esg-component-name').val());
  const targetLibrary = textOf($t('#st-esg-component-target-library').val()) || 'components';
  if (targetLibrary === 'theater') {
    const content = textOf($t('#st-esg-component-content').val());
    if (!content) { setStatus('小剧场内容不能为空。'); return; }
    settings.theaterComponents.push({ id: createNewTheaterId(), name: name || '未命名小剧场', content, enabled: true, groupId: '', sourceType: '手动' });
    $t('#st-esg-component-name').val(''); $t('#st-esg-component-content').val('');
    saveSettings(); renderComponentList(); setStatus('已添加到小剧场库。');
    return;
  }
  const scope = textOf($t('#st-esg-component-scope').val()) || COMPONENT_SCOPE_GLOBAL;
  const presetSchemeId = scope === COMPONENT_SCOPE_PRESET ? textOf($t('#st-esg-component-preset-scheme').val()) : '';
  const content = textOf($t('#st-esg-component-content').val());
  if (!content) { setStatus('组件内容不能为空。'); return; }
  if (scope === COMPONENT_SCOPE_PRESET && !getPresetSchemeById(presetSchemeId)) { notifyStatus('请先选择要绑定的预设方案。', 'warning'); return; }
  const presetScheme = getPresetSchemeById(presetSchemeId);
  settings.components.push({ id: createNewComponentId(), name: name || '未命名组件', scope, presetSchemeId, bindName: scope === COMPONENT_SCOPE_PRESET ? presetScheme.name : getComponentBindingName(scope, targetWindow, getContext()), content, enabled: true, sourceType: '手动', groupId: '' });
  $t('#st-esg-component-name').val(''); $t('#st-esg-component-content').val('');
  saveSettings(); renderComponentList(); setStatus('已添加组件。');
}

function getImportTarget(sourceType = 'preset') {
  const librarySelect = sourceType === 'worldbook' ? '#st-esg-worldbook-import-target-library' : '#st-esg-import-target-library';
  const library = textOf($t(librarySelect).val()) || 'components';
  const scopeSelect = sourceType === 'worldbook' ? '#st-esg-worldbook-import-target-scope' : '#st-esg-import-target-scope';
  const scope = textOf($t(scopeSelect).val()) || COMPONENT_SCOPE_GLOBAL;
  if (library === 'theater') return { library, scope: '', presetSchemeId: '', bindName: '' };
  const presetSchemeId = scope === COMPONENT_SCOPE_PRESET
    ? textOf($t(sourceType === 'worldbook' ? '#st-esg-worldbook-import-preset-scheme' : '#st-esg-import-preset-scheme').val())
    : '';
  if (scope === COMPONENT_SCOPE_PRESET && !getPresetSchemeById(presetSchemeId)) {
    notifyStatus('请先选择要绑定的预设方案。', 'warning');
    return null;
  }
  const presetScheme = getPresetSchemeById(presetSchemeId);
  return { library, scope, presetSchemeId, bindName: scope === COMPONENT_SCOPE_PRESET ? presetScheme.name : getComponentBindingName(scope, targetWindow, getContext()) };
}

function resetComponentEditMode() {
  componentEditMode = false;
  componentMoveState = null;
  theaterMoveState = null;
  selectedComponentIds.clear();
  renderComponentPositionMoveFooter();
}

function resetComponentLibraryFilters() {
  componentSearchQuery = '';
  componentFilterMode = 'all';
}

function pruneSelectedComponentIds() {
  const validIds = new Set(settings.components.map((item) => textOf(item?.id)).filter(Boolean));
  selectedComponentIds.forEach((id) => {
    if (!validIds.has(id)) selectedComponentIds.delete(id);
  });
}

function updateComponentEditSelectionUi() {
  if (!componentEditMode) return;
  pruneSelectedComponentIds();
  const list = $t('#st-esg-component-list');
  const visibleSelectedIds = new Set(list.find('.st-esg-component-item').not('.st-esg-hidden').map((_, item) => textOf($(item).attr('data-component-id'))).get());
  const hiddenSelectedCount = [...selectedComponentIds].filter((id) => !visibleSelectedIds.has(id)).length;
  const selectionText = selectedComponentIds.size
    ? `已选 ${selectedComponentIds.size} 项${hiddenSelectedCount ? `（${hiddenSelectedCount} 项已筛选隐藏）` : ''}`
    : '未选择项目';
  list.find('.st-esg-component-edit-selection-count').text(selectionText);
  list.find('.st-esg-component-batch-move, .st-esg-component-batch-delete').prop('disabled', selectedComponentIds.size === 0);
  list.find('.st-esg-component-select').each(function () {
    $(this).prop('checked', selectedComponentIds.has(textOf($(this).attr('data-component-id'))));
  });
  list.find('.st-esg-component-group-select').each(function () {
    const componentIds = $(this).closest('.st-esg-component-folder').find('.st-esg-component-item').map((_, item) => textOf($(item).attr('data-component-id'))).get().filter(Boolean);
    const selectedCount = componentIds.filter((id) => selectedComponentIds.has(id)).length;
    $(this).prop('checked', componentIds.length > 0 && selectedCount === componentIds.length);
    $(this).prop('indeterminate', selectedCount > 0 && selectedCount < componentIds.length);
  });
}

function captureComponentLibraryViewState() {
  const list = $t('#st-esg-component-list');
  return {
    scrollTop: list.length ? list.scrollTop() : 0,
    openFolders: new Set(list.find('.st-esg-component-folder[open]').map((_, folder) => textOf($(folder).attr('data-folder-state-id'))).get().filter(Boolean)),
    openItems: new Set(list.find('.st-esg-component-item[open]').map((_, item) => textOf($(item).attr('data-component-id'))).get().filter(Boolean)),
  };
}

function restoreComponentLibraryViewState(state) {
  if (!state) return;
  $t('#st-esg-component-list').scrollTop(state.scrollTop || 0);
}

function getComponentSiblingIndexes(componentId) {
  const sourceIndex = settings.components.findIndex((item) => textOf(item?.id) === textOf(componentId));
  const component = settings.components[sourceIndex];
  if (!component) return { sourceIndex: -1, siblingIndexes: [] };
  const scope = normalizeComponentScope(component.scope);
  const groupId = textOf(component.groupId);
  const siblingIndexes = settings.components.reduce((indexes, item, index) => {
    if (normalizeComponentScope(item?.scope) === scope && textOf(item?.groupId) === groupId) indexes.push(index);
    return indexes;
  }, []);
  return { sourceIndex, siblingIndexes };
}

function moveComponentWithinGroup(componentId, direction) {
  const { sourceIndex, siblingIndexes } = getComponentSiblingIndexes(componentId);
  const siblingPosition = siblingIndexes.indexOf(sourceIndex);
  const targetIndex = siblingIndexes[siblingPosition + direction];
  if (sourceIndex < 0 || !Number.isInteger(targetIndex)) return false;
  [settings.components[sourceIndex], settings.components[targetIndex]] = [settings.components[targetIndex], settings.components[sourceIndex]];
  return true;
}

function getComponentGroupSiblingGroups(groupId) {
  const id = textOf(groupId);
  const group = settings.componentGroups.find((item) => textOf(item?.id) === id);
  if (!group) return { groupPosition: -1, siblingGroups: [] };
  const scope = normalizeComponentScope(group.scope);
  const siblingGroups = settings.componentGroups.filter((item) => normalizeComponentScope(item?.scope) === scope);
  siblingGroups.sort((left, right) => Number(left.order) - Number(right.order));
  return { groupPosition: siblingGroups.findIndex((item) => textOf(item?.id) === id), siblingGroups };
}

function moveComponentGroupWithinScope(groupId, direction) {
  const { groupPosition, siblingGroups } = getComponentGroupSiblingGroups(groupId);
  const targetGroup = siblingGroups[groupPosition + direction];
  const group = siblingGroups[groupPosition];
  if (!group || !targetGroup) return false;
  [group.order, targetGroup.order] = [targetGroup.order, group.order];
  return true;
}

function moveComponentsToGroup(componentIds, targetGroupId) {
  const selectedIdSet = new Set(componentIds.map((componentId) => textOf(componentId)).filter(Boolean));
  const selectedComponents = settings.components.filter((component) => selectedIdSet.has(textOf(component?.id)));
  if (!selectedComponents.length) return false;
  const scopes = new Set(selectedComponents.map((component) => normalizeComponentScope(component.scope)));
  if (scopes.size !== 1) return false;
  const [scope] = scopes;
  const groupId = textOf(targetGroupId);
  if (groupId && !settings.componentGroups.some((group) => textOf(group?.id) === groupId && normalizeComponentScope(group?.scope) === scope)) return false;

  const selectedIds = new Set(selectedComponents.map((component) => component.id));
  const remainingComponents = settings.components.filter((component) => !selectedIds.has(component.id));
  selectedComponents.forEach((component) => { component.groupId = groupId; });
  let insertIndex = remainingComponents.length;
  remainingComponents.forEach((component, index) => {
    if (normalizeComponentScope(component?.scope) === scope && textOf(component?.groupId) === groupId) insertIndex = index + 1;
  });
  remainingComponents.splice(insertIndex, 0, ...selectedComponents);
  settings.components = remainingComponents;
  return true;
}

function renderComponentPreview(item) {
  if (!componentEditMode) return `<pre>${escapeHtml(item.content || '')}</pre>`;
  return `<div class="st-esg-component-editor"><input class="text_pole st-esg-component-name-input" type="text" value="${escapeHtml(item.name || '')}" placeholder="组件名称" /><textarea class="text_pole textarea_compact st-esg-textarea st-esg-source-content st-esg-component-content" rows="7">${escapeHtml(item.content || '')}</textarea><div class="st-esg-source-actions"><button class="menu_button st-esg-source-confirm st-esg-component-edit-confirm" type="button">确认</button><button class="menu_button st-esg-source-cancel st-esg-component-edit-cancel" type="button">取消</button></div></div>`;
}

function getSourceType(value) {
  return normalizePromptSourceType(value);
}

function getSourceMode(type) {
  const sourceType = getSourceType(type);
  return settings.sourceModes?.[sourceType] || settings.sourceMode;
}

function setSourceMode(type, mode) {
  const sourceType = getSourceType(type);
  if (!settings.sourceModes || typeof settings.sourceModes !== 'object') settings.sourceModes = {};
  settings.sourceModes[sourceType] = mode === SOURCE_MODE_IMPORT ? SOURCE_MODE_IMPORT : SOURCE_MODE_PROMPT;
}

function clearImportSelections(type) {
  const sourceType = getSourceType(type);
  const sourceScope = sourceType === 'worldbook' ? SOURCE_WORLDBOOK : SOURCE_PRESET;
  settings.importSelections = clearImportSelectionsForScope(settings.importSelections, sourceScope);
}

async function changeSourceMode(type, mode) {
  const sourceType = getSourceType(type);
  const nextMode = mode === SOURCE_MODE_IMPORT ? SOURCE_MODE_IMPORT : SOURCE_MODE_PROMPT;
  if (nextMode === getSourceMode(sourceType)) return;
  clearImportSelections(sourceType);
  setSourceMode(sourceType, nextMode);
  saveSettings();
  renderSourceModeUi();
  if (!importGroups.length) await scanImportCandidates();
  else renderImportCandidates({ renderPreset: sourceType === 'preset', renderWorldbook: sourceType === 'worldbook' });
}

function getSourceSelectionStore(item) {
  return getSourceMode(item) === SOURCE_MODE_IMPORT ? settings.importSelections : settings.promptSelections;
}

function hasWorldbookDraftSource(source) {
  return settings.worldbookDraftSources.includes(getWorldbookRawName(source));
}

function renderLibraryTransferToolbar() {
  const selectedCount = exportSelectedComponentIds.size + exportSelectedTheaterIds.size;
  const exportableIds = getExportableLibraryIds();
  const allSelected = exportableIds.total > 0
    && exportableIds.components.every((id) => exportSelectedComponentIds.has(id))
    && exportableIds.theater.every((id) => exportSelectedTheaterIds.has(id));
  const normalActions = '<button class="menu_button menu_button_icon st-esg-secondary-action st-esg-library-import-trigger" type="button"><i class="fa-solid fa-file-import"></i><span>导入文件</span></button><button class="menu_button menu_button_icon st-esg-secondary-action st-esg-library-export-start" type="button"><i class="fa-solid fa-file-export"></i><span>选择导出</span></button>';
  const exportActions = `<span class="st-esg-library-export-count">已选 ${selectedCount} 项</span><button class="menu_button menu_button_icon st-esg-secondary-action st-esg-library-export-toggle-all" type="button" ${exportableIds.total ? '' : 'disabled'}><i class="fa-solid ${allSelected ? 'fa-square-minus' : 'fa-square-check'}"></i><span>${allSelected ? '取消全选' : '全选'}</span></button><button class="menu_button menu_button_icon st-esg-secondary-action st-esg-library-export-confirm" type="button" ${selectedCount ? '' : 'disabled'}><i class="fa-solid fa-download"></i><span>确认导出</span></button><button class="menu_button menu_button_icon st-esg-secondary-action st-esg-library-export-cancel" type="button"><i class="fa-solid fa-xmark"></i><span>取消</span></button>`;
  return `<div class="st-esg-component-edit-toolbar st-esg-library-transfer-toolbar"><span>${libraryExportMode ? '选择要导出的条目' : '组件库文件'}</span><span class="st-esg-component-batch-actions">${libraryExportMode ? exportActions : normalActions}</span></div><input id="st-esg-library-import-file" class="st-esg-hidden" type="file" accept="application/json,.json" />`;
}

function getExportableLibraryIds() {
  const componentIds = $t('#st-esg-component-list .st-esg-component-item').map((_, item) => textOf($(item).attr('data-component-id'))).get().filter(Boolean);
  const theaterIds = $t('#st-esg-theater-list .st-esg-theater-item').map((_, item) => textOf($(item).attr('data-component-id'))).get().filter(Boolean);
  const components = [...new Set(componentIds)];
  const theater = [...new Set(theaterIds)];
  return { components, theater, total: components.length + theater.length };
}

function resetLibraryExportMode() {
  libraryExportMode = false;
  exportSelectedComponentIds.clear();
  exportSelectedTheaterIds.clear();
}

function downloadJsonFile(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = targetDoc.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  targetDoc.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getPresetSourceGroup(name) {
  return importGroups.find((group) => group?.scope === SOURCE_PRESET
    && textOf(group?.source) === textOf(name)
    && group.loaded === true
    && Array.isArray(group.items));
}

async function exportCurrentEditedPreset() {
  if (getSourceMode('preset') !== SOURCE_MODE_PROMPT) {
    notifyStatus('请先切换到提示词编辑，再导出修改后的预设。', 'warning');
    return;
  }
  const presetName = textOf($t('#st-esg-source-preset').val()) || textOf(settings.activeSourcePreset);
  if (!presetName) { notifyStatus('请先选择要导出的预设。', 'warning'); return; }
  try {
    let group = getPresetSourceGroup(presetName);
    if (!group) {
      await scanImportCandidates({ explicitPresetName: presetName });
      group = getPresetSourceGroup(presetName);
    }
    if (!group) throw new Error('无法读取当前预设条目，请先同步来源。');
    const preset = getNativeTavernPreset(getContext(), presetName);
    const exported = buildEditedPresetExport({
      preset,
      items: group.items,
      contentOverrides: settings.sourceContentOverrides,
      selectionOverrides: settings.promptSelections,
    });
    const activeScheme = findScheme(getSchemeList('preset'), getActiveSchemeId('preset'));
    const filename = buildPresetExportFilename({
      schemeName: activeScheme?.name,
      dirty: Boolean(settings.dirtySchemeTypes?.preset),
    });
    downloadJsonFile(filename, exported);
    notifyStatus(`已导出修改后的预设：${filename}`);
  } catch (error) {
    notifyStatus(`导出失败：${error?.message || '无法生成预设文件。'}`, 'error');
  }
}

function exportSelectedLibraries() {
  const selectedCount = exportSelectedComponentIds.size + exportSelectedTheaterIds.size;
  if (!selectedCount) { notifyStatus('请先选择要导出的条目。', 'warning'); return; }
  const bundle = createLibraryExportPackage({
    components: settings.components,
    componentGroups: settings.componentGroups,
    theaterComponents: settings.theaterComponents,
    theaterGroups: settings.theaterGroups,
    selectedComponentIds: exportSelectedComponentIds,
    selectedTheaterIds: exportSelectedTheaterIds,
    defaultGroupEnabled: settings.defaultGroupEnabled,
    theaterDefaultGroupEnabled: settings.theaterDefaultGroupEnabled,
  });
  downloadJsonFile(buildLibraryExportFilename(), bundle);
  resetLibraryExportMode();
  renderComponentList();
  notifyStatus(`已导出 ${selectedCount} 个条目。`);
}

async function importLibraryFile(file) {
  if (!file) return;
  try {
    const bundle = JSON.parse(await file.text());
    const imported = importLibraryPackage(bundle, {
      createComponentId: createTrackedLibraryIdFactory(settings.components),
      createComponentGroupId: createTrackedLibraryIdFactory(settings.componentGroups),
      createTheaterId: createTrackedLibraryIdFactory(settings.theaterComponents),
      createTheaterGroupId: createTrackedLibraryIdFactory(settings.theaterGroups),
    });
    const componentOrderStart = settings.componentGroups.reduce((max, group) => Math.max(max, Number(group?.order) || 0), -1) + 1;
    const theaterOrderStart = settings.theaterGroups.reduce((max, group) => Math.max(max, Number(group?.order) || 0), -1) + 1;
    imported.componentGroups.forEach((group, index) => { group.order = componentOrderStart + index; });
    imported.theaterGroups.forEach((group, index) => { group.order = theaterOrderStart + index; });
    settings.componentGroups.push(...imported.componentGroups);
    settings.components.push(...imported.components);
    settings.theaterGroups.push(...imported.theaterGroups);
    settings.theaterComponents.push(...imported.theaterComponents);
    saveSettings();
    renderComponentList();
    notifyStatus(`已导入 ${imported.components.length} 个组件和 ${imported.theaterComponents.length} 个小剧场。`);
  } catch (error) {
    notifyStatus(`导入失败：${error?.message || '文件内容不正确。'}`, 'error');
  }
}

function bindLibraryTransferControls() {
  const panel = $t('[data-tab-panel="components"]');
  panel.find('.st-esg-library-import-trigger').off('.stEsgLibraryTransfer').on('click.stEsgLibraryTransfer', () => $t('#st-esg-library-import-file').trigger('click'));
  panel.find('#st-esg-library-import-file').off('.stEsgLibraryTransfer').on('change.stEsgLibraryTransfer', async function () {
    const [file] = this.files || [];
    await importLibraryFile(file);
    this.value = '';
  });
  panel.find('.st-esg-library-export-start').off('.stEsgLibraryTransfer').on('click.stEsgLibraryTransfer', () => {
    libraryExportMode = true;
    exportSelectedComponentIds.clear();
    exportSelectedTheaterIds.clear();
    resetComponentEditMode();
    theaterEditMode = false;
    selectedComponentIds.clear();
    selectedTheaterIds.clear();
    renderComponentList();
  });
  panel.find('.st-esg-library-export-cancel').off('.stEsgLibraryTransfer').on('click.stEsgLibraryTransfer', () => { resetLibraryExportMode(); renderComponentList(); });
  panel.find('.st-esg-library-export-toggle-all').off('.stEsgLibraryTransfer').on('click.stEsgLibraryTransfer', () => {
    const ids = getExportableLibraryIds();
    toggleLibraryExportSelection({
      componentIds: ids.components,
      theaterIds: ids.theater,
      selectedComponents: exportSelectedComponentIds,
      selectedTheaters: exportSelectedTheaterIds,
    });
    renderComponentList();
  });
  panel.find('.st-esg-library-export-confirm').off('.stEsgLibraryTransfer').on('click.stEsgLibraryTransfer', exportSelectedLibraries);
}

function getWorldbookRuntimeMode() {
  if (isFollowingTavernWorldbook()) return WORLDBOOK_RUNTIME_NATIVE;
  if (isTavernDefaultWorldbookScheme()) return WORLDBOOK_RUNTIME_DRAFT;
  return WORLDBOOK_RUNTIME_SCHEME;
}

function getWorldbookRuntimeOptions() {
  return {
    mode: getWorldbookRuntimeMode(),
    sourceNames: settings.worldbookDraftSources,
    selections: getSourceMode('worldbook') === SOURCE_MODE_IMPORT
      ? settings.importSelections
      : settings.promptSelections,
  };
}

function isWorldbookSourceEnabledByPlugin(group) {
  return isWorldbookSourceEnabled(group, getWorldbookRuntimeOptions());
}

function rememberWorldbookDraftSource(source) {
  const name = getWorldbookRawName(source);
  if (!name.trim() || hasWorldbookDraftSource(name)) return;
  settings.worldbookDraftSources.push(name);
}

function captureWorldbookDraftSources() {
  if (!isFollowingTavernWorldbook()) return;
  settings.worldbookDraftSources = [...new Set(importGroups
    .filter((group) => group?.scope === SOURCE_WORLDBOOK && group.category !== 'inactive')
    .map((group) => getWorldbookRawName(group.source))
    .filter((name) => name.trim()))];
}

function getWorldbookRecordStores() {
  return {
    promptSelections: settings.promptSelections,
    importSelections: settings.importSelections,
    sourceContentOverrides: settings.sourceContentOverrides,
    worldbookActivationOverrides: settings.worldbookActivationOverrides,
    worldbookKeywordOverrides: settings.worldbookKeywordOverrides,
  };
}

function getPresetRecordStores(source = settings) {
  return {
    promptSelections: source?.promptSelections,
    importSelections: source?.importSelections,
    sourceContentOverrides: source?.sourceContentOverrides,
  };
}

function reconcileLoadedPresetGroups(groups) {
  const presetGroups = (Array.isArray(groups) ? groups : [])
    .filter((group) => group?.scope === SOURCE_PRESET && group.loaded === true && Array.isArray(group.items));
  let changed = false;
  for (const group of presetGroups) {
    const current = reconcilePresetEntryRecords(getPresetRecordStores(), group.source, group.items);
    if (current.changed) {
      Object.assign(settings, current.stores);
      settings.taskPlacementAfterSourceId = current.keyMap[settings.taskPlacementAfterSourceId]
        || settings.taskPlacementAfterSourceId;
      changed = true;
    }
    const schemeMigration = reconcilePresetSchemeRecords(settings.presetSchemes, group.source, group.items);
    settings.presetSchemes = schemeMigration.schemes;
    if (schemeMigration.changed) changed = true;
  }
  if (changed) saveSettings();
  return changed;
}

function reconcileLoadedWorldbookGroup(group, items = group?.items, { authoritative = false } = {}) {
  if (!group || group.scope !== SOURCE_WORLDBOOK || (!authoritative && group.loaded !== true) || !Array.isArray(items)) {
    return { changed: false, staleEnabledCount: 0, unmatchedRecords: [] };
  }
  const result = reconcileWorldbookEntryRecords(getWorldbookRecordStores(), group.source, items);
  Object.assign(settings, result.stores);
  group.staleEnabledCount = result.staleEnabledCount;
  group.unmatchedWorldbookRecords = result.unmatchedRecords;
  if (result.changed) saveSettings();
  return result;
}

function removeEmptyWorldbookSchemeSource(group, enabledCount, migration = {}) {
  if (isFollowingTavernWorldbook()
    // Import mode owns a separate, temporary selection store. Its background counts
    // must not remove prompt sources or records from the saved worldbook scheme.
    || getSourceMode('worldbook') === SOURCE_MODE_IMPORT
    || Number(enabledCount) > 0
    || Number(migration?.staleEnabledCount || 0) > 0
    || !hasWorldbookDraftSource(group?.source)) return false;
  const source = getWorldbookRawName(group.source);
  settings.worldbookDraftSources = settings.worldbookDraftSources.filter((name) => getWorldbookRawName(name) !== source);
  const removed = removeWorldbookSourceRecords(getWorldbookRecordStores(), source);
  Object.assign(settings, removed.stores);
  saveSettings();
  return true;
}

function persistCurrentWorldbookSchemeMigration() {
  const schemeId = getActiveSchemeId('worldbook');
  if (!schemeId
    || schemeId === WORLD_BOOK_FOLLOW_TAVERN
    || schemeId !== getSelectedSchemeId('worldbook')
    || settings.dirtySchemeTypes?.worldbook
    // Background UID/source reconciliation must never rewrite a saved scheme while
    // the user is in the temporary import-to-library view.
    || getSourceMode('worldbook') === SOURCE_MODE_IMPORT) return false;
  const list = getSchemeList('worldbook');
  const scheme = findScheme(list, schemeId);
  if (!scheme) return false;
  setSchemeList('worldbook', saveScheme(list, scheme.name, currentSchemeSnapshot('worldbook'), schemeId));
  saveSettings();
  return true;
}

function getSourceSelection(item, group = null) {
  const store = getSourceSelectionStore(item);
  if (item?.scope === SOURCE_WORLDBOOK) {
    return resolveWorldbookEntryRuntimeState(group || {
      scope: item.scope,
      source: item.source,
      category: item.worldbookCategory,
    }, item, { ...getWorldbookRuntimeOptions(), selections: store }).shouldInject;
  }
  if (item?.locked) return item.enabled !== false;
  if (Object.prototype.hasOwnProperty.call(store, item.key)) return store[item.key] !== false;
  return getSourceMode(item) === SOURCE_MODE_PROMPT ? item.enabled !== false : false;
}

function setSourceSelection(item, checked) {
  if (!item?.key || item?.locked) return;
  const sourceType = item?.scope === SOURCE_WORLDBOOK ? 'worldbook' : 'preset';
  if (sourceType === 'worldbook') {
    captureWorldbookDraftSources();
    if (checked) rememberWorldbookDraftSource(item.source);
  }
  getSourceSelectionStore(item)[item.key] = Boolean(checked);
  if (getSourceMode(sourceType) === SOURCE_MODE_PROMPT) markSchemeDirty(sourceType);
  else saveSettings();
}

function syncSelectionForChecks(checks) {
  checks.toArray().forEach((checkbox) => {
    const row = $(checkbox).closest('.st-esg-import-item');
    const group = importGroups[Number(row.data('group-index'))];
    const item = group?.items?.[Number(row.data('item-index'))];
    if (item) setSourceSelection(item, Boolean($(checkbox).prop('checked')));
  });
}

function syncPromptSelectionsFromLoadedGroups(groups = importGroups) {
  // Tag each worldbook group with whether it mirrors Tavern. While a scheme is active the snapshot is
  // authoritative, so loading a book must not seed its entries from Tavern's activation state.
  const worldbookRuntimeMode = getWorldbookRuntimeMode();
  const followingTavernWorldbook = worldbookRuntimeMode === WORLDBOOK_RUNTIME_NATIVE;
  const promptGroups = groups.filter((group) => getSourceMode(group) === SOURCE_MODE_PROMPT
    && (!isWorldbookGroup(group) || worldbookRuntimeMode !== WORLDBOOK_RUNTIME_DRAFT)
    && (group.category !== 'inactive' || !followingTavernWorldbook))
    .map((group) => (isWorldbookGroup(group)
      ? { ...group, followsTavernState: followingTavernWorldbook }
      : group));
  const before = JSON.stringify(settings.promptSelections || {});
  settings.promptSelections = syncPromptSelectionsFromGroups(promptGroups, settings.promptSelections, (group) => isWorldbookGroup(group) ? followingTavernWorldbook : isFollowingTavernPreset());
  if (JSON.stringify(settings.promptSelections || {}) !== before) saveSettings();
  return promptGroups.reduce((sum, group) => sum + (group?.loaded && Array.isArray(group.items) ? group.items.length : 0), 0);
}

async function ensurePromptSourceItemsForGeneration({ chat = null, animaWorldbookEntries = [] } = {}) {
  const currentSignature = getTavernSourceSignature();
  if (promptSourceCache.signature && currentSignature !== promptSourceCache.signature) {
    markPromptSourceStructureDirty(promptSourceCache);
  }
  if (!importGroups.length || promptSourceCache.structureDirty) await scanImportCandidates();
  const dirtyWorldbooks = new Set(takeDirtyWorldbookSources(promptSourceCache));
  importGroups
    .filter((group) => group?.scope === SOURCE_WORLDBOOK && dirtyWorldbooks.has(group.source))
    .forEach((group) => {
      group.loaded = false;
      group.loading = false;
      group.items = [];
    });
  const worldbookRuntimeOptions = { ...getWorldbookRuntimeOptions(), selections: settings.promptSelections };
  const activeWorldbookGroups = importGroups.filter((group) => getSourceMode(group) === SOURCE_MODE_PROMPT
    && group?.scope === SOURCE_WORLDBOOK
    && isWorldbookSourceEnabled(group, worldbookRuntimeOptions)
    && !group.loaded
    && !group.loading);
  await loadWorldbookSourceGroups(
    activeWorldbookGroups,
    (worldbookName, group) => collectWorldbookImportCandidates(targetWindow, worldbookName)
      .then((items) => attachWorldbookRuntimeCategory(group, items)),
  );
  activeWorldbookGroups.forEach((group) => reconcileLoadedWorldbookGroup(group));
  const worldbookIssue = getWorldbookGenerationIssue(activeWorldbookGroups);
  if (worldbookIssue) throw new Error(worldbookIssue);
  syncPromptSelectionsFromLoadedGroups(activeWorldbookGroups);
  importCandidates = importGroups.flatMap((group) => group.items || []);
  if (settings.activeTab === 'worldbook') renderImportCandidates({ renderPreset: false });
  const promptGroups = importGroups.filter((group) => getSourceMode(group) === SOURCE_MODE_PROMPT);
  const selected = collectSelectedPromptSourceItems(promptGroups, settings.promptSelections, settings.sourceContentOverrides, {
    isSelected: (item, group) => item?.scope === SOURCE_WORLDBOOK
      ? resolveWorldbookEntryRuntimeState(group, item, worldbookRuntimeOptions).shouldInject
      : undefined,
  });
  const sourceItems = isFollowingTavernPreset() && getSourceMode('preset') === SOURCE_MODE_PROMPT
    ? [
      ...selected.filter((item) => item?.scope === SOURCE_WORLDBOOK),
      ...importGroups
        .filter((group) => !isWorldbookGroup(group) && group.loaded)
        .flatMap((group) => group.items || [])
        .filter((item) => item?.enabled !== false),
    ]
    : selected;
  const context = getContext();
  const promptChat = Array.isArray(chat) ? chat : context.chat;
  // Keep selection, activation lamps, and scheme overrides authoritative. Only after
  // that normal pipeline is complete do we replace the content of existing Anima entries.
  const selectedItemsWithAnima = applyAnimaWorldbookOverrides(sourceItems, animaWorldbookEntries);
  const itemsWithKeywordOverrides = selectedItemsWithAnima.map((item) => {
    if (item?.scope !== SOURCE_WORLDBOOK || !item?.key || !Object.prototype.hasOwnProperty.call(settings.worldbookKeywordOverrides, item.key)) return item;
    return { ...item, worldbookKeys: splitWorldbookKeywords(settings.worldbookKeywordOverrides[item.key]) };
  });
  return filterWorldbookPromptItems(itemsWithKeywordOverrides, {
    chat: promptChat,
    scanDepth: getWorldbookScanDepth(),
    historyRangeMode: settings.historyRangeMode,
    recentMessageCount: settings.recentMessageCount,
    // The lamp must see the same history range and cleanup result the model gets.
    historyCleanupRules: settings.historyCleanupRules,
    activationModeForItem: isFollowingTavernWorldbook() ? (item) => item?.activationMode : getWorldbookActivationMode,
    substituteKeyword: (keyword) => typeof context?.substituteParams === 'function'
      ? context.substituteParams.call(context, keyword)
      : keyword,
  });
}

function renderSourceModeUi() {
  const presetMode = getSourceMode('preset');
  const worldbookMode = getSourceMode('worldbook');
  $t('.st-esg-mode-radio[name="preset_source_mode"][value="prompt"]').prop('checked', presetMode === SOURCE_MODE_PROMPT);
  $t('.st-esg-mode-radio[name="preset_source_mode"][value="import"]').prop('checked', presetMode === SOURCE_MODE_IMPORT);
  $t('.st-esg-mode-radio[name="worldbook_source_mode"][value="prompt"]').prop('checked', worldbookMode === SOURCE_MODE_PROMPT);
  $t('.st-esg-mode-radio[name="worldbook_source_mode"][value="import"]').prop('checked', worldbookMode === SOURCE_MODE_IMPORT);
  $t('#st-esg-import-target-container').toggle(presetMode === SOURCE_MODE_IMPORT);
  $t('#st-esg-worldbook-import-container').toggle(worldbookMode === SOURCE_MODE_IMPORT);
  $t('#st-esg-preset-placement-slot').toggle(presetMode === SOURCE_MODE_PROMPT);
  $t('#st-esg-export-current-preset').prop('disabled', presetMode !== SOURCE_MODE_PROMPT);
  ['preset', 'worldbook'].forEach((type) => {
    const editable = getSourceMode(type) === SOURCE_MODE_PROMPT;
    $t(`.st-esg-scheme-group[data-scheme-type="${type}"] .st-esg-save-scheme-new, .st-esg-scheme-group[data-scheme-type="${type}"] .st-esg-overwrite-scheme, .st-esg-scheme-group[data-scheme-type="${type}"] .st-esg-delete-scheme`).toggleClass('st-esg-hidden', !editable).prop('disabled', !editable);
  });
  renderPresetBindingControls();
}

function renderSourceModeControl(type) {
  const isPreset = type === 'preset';
  const radioName = `${type}_source_mode`;
  const target = isPreset
    ? `<div id="st-esg-import-target-container" class="st-esg-import-target-container" style="display:none;"><label>导入到:<select id="st-esg-import-target-scope" class="text_pole"><option>全局</option><option>预设</option><option>角色</option></select></label><div class="st-esg-actions-row st-esg-source-import-action"><div id="st-esg-import-preset-components" class="menu_button menu_button_icon st-esg-secondary-action"><i class="fa-solid fa-file-import"></i><span>确认导入</span></div></div></div>`
    : `<div id="st-esg-worldbook-import-container" class="st-esg-import-target-container" style="display:none;"><label>导入到:<select id="st-esg-worldbook-import-target-scope" class="text_pole"><option>全局</option><option>预设</option><option>角色</option></select></label><div class="st-esg-actions-row st-esg-source-import-action"><div id="st-esg-import-worldbook-components" class="menu_button menu_button_icon st-esg-secondary-action"><i class="fa-solid fa-file-import"></i><span>确认导入</span></div></div></div>`;
  return `<div class="st-esg-segmented-control-wrapper"><div class="st-esg-segmented-control"><label><input type="radio" name="${radioName}" value="prompt" class="st-esg-mode-radio" checked><span>提示词编辑</span></label><label><input type="radio" name="${radioName}" value="import" class="st-esg-mode-radio"><span>导入到组件</span></label></div></div>${target}`;
}

function getPresetTaskPlacementItems() {
  return importGroups
    .filter((group) => group?.scope !== SOURCE_WORLDBOOK && group.loaded && Array.isArray(group.items))
    .flatMap((group) => group.items
      .filter((item) => item?.key && (textOf(item.content) || textOf(item.markerType)))
      .map((item) => ({ id: item.key, label: `${group.source || group.group} / ${item.name}`, markerType: textOf(item.markerType) })));
}

function getSourceContentValue(item) {
  if (item?.key && Object.prototype.hasOwnProperty.call(settings.sourceContentOverrides, item.key)) {
    return String(settings.sourceContentOverrides[item.key] ?? '');
  }
  return String(item?.content ?? '');
}

function getWorldbookKeywordValue(item) {
  const value = item?.key && Object.prototype.hasOwnProperty.call(settings.worldbookKeywordOverrides, item.key)
    ? settings.worldbookKeywordOverrides[item.key]
    : item?.worldbookKeys;
  return splitWorldbookKeywords(value).join(', ');
}

function hasSourceItemOverride(item) {
  if (!item?.key) return false;
  return Object.prototype.hasOwnProperty.call(settings.sourceContentOverrides, item.key)
    || (item?.scope === SOURCE_WORLDBOOK && Object.prototype.hasOwnProperty.call(settings.worldbookKeywordOverrides, item.key));
}

function setSourceItemOverrides(item, value, keywordValue = '') {
  if (!item?.key || item?.locked) return;
  if (item?.scope === SOURCE_WORLDBOOK) {
    captureWorldbookDraftSources();
    rememberWorldbookDraftSource(item.source);
  }
  const original = String(item.content ?? '');
  const next = String(value ?? '');
  if (next === original) {
    delete settings.sourceContentOverrides[item.key];
  } else {
    settings.sourceContentOverrides[item.key] = next;
  }
  if (item?.scope === SOURCE_WORLDBOOK) {
    const originalKeywords = splitWorldbookKeywords(item.worldbookKeys);
    const nextKeywords = splitWorldbookKeywords(keywordValue);
    if (JSON.stringify(nextKeywords) === JSON.stringify(originalKeywords)) {
      delete settings.worldbookKeywordOverrides[item.key];
    } else {
      settings.worldbookKeywordOverrides[item.key] = nextKeywords;
    }
  }
  markSchemeDirty(item?.scope === SOURCE_WORLDBOOK ? 'worldbook' : 'preset');
}

function getWorldbookActivationMode(item) {
  const override = item?.key && settings.worldbookActivationOverrides?.[item.key];
  return normalizeWorldbookActivationMode(override || item?.activationMode, 'green');
}

function setWorldbookActivationMode(item, mode) {
  if (!item?.key) return;
  captureWorldbookDraftSources();
  rememberWorldbookDraftSource(item.source);
  const normalized = normalizeWorldbookActivationMode(mode);
  const nativeMode = normalizeWorldbookActivationMode(item.activationMode, 'green');
  if (normalized === nativeMode) delete settings.worldbookActivationOverrides[item.key];
  else settings.worldbookActivationOverrides[item.key] = normalized;
  markSchemeDirty('worldbook');
}

function getWorldbookScanDepth() {
  try {
    const depth = Number(getWorldInfoSettings?.()?.world_info_depth);
    if (Number.isFinite(depth) && depth >= 0) return Math.floor(depth);
  } catch (_) {}
  const inputValue = Number(targetDoc.querySelector('#world_info_depth')?.value);
  return Number.isFinite(inputValue) && inputValue >= 0 ? Math.floor(inputValue) : 2;
}

function renderSourceContentEditor(item, groupIndex, itemIndex) {
  const value = getSourceContentValue(item);
  if (getSourceMode(item?.scope === SOURCE_WORLDBOOK ? 'worldbook' : 'preset') === SOURCE_MODE_IMPORT) {
    const keywordPreview = item?.scope === SOURCE_WORLDBOOK
      ? `<div class="st-esg-card-desc st-esg-worldbook-keywords-readonly">主关键词：${escapeHtml(getWorldbookKeywordValue(item) || '无')}</div>`
      : '';
    return `${keywordPreview}<pre class="st-esg-source-content-preview">${escapeHtml(value || '暂无内容')}</pre>`;
  }
  if (item?.markerType && !value) {
    return '<div class="st-esg-empty st-esg-empty-small">运行时插入，无可编辑内容。</div>';
  }
  const keywordEditor = item?.scope === SOURCE_WORLDBOOK
    ? `<label class="st-esg-worldbook-keyword-editor"><span>主关键词</span><textarea class="text_pole textarea_compact st-esg-worldbook-keywords" rows="2" data-group-index="${groupIndex}" data-item-index="${itemIndex}">${escapeHtml(getWorldbookKeywordValue(item))}</textarea></label>`
    : '';
  const textarea = `<textarea class="text_pole textarea_compact st-esg-textarea st-esg-source-content" rows="7" data-group-index="${groupIndex}" data-item-index="${itemIndex}" ${item?.locked ? 'readonly' : ''}>${escapeHtml(value)}</textarea>`;
  if (item?.locked) return `${keywordEditor}${textarea}`;
  const restoreAction = hasSourceItemOverride(item)
    ? `<button class="menu_button st-esg-source-restore" type="button" data-group-index="${groupIndex}" data-item-index="${itemIndex}">恢复原生</button>`
    : '';
  return `${keywordEditor}${textarea}<div class="st-esg-source-actions"><button class="menu_button st-esg-source-confirm" type="button" data-group-index="${groupIndex}" data-item-index="${itemIndex}">确认</button><button class="menu_button st-esg-source-cancel" type="button" data-group-index="${groupIndex}" data-item-index="${itemIndex}">取消</button>${restoreAction}</div>`;
}

function renderTaskPlacementOptions() {
  const enabled = Boolean(settings.taskPlacementEnabled);
  const row = $t('#st-esg-task-placement-row');
  const select = $t('#st-esg-task-placement-after');
  const items = getPresetTaskPlacementItems();
  row.toggle(enabled);
  select.html(items.length
    ? items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`).join('')
    : '<option value="">请先在“预设/世界书”页同步当前预设</option>');
  const placement = resolveTaskPlacementSelection(items, settings.taskPlacementAfterSourceId);
  select.val(placement.selectedId);
  if (settings.taskPlacementEnabled && settings.taskPlacementAfterSourceId !== placement.storedId) {
    settings.taskPlacementAfterSourceId = placement.storedId;
    saveSettings();
  }
}

function captureImportViewState() {
  const presetBox = $t('#st-esg-preset-candidates');
  const worldbookBox = $t('#st-esg-worldbook-candidates');
  return {
    presetScrollTop: presetBox.length ? presetBox.scrollTop() : 0,
    worldbookScrollTop: worldbookBox.length ? worldbookBox.scrollTop() : 0,
    openGroups: new Set($t('.st-esg-import-group[open]').toArray().map((node) => Number($(node).data('group-index')))),
    openItems: new Set($t('.st-esg-import-item[open]').toArray().map((node) => `${Number($(node).data('group-index'))}:${Number($(node).data('item-index'))}`)),
  };
}

const EXTENSION_THEME_CLASSES = ['st-esg-theme-dark', 'st-esg-theme-light', 'st-esg-theme-tavern'];

function applyThemeClass(element, theme) {
  if (!element) return;
  element.classList.remove(...EXTENSION_THEME_CLASSES);
  element.classList.add(getThemeClassName(theme));
}

function applyTheme() {
  settings.theme = normalizeThemeMode(settings.theme);
  const themedElements = [
    getDialog(),
    targetDoc.getElementById('st-esg-ball'),
    ...targetDoc.querySelectorAll('.st-esg-message-floor-panel'),
    ...targetDoc.querySelectorAll(
      '.st-esg-anchor-preview-dialog, .st-esg-scheme-name-dialog, .st-esg-api-additional-dialog, .st-esg-data-management-dialog',
    ),
  ];
  themedElements.forEach((element) => applyThemeClass(element, settings.theme));

  const presentation = getThemePresentation(settings.theme);
  const toggle = $t('#st-esg-theme-toggle');
  toggle.html(`
    <span class="st-esg-theme-glyph" aria-hidden="true">
      <i class="fa-solid ${presentation.icon}"></i>
      ${presentation.badgeIcon ? `<i class="fa-solid ${presentation.badgeIcon} st-esg-theme-glyph-badge"></i>` : ''}
    </span>
  `);
  toggle.attr({
    title: `主题：${presentation.label}（点击切换）`,
    'aria-label': `当前主题：${presentation.label}，点击切换`,
  });
}

function restoreImportViewState(state) {
  if (!state) return;
  $t('.st-esg-import-item').each(function () {
    const key = `${Number($(this).data('group-index'))}:${Number($(this).data('item-index'))}`;
    if (state.openItems.has(key)) this.open = true;
  });
  $t('#st-esg-preset-candidates').scrollTop(state.presetScrollTop || 0);
  $t('#st-esg-worldbook-candidates').scrollTop(state.worldbookScrollTop || 0);
}

function renderListToolbar() {
  return `<div class="st-esg-list-toolbar"><input type="text" class="st-esg-search-input text_pole" placeholder="搜索条目..." value="${escapeHtml(listSearchQuery)}"><select class="st-esg-filter-select text_pole"><option value="all" ${listFilterMode === 'all' ? 'selected' : ''}>全部</option><option value="enabled" ${listFilterMode === 'enabled' ? 'selected' : ''}>仅启用</option><option value="modified" ${listFilterMode === 'modified' ? 'selected' : ''}>仅修改</option></select><span class="st-esg-list-count"></span></div>`;
}

function applyListFilters() {
  const query = listSearchQuery.trim().toLocaleLowerCase();
  $t('.st-esg-list-toolbar').each(function () {
    const toolbar = $(this);
    const container = toolbar.closest('#st-esg-preset-candidates, #st-esg-worldbook-candidates');
    const items = container.find('.st-esg-import-item');
    let visibleCount = 0;
    items.each(function () {
      const row = $(this);
      const group = importGroups[Number(row.data('group-index'))];
      const item = group?.items?.[Number(row.data('item-index'))];
      if (!item) return;
      const searchableText = `${item.name || ''}\n${item.content || ''}\n${getWorldbookKeywordValue(item)}`.toLocaleLowerCase();
      const matchesQuery = !query || searchableText.includes(query);
      const matchesFilter = listFilterMode === 'all'
        || (listFilterMode === 'enabled' && getSourceSelection(item, group))
        || (listFilterMode === 'modified' && hasSourceItemOverride(item));
      const visible = matchesQuery && matchesFilter;
      row.toggleClass('st-esg-hidden', !visible);
      if (visible) visibleCount += 1;
    });
    toolbar.find('.st-esg-list-count').text(`${visibleCount} / ${items.length}`);
  });
}

function scrollWorldbookCardIntoView() {
  const worldbookBox = targetDoc.getElementById('st-esg-worldbook-candidates');
  const panelBody = worldbookBox?.closest?.('.st-esg-panel-body');
  if (!panelBody) return;
  targetWindow.requestAnimationFrame(() => {
    const activeDetail = worldbookBox.querySelector('.st-esg-worldbook-detail');
    if (!activeDetail || typeof panelBody.getBoundingClientRect !== 'function') return;
    const bodyRect = panelBody.getBoundingClientRect();
    const detailRect = activeDetail.getBoundingClientRect();
    const delta = detailRect.top - bodyRect.top;
    if (Math.abs(delta) > 1) panelBody.scrollTop += delta;
  });
}

async function openWorldbookDetail(groupIndex) {
  activeWorldbookGroupIndex = Number(groupIndex);
  renderImportCandidates({ renderPreset: false });
  scrollWorldbookCardIntoView();
  await loadImportGroup(activeWorldbookGroupIndex);
  scrollWorldbookCardIntoView();
}

function backToWorldbookList() {
  activeWorldbookGroupIndex = null;
  renderImportCandidates({ renderPreset: false });
  scrollWorldbookCardIntoView();
}

function renderSourcePresetSelect() {
  const select = $t('#st-esg-source-preset');
  if (!select.length) return;
  const names = getPresetNamesSafe(targetWindow, getContext());
  const current = getSelectedSchemeId('preset') ? settings.activeSourcePreset : getCurrentPresetNameSafe(targetWindow, getContext()) || settings.activeSourcePreset || names[0] || '';
  if (!settings.activeSourcePreset && current) settings.activeSourcePreset = current;
  select.html(names.map((name) => `<option value="${escapeHtml(name)}" ${name === current ? 'selected' : ''}>${escapeHtml(name)}</option>`).join(''));
}

function getSelectedGlobalWorldbookNamesFromDom() {
  const selectedLabels = $t('#world_info option:selected')
    .map((_, option) => getWorldbookRawName($(option).text()))
    .get()
    .filter((name) => name.trim());
  if (selectedLabels.length) return selectedLabels;
  const value = $t('#world_info').val() || [];
  return (Array.isArray(value) ? value : [value])
    .map(getWorldbookRawName)
    .filter((name) => name.trim());
}

function getWorldbookCountText(group) {
  if (group?.loadFailed || group?.error || group?.missingFromTavern) return '点击查看';
  const total = Number(group?.entryCount);
  if (!Number.isFinite(total)) return '统计中';
  const unmatchedCount = Number(group?.staleEnabledCount || 0);
  return `${Number(group?.pluginEnabledCount || 0)}/${total}${unmatchedCount > 0 ? ` · ${unmatchedCount}条未匹配` : ''}`;
}

function updateWorldbookCountLabel(group) {
  const groupIndex = importGroups.indexOf(group);
  if (groupIndex < 0) return;
  const row = $t(`.st-esg-worldbook-row[data-group-index="${groupIndex}"]`);
  if (!row.length) return;
  row.find('em').text(getWorldbookCountText(group));
  // A fresh count can move a book between categories. The label lives inside the old category body,
  // so rewriting only the text would leave the book filed under the wrong heading until the next
  // full redraw. Re-render once the category no longer matches where the row currently sits.
  const expectedCategory = resolveWorldbookSourceDisplayCategory(group, {
    mode: getWorldbookRuntimeMode(),
    enabledCount: Number(group.pluginEnabledCount || 0),
    sourceEnabled: isWorldbookSourceEnabledByPlugin(group),
    entriesResolved: Boolean(group.entriesResolved),
    loadFailed: Boolean(group.loadFailed || group.error || group.missingFromTavern),
    unmatchedEnabledCount: Number(group.staleEnabledCount || 0),
  });
  if (textOf(row.closest('.st-esg-import-category').data('category')) !== expectedCategory) {
    if (settings.activeTab !== 'worldbook') return;
    renderImportCandidates({ renderPreset: false });
  }
}

async function startBackgroundWorldbookCounts() {
  const revision = ++worldbookCountRevision;
  const groups = importGroups.filter((group) => group?.scope === SOURCE_WORLDBOOK && !group.loaded);
  for (const group of groups) {
    await new Promise((resolve) => targetWindow.setTimeout(resolve, 0));
    if (revision !== worldbookCountRevision || group.loaded) continue;
    try {
      const items = await readWorldbookItemsForGroup(group);
      if (revision !== worldbookCountRevision || group.loaded) continue;
      group.error = '';
      group.loadFailed = false;
      group.entriesResolved = true;
      const migration = reconcileLoadedWorldbookGroup(group, items, { authoritative: true });
      group.entryCount = items.length;
      group.pluginEnabledCount = items.filter((item) => getSourceSelection(item, group)).length;
      const removedEmptySource = removeEmptyWorldbookSchemeSource(group, group.pluginEnabledCount, migration);
      if ((migration.changed || removedEmptySource) && migration.staleEnabledCount === 0) {
        persistCurrentWorldbookSchemeMigration();
      }
      updateWorldbookCountLabel(group);
    } catch (error) {
      if (revision === worldbookCountRevision) {
        group.error = error?.message || '读取世界书失败。';
        group.loadFailed = true;
        group.entriesResolved = false;
        delete group.entryCount;
        delete group.pluginEnabledCount;
        updateWorldbookCountLabel(group);
      }
    }
  }
}

async function readWorldbookItemsForGroup(group) {
  if (group?.loaded && Array.isArray(group.items)) {
    group.items = attachWorldbookRuntimeCategory(group, group.items);
    return group.items;
  }
  if (Array.isArray(group?.backgroundItems)) {
    group.backgroundItems = attachWorldbookRuntimeCategory(group, group.backgroundItems);
    return group.backgroundItems;
  }
  if (!group?.backgroundItemsPromise) {
    group.backgroundItemsPromise = collectWorldbookImportCandidates(targetWindow, group.source)
      .then((items) => attachWorldbookRuntimeCategory(group, items));
  }
  try {
    const items = attachWorldbookRuntimeCategory(group, await group.backgroundItemsPromise);
    group.backgroundItems = items;
    return items;
  } finally {
    group.backgroundItemsPromise = null;
  }
}

async function scanImportCandidates({ explicitPresetName = '' } = {}) {
  const context = getContext();
  const cachedWorldbookGroups = new Map(importGroups
    .filter((group) => group?.scope === SOURCE_WORLDBOOK
      && (group.loaded || Array.isArray(group.backgroundItems) || group.backgroundItemsPromise)
      && !promptSourceCache.dirtyWorldbooks.has(group.source))
    .map((group) => [group.source, group]));
  const followingTavernWorldbook = isFollowingTavernWorldbook();
  const selectedWorldNames = followingTavernWorldbook ? getSelectedGlobalWorldbookNamesFromDom() : [];
  settings.activeSourcePreset = textOf(explicitPresetName) || (isFollowingTavernPreset()
    ? getCurrentPresetNameSafe(targetWindow, context)
    : getSelectedSchemeId('preset')
      ? textOf($t('#st-esg-source-preset').val()) || settings.activeSourcePreset || getCurrentPresetNameSafe(targetWindow, context)
      : getCurrentPresetNameSafe(targetWindow, context) || textOf($t('#st-esg-source-preset').val()) || settings.activeSourcePreset);
  saveSettings();
  const worldbookGroups = collectWorldbookImportGroups({
    targetWindow,
    context,
    selectedWorldNames,
    explicitWorldbookNames: followingTavernWorldbook ? null : settings.worldbookDraftSources,
  });
  importGroups = [
    ...collectPresetImportGroups({ targetWindow, context, presetName: settings.activeSourcePreset }),
    ...worldbookGroups.map((group) => {
      const cached = group.missingFromTavern ? null : cachedWorldbookGroups.get(group.source);
      return {
        ...group,
        ...(group.missingFromTavern ? {
          loadFailed: true,
          error: `未找到世界书“${group.source}”。它可能已被改名、删除，或方案保存的名称与酒馆实际名称不一致。`,
        } : {}),
        ...(cached?.loaded ? { loaded: true, items: attachWorldbookRuntimeCategory(group, cached.items), error: cached.error } : {}),
        ...(Array.isArray(cached?.backgroundItems) ? { backgroundItems: attachWorldbookRuntimeCategory(group, cached.backgroundItems) } : {}),
        ...(cached?.backgroundItemsPromise ? { backgroundItemsPromise: cached.backgroundItemsPromise } : {}),
      };
    }),
  ];
  const presetMigrationChanged = reconcileLoadedPresetGroups(importGroups);
  const syncedCount = syncPromptSelectionsFromLoadedGroups(importGroups);
  activeWorldbookGroupIndex = null;
  importCandidates = importGroups.flatMap((group) => group.items || []);
  if (settings.activeTab === 'worldbook') renderImportCandidates({ renderPreset: false });
  else if (settings.activeTab === 'preset') renderImportCandidates({ renderWorldbook: false });
  void startBackgroundWorldbookCounts();
  renderTaskPlacementOptions();
  promptSourceCache.structureDirty = false;
  promptSourceCache.signature = getTavernSourceSignature();
  lastTavernSourceSignature = promptSourceCache.signature;
  setStatus(getSourceMode('preset') === SOURCE_MODE_PROMPT || getSourceMode('worldbook') === SOURCE_MODE_PROMPT
    ? `已同步 ${syncedCount} 个已加载条目的酒馆勾选状态。世界书会在进入详情页时同步。`
    : `已列出 ${importGroups.length} 个来源。世界书会在进入详情页时加载。`);
  if (presetMigrationChanged) console.info(`[${EXTENSION_ID}] 已将可匹配的预设条目记录迁移为 ID 键。`);
}

async function loadImportGroup(groupIndex) {
  const group = importGroups[groupIndex];
  if (!group || group.loaded || group.loading || group.scope !== SOURCE_WORLDBOOK) return;
  group.uiOpen = true;
  group.loading = true;
  renderImportCandidates({ renderPreset: false });
  scrollWorldbookCardIntoView();
  try {
    group.items = await readWorldbookItemsForGroup(group);
    group.loaded = true;
    group.error = '';
    group.loadFailed = false;
    group.entriesResolved = true;
    group.entryCount = group.items.length;
    reconcileLoadedWorldbookGroup(group);
    syncPromptSelectionsFromLoadedGroups([group]);
    setStatus(`已加载 ${group.source}：${group.items.length} 个条目。`);
  } catch (error) {
    group.error = error?.message || '加载失败';
    group.loadFailed = true;
    group.entriesResolved = false;
    setStatus(`加载 ${group.source} 失败。`);
  } finally {
    group.loading = false;
    importCandidates = importGroups.flatMap((item) => item.items || []);
    renderImportCandidates({ renderPreset: false });
    scrollWorldbookCardIntoView();
  }
}

function renderImportCandidates({ renderPreset = true, renderWorldbook = true } = {}) {
  const presetBox = $t('#st-esg-preset-candidates');
  const worldbookBox = $t('#st-esg-worldbook-candidates');
  if (!presetBox.length && !worldbookBox.length) return;
  if (!importGroups.length) {
    if (renderPreset) presetBox.html('<div class="st-esg-empty st-esg-empty-small">还没有预设条目。选择预设后点击“同步来源”。</div>');
    if (renderWorldbook) worldbookBox.html('<div class="st-esg-empty st-esg-empty-small">还没有世界书来源。点击“同步来源”后会按分类列出。</div>');
    renderTaskPlacementOptions();
    return;
  }
  const viewState = captureImportViewState();
  const groupsWithIndex = importGroups.map((group, groupIndex) => ({ ...group, groupIndex }));
  const presetGroups = groupsWithIndex.filter((group) => group.scope !== SOURCE_WORLDBOOK);
  const worldbookGroups = groupsWithIndex.filter((group) => group.scope === SOURCE_WORLDBOOK);
  const worldbookCategories = new Map();
  WORLDBOOK_CATEGORY_ORDER.forEach(([category, categoryLabel]) => worldbookCategories.set(category, { categoryLabel, groups: [] }));
  worldbookGroups.forEach((group) => {
    const currentEnabledCount = group.loaded && getSourceMode(group) === SOURCE_MODE_PROMPT
      ? group.items.filter((item) => getSourceSelection(item, group)).length
      : Number(group.pluginEnabledCount || 0);
    const category = resolveWorldbookSourceDisplayCategory(group, {
      mode: getWorldbookRuntimeMode(),
      enabledCount: currentEnabledCount,
      sourceEnabled: isWorldbookSourceEnabledByPlugin(group),
      entriesResolved: Boolean(group.entriesResolved || group.loaded),
      loadFailed: Boolean(group.loadFailed || group.error || group.missingFromTavern),
      unmatchedEnabledCount: Number(group.staleEnabledCount || 0),
    });
    if (!worldbookCategories.has(category)) worldbookCategories.set(category, { categoryLabel: group.categoryLabel || '世界书', groups: [] });
    worldbookCategories.get(category).groups.push(group);
  });
  const countItems = (groups) => groups.reduce((sum, group) => sum + (group.loaded ? group.items.length : 0), 0);
  const groupBody = (group) => {
    if (group.loading) return '<div class="st-esg-empty st-esg-empty-small">正在加载这本世界书...</div>';
    if (group.error) return `<div class="st-esg-empty st-esg-empty-small">${escapeHtml(group.error)}</div>`;
    if (!group.loaded) return '<div class="st-esg-empty st-esg-empty-small">展开后才加载条目，避免刷新卡顿。</div>';
    if (!group.items.length) return '<div class="st-esg-empty st-esg-empty-small">没有可导入条目</div>';
    return group.items.map((item, itemIndex) => {
      const checked = getSourceSelection(item, group);
      const isWorldbookItem = group.scope === SOURCE_WORLDBOOK;
      const isPromptEditing = getSourceMode(group) === SOURCE_MODE_PROMPT;
      const meta = [item.role ? `role: ${item.role}` : '', item.scope || '', item.sourceUid ? `id: ${item.sourceUid}` : ''].filter(Boolean).join(' | ');
      const summaryLabel = item.locked
        ? `<span class="st-esg-import-label"><i class="fa-solid fa-lock"></i><span>${escapeHtml(item.name)}</span></span>`
        : isPromptEditing
          ? `<label class="st-esg-source-enable-label"><span class="st-esg-source-enable-name">${escapeHtml(item.name)}</span><span class="st-esg-switch st-esg-switch-sm st-esg-source-enable-switch"><input class="st-esg-source-enabled" type="checkbox" ${checked ? 'checked' : ''} /><span></span></span></label>`
          : `<label class="st-esg-checkbox"><input class="st-esg-import-check" type="checkbox" ${checked ? 'checked' : ''} /><span>${escapeHtml(item.name)}</span></label>`;
      const modifiedMark = hasSourceItemOverride(item)
        ? '<i class="fa-solid fa-pen st-esg-source-modified-mark" title="条目已修改" aria-label="条目已修改"></i>'
        : '';
      const worldbookMode = isWorldbookItem && isPromptEditing
        ? (() => {
            const mode = getWorldbookActivationMode(item);
            const label = mode === 'blue' ? '蓝灯' : '绿灯';
            return `<button class="menu_button st-esg-worldbook-mode st-esg-worldbook-mode-${mode}" type="button" title="${label}" aria-label="${label}" aria-pressed="${mode === 'green'}" data-group-index="${group.groupIndex}" data-item-index="${itemIndex}"><span class="st-esg-worldbook-switch-thumb"></span></button>`;
          })()
        : '';
      const summary = `${summaryLabel}${modifiedMark}${worldbookMode}<button class="menu_button st-esg-source-expand" type="button" title="展开内容"><i class="fa-solid fa-chevron-down"></i></button>`;
      return `<details class="st-esg-import-item ${item.locked ? 'st-esg-import-item-locked' : ''}" data-group-index="${group.groupIndex}" data-item-index="${itemIndex}"><summary>${summary}</summary><div class="st-esg-source-detail"><div class="st-esg-card-desc">${escapeHtml(meta)}</div>${renderSourceContentEditor(item, group.groupIndex, itemIndex)}</div></details>`;
    }).join('');
  };
  const renderGroup = (group) => {
    const shouldOpen = group.uiOpen || viewState.openGroups.has(group.groupIndex) || (group.loaded && group.scope !== SOURCE_WORLDBOOK);
    return `<details class="st-esg-import-group" data-group-index="${group.groupIndex}" ${shouldOpen ? 'open' : ''}><summary class="st-esg-import-group-head"><div><div class="st-esg-import-group-title">${escapeHtml(group.group)}</div><div class="st-esg-card-desc">${group.loaded ? `${group.items.length} 个可导入条目` : '未加载，点开读取'}</div></div></summary><div class="st-esg-import-group-list">${groupBody(group)}</div></details>`;
  };
  const renderWorldbookRow = (group) => {
    const unmatchedCount = Number(group.staleEnabledCount || 0);
    const count = group.loaded
      ? `${group.items.filter((item) => getSourceSelection(item, group)).length}/${group.items.length}${unmatchedCount > 0 ? ` · ${unmatchedCount}条未匹配` : ''}`
      : getWorldbookCountText(group);
    return `<button class="st-esg-worldbook-row" type="button" data-group-index="${group.groupIndex}"><span>${escapeHtml(group.group)}</span><em>${count}</em><i class="fa-solid fa-chevron-right"></i></button>`;
  };
  const renderUnmatchedWorldbookRecords = (group) => {
    const records = Array.isArray(group.unmatchedWorldbookRecords) ? group.unmatchedWorldbookRecords : [];
    if (!records.length) return '';
    return `<div class="st-esg-unmatched-worldbook"><div class="st-esg-unmatched-worldbook-head"><div class="st-esg-import-group-title">未匹配的旧方案条目</div><div class="st-esg-card-desc">这些记录没有匹配上当前 UID。酒馆当前的 UID 条目仍正常显示在上方；请先重新勾选正确条目，再删除旧记录。</div></div>${records.map((record) => `<div class="st-esg-unmatched-worldbook-row"><div class="st-esg-unmatched-worldbook-copy"><div><strong>${escapeHtml(record.name || '旧方案条目')}</strong><em>未匹配上 UID</em></div>${record.contentPreview ? `<p>${escapeHtml(record.contentPreview)}</p>` : ''}</div><button class="menu_button st-esg-remove-unmatched-worldbook-record" type="button" data-group-index="${group.groupIndex}" data-record-key="${escapeHtml(record.key)}"><i class="fa-solid fa-trash"></i><span>删除该条记录</span></button></div>`).join('')}</div>`;
  };
  const renderWorldbookDetail = (group) => {
    const failed = Boolean(group.error || group.loadFailed || group.missingFromTavern);
    const failureBody = failed
      ? `<div class="st-esg-worldbook-failure"><div class="st-esg-import-group-title">无法读取这本世界书</div><div class="st-esg-card-desc">${escapeHtml(group.error || '酒馆没有返回这本世界书的条目。')}</div><div class="st-esg-card-desc">可能原因：世界书已被改名或删除；名称首尾含有空格或不可见字符；酒馆返回的名称与实际文件名不一致。</div><button class="menu_button st-esg-remove-worldbook-record" type="button" data-group-index="${group.groupIndex}"><i class="fa-solid fa-trash"></i><span>删除这条世界书记录</span></button></div>`
      : `${renderUnmatchedWorldbookRecords(group)}${renderListToolbar()}${groupBody(group)}`;
    const toggleLabel = getSourceMode(group) === SOURCE_MODE_PROMPT ? '开启全部条目' : '全选条目';
    return `<div class="st-esg-worldbook-detail" data-group-index="${group.groupIndex}"><div class="st-esg-detail-head"><button class="menu_button st-esg-back-worldbooks" type="button" title="返回世界书列表" aria-label="返回世界书列表"><i class="fa-solid fa-arrow-left"></i></button><div><div class="st-esg-import-group-title">${escapeHtml(group.group)}</div><div class="st-esg-card-desc">${group.loading ? '正在加载条目...' : failed ? '读取失败' : group.loaded ? `${group.items.length} 个可导入条目` : '准备加载这本世界书'}</div></div>${group.loaded && !failed ? `<button class="menu_button st-esg-import-detail-toggle" type="button">${toggleLabel}</button>` : ''}</div><div class="st-esg-import-group-list">${failureBody}</div></div>`;
  };
  const detailGroup = activeWorldbookGroupIndex === null ? null : groupsWithIndex.find((group) => group.groupIndex === activeWorldbookGroupIndex && group.scope === SOURCE_WORLDBOOK);
  const worldbookSection = detailGroup
    ? renderWorldbookDetail(detailGroup)
    : (worldbookGroups.length ? `<details class="st-esg-import-scope" open><summary class="st-esg-import-scope-summary"><span>世界书</span><em>${worldbookGroups.length} 本来源</em></summary><div class="st-esg-import-scope-body">${[...worldbookCategories.entries()].filter(([, category]) => category.groups.length).map(([categoryKey, category]) => `<details class="st-esg-import-category" data-category="${escapeHtml(categoryKey)}" open><summary class="st-esg-import-category-summary"><span>${escapeHtml(category.categoryLabel)}</span><em>${category.groups.length} 本</em></summary><div class="st-esg-import-category-body">${category.groups.map(renderWorldbookRow).join('')}</div></details>`).join('')}</div></details>` : '');
  if (renderPreset) presetBox.html(`${renderListToolbar()}${presetGroups.length ? presetGroups.map(renderGroup).join('') : '<div class="st-esg-empty st-esg-empty-small">当前预设没有可导入条目。</div>'}`);
  if (renderWorldbook) worldbookBox.html(worldbookSection || '<div class="st-esg-empty st-esg-empty-small">没有世界书来源。</div>');
  renderTaskPlacementOptions();
  restoreImportViewState(viewState);
  if (renderPreset) $t('.st-esg-import-group').on('toggle', function () {
    const groupIndex = Number($(this).data('group-index'));
    if (importGroups[groupIndex]) importGroups[groupIndex].uiOpen = this.open;
    if (this.open) loadImportGroup(groupIndex);
  });
  if (renderWorldbook) $t('.st-esg-worldbook-row').on('click', function () { openWorldbookDetail(Number($(this).data('group-index'))); });
  if (renderWorldbook) $t('.st-esg-back-worldbooks').on('click', backToWorldbookList);
  if (renderWorldbook) $t('.st-esg-remove-worldbook-record').on('click', async function (event) {
    event.preventDefault();
    event.stopPropagation();
    const group = importGroups[Number($(this).data('group-index'))];
    if (!group || !targetWindow.confirm(`确认删除世界书记录“${group.source}”？\n\n只会从当前插件方案中移除记录，不会删除酒馆里的世界书文件。`)) return;
    const source = getWorldbookRawName(group.source);
    settings.worldbookDraftSources = settings.worldbookDraftSources.filter((name) => getWorldbookRawName(name) !== source);
    const removed = removeWorldbookSourceRecords(getWorldbookRecordStores(), source);
    Object.assign(settings, removed.stores);
    markSchemeDirty('worldbook');
    activeWorldbookGroupIndex = null;
    await scanImportCandidates();
    setStatus(`已移除世界书记录“${source}”。请覆盖保存当前方案以永久保存这次修改。`);
  });
  if (renderWorldbook) $t('.st-esg-remove-unmatched-worldbook-record').on('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    const group = importGroups[Number($(this).data('group-index'))];
    const key = String($(this).attr('data-record-key') || '');
    const record = group?.unmatchedWorldbookRecords?.find((item) => item.key === key);
    if (!group || !record || !targetWindow.confirm(`确认删除旧方案条目记录“${record.name || '未命名'}”？\n\n只会删除插件方案中的未匹配记录，不会删除酒馆世界书条目。`)) return;
    const removed = removeWorldbookEntryRecord(getWorldbookRecordStores(), key);
    Object.assign(settings, removed.stores);
    group.unmatchedWorldbookRecords = group.unmatchedWorldbookRecords.filter((item) => item.key !== key);
    group.staleEnabledCount = group.unmatchedWorldbookRecords.filter((item) => item.enabled).length;
    removeEmptyWorldbookSchemeSource(group, group.loaded
      ? group.items.filter((item) => getSourceSelection(item, group)).length
      : group.pluginEnabledCount, { staleEnabledCount: group.staleEnabledCount });
    markSchemeDirty('worldbook');
    renderImportCandidates({ renderPreset: false });
    setStatus('已删除未匹配的旧方案条目记录。请覆盖保存当前方案。');
  });
  $t('.st-esg-import-check, .st-esg-source-enabled').off('.stEsgSource');
  $t('.st-esg-import-check, .st-esg-source-enabled').on('click.stEsgSource', (event) => event.stopPropagation());
  $t('.st-esg-source-enable-label').off('.stEsgSource').on('click.stEsgSource', (event) => event.stopPropagation());
  $t('.st-esg-import-check, .st-esg-source-enabled').on('change.stEsgSource', function () {
    const row = $(this).closest('.st-esg-import-item');
    const group = importGroups[Number(row.data('group-index'))];
    const item = group?.items?.[Number(row.data('item-index'))];
    setSourceSelection(item, Boolean($(this).prop('checked')));
    applyListFilters();
  });
  $t('.st-esg-worldbook-mode').off('.stEsgWorldbookMode');
  $t('.st-esg-worldbook-mode').on('click.stEsgWorldbookMode', function (event) {
    event.preventDefault();
    event.stopPropagation();
    const group = importGroups[Number($(this).data('group-index'))];
    const item = group?.items?.[Number($(this).data('item-index'))];
    if (!item) return;
    const nextMode = getWorldbookActivationMode(item) === 'blue' ? 'green' : 'blue';
    setWorldbookActivationMode(item, nextMode);
    renderImportCandidates({ renderPreset: false });
  });
  $t('.st-esg-source-expand').off('.stEsgSourceExpand');
  $t('.st-esg-source-expand').on('click.stEsgSourceExpand', function (event) {
    event.preventDefault();
    event.stopPropagation();
    const details = $(this).closest('.st-esg-import-item').get(0);
    if (details) details.open = !details.open;
  });
  $t('.st-esg-source-content, .st-esg-worldbook-keywords').off('.stEsgSourceContent');
  $t('.st-esg-source-content, .st-esg-worldbook-keywords').on('click.stEsgSourceContent', (event) => event.stopPropagation());
  $t('.st-esg-source-confirm').off('.stEsgSourceContent');
  $t('.st-esg-source-confirm').on('click.stEsgSourceContent', function (event) {
    event.preventDefault();
    event.stopPropagation();
    const group = importGroups[Number($(this).data('group-index'))];
    const item = group?.items?.[Number($(this).data('item-index'))];
    const detail = $(this).closest('.st-esg-source-detail');
    const textarea = detail.find('.st-esg-source-content');
    const keywordInput = detail.find('.st-esg-worldbook-keywords');
    const keywordValue = item?.scope === SOURCE_WORLDBOOK
      ? splitWorldbookKeywords(String(keywordInput.val() ?? ''))
      : [];
    setSourceItemOverrides(item, textarea.val(), keywordValue);
    textarea.val(getSourceContentValue(item));
    renderImportCandidates();
    setStatus('已保存条目。');
  });
  $t('.st-esg-source-cancel').off('.stEsgSourceContent');
  $t('.st-esg-source-cancel').on('click.stEsgSourceContent', function (event) {
    event.preventDefault();
    event.stopPropagation();
    const group = importGroups[Number($(this).data('group-index'))];
    const item = group?.items?.[Number($(this).data('item-index'))];
    const detail = $(this).closest('.st-esg-source-detail');
    detail.find('.st-esg-source-content').val(getSourceContentValue(item));
    detail.find('.st-esg-worldbook-keywords').val(getWorldbookKeywordValue(item));
    setStatus('已取消编辑。');
  });
  $t('.st-esg-source-restore').off('.stEsgSourceContent');
  $t('.st-esg-source-restore').on('click.stEsgSourceContent', function (event) {
    event.preventDefault();
    event.stopPropagation();
    const group = importGroups[Number($(this).data('group-index'))];
    const item = group?.items?.[Number($(this).data('item-index'))];
    if (!item?.key || item.locked) return;
    delete settings.sourceContentOverrides[item.key];
    delete settings.worldbookKeywordOverrides[item.key];
    markSchemeDirty(item.scope === SOURCE_WORLDBOOK ? 'worldbook' : 'preset');
    renderImportCandidates();
    setStatus('已恢复原生条目。');
  });
  if (renderWorldbook) $t('.st-esg-import-detail-toggle').on('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    const checks = $(this).closest('.st-esg-worldbook-detail').find('.st-esg-import-check, .st-esg-source-enabled');
    const shouldCheck = checks.toArray().some((item) => !$(item).prop('checked'));
    checks.prop('checked', shouldCheck);
    syncSelectionForChecks(checks);
    const promptEditing = getSourceMode('worldbook') === SOURCE_MODE_PROMPT;
    $(this).text(promptEditing
      ? (shouldCheck ? '关闭全部条目' : '开启全部条目')
      : (shouldCheck ? '取消全选' : '全选条目'));
  });
  $t('.st-esg-search-input').off('.stEsgListFilter');
  $t('.st-esg-search-input').on('input.stEsgListFilter', function () {
    listSearchQuery = String($(this).val() || '');
    applyListFilters();
  });
  $t('.st-esg-filter-select').off('.stEsgListFilter');
  $t('.st-esg-filter-select').on('change.stEsgListFilter', function () {
    listFilterMode = String($(this).val() || 'all');
    applyListFilters();
  });
  applyListFilters();
}

function importCheckedCandidates(sourceType) {
  if (getSourceMode(sourceType) !== SOURCE_MODE_IMPORT) {
    notifyStatus('当前是提示词编辑：启用状态会用于生成提示词，不会导入组件库。', 'warning');
    return;
  }
  const checked = $t('.st-esg-import-check:checked').toArray();
  if (!checked.length) { notifyStatus('请先勾选要导入的候选组件。', 'warning'); return; }
  const target = getImportTarget(sourceType);
  if (!target) { notifyStatus('请先选择导入目标。', 'warning'); return; }
  const { library, scope: targetScope, presetSchemeId, bindName } = target;
  let added = 0;
  for (const checkbox of checked) {
    const row = $(checkbox).closest('.st-esg-import-item');
    const group = importGroups[Number(row.data('group-index'))];
    const item = group?.items?.[Number(row.data('item-index'))];
    if (!item || getSourceType(item) !== getSourceType(sourceType)) continue;
    const content = getSourceContentValue(item);
    const importedComponent = { name: item.name, scope: targetScope, presetSchemeId, bindName, content, enabled: true, source: item.source, sourceType: item.scope, sourceOrder: item.sourceOrder, sourceUid: item.sourceUid, groupId: '' };
    if (library === 'theater') settings.theaterComponents.push({ id: createNewTheaterId(), name: item.name, content, enabled: true, source: item.source, sourceType: item.scope, sourceOrder: item.sourceOrder, sourceUid: item.sourceUid, groupId: '' });
    else settings.components.push({ id: createNewComponentId(), ...importedComponent });
    added += 1;
  }
  saveSettings(); renderComponentList(); renderImportCandidates(); notifyStatus(`已新增导入 ${added} 个组件。`);
}

function buildPluginPanelMarkup() {
  const importAction = (id, label) => `<div class="st-esg-actions-row st-esg-source-import-action"><div id="${id}" class="menu_button menu_button_icon st-esg-secondary-action"><i class="fa-solid fa-file-import"></i><span>${label}</span></div></div>`;
  return `<div class="st-esg-shell"><div class="st-esg-panel-header"><div class="st-esg-panel-title"><div class="st-esg-title-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></div><div><div class="st-esg-kicker">外置组件生成器</div><div class="st-esg-title-text">织幕·外置组件</div></div></div><div id="st-esg-close" class="menu_button fa-solid fa-xmark" title="关闭面板"></div></div><div class="st-esg-panel-body"><nav class="st-esg-tabs" aria-label="织幕·外置组件分页"><button class="st-esg-tab" type="button" data-tab="workspace"><i class="fa-solid fa-sparkles"></i><span>生成</span></button><button class="st-esg-tab" type="button" data-tab="task"><i class="fa-solid fa-pen-to-square"></i><span>任务指令</span></button><button class="st-esg-tab" type="button" data-tab="preset"><i class="fa-solid fa-list-check"></i><span>预设</span></button><button class="st-esg-tab" type="button" data-tab="worldbook"><i class="fa-solid fa-book-open"></i><span>世界书</span></button><button class="st-esg-tab" type="button" data-tab="runtime"><i class="fa-solid fa-sliders"></i><span>运行设置</span></button><button class="st-esg-tab" type="button" data-tab="components"><i class="fa-solid fa-layer-group"></i><span>组件库</span></button><button class="st-esg-tab" type="button" data-tab="debug"><i class="fa-solid fa-list"></i><span>提示词日志</span></button></nav><section class="st-esg-tab-panel" data-tab-panel="workspace">${buildGenerationSettingsMarkup()}<div class="st-esg-card st-esg-temporary-task-card"><label for="st-esg-temporary-task-instruction">额外指令</label><div class="st-esg-temporary-task-row"><input id="st-esg-temporary-task-instruction" class="text_pole" type="text" autocomplete="off" placeholder="临时追加到任务指令末尾" /><button id="st-esg-clear-temporary-task-instruction" class="menu_button st-esg-secondary-action" type="button">清空</button></div></div><div class="st-esg-card st-esg-generation-content"><div id="st-esg-thinking-panel" class="st-esg-hidden"></div><div id="st-esg-generation-error" class="st-esg-generation-error st-esg-hidden"></div><textarea id="st-esg-preview" class="text_pole textarea_compact st-esg-textarea st-esg-preview" rows="11" placeholder="生成后的组件会出现在这里。"></textarea></div><div class="st-esg-card st-esg-generation-history-card"><div class="st-esg-card-head"><div><div class="st-esg-card-title">最近生成记录</div><div class="st-esg-card-desc">保留最近三次成功生成；载入后可在上方预览框检查或编辑。</div></div></div><div id="st-esg-generation-history" class="st-esg-generation-history"></div></div></section><section class="st-esg-tab-panel" data-tab-panel="task"><div class="st-esg-card">${renderSchemeManager('task')}<div class="st-esg-card-head"><div><div class="st-esg-card-title">生成任务指令</div><div class="st-esg-card-desc">编辑最终发送给模型的任务指令；{{external_components}} 的位置会插入组件库内容，不写则不发送组件。</div></div></div><textarea id="st-esg-task" class="text_pole textarea_compact st-esg-textarea" rows="7"></textarea><div class="st-esg-actions-row"><div id="st-esg-reset-task" class="menu_button menu_button_icon st-esg-secondary-action"><i class="fa-solid fa-rotate-left"></i><span>恢复默认提示词</span></div></div></div></section><section class="st-esg-tab-panel" data-tab-panel="preset"><div class="st-esg-card st-esg-import-tools"><div class="st-esg-card-head"><div><div id="st-esg-source-mode-title" class="st-esg-card-title">提示词模式</div><div id="st-esg-source-mode-desc" class="st-esg-card-desc">当前勾选会作为外置生成时启用的来源，不会导入组件库。</div></div></div><div class="st-esg-grid"><label>来源模式<select id="st-esg-source-mode" class="text_pole"><option value="prompt">提示词模式</option><option value="import">导入组件库模式</option></select></label><label>导入到<select id="st-esg-import-target-scope" class="text_pole"><option>全局</option><option>预设</option><option>角色</option></select></label></div>${importAction('st-esg-import-preset-components', '导入预设勾选')}</div><div class="st-esg-card">${renderSchemeManager('preset')}<div class="st-esg-card-head"><div><div class="st-esg-card-title">预设</div><div class="st-esg-card-desc">用选择框切换预设；下方只显示当前选择的预设条目。</div></div></div><div class="st-esg-grid"><label>选择预设<select id="st-esg-source-preset" class="text_pole"></select></label></div><div id="st-esg-preset-placement-slot" class="st-esg-scheme-box"><label class="st-esg-checkbox st-esg-log-option"><input id="st-esg-task-placement-enabled" type="checkbox" /><span>自定义任务指令插入位置</span><em>开启后插入到指定预设条目之后；关闭时仍追加到末尾。</em></label><div id="st-esg-task-placement-row" class="st-esg-grid"><label>插入到这条预设之后<select id="st-esg-task-placement-after" class="text_pole"></select></label></div><label class="st-esg-checkbox st-esg-log-option"><input id="st-esg-replace-last-user-message" type="checkbox" /><span>用任务指令替换 {{LastUserMessage}}</span><em>开启后预设里的 {{LastUserMessage}} 会使用当前任务指令内容。</em></label><label class="st-esg-checkbox st-esg-log-option"><input id="st-esg-omit-original-user-messages" type="checkbox" /><span>不发送原用户输入</span><em>开启后聊天历史里的 user 消息不会发送给外置 API。</em></label></div><div id="st-esg-preset-candidates" class="st-esg-import-list"></div></div></section><section class="st-esg-tab-panel" data-tab-panel="worldbook"><div class="st-esg-card st-esg-import-tools st-esg-worldbook-mode-card"><div class="st-esg-card-head"><div><div id="st-esg-source-mode-title-worldbook" class="st-esg-card-title">提示词模式</div><div id="st-esg-source-mode-desc-worldbook" class="st-esg-card-desc">当前勾选会作为外置生成时启用的来源，不会导入组件库。</div></div></div><div class="st-esg-grid"><label>世界书来源模式<select id="st-esg-source-mode-worldbook" class="text_pole"><option value="prompt">提示词模式</option><option value="import">导入组件库模式</option></select></label></div>${importAction('st-esg-import-worldbook-components', '导入世界书勾选')}</div><div class="st-esg-card"><div class="st-esg-card-head"><div><div class="st-esg-card-title">世界书</div><div class="st-esg-card-desc">这里是独立的世界书列表；点进某本世界书后只替换这张卡片。</div></div></div>${renderSchemeManager('worldbook')}<div id="st-esg-worldbook-candidates" class="st-esg-import-list"></div></div></section><section class="st-esg-tab-panel" data-tab-panel="runtime"><details class="st-esg-card st-esg-collapsible"><summary class="st-esg-collapsible-summary">API配置</summary><div class="st-esg-collapsible-body">${renderSchemeManager('api')}<div class="st-esg-grid"><label>API 地址<input id="st-esg-api-url" class="text_pole" type="text" placeholder="例如 https://api.openai.com/v1" /></label><label>模型名称<input id="st-esg-api-model" class="text_pole" type="text" list="st-esg-model-options" placeholder="例如 gpt-4o-mini / deepseek-chat" /><datalist id="st-esg-model-options"></datalist></label><label>最大输出<input id="st-esg-max-tokens" class="text_pole" type="number" min="1" step="1" /></label><label>温度<input id="st-esg-temperature" class="text_pole" type="number" min="0" max="2" step="0.1" /></label></div><label class="st-esg-secret-label">API Key<input id="st-esg-api-key" class="text_pole" type="password" placeholder="可选。多数独立 API 需要填写。" /></label><label class="st-esg-checkbox st-esg-log-option"><input id="st-esg-streaming-enabled" type="checkbox" /><span>启用流式传输</span><em>开启后生成结果会随着 API 返回逐步显示。</em></label><div class="st-esg-actions-row"><div id="st-esg-fetch-models" class="menu_button menu_button_icon st-esg-secondary-action"><i class="fa-solid fa-cloud-arrow-down"></i><span>拉取模型</span></div></div></div></details><div class="st-esg-card"><div class="st-esg-card-head"><div><div class="st-esg-card-title">标签清理</div><div class="st-esg-card-desc">分别处理拼接提示词时的聊天历史，以及生成内容注入前的思维链标签。</div></div></div><div class="st-esg-grid"><label>聊天历史清理标签<textarea id="st-esg-history-cleanup-tags" class="text_pole textarea_compact st-esg-textarea" rows="4"></textarea></label><label>生成内容剥离标签<textarea id="st-esg-output-cleanup-tags" class="text_pole textarea_compact st-esg-textarea" rows="4"></textarea></label></div></div><details class="st-esg-card st-esg-collapsible"><summary class="st-esg-collapsible-summary">柏宝书记忆库</summary><div class="st-esg-collapsible-body"><label class="st-esg-checkbox st-esg-log-option"><input id="st-esg-baibai-history-enabled" type="checkbox" /><span>注入此前剧情</span><em>注入柏宝书整理的历史记忆。</em></label><label class="st-esg-checkbox st-esg-log-option"><input id="st-esg-baibai-state-enabled" type="checkbox" /><span>注入故事现状</span><em>注入人物、物品、相关人物、未结束事项和持续记录的变量。</em></label></div></details></section><section class="st-esg-tab-panel" data-tab-panel="components"><div class="st-esg-card"><div class="st-esg-card-head"><div><div class="st-esg-card-title">手动添加组件</div><div class="st-esg-card-desc">组件库只管理最终会发送的组件；从预设和世界书导入请去“预设/世界书”页。</div></div></div><div class="st-esg-grid"><label>组件名<input id="st-esg-component-name" class="text_pole" type="text" /></label><label>归属<select id="st-esg-component-scope" class="text_pole"><option>全局</option><option>预设</option><option>角色</option></select></label></div><textarea id="st-esg-component-content" class="text_pole textarea_compact st-esg-textarea" rows="5"></textarea><div class="st-esg-actions-row"><div id="st-esg-add-component" class="menu_button menu_button_icon st-esg-secondary-action"><i class="fa-solid fa-plus"></i><span>添加到组件库</span></div></div></div><div id="st-esg-component-list" class="st-esg-component-list"></div></section><section class="st-esg-tab-panel" data-tab-panel="debug"><div class="st-esg-card"><div class="st-esg-card-head"><div><div class="st-esg-card-title">提示词日志</div><div class="st-esg-card-desc">按 API messages 分栏查看；复制日志仍会复制完整 JSON，不保存 API Key。</div></div></div><label class="st-esg-checkbox st-esg-log-option"><input id="st-esg-compress-system" type="checkbox" /><span>压缩连续系统消息</span><em>将连续 system 合并为一条，遇到 user/assistant 会断开。</em></label><div id="st-esg-prompt-log-summary" class="st-esg-prompt-log-summary"></div><div id="st-esg-prompt-log-view" class="st-esg-prompt-log-view"></div><textarea id="st-esg-prompt-log" class="st-esg-hidden-log" readonly></textarea><div class="st-esg-actions-row"><div id="st-esg-copy-prompt-log" class="menu_button menu_button_icon st-esg-secondary-action"><i class="fa-solid fa-copy"></i><span>复制完整日志</span></div><div id="st-esg-clear-prompt-log" class="menu_button menu_button_icon st-esg-secondary-action"><i class="fa-solid fa-eraser"></i><span>清空日志</span></div></div></div></section></div><div class="st-esg-panel-footer"><div id="st-esg-status" class="st-esg-status-pill"><span class="st-esg-dot"></span><span>准备就绪</span></div><div class="st-esg-footer-actions"><div id="st-esg-generate" class="menu_button menu_button_icon st-esg-primary-action"><i class="fa-solid fa-sparkles"></i><span>生成组件</span></div><div id="st-esg-inject" class="menu_button menu_button_icon st-esg-secondary-action"><i class="fa-solid fa-file-import"></i><span>注入回复</span></div></div></div></div>`;
}

function buildGenerationSettingsMarkup() {
  return `<details class="st-esg-card st-esg-collapsible st-esg-generation-settings"><summary class="st-esg-collapsible-summary">生成设置</summary><div class="st-esg-collapsible-body st-esg-generation-settings-body">
    <section class="st-esg-generation-settings-section">
      <div class="st-esg-generation-settings-section-title"><strong>运行流程</strong></div>
      <div class="st-esg-generation-settings-grid">
        <label class="st-esg-checkbox st-esg-log-option st-esg-generation-setting-card"><input id="st-esg-auto-generate" type="checkbox" /><span>监听正文结束自动生成</span><em>检测到新的助手正文结束后自动开始生成。</em></label>
        <div id="st-esg-auto-generate-trigger-row" class="st-esg-auto-generate-trigger st-esg-hidden">
          <label for="st-esg-auto-generate-trigger">自动生成触发字符串</label>
          <input id="st-esg-auto-generate-trigger" class="text_pole" type="text" autocomplete="off" placeholder="留空则不限制" />
          <span>仅当最新回复原样包含该字符串时自动生成；区分大小写，留空则保持当前行为。</span>
        </div>
        <label class="st-esg-checkbox st-esg-log-option st-esg-generation-setting-card"><input id="st-esg-auto-inject" type="checkbox" /><span>生成结束后自动注入</span><em>生成完成并通过解析后，自动写回当前回复。</em></label>
      </div>
    </section>
    <section class="st-esg-generation-settings-section st-esg-generation-injection-section">
      <div class="st-esg-generation-settings-section-title"><strong>注入方式</strong></div>
      <select id="st-esg-inject-mode" class="text_pole st-esg-select" aria-label="注入方式"><option value="replace">正文已有同名标签时直接覆盖</option><option value="append">始终追加到末尾</option><option value="anchor">按模型返回的自定义锚点插入</option></select>
      <div id="st-esg-inject-mode-help" class="st-esg-generation-settings-help" role="status" aria-live="polite"><i class="fa-solid fa-circle-info" aria-hidden="true"></i><span></span></div>
    </section>
    <section class="st-esg-generation-settings-section">
      <div class="st-esg-generation-settings-section-title"><strong>注入处理</strong></div>
      <div class="st-esg-generation-settings-grid st-esg-generation-processing-options">
        <label class="st-esg-checkbox st-esg-log-option st-esg-generation-setting-row"><input id="st-esg-rollback-before-generation" type="checkbox" /><span>生成前撤回本楼上次注入</span><em>只在开始新一轮生成前撤回上一轮注入；手动点击“注入”不会重复撤回。</em></label>
        <label class="st-esg-checkbox st-esg-log-option st-esg-generation-setting-row"><input id="st-esg-status-placeholder-enabled" type="checkbox" /><span>将 MVU 状态标签固定到正文末尾</span><em>检测正文或生成内容中的 &lt;StatusPlaceHolderImpl/&gt;，清理重复项并在最终文末保留一个。</em></label>
        <label class="st-esg-checkbox st-esg-log-option st-esg-generation-setting-row"><input id="st-esg-mvu-reprocess-on-inject" type="checkbox" /><span>注入变量更新后重处理 MVU 变量</span><em>仅本次注入内容含有 &lt;UpdateVariable&gt; 时执行；未安装 MVU 会自动跳过。</em></label>
      </div>
    </section>
  </div></details>`;
}

function upgradePanelActionToButton(dialog, selector) {
  const current = dialog.querySelector(selector);
  if (!current || current.tagName === 'BUTTON') return current;
  const button = targetDoc.createElement('button');
  for (const { name, value } of current.attributes) button.setAttribute(name, value);
  button.type = 'button';
  button.innerHTML = current.innerHTML;
  current.replaceWith(button);
  return button;
}

function renderHistoryRangeUi() {
  const mode = normalizeChatHistoryRangeMode(settings.historyRangeMode);
  settings.historyRangeMode = mode;
  const count = normalizeRecentMessageCount(settings.recentMessageCount);
  settings.recentMessageCount = count;
  $t('input[name="st-esg-history-range-mode"]').prop('checked', false);
  $t(`#st-esg-history-range-mode-${mode}`).prop('checked', true);
  $t('#st-esg-recent-message-count').val(count).prop('disabled', mode !== CHAT_HISTORY_RANGE_RECENT);
}

function commitRecentMessageCountInput(input) {
  const raw = String($(input).val() ?? '').trim();
  const count = normalizeRecentMessageCount(raw || 10);
  settings.recentMessageCount = count;
  $(input).val(count);
  saveSettings();
}

function buildDataScopeSummary(groups, emptyText) {
  if (!groups.length) return `<div class="st-esg-data-empty">${escapeHtml(emptyText)}</div>`;
  return groups.map((group) => `<details class="st-esg-data-scope-item" ${group.orphan ? 'data-orphan="true"' : ''}>
    <summary><span>${escapeHtml(group.label)}</span><span>${group.items.length} 个组件${group.orphan ? ' · 归属已不存在' : ''}</span></summary>
    <div class="st-esg-data-scope-items">${group.items.map((item) => `<div class="st-esg-data-row"><span>${escapeHtml(item.name || '未命名组件')}</span><button class="st-esg-icon-btn st-esg-icon-danger st-esg-data-action-button st-esg-data-delete-component" type="button" data-component-id="${escapeHtml(item.id)}" title="删除组件" aria-label="删除组件"><i class="fa-solid fa-trash"></i></button></div>`).join('')}</div>
  </details>`).join('');
}

function renderDataManagement() {
  const host = targetDoc.getElementById('st-esg-data-management');
  if (!host) return;
  const model = buildDataManagementModel(settings, {
    characterNames: getAvailableCharacterNames(),
    runtimeData: {
      promptLog: lastPromptLogText,
      recentGenerationHistory,
      animaWorldbookSnapshot,
    },
  });
  const storageRows = [
    ['schemes', 'fa-folder-tree', '方案数据', model.counts.schemes, `${model.counts.schemes} 个已保存方案`, 'API、任务指令、预设和世界书方案', model.storage.schemes],
    ['libraries', 'fa-layer-group', '库数据', model.counts.libraries, `${model.counts.libraries} 个条目`, '组件库、小剧场库及其分组', model.storage.libraries],
    ['bindings', 'fa-link', '聊天绑定', model.counts.bindings, `${model.counts.bindings} 个有效绑定`, '聊天窗口与世界书方案的自动切换关系', model.storage.bindings],
    ['runtime', 'fa-clock-rotate-left', '临时记录', model.counts.runtime, `${model.counts.runtime} 类记录`, '生成结果、提示词日志和最近记录', model.storage.caches],
  ];
  const characterComponentCount = model.characterGroups.reduce((sum, group) => sum + group.items.length, 0);
  const presetComponentCount = model.presetGroups.reduce((sum, group) => sum + group.items.length, 0);
  const worldbookSchemeCount = model.worldbookSchemes.length;
  host.innerHTML = `
    <section class="st-esg-data-summary">
      <div><span>插件数据估算占用</span><strong>${formatByteSize(model.storage.total)}</strong></div>
      <p>这里只负责整类清空。单独编辑或删除某项数据，请前往对应功能页面。</p>
    </section>
    <div class="st-esg-data-overview">${storageRows.map(([key, icon, label, count, countLabel, description, size]) => `<section class="st-esg-data-category">
      <div class="st-esg-data-category-icon"><i class="fa-solid ${icon}"></i></div>
      <div class="st-esg-data-category-copy"><div><strong>${label}</strong><span>${countLabel}</span></div><p>${description}</p></div>
      <div class="st-esg-data-category-size"><span>占用</span><b>${formatByteSize(size)}</b></div>
      <button class="menu_button st-esg-data-action-button st-esg-data-clear-button" type="button" data-clear-category="${key}" ${Number(count) > 0 ? '' : 'disabled'}><i class="fa-solid fa-trash-can"></i><span>清空</span></button>
    </section>`).join('')}</div>
    <section class="st-esg-data-details">
      <div class="st-esg-data-section-heading"><strong>细分管理</strong><span>集中管理平时需要切换角色、预设或聊天后才能找到的数据。</span></div>
      <details class="st-esg-data-detail-group">
        <summary><span>角色专属组件</span><b>${characterComponentCount}</b></summary>
        <div class="st-esg-data-detail-body st-esg-data-scope-list">${buildDataScopeSummary(model.characterGroups, '没有保存角色专属组件。')}</div>
      </details>
      <details class="st-esg-data-detail-group">
        <summary><span>预设专属组件</span><b>${presetComponentCount}</b></summary>
        <div class="st-esg-data-detail-body st-esg-data-scope-list">${buildDataScopeSummary(model.presetGroups, '没有保存预设专属组件。')}</div>
      </details>
      <details class="st-esg-data-detail-group">
        <summary><span>世界书方案快照</span><b>${worldbookSchemeCount}</b></summary>
        <div class="st-esg-data-detail-body st-esg-data-binding-list">${worldbookSchemeCount ? model.worldbookSchemes.map((scheme) => `<div class="st-esg-data-binding ${scheme.hasData ? '' : 'st-esg-data-orphan'}"><div><strong>${escapeHtml(scheme.name)}</strong><span>${scheme.sourceCount} 个世界书来源 · ${scheme.entryCount} 条条目记录 · ${formatByteSize(scheme.size)}</span></div><span>${scheme.hasData ? '可恢复' : '空快照'}</span></div>`).join('') : '<div class="st-esg-data-empty">没有保存世界书方案。</div>'}</div>
      </details>
      <details class="st-esg-data-detail-group">
        <summary><span>聊天世界书绑定</span><b>${model.chatBindings.length}</b></summary>
        <div class="st-esg-data-detail-body st-esg-data-binding-list">${model.chatBindings.length ? model.chatBindings.map((binding) => `<div class="st-esg-data-binding ${binding.orphan ? 'st-esg-data-orphan' : ''}"><div><strong>${escapeHtml(binding.chatName || binding.chatId)}</strong><span>${escapeHtml(binding.characterName || '未知角色')} · ${escapeHtml(binding.schemeName || '未知方案')}${binding.orphan ? ' · 方案已不存在' : ''}</span></div><button class="menu_button st-esg-data-action-button st-esg-cancel-chat-binding" type="button" data-chat-id="${escapeHtml(binding.chatId)}">取消绑定</button></div>`).join('') : '<div class="st-esg-data-empty">还没有聊天绑定世界书方案。</div>'}</div>
      </details>
      <div class="st-esg-data-orphan-cleanup"><div><strong>遗留数据</strong><span>${model.orphanComponentIds.length + model.orphanBindingChatIds.length ? `发现 ${model.orphanComponentIds.length + model.orphanBindingChatIds.length} 条归属或方案已不存在的数据。` : '未发现遗留数据。'}</span></div><button id="st-esg-clean-orphan-data" class="menu_button st-esg-data-action-button st-esg-icon-danger" type="button" ${model.orphanComponentIds.length + model.orphanBindingChatIds.length ? '' : 'disabled'}><i class="fa-solid fa-broom"></i><span>清理遗留数据</span></button></div>
    </section>`;
}

function releaseDataManagementButton(button) {
  if (!button) return;
  button.blur?.();
  button.classList?.remove('active', 'selected', 'pressed');
  targetWindow.requestAnimationFrame?.(() => {
    button.blur?.();
    button.classList?.remove('active', 'selected', 'pressed');
  });
}

function openDataManagementDialog() {
  let dialog = targetDoc.getElementById('st-esg-data-management-dialog');
  if (!dialog) {
    dialog = targetDoc.createElement('dialog');
    dialog.id = 'st-esg-data-management-dialog';
    dialog.className = `st-esg-data-management-dialog ${getThemeClassName(settings.theme)}`;
    dialog.innerHTML = `<div class="st-esg-data-dialog-shell"><header><div><strong>数据管理</strong><span>查看织幕保存的数据，并按类别清空。</span></div><button class="st-esg-header-btn" type="button" data-data-dialog-close title="关闭" aria-label="关闭数据管理"><i class="fa-solid fa-xmark"></i></button></header><div id="st-esg-data-management" class="st-esg-data-dialog-body"></div></div>`;
    targetDoc.body.appendChild(dialog);
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); dialog.close(); });
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    dialog.querySelector('[data-data-dialog-close]')?.addEventListener('click', () => dialog.close());
    $(dialog).on('click', '.st-esg-data-delete-component', function (event) {
      event.preventDefault();
      releaseDataManagementButton(event.currentTarget);
      const id = textOf($(this).data('component-id'));
      const component = settings.components.find((item) => textOf(item?.id) === id);
      if (!component || !targetWindow.confirm(`确认删除组件“${component.name || '未命名组件'}”？此操作无法恢复。`)) return;
      settings.components = settings.components.filter((item) => textOf(item?.id) !== id);
      saveSettings();
      renderDataManagement();
      renderComponentList();
      notifyStatus('已删除组件。');
    }).on('click', '.st-esg-cancel-chat-binding', function (event) {
      event.preventDefault();
      releaseDataManagementButton(event.currentTarget);
      void cancelChatWorldbookBinding($(this).data('chat-id'));
    }).on('click', '#st-esg-clean-orphan-data', function (event) {
      event.preventDefault();
      releaseDataManagementButton(event.currentTarget);
      cleanOrphanPluginData();
    }).on('click', '[data-clear-category]', function (event) {
      event.preventDefault();
      releaseDataManagementButton(event.currentTarget);
      void clearDataManagementCategory($(this).data('clear-category'));
    });
  }
  dialog.className = `st-esg-data-management-dialog ${getThemeClassName(settings.theme)}`;
  renderDataManagement();
  if (!dialog.open) dialog.showModal();
}

async function cancelChatWorldbookBinding(chatId) {
  const id = textOf(chatId);
  if (!id) return;
  const binding = normalizeChatBindingIndex(settings.chatWorldbookBindings).find((item) => item.chatId === id && !item.cancelled);
  if (!binding || !targetWindow.confirm(`确认取消聊天“${binding.chatName || id}”的世界书方案绑定？`)) return;
  settings.chatWorldbookBindings = cancelChatBindingIndex(settings.chatWorldbookBindings, id);
  const context = getContext();
  if (getCurrentChatIdSafe(context) === id) {
    const metadata = getCurrentChatMetadata(context);
    if (metadata) {
      setChatWorldbookSchemeId(metadata, '');
      await persistCurrentChatMetadata(context);
    }
  }
  saveSettings();
  renderDataManagement();
  notifyStatus('已取消聊天的世界书方案绑定。');
}

function cleanOrphanPluginData() {
  const model = buildDataManagementModel(settings, { characterNames: getAvailableCharacterNames() });
  const ids = new Set(model.orphanComponentIds);
  const chatIds = new Set(model.orphanBindingChatIds);
  if (!ids.size && !chatIds.size) return;
  if (!targetWindow.confirm(`确认清理 ${ids.size + chatIds.size} 条遗留数据？此操作无法恢复。`)) return;
  settings.components = settings.components.filter((item) => !ids.has(textOf(item?.id)));
  settings.chatWorldbookBindings = normalizeChatBindingIndex(settings.chatWorldbookBindings).filter((item) => !chatIds.has(item.chatId));
  saveSettings();
  renderDataManagement();
  renderComponentList();
  notifyStatus('已清理遗留数据。');
}

async function clearDataManagementCategory(category) {
  const model = buildDataManagementModel(settings, { characterNames: getAvailableCharacterNames() });
  const definitions = {
    schemes: {
      count: model.counts.schemes,
      message: `确认清空全部 ${model.counts.schemes} 个已保存方案？API、任务指令、预设和世界书方案都会被删除，当前编辑内容不会被清空。此操作无法恢复。`,
      clear() {
        settings = clearSettingsDataCategory(settings, 'schemes');
      },
    },
    libraries: {
      count: model.counts.libraries,
      message: `确认清空组件库和小剧场库中的全部 ${model.counts.libraries} 个条目？分组也会一并删除。此操作无法恢复。`,
      clear() {
        settings = clearSettingsDataCategory(settings, 'libraries');
        selectedComponentIds.clear();
        selectedTheaterIds.clear();
        exportSelectedComponentIds.clear();
        exportSelectedTheaterIds.clear();
      },
    },
    bindings: {
      count: model.counts.bindings,
      message: `确认取消全部 ${model.counts.bindings} 个聊天世界书绑定？以后打开这些聊天时不再自动切换方案。`,
      clear() {
        settings = clearSettingsDataCategory(settings, 'bindings');
        const metadata = getCurrentChatMetadata();
        if (metadata) setChatWorldbookSchemeId(metadata, '');
      },
      async persist() { await persistCurrentChatMetadata(); },
    },
    runtime: {
      count: model.counts.runtime,
      message: '确认清空生成结果、最近生成记录、提示词查看记录、报错记录、思维链和 Anima 临时快照？此操作不会删除方案或组件。',
      async clear() {
        settings.lastGenerated = '';
        settings.lastGeneratedAnchorItems = [];
        settings.lastGeneratedAnchorWarnings = [];
        settings.lastGeneratedStatusPlaceholderPresent = false;
        settings.lastGenerationError = null;
        settings.lastPromptLog = '';
        lastPromptLogText = '';
        lastRuntimeDiagnostics = {};
        clearGeneratedThinking();
        recentGenerationHistory = [];
        try { getGenerationHistoryStorage()?.removeItem?.(GENERATION_HISTORY_STORAGE_KEY); } catch (_) {}
        clearAnimaWorldbookSnapshot();
      },
    },
  };
  const definition = definitions[textOf(category)];
  if (!definition || !definition.count || !targetWindow.confirm(definition.message)) return;
  try {
    await definition.clear();
    await definition.persist?.();
    saveSettings();
    renderAllSchemeOptions();
    renderComponentList();
    renderGenerationHistory();
    renderGeneratedThinking();
    renderGenerationResultPanel();
    renderPromptLog();
    renderDataManagement();
    notifyStatus('已清空所选数据。');
  } catch (error) {
    notifyStatus(`清空数据失败：${error?.message || '未知错误'}`, 'error');
  }
}

function renderGenerationSettings() {
  const modeSelect = targetDoc.getElementById('st-esg-inject-mode');
  const modeHelp = targetDoc.getElementById('st-esg-inject-mode-help');
  const injectionHelp = getGenerationInjectionModeHelp(settings.injectMode);
  if (modeSelect) modeSelect.value = injectionHelp.mode;
  if (modeHelp) {
    modeHelp.dataset.mode = injectionHelp.mode;
    const helpText = modeHelp.querySelector('span');
    if (helpText) helpText.textContent = injectionHelp.text;
  }
  $t('#st-esg-auto-generate').prop('checked', settings.autoGenerate);
  $t('#st-esg-auto-generate-trigger').val(settings.automaticGenerationTriggerText);
  $t('#st-esg-auto-generate-trigger-row').toggleClass('st-esg-hidden', !settings.autoGenerate);
  $t('#st-esg-auto-inject').prop('checked', settings.autoInject);
  $t('#st-esg-inject-mode').val(injectionHelp.mode);
  $t('#st-esg-rollback-before-generation').prop('checked', settings.rollbackBeforeGeneration);
  $t('#st-esg-status-placeholder-enabled').prop('checked', settings.statusPlaceholderEnabled);
  $t('#st-esg-mvu-reprocess-on-inject').prop('checked', settings.mvuReprocessOnInject);
}

function getActiveMultiTask() {
  const state = normalizeMultiTaskSettings(settings.multiTaskSettings);
  return state.tasks.find((task) => task.id === state.activeTaskId) || state.tasks[0] || null;
}

async function ensureRuntimePromptSourceItemsForGeneration(runtimeSettings, { chat = null, animaWorldbookEntries = [] } = {}) {
  const context = getContext();
  const presetFollowsTavern = runtimeSettings.presetRuntimeMode === 'tavern';
  const worldbookFollowsTavern = runtimeSettings.worldbookRuntimeMode === 'tavern';
  const presetName = presetFollowsTavern
    ? getCurrentPresetNameSafe(targetWindow, context)
    : textOf(runtimeSettings.activeSourcePreset);
  const selectedWorldNames = worldbookFollowsTavern ? getSelectedGlobalWorldbookNamesFromDom() : [];
  const worldbookGroups = collectWorldbookImportGroups({
    targetWindow,
    context,
    selectedWorldNames,
    explicitWorldbookNames: worldbookFollowsTavern ? null : runtimeSettings.worldbookDraftSources,
  });
  const worldbookRuntimeOptions = {
    mode: worldbookFollowsTavern ? WORLDBOOK_RUNTIME_NATIVE : WORLDBOOK_RUNTIME_SCHEME,
    sourceNames: runtimeSettings.worldbookDraftSources,
    selections: runtimeSettings.promptSelections || {},
  };
  const activeWorldbookGroups = worldbookGroups.filter((group) => isWorldbookSourceEnabled(group, worldbookRuntimeOptions));
  await loadWorldbookSourceGroups(
    activeWorldbookGroups,
    (worldbookName, group) => collectWorldbookImportCandidates(targetWindow, worldbookName)
      .then((items) => attachWorldbookRuntimeCategory(group, items)),
  );
  const worldbookIssue = getWorldbookGenerationIssue(activeWorldbookGroups);
  if (worldbookIssue) throw new Error(worldbookIssue);
  const groups = [
    ...collectPresetImportGroups({ targetWindow, context, presetName }),
    ...worldbookGroups,
  ];
  const selected = collectSelectedPromptSourceItems(
    groups,
    runtimeSettings.promptSelections || {},
    runtimeSettings.sourceContentOverrides || {},
    {
      isSelected: (item, group) => {
        if (item?.scope === SOURCE_WORLDBOOK) {
          return resolveWorldbookEntryRuntimeState(group, item, worldbookRuntimeOptions).shouldInject;
        }
        return presetFollowsTavern ? item?.enabled !== false : undefined;
      },
    },
  );
  const selectedItemsWithAnima = applyAnimaWorldbookOverrides(selected, animaWorldbookEntries);
  const itemsWithKeywordOverrides = selectedItemsWithAnima.map((item) => {
    if (item?.scope !== SOURCE_WORLDBOOK || !item?.key || !Object.prototype.hasOwnProperty.call(runtimeSettings.worldbookKeywordOverrides || {}, item.key)) return item;
    return { ...item, worldbookKeys: splitWorldbookKeywords(runtimeSettings.worldbookKeywordOverrides[item.key]) };
  });
  const promptChat = Array.isArray(chat) ? chat : context.chat;
  return filterWorldbookPromptItems(itemsWithKeywordOverrides, {
    chat: promptChat,
    scanDepth: getWorldbookScanDepth(),
    historyRangeMode: runtimeSettings.historyRangeMode,
    recentMessageCount: runtimeSettings.recentMessageCount,
    historyCleanupRules: runtimeSettings.historyCleanupRules,
    activationModeForItem: worldbookFollowsTavern
      ? (item) => item?.activationMode
      : (item) => normalizeWorldbookActivationMode(runtimeSettings.worldbookActivationOverrides?.[item?.key] || item?.activationMode, 'green'),
    substituteKeyword: (keyword) => typeof context?.substituteParams === 'function'
      ? context.substituteParams.call(context, keyword)
      : keyword,
  });
}

function showGenerationHistoryDialog() {
  targetDoc.getElementById('st-esg-generation-history-dialog')?.remove();
  const dialog = targetDoc.createElement('dialog');
  dialog.id = 'st-esg-generation-history-dialog';
  dialog.className = `st-esg-scheme-name-dialog st-esg-generation-history-dialog ${getThemeClassName(settings.theme)}`;
  dialog.innerHTML = `<div class="st-esg-generation-history-shell">
    <header><div><div class="st-esg-card-title">最近生成记录</div><div class="st-esg-card-desc">单任务与多任务共用，最多保留五条成功生成记录。</div></div><button class="menu_button menu_button_icon st-esg-secondary-action" type="button" data-generation-history-close aria-label="关闭历史记录" title="关闭"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header>
    <div class="st-esg-generation-history-dialog-body"><div id="st-esg-generation-history" class="st-esg-generation-history"></div></div>
  </div>`;
  const finish = () => {
    if (dialog.open) dialog.close();
    dialog.remove();
  };
  dialog.querySelector('[data-generation-history-close]')?.addEventListener('click', finish);
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(); });
  dialog.querySelector('#st-esg-generation-history')?.addEventListener('click', (event) => {
    const button = event.target.closest('.st-esg-load-generation-history');
    if (!button) return;
    if (loadGenerationHistoryEntry(button.getAttribute('data-history-id'))) finish();
  });
  targetDoc.body.appendChild(dialog);
  dialog.showModal();
  renderGenerationHistory();
}

function replaceMultiTask(taskId, patch) {
  const state = normalizeMultiTaskSettings(settings.multiTaskSettings);
  settings.multiTaskSettings = {
    ...state,
    tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
  };
}

function cancelMultiTaskGeneration(taskIds = null) {
  const state = normalizeMultiTaskSettings(settings.multiTaskSettings);
  const requestedIds = Array.isArray(taskIds) ? new Set(taskIds.map(textOf).filter(Boolean)) : null;
  const cancellable = new Set([MULTI_TASK_STATUS.QUEUED, MULTI_TASK_STATUS.GENERATING]);
  let changed = false;
  settings.multiTaskSettings = {
    ...state,
    tasks: state.tasks.map((task) => {
      if ((requestedIds && !requestedIds.has(task.id)) || !cancellable.has(task.status)) return task;
      multiTaskAbortControllers.get(task.id)?.abort();
      multiTaskAbortControllers.delete(task.id);
      changed = true;
      return {
        ...task,
        runId: '',
        status: task.output || task.anchorItems.length ? MULTI_TASK_STATUS.READY : MULTI_TASK_STATUS.IDLE,
      };
    }),
  };
  if (changed) renderMultiTaskRuntimeState();
  return changed;
}

function getMultiTaskSchemeLists() {
  return {
    apiSchemes: settings.apiSchemes,
    presetSchemes: settings.presetSchemes,
    worldbookSchemes: settings.worldbookSchemes,
    componentSchemes: settings.componentSchemes,
  };
}

function serializeMultiTaskError(error) {
  return {
    message: textOf(error?.message) || '生成失败。',
    code: textOf(error?.code),
  };
}

function updateMultiTaskStream(taskId, text, runId) {
  const state = normalizeMultiTaskSettings(settings.multiTaskSettings);
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task || task.runId !== runId) return;
  const streamed = normalizeStreamOutputPreview(text);
  replaceMultiTask(taskId, {
    output: streamed.text,
    thinking: streamed.thinking ? [streamed.thinking] : [],
    error: null,
  });
  updateMessageFloorPanelMultiTaskStream(taskId);
  if (state.activeTaskId !== taskId || settings.generationMode !== 'multi') return;
  const preview = targetDoc.getElementById('st-esg-preview');
  if (preview) preview.value = streamed.text;
  lastGeneratedThinking = streamed.thinking ? [streamed.thinking] : [];
  settings.lastGeneratedThinking = [...lastGeneratedThinking];
  updateStreamedThinking(streamed.thinking);
  resizeGeneratedPreview();
}

function normalizeMultiTaskGeneratedResult(rawText) {
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

function recordMultiTaskHistory(result) {
  const historyResult = result.resultMode === 'anchor'
    ? { kind: 'anchor', anchorItems: result.anchorItems, warnings: result.warnings }
    : result.output;
  recentGenerationHistory = recordGenerationResult(
    getGenerationHistoryStorage(),
    GENERATION_HISTORY_STORAGE_KEY,
    historyResult,
  );
  renderGenerationHistory();
}

async function generateMultiTasks(requestedTaskIds = null) {
  captureActiveMultiTaskView();
  const multiTaskState = normalizeMultiTaskSettings(settings.multiTaskSettings);
  const requestedIds = Array.isArray(requestedTaskIds) ? new Set(requestedTaskIds.map(textOf).filter(Boolean)) : null;
  const tasks = multiTaskState.tasks.filter((task) => !requestedIds || requestedIds.has(task.id));
  if (!tasks.length) {
    notifyStatus('请先在设置中添加任务。', 'warning');
    return [];
  }
  if (settings.rollbackBeforeGeneration) {
    await undoMultiTaskInjections(tasks.map((task) => task.id), { requireConfirmation: false, silent: true });
  }
  const context = getContext();
  const latest = getLatestAssistantMessage(context.chat);
  if (!latest) {
    notifyStatus('没有找到可用于生成的助手回复。', 'warning');
    return [];
  }
  const target = {
    chatId: getCurrentChatIdSafe(context),
    messageIndex: latest.index,
    messageText: String(latest.message.mes ?? ''),
  };
  const runtimeByTaskId = new Map();
  for (const task of tasks) {
    try {
      runtimeByTaskId.set(task.id, resolveMultiTaskRuntimeSettings(settings, task, getMultiTaskSchemeLists()));
    } catch (error) {
      replaceMultiTask(task.id, { status: MULTI_TASK_STATUS.ERROR, error: serializeMultiTaskError(error) });
    }
  }
  const runnableTasks = tasks.filter((task) => runtimeByTaskId.has(task.id));
  if (!runnableTasks.length) {
    renderMultiTaskRuntimeState();
    notifyStatus('任务缺少 API 方案或组件方案，请先在设置中选择。', 'warning');
    return [];
  }
  runnableTasks.forEach((task) => {
    multiTaskAbortControllers.get(task.id)?.abort();
  });
  const plan = createMultiTaskRunPlan({
    tasks: runnableTasks,
    concurrency: multiTaskState.concurrency,
    target,
    resolveTask: (task) => runtimeByTaskId.get(task.id),
  });
  activeMultiTaskRunIds.add(plan.runId);
  plan.entries.forEach((entry) => replaceMultiTask(entry.task.id, {
    runId: plan.runId,
    status: MULTI_TASK_STATUS.QUEUED,
    output: '',
    thinking: [],
    resultMode: entry.runtime.injectMode === 'anchor' ? 'anchor' : 'standard',
    anchorItems: [],
    warnings: [],
    target,
    error: null,
  }));
  scheduleMultiTaskFrameworkRender();
  const shouldAutoInject = Boolean(settings.autoInject);
  const autoInjectionPromises = [];
  const enqueueAutoInjection = (taskId) => {
    const currentTask = normalizeMultiTaskSettings(settings.multiTaskSettings).tasks.find((task) => task.id === taskId);
    if (!canEnqueueTaskAutoInjection(currentTask, plan.runId)) return Promise.resolve([]);
    replaceMultiTask(taskId, { status: MULTI_TASK_STATUS.PENDING_INJECTION });
    scheduleMultiTaskFrameworkRender();
    const promise = enqueueMultiTaskInjection(taskId, {
      intervalMs: multiTaskState.injectionIntervalSeconds * 1000,
      silent: true,
      expectedRunId: plan.runId,
    });
    autoInjectionPromises.push(promise);
    return promise;
  };
  const taskOrderInjectionCoordinator = shouldAutoInject
    && multiTaskState.injectionOrder === MULTI_TASK_INJECTION_ORDER_TASK
    ? createTaskOrderInjectionCoordinator(plan.entries.map((entry) => entry.task.id), {
      enqueue: enqueueAutoInjection,
    })
    : null;
  const results = await runMultiTaskQueue(plan, {
    isCurrent: (runId) => activeMultiTaskRunIds.has(runId),
    onTransition: ({ taskId, status, value, error }) => {
      const currentTask = normalizeMultiTaskSettings(settings.multiTaskSettings).tasks.find((task) => task.id === taskId);
      if (!currentTask || currentTask.runId !== plan.runId) {
        taskOrderInjectionCoordinator?.skip(taskId);
        return;
      }
      if (status === 'queued' || status === 'generating') {
        replaceMultiTask(taskId, { status: status === 'queued' ? MULTI_TASK_STATUS.QUEUED : MULTI_TASK_STATUS.GENERATING });
      } else if (status === 'ready') {
        replaceMultiTask(taskId, { ...value, status: MULTI_TASK_STATUS.READY });
        if (shouldAutoInject) {
          if (taskOrderInjectionCoordinator) taskOrderInjectionCoordinator.ready(taskId);
          else enqueueAutoInjection(taskId);
        }
      } else if (status === 'error') {
        replaceMultiTask(taskId, { status: MULTI_TASK_STATUS.ERROR, error: serializeMultiTaskError(error) });
        taskOrderInjectionCoordinator?.skip(taskId);
      } else if (status === 'cancelled') {
        replaceMultiTask(taskId, { status: currentTask.output ? MULTI_TASK_STATUS.READY : MULTI_TASK_STATUS.IDLE });
        taskOrderInjectionCoordinator?.skip(taskId);
      }
      scheduleMultiTaskFrameworkRender();
    },
    execute: async (entry) => {
      const currentTask = normalizeMultiTaskSettings(settings.multiTaskSettings).tasks.find((task) => task.id === entry.task.id);
      if (currentTask?.runId !== plan.runId) {
        const error = new Error('Task generation was cancelled');
        error.name = 'AbortError';
        throw error;
      }
      const controller = new AbortController();
      multiTaskAbortControllers.set(entry.task.id, controller);
      try {
        let rawText = '';
        try {
          rawText = await callExternalApi(latest.message, controller.signal, entry.runtime, {
            onPreview: (text) => updateMultiTaskStream(entry.task.id, text, plan.runId),
            onPromptLog: () => {},
          });
        } catch (error) {
          const partial = String(error?.streamedText ?? '');
          if (!partial.trim()) throw error;
          rawText = partial;
        }
        const result = normalizeMultiTaskGeneratedResult(rawText);
        recordMultiTaskHistory(result);
        return result;
      } finally {
        if (multiTaskAbortControllers.get(entry.task.id) === controller) multiTaskAbortControllers.delete(entry.task.id);
      }
    },
  });
  activeMultiTaskRunIds.delete(plan.runId);
  const completed = results.filter((item) => item.status === 'fulfilled').length;
  const failed = results.filter((item) => item.status === 'rejected').length;
  if (autoInjectionPromises.length) await Promise.allSettled(autoInjectionPromises);
  notifyStatus(`多任务生成结束：完成 ${completed} 个${failed ? `，失败 ${failed} 个` : ''}。`, failed ? 'warning' : 'info');
  return results;
}

function getRequestedMultiTasks(requestedTaskIds = null) {
  const state = normalizeMultiTaskSettings(settings.multiTaskSettings);
  const ids = Array.isArray(requestedTaskIds) ? new Set(requestedTaskIds.map(textOf).filter(Boolean)) : null;
  return state.tasks.filter((task) => !ids || ids.has(task.id));
}

async function persistMultiTaskMessageUpdates(context, messageIndexes) {
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

function enqueueMultiTaskInjection(taskId, { intervalMs = 0, silent = false, expectedRunId = '' } = {}) {
  return multiTaskInjectionQueue.enqueue({ taskId, silent, expectedRunId }, { intervalMs });
}

async function injectMultiTasks(requestedTaskIds = null) {
  captureActiveMultiTaskView();
  const tasks = getRequestedMultiTasks(requestedTaskIds)
    .filter((task) => [MULTI_TASK_STATUS.READY, MULTI_TASK_STATUS.UNDONE].includes(task.status))
    .filter((task) => String(task.output || '').trim() || task.anchorItems?.length);
  if (!tasks.length) {
    notifyStatus('没有可注入的多任务结果。', 'warning');
    return [];
  }
  const intervalMs = tasks.length > 1
    ? normalizeMultiTaskSettings(settings.multiTaskSettings).injectionIntervalSeconds * 1000
    : 0;
  tasks.forEach((task) => replaceMultiTask(task.id, { status: MULTI_TASK_STATUS.PENDING_INJECTION }));
  scheduleMultiTaskFrameworkRender();
  const results = await Promise.allSettled(tasks.map((task) => enqueueMultiTaskInjection(task.id, {
    intervalMs,
    silent: true,
  })));
  const injectedTaskIds = results
    .filter((result) => result.status === 'fulfilled')
    .flatMap((result) => result.value);
  if (injectedTaskIds.length) notifyStatus(`已按顺序分批注入 ${injectedTaskIds.length} 个结果。`);
  return injectedTaskIds;
}

async function injectMultiTaskBatchNow(requestedTaskIds = null, { silent = false, expectedRunId = '' } = {}) {
  const tasks = getRequestedMultiTasks(requestedTaskIds)
    .filter((task) => !expectedRunId || task.runId === expectedRunId)
    .filter((task) => ![MULTI_TASK_STATUS.QUEUED, MULTI_TASK_STATUS.GENERATING].includes(task.status))
    .filter((task) => String(task.output || '').trim() || task.anchorItems?.length);
  if (!tasks.length) {
    if (!silent) notifyStatus('没有可注入的多任务结果。', 'warning');
    return [];
  }
  const context = getContext();
  const currentChatId = getCurrentChatIdSafe(context);
  const changedIndexes = new Set();
  const mvuIndexes = new Set();
  const injectedTaskIds = [];
  for (const task of tasks) {
    const targetIndex = Number(task.target?.messageIndex);
    if (textOf(task.target?.chatId) !== currentChatId || !Number.isInteger(targetIndex)) {
      replaceMultiTask(task.id, { status: MULTI_TASK_STATUS.ERROR, error: { message: '任务目标聊天已经变化，无法注入。', code: 'target-changed' } });
      continue;
    }
    const latest = getAssistantMessageAtIndex(context.chat, targetIndex);
    if (!latest) {
      replaceMultiTask(task.id, { status: MULTI_TASK_STATUS.ERROR, error: { message: '任务目标楼层已经不存在。', code: 'target-missing' } });
      continue;
    }
    try {
      const prepared = {
        taskId: task.id,
        targetIndex,
        resultMode: task.resultMode,
        output: stripConfiguredBlocks(task.output, settings.outputCleanupTags).trim(),
        anchorItems: (Array.isArray(task.anchorItems) ? task.anchorItems : []).map((item) => ({
          ...item,
          content: stripConfiguredBlocks(item?.content, settings.outputCleanupTags).trim(),
        })),
      };
      const injected = applyMultiTaskInjection(String(latest.message.mes ?? ''), prepared);
      latest.message.mes = settings.statusPlaceholderEnabled
        ? normalizeStatusPlaceholder(injected.text, true)
        : injected.text;
      if (Array.isArray(latest.message.swipes) && Number.isInteger(latest.message.swipe_id)) {
        latest.message.swipes[latest.message.swipe_id] = latest.message.mes;
      }
      const record = {
        ...injected.record,
        chatId: currentChatId,
        targetIndex,
        afterText: latest.message.mes,
      };
      replaceMultiTask(task.id, { status: MULTI_TASK_STATUS.INJECTED, injectionRecord: record, error: null });
      changedIndexes.add(targetIndex);
      injectedTaskIds.push(task.id);
      const insertedText = record.operations.map((operation) => operation.text).join('\n');
      if (settings.mvuReprocessOnInject && containsMvuUpdateVariable(insertedText)) mvuIndexes.add(targetIndex);
    } catch (error) {
      replaceMultiTask(task.id, { status: MULTI_TASK_STATUS.ERROR, error: serializeMultiTaskError(error) });
    }
  }
  if (changedIndexes.size) {
    try {
      await persistMultiTaskMessageUpdates(context, [...changedIndexes]);
      for (const targetIndex of mvuIndexes) await reprocessMvuVariables(context, targetIndex);
    } catch (error) {
      notifyStatus(`多任务内容已经写入，但聊天保存失败：${error?.message || '未知错误'}`, 'warning');
    }
  }
  renderMultiTaskRuntimeState();
  if (!silent && injectedTaskIds.length) notifyStatus(`已注入 ${injectedTaskIds.length} 个结果。`);
  return injectedTaskIds;
}

async function undoMultiTaskInjections(requestedTaskIds = null, { requireConfirmation = false, silent = false } = {}) {
  const tasks = getRequestedMultiTasks(requestedTaskIds).filter((task) => task.injectionRecord);
  if (!tasks.length) {
    if (!silent) notifyStatus('没有可撤回的多任务注入记录。', 'warning');
    return [];
  }
  if (requireConfirmation && !targetWindow.confirm(`撤回 ${tasks.length} 个任务各自最新的一次注入？\n\n已经单独撤回的任务会自动跳过。`)) return [];
  const context = getContext();
  const currentChatId = getCurrentChatIdSafe(context);
  const changedIndexes = new Set();
  const undoneTaskIds = [];
  for (const task of [...tasks].reverse()) {
    const record = task.injectionRecord;
    const targetIndex = Number(record?.targetIndex);
    const latest = getAssistantMessageAtIndex(context.chat, targetIndex);
    if (textOf(record?.chatId) !== currentChatId || !latest) continue;
    const undone = undoMultiTaskInjection(String(latest.message.mes ?? ''), record);
    if (!undone.ok) {
      replaceMultiTask(task.id, { error: { message: '楼层中的对应注入内容已经变化，无法安全撤回。', code: undone.reason } });
      continue;
    }
    latest.message.mes = settings.statusPlaceholderEnabled
      ? normalizeStatusPlaceholder(undone.text, true)
      : undone.text;
    if (Array.isArray(latest.message.swipes) && Number.isInteger(latest.message.swipe_id)) {
      latest.message.swipes[latest.message.swipe_id] = latest.message.mes;
    }
    replaceMultiTask(task.id, { status: MULTI_TASK_STATUS.UNDONE, injectionRecord: null, error: null });
    changedIndexes.add(targetIndex);
    undoneTaskIds.push(task.id);
  }
  if (changedIndexes.size) {
    try {
      await persistMultiTaskMessageUpdates(context, [...changedIndexes]);
      if (settings.mvuReprocessOnInject) {
        for (const targetIndex of changedIndexes) await reprocessMvuVariables(context, targetIndex);
      }
    } catch (error) {
      notifyStatus(`撤回已经应用，但聊天保存失败：${error?.message || '未知错误'}`, 'warning');
    }
  }
  renderMultiTaskRuntimeState();
  if (!silent && undoneTaskIds.length) notifyStatus(`已撤回 ${undoneTaskIds.length} 个任务各自最新的一次注入。`);
  return undoneTaskIds;
}

function getNextMultiTaskName() {
  const names = new Set(normalizeMultiTaskSettings(settings.multiTaskSettings).tasks.map((task) => task.name));
  let index = 1;
  while (names.has(`任务 ${index}`)) index += 1;
  return `任务 ${index}`;
}

function getMultiTaskDefaultSchemeId(value) {
  const schemeId = textOf(value);
  return schemeId === WORLD_BOOK_FOLLOW_TAVERN ? '' : schemeId;
}

function getNewMultiTaskDefaults() {
  return {
    apiSchemeId: textOf(settings.selectedApiSchemeId),
    taskSchemeId: textOf(settings.selectedTaskSchemeId),
    presetSchemeId: getMultiTaskDefaultSchemeId(settings.selectedPresetSchemeId),
    worldbookSchemeId: getMultiTaskDefaultSchemeId(settings.selectedWorldbookSchemeId),
    componentSchemeId: textOf(settings.selectedComponentSchemeId),
    injectMode: settings.injectMode === 'anchor' ? 'anchor' : 'append',
  };
}

function captureGenerationWorkspaceView() {
  return {
    extraInstruction: String(targetDoc.getElementById('st-esg-temporary-task-instruction')?.value ?? temporaryTaskInstruction),
    output: String(targetDoc.getElementById('st-esg-preview')?.value ?? settings.lastGenerated ?? ''),
    thinking: Array.isArray(lastGeneratedThinking) ? [...lastGeneratedThinking] : [],
    error: settings.lastGenerationError && typeof settings.lastGenerationError === 'object'
      ? { ...settings.lastGenerationError }
      : null,
    resultMode: settings.lastGeneratedResultMode === 'anchor' ? 'anchor' : 'standard',
    anchorItems: Array.isArray(settings.lastGeneratedAnchorItems) ? settings.lastGeneratedAnchorItems.map((item) => ({ ...item })) : [],
    warnings: Array.isArray(settings.lastGeneratedAnchorWarnings) ? [...settings.lastGeneratedAnchorWarnings] : [],
    target: Number.isInteger(settings.lastGeneratedAnchorTargetIndex)
      ? { messageIndex: settings.lastGeneratedAnchorTargetIndex }
      : null,
  };
}

function applyGenerationWorkspaceView(view = {}) {
  temporaryTaskInstruction = String(view.extraInstruction ?? '');
  settings.lastGenerated = String(view.output ?? '');
  lastGeneratedThinking = Array.isArray(view.thinking) ? [...view.thinking] : [];
  settings.lastGeneratedThinking = [...lastGeneratedThinking];
  settings.lastGenerationError = view.error && typeof view.error === 'object' ? { ...view.error } : null;
  settings.lastGeneratedAnchorItems = Array.isArray(view.anchorItems) ? view.anchorItems.map((item) => ({ ...item })) : [];
  settings.lastGeneratedAnchorWarnings = Array.isArray(view.warnings) ? [...view.warnings] : [];
  settings.lastGeneratedResultMode = view.resultMode === 'anchor' ? 'anchor' : 'standard';
  settings.lastGeneratedAnchorTargetIndex = Number.isInteger(view.target?.messageIndex) ? view.target.messageIndex : null;
  const instruction = targetDoc.getElementById('st-esg-temporary-task-instruction');
  const preview = targetDoc.getElementById('st-esg-preview');
  if (instruction) instruction.value = temporaryTaskInstruction;
  if (preview) preview.value = settings.lastGeneratedResultMode === 'anchor' ? '' : settings.lastGenerated;
  renderGeneratedThinking();
  renderGenerationResultPanel();
}

function captureActiveMultiTaskView() {
  if (settings.generationMode !== 'multi') return;
  const task = getActiveMultiTask();
  if (!task) return;
  replaceMultiTask(task.id, mergeMultiTaskWorkspaceView(task, captureGenerationWorkspaceView()));
}

function hydrateActiveMultiTaskView() {
  const task = getActiveMultiTask();
  applyGenerationWorkspaceView(task || {});
}

function persistActiveMultiTaskSelection() {
  const store = getSettingsStore();
  const persisted = store.multiTaskSettings && typeof store.multiTaskSettings === 'object'
    ? store.multiTaskSettings
    : {};
  store.multiTaskSettings = {
    ...persisted,
    activeTaskId: normalizeMultiTaskSettings(settings.multiTaskSettings).activeTaskId,
  };
  getContext().saveSettingsDebounced();
}

function scheduleSettingsSave() {
  if (settingsSaveTimer !== null) targetWindow.clearTimeout(settingsSaveTimer);
  settingsSaveTimer = targetWindow.setTimeout(() => {
    settingsSaveTimer = null;
    saveSettings();
  }, 180);
}

function renderActiveMultiTaskViews() {
  const multiHost = getDialog()?.querySelector('#st-esg-multi-task-host');
  if (multiHost) multiHost.innerHTML = renderMultiTaskWorkspace(settings.multiTaskSettings);
  hydrateActiveMultiTaskView();
  if (settings.messageFloorPanelEnabled) syncMessageFloorPanelTaskSelection();
}

function selectActiveMultiTaskView(taskId) {
  const state = normalizeMultiTaskSettings(settings.multiTaskSettings);
  const nextTaskId = textOf(taskId);
  if (!nextTaskId || nextTaskId === state.activeTaskId || !state.tasks.some((task) => task.id === nextTaskId)) return;
  captureActiveMultiTaskView();
  settings.multiTaskSettings = selectMultiTask(settings.multiTaskSettings, nextTaskId);
  persistActiveMultiTaskSelection();
  renderActiveMultiTaskViews();
}

function updateMultiTaskActionState(dialog, multiState = normalizeMultiTaskSettings(settings.multiTaskSettings)) {
  const hasTasks = multiState.tasks.length > 0;
  const hasResult = multiState.tasks.some((task) => (
    [MULTI_TASK_STATUS.READY, MULTI_TASK_STATUS.UNDONE].includes(task.status)
    && (String(task.output || '').trim() || task.anchorItems?.length)
  ));
  const hasUndo = multiState.tasks.some((task) => task.injectionRecord);
  const running = multiState.tasks.some((task) => [MULTI_TASK_STATUS.QUEUED, MULTI_TASK_STATUS.GENERATING].includes(task.status));
  const generate = dialog?.querySelector('#st-esg-generate');
  generate?.toggleAttribute('disabled', !hasTasks);
  generate?.classList.toggle('disabled', !hasTasks);
  generate?.classList.toggle('st-esg-action-running', running);
  generate?.querySelector('i')?.setAttribute('class', running ? 'fa-solid fa-stop' : 'fa-solid fa-wand-magic-sparkles');
  generate?.querySelector('span')?.replaceChildren(running ? '停止全部' : '生成全部');
  const inject = dialog?.querySelector('#st-esg-inject');
  inject?.toggleAttribute('disabled', !hasResult || running);
  inject?.classList.toggle('disabled', !hasResult || running);
  const undo = dialog?.querySelector('#st-esg-undo-injection');
  undo?.toggleAttribute('disabled', !hasUndo);
  undo?.classList.toggle('disabled', !hasUndo);
  undo?.classList.toggle('st-esg-hidden', !hasUndo);
}

function renderMultiTaskRuntimeState() {
  if (settings.generationMode !== 'multi') return;
  const dialog = getDialog();
  const multiState = normalizeMultiTaskSettings(settings.multiTaskSettings);
  renderGenerationModeSwitchControl(dialog);
  const multiHost = dialog?.querySelector('#st-esg-multi-task-host');
  if (multiHost) multiHost.innerHTML = renderMultiTaskWorkspace(multiState);
  updateMultiTaskActionState(dialog, multiState);
  hydrateActiveMultiTaskView();
  if (settings.messageFloorPanelEnabled) syncMessageFloorPanelFromMultiTasks();
}

function isAnyGenerationRunning() {
  if (generationAbortController) return true;
  return normalizeMultiTaskSettings(settings.multiTaskSettings).tasks
    .some((task) => [MULTI_TASK_STATUS.QUEUED, MULTI_TASK_STATUS.GENERATING].includes(task.status));
}

function renderGenerationModeSwitchControl(dialog = getDialog()) {
  const modeHost = dialog?.querySelector('#st-esg-generation-mode-host');
  if (!modeHost) return;
  const mode = settings.generationMode === 'multi' ? 'multi' : 'single';
  modeHost.innerHTML = renderGenerationModeSwitch(mode, { switchingDisabled: isAnyGenerationRunning() });
}

function scheduleMultiTaskFrameworkRender() {
  if (multiTaskFrameworkRenderScheduled) return;
  multiTaskFrameworkRenderScheduled = true;
  const flush = () => {
    multiTaskFrameworkRenderScheduled = false;
    renderMultiTaskRuntimeState();
  };
  if (typeof targetWindow.requestAnimationFrame === 'function') targetWindow.requestAnimationFrame(flush);
  else targetWindow.setTimeout(flush, 0);
}

function renderMultiTaskFramework() {
  const dialog = getDialog();
  const mode = settings.generationMode === 'multi' ? 'multi' : 'single';
  dialog?.querySelector('#st-esg-generation-mode-host')?.replaceChildren();
  const running = isAnyGenerationRunning();
  const modeHost = dialog?.querySelector('#st-esg-generation-mode-host');
  if (modeHost) modeHost.innerHTML = renderGenerationModeSwitch(mode, { switchingDisabled: running });
  const multiHost = dialog?.querySelector('#st-esg-multi-task-host');
  multiHost?.classList.toggle('st-esg-hidden', mode !== 'multi');
  if (multiHost) multiHost.innerHTML = renderMultiTaskWorkspace(settings.multiTaskSettings);
  dialog?.querySelector('.st-esg-generation-settings')?.classList.add('st-esg-hidden');
  dialog?.querySelector('#st-esg-generate span')?.replaceChildren(mode === 'multi' ? '生成全部' : '生成组件');
  dialog?.querySelector('#st-esg-inject span')?.replaceChildren(mode === 'multi' ? '注入全部' : '注入回复');
  dialog?.querySelector('#st-esg-undo-injection span')?.replaceChildren(mode === 'multi' ? '撤回全部' : '撤回注入');
  if (mode === 'multi') {
    const multiState = normalizeMultiTaskSettings(settings.multiTaskSettings);
    updateMultiTaskActionState(dialog, multiState);
  } else {
    for (const selector of ['#st-esg-generate', '#st-esg-inject']) {
      const action = dialog?.querySelector(selector);
      action?.removeAttribute('disabled');
      action?.classList.remove('disabled', 'st-esg-action-running');
    }
    dialog?.querySelector('#st-esg-generate i')?.setAttribute('class', 'fa-solid fa-wand-magic-sparkles');
    refreshInjectionUndoState();
  }
  if (mode === 'multi') hydrateActiveMultiTaskView();
  else applyGenerationWorkspaceView(singleTaskWorkspaceSnapshot || {});
  if (settings.messageFloorPanelEnabled) {
    if (mode === 'multi') syncMessageFloorPanelFromMultiTasks();
    else if (messageFloorPanelState.mode === 'multi') {
      const expanded = messageFloorPanelState.expanded;
      messageFloorPanelState = {
        ...createFloorPanelState({ enabled: true }),
        expanded,
        target: getCurrentFloorPanelTarget(),
      };
      if (settings.lastGenerated || settings.lastGeneratedAnchorItems?.length) syncMessageFloorPanelResult();
      else renderMessageFloorPanel({ force: true });
    }
  }
}

function installMultiTaskFrameworkShell(dialog) {
  const workspace = dialog.querySelector('[data-tab-panel="workspace"]');
  if (!workspace || workspace.querySelector('#st-esg-generation-mode-host')) return;
  workspace.querySelector('.st-esg-generation-history-card')?.remove();
  const modeHost = targetDoc.createElement('div');
  modeHost.id = 'st-esg-generation-mode-host';
  const multiHost = targetDoc.createElement('div');
  multiHost.id = 'st-esg-multi-task-host';
  multiHost.className = 'st-esg-hidden';
  workspace.prepend(modeHost, multiHost);
  renderMultiTaskFramework();
}

function renderMultiTaskSchemeOptions(list, selectedId, emptyLabel = '未选择') {
  const options = [`<option value="">${escapeHtml(emptyLabel)}</option>`];
  for (const scheme of normalizeSchemeList(list)) {
    options.push(`<option value="${escapeHtml(scheme.id)}"${scheme.id === selectedId ? ' selected' : ''}>${escapeHtml(scheme.name)}</option>`);
  }
  return options.join('');
}

function showMultiTaskSettingsDialog(initialPage = 'general') {
  const state = normalizeMultiTaskSettings(settings.multiTaskSettings);
  const settingsCard = targetDoc.querySelector('.st-esg-generation-settings');
  const injectionSection = settingsCard?.querySelector('.st-esg-generation-injection-section');
  if (!settingsCard || !injectionSection) return;
  targetDoc.getElementById('st-esg-generation-mode-settings-dialog')?.remove();
  const settingsMarker = targetDoc.createComment('st-esg-generation-settings-home');
  const injectionMarker = targetDoc.createComment('st-esg-single-task-injection-home');
  injectionSection.before(injectionMarker);
  settingsCard.before(settingsMarker);
  const dialog = targetDoc.createElement('dialog');
  dialog.id = 'st-esg-generation-mode-settings-dialog';
  dialog.className = `st-esg-scheme-name-dialog st-esg-generation-mode-settings-dialog st-esg-multi-task-settings-dialog ${getThemeClassName(settings.theme)}`;
  const taskFields = state.tasks.map((item) => `<section class="st-esg-multi-task-settings-task" data-multi-task-settings-task-id="${escapeHtml(item.id)}">
    <header class="st-esg-multi-task-settings-task-head"><strong>${escapeHtml(item.name)}</strong><div><button class="menu_button menu_button_icon st-esg-secondary-action" type="button" data-multi-task-settings-action="rename" data-multi-task-task-id="${escapeHtml(item.id)}" aria-label="重命名 ${escapeHtml(item.name)}" title="改名"><i class="fa-solid fa-pen" aria-hidden="true"></i></button><button class="menu_button menu_button_icon st-esg-secondary-action st-esg-icon-danger" type="button" data-multi-task-settings-action="delete" data-multi-task-task-id="${escapeHtml(item.id)}" aria-label="删除 ${escapeHtml(item.name)}" title="删除"><i class="fa-solid fa-trash" aria-hidden="true"></i></button></div></header>
    <label class="st-esg-multi-task-compact-field"><span>预设方案</span><select class="text_pole" data-multi-task-task-field="presetSchemeId">${renderMultiTaskSchemeOptions(settings.presetSchemes, item.presetSchemeId, '酒馆默认')}</select></label>
    <label class="st-esg-multi-task-compact-field"><span>世界书方案</span><select class="text_pole" data-multi-task-task-field="worldbookSchemeId">${renderMultiTaskSchemeOptions(settings.worldbookSchemes, item.worldbookSchemeId, '酒馆默认')}</select></label>
    <label class="st-esg-multi-task-compact-field"><span>API 方案</span><select class="text_pole" data-multi-task-task-field="apiSchemeId">${renderMultiTaskSchemeOptions(settings.apiSchemes, item.apiSchemeId)}</select></label>
    <label class="st-esg-multi-task-compact-field"><span>组件方案</span><select class="text_pole" data-multi-task-task-field="componentSchemeId">${renderMultiTaskSchemeOptions(settings.componentSchemes, item.componentSchemeId)}</select></label>
    <label class="st-esg-multi-task-compact-field"><span>注入方式</span><select class="text_pole" data-multi-task-task-field="injectMode"><option value="append"${item.injectMode === 'append' ? ' selected' : ''}>追加</option><option value="anchor"${item.injectMode === 'anchor' ? ' selected' : ''}>锚点插入</option></select></label>
  </section>`).join('') || '<div class="st-esg-multi-task-settings-empty">还没有任务，请点击“添加任务”。</div>';
  const activePage = initialPage === 'tasks' ? 'tasks' : 'general';
  dialog.innerHTML = `<div class="st-esg-generation-mode-settings-shell"><header><div class="st-esg-card-title">生成设置</div><button class="menu_button menu_button_icon st-esg-secondary-action" type="button" data-generation-settings-close aria-label="关闭设置" title="关闭设置"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header>
    <div class="st-esg-generation-settings-pages" role="tablist" aria-label="生成设置分页"><button class="${activePage === 'general' ? 'active' : ''}" type="button" role="tab" aria-selected="${activePage === 'general'}" data-generation-settings-page="general">通用设置</button><button class="${activePage === 'tasks' ? 'active' : ''}" type="button" role="tab" aria-selected="${activePage === 'tasks'}" data-generation-settings-page="tasks">任务配置</button></div>
    <div class="st-esg-all-mode-settings-body">
      <section class="st-esg-generation-settings-panel${activePage === 'general' ? '' : ' st-esg-hidden'}" data-generation-settings-panel="general"><div data-generation-settings-card-host></div></section>
      <section class="st-esg-generation-settings-panel${activePage === 'tasks' ? '' : ' st-esg-hidden'}" data-generation-settings-panel="tasks">
        <section class="st-esg-multi-task-settings-section"><div class="st-esg-generation-settings-section-title"><strong>单任务</strong></div><div data-single-task-injection-host></div></section>
        <section class="st-esg-multi-task-settings-section"><div class="st-esg-multi-task-settings-heading"><strong>多任务</strong><button class="menu_button menu_button_icon st-esg-secondary-action" type="button" data-multi-task-settings-action="add"><i class="fa-solid fa-plus" aria-hidden="true"></i><span>添加任务 ${state.tasks.length}/5</span></button></div>
          <div class="st-esg-multi-task-runtime-settings"><div class="st-esg-multi-task-runtime-row"><label class="st-esg-multi-task-runtime-field"><span>并发任务数</span><select class="text_pole" name="concurrency">${[1, 2, 3, 4, 5].map((value) => `<option value="${value}"${state.concurrency === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label><label class="st-esg-multi-task-runtime-field"><span>注入间隔</span><input class="text_pole" type="number" name="injectionIntervalSeconds" min="0" max="10" step="0.5" value="${state.injectionIntervalSeconds}"></label><label class="st-esg-multi-task-runtime-field"><span>注入顺序</span><select class="text_pole" name="injectionOrder"><option value="completion"${state.injectionOrder === 'completion' ? ' selected' : ''}>完成顺序</option><option value="task"${state.injectionOrder === 'task' ? ' selected' : ''}>任务顺序</option></select></label></div><em class="st-esg-multi-task-runtime-help">超出并发数的任务会自动排队；自动注入可按完成顺序即时注入，或等待前项后按任务顺序注入；失败或停止的任务会自动跳过；注入间隔范围为 0–10 秒。</em></div>
          <div class="st-esg-multi-task-settings-list">${taskFields}</div>
        </section>
      </section>
    </div>
  </div>`;
  settingsCard.classList.remove('st-esg-hidden');
  settingsCard.open = true;
  dialog.querySelector('[data-generation-settings-card-host]').appendChild(settingsCard);
  dialog.querySelector('[data-single-task-injection-host]').appendChild(injectionSection);
  const finish = () => {
    if (dialog.open) dialog.close();
    injectionMarker.replaceWith(injectionSection);
    settingsMarker.replaceWith(settingsCard);
    settingsCard.classList.add('st-esg-hidden');
    dialog.remove();
  };
  dialog.querySelectorAll('[data-generation-settings-close]').forEach((button) => button.addEventListener('click', finish));
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(); });
  dialog.querySelectorAll('[data-generation-settings-page]').forEach((button) => button.addEventListener('click', () => {
    const nextPage = String(button.getAttribute('data-generation-settings-page'));
    dialog.querySelectorAll('[data-generation-settings-page]').forEach((item) => {
      const isActive = item === button;
      item.classList.toggle('active', isActive);
      item.setAttribute('aria-selected', String(isActive));
    });
    dialog.querySelectorAll('[data-generation-settings-panel]').forEach((panel) => {
      panel.classList.toggle('st-esg-hidden', panel.getAttribute('data-generation-settings-panel') !== nextPage);
    });
  }));
  dialog.querySelectorAll('[data-multi-task-settings-action]').forEach((button) => button.addEventListener('click', () => {
    const action = String(button.getAttribute('data-multi-task-settings-action'));
    const taskId = String(button.getAttribute('data-multi-task-task-id') || '');
    if (action === 'add' && state.tasks.length >= 5) {
      notifyStatus('最多只能添加五个任务。', 'warning');
      return;
    }
    finish();
    void handleMultiTaskAction(action, true, taskId);
  }));
  dialog.querySelectorAll('[data-multi-task-task-field]').forEach((control) => control.addEventListener('change', () => {
    const taskPanel = control.closest('[data-multi-task-settings-task-id]');
    const taskId = String(taskPanel?.getAttribute('data-multi-task-settings-task-id') || '');
    const field = String(control.getAttribute('data-multi-task-task-field') || '');
    if (!taskId || !['componentSchemeId', 'apiSchemeId', 'presetSchemeId', 'worldbookSchemeId', 'injectMode'].includes(field)) return;
    const rawValue = textOf(control.value);
    const value = field === 'injectMode' ? (rawValue === 'anchor' ? 'anchor' : 'append') : rawValue;
    replaceMultiTask(taskId, { [field]: value });
    saveSettings();
  }));
  dialog.querySelector('[name="concurrency"]')?.addEventListener('change', (event) => {
    settings.multiTaskSettings = normalizeMultiTaskSettings({
      ...settings.multiTaskSettings,
      concurrency: event.currentTarget.value,
    });
    saveSettings();
  });
  dialog.querySelector('[name="injectionIntervalSeconds"]')?.addEventListener('change', (event) => {
    settings.multiTaskSettings = normalizeMultiTaskSettings({
      ...settings.multiTaskSettings,
      injectionIntervalSeconds: event.currentTarget.value,
    });
    event.currentTarget.value = String(settings.multiTaskSettings.injectionIntervalSeconds);
    saveSettings();
  });
  dialog.querySelector('[name="injectionOrder"]')?.addEventListener('change', (event) => {
    settings.multiTaskSettings = normalizeMultiTaskSettings({ ...settings.multiTaskSettings, injectionOrder: event.currentTarget.value });
    saveSettings();
  });
  targetDoc.body.appendChild(dialog);
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function showGenerationModeSettingsDialog() {
  showMultiTaskSettingsDialog();
}

async function handleMultiTaskAction(action, reopenSettings = false, requestedTaskId = '') {
  const multiTaskState = normalizeMultiTaskSettings(settings.multiTaskSettings);
  const activeTask = multiTaskState.tasks.find((task) => task.id === requestedTaskId) || getActiveMultiTask();
  if (action === 'add') {
    if (multiTaskState.tasks.length >= 5) {
      notifyStatus('最多只能添加五个任务。', 'warning');
      if (reopenSettings) showMultiTaskSettingsDialog('tasks');
      return;
    }
    const name = await requestTextInputDialog({ title: '添加任务', label: '任务名称', placeholder: '输入便于识别的任务名称', value: getNextMultiTaskName() });
    if (!name) { if (reopenSettings) showMultiTaskSettingsDialog('tasks'); return; }
    const result = createMultiTask(settings.multiTaskSettings, name, getNewMultiTaskDefaults());
    if (result.error) {
      notifyStatus(result.error === 'duplicate-name' ? '任务名称不能重复。' : '最多只能添加五个任务。', 'warning');
      if (reopenSettings) showMultiTaskSettingsDialog('tasks');
      return;
    }
    settings.multiTaskSettings = result.state;
    saveSettings();
    renderMultiTaskFramework();
    showMultiTaskSettingsDialog('tasks');
    return;
  }
  if (action === 'global-settings') { showMultiTaskSettingsDialog('tasks'); return; }
  if (!activeTask) return;
  if (action === 'settings') { showMultiTaskSettingsDialog('tasks'); return; }
  if (action === 'generate') {
    if ([MULTI_TASK_STATUS.QUEUED, MULTI_TASK_STATUS.GENERATING].includes(activeTask.status)) {
      cancelMultiTaskGeneration([activeTask.id]);
    } else await generateMultiTasks([activeTask.id]);
    return;
  }
  if (action === 'inject') { await injectMultiTasks([activeTask.id]); return; }
  if (action === 'undo') { await undoMultiTaskInjections([activeTask.id], { requireConfirmation: true }); return; }
  if (action === 'rename') {
    const name = await requestTextInputDialog({ title: '重命名任务', label: '任务名称', value: activeTask.name });
    if (!name || name === activeTask.name) { if (reopenSettings) showMultiTaskSettingsDialog('tasks'); return; }
    const result = renameMultiTask(settings.multiTaskSettings, activeTask.id, name);
    if (result.error) { notifyStatus('任务名称不能为空或与其他任务重复。', 'warning'); if (reopenSettings) showMultiTaskSettingsDialog('tasks'); return; }
    settings.multiTaskSettings = result.state;
    saveSettings();
    renderMultiTaskFramework();
    if (reopenSettings) showMultiTaskSettingsDialog('tasks');
    return;
  }
  if (action === 'delete') {
    if (!targetWindow.confirm(`删除任务“${activeTask.name}”？\n\n当前框架中的任务配置和未接入的临时结果会一并删除。`)) { if (reopenSettings) showMultiTaskSettingsDialog('tasks'); return; }
    cancelMultiTaskGeneration([activeTask.id]);
    settings.multiTaskSettings = deleteMultiTask(settings.multiTaskSettings, activeTask.id).state;
    saveSettings();
    renderMultiTaskFramework();
    if (reopenSettings) showMultiTaskSettingsDialog('tasks');
  }
}

function bindMultiTaskFrameworkEvents() {
  const workspace = $t('[data-tab-panel="workspace"]');
  workspace.off('.stEsgMultiTask')
    .on('click.stEsgMultiTask', '[data-generation-mode]', function () {
      const nextMode = String($(this).attr('data-generation-mode')) === 'multi' ? 'multi' : 'single';
      if (nextMode === settings.generationMode) return;
      if (isAnyGenerationRunning()) {
        notifyStatus('生成进行中，暂时不能切换任务模式。', 'warning');
        return;
      }
      if (settings.generationMode === 'multi') captureActiveMultiTaskView();
      else singleTaskWorkspaceSnapshot = captureGenerationWorkspaceView();
      settings.generationMode = nextMode;
      saveSettings();
      renderMultiTaskFramework();
    })
    .on('click.stEsgMultiTask', '[data-generation-mode-settings]', function () {
      showGenerationModeSettingsDialog();
    })
    .on('click.stEsgMultiTask', '[data-generation-history-open]', function () {
      showGenerationHistoryDialog();
    })
    .on('click.stEsgMultiTask', '[data-multi-task-id]', function () {
      selectActiveMultiTaskView(String($(this).attr('data-multi-task-id')));
    })
    .on('click.stEsgMultiTask', '[data-multi-task-action]', function () {
      void handleMultiTaskAction(String($(this).attr('data-multi-task-action')));
    });
}

function renderPluginPanel() {
  if (targetDoc.getElementById('st-esg-dialog')) return;
  const dialog = targetDoc.createElement('dialog');
  dialog.id = 'st-esg-dialog';
  dialog.className = 'st-esg-dialog';
  dialog.tabIndex = -1;
  dialog.innerHTML = buildPluginPanelMarkup();
  const componentPanel = dialog.querySelector('[data-tab-panel="components"]');
  const componentSchemeCard = targetDoc.createElement('div');
  componentSchemeCard.className = 'st-esg-card st-esg-component-scheme-card';
  componentSchemeCard.innerHTML = `${renderSchemeManager('component')}<div class="st-esg-card-desc">保存组件库、小剧场库的启用状态与随机设置；组件内容仍使用当前库中的最新版本。</div>`;
  componentPanel?.prepend(componentSchemeCard);
  installMultiTaskFrameworkShell(dialog);
  upgradePanelActionToButton(dialog, '#st-esg-generate');
  upgradePanelActionToButton(dialog, '#st-esg-inject');
  dialog.querySelector('#st-esg-generate span')?.replaceChildren('生成组件');
  dialog.querySelector('#st-esg-inject span')?.replaceChildren('注入回复');
  const titleIcon = dialog.querySelector('.st-esg-title-icon');
  if (titleIcon) titleIcon.innerHTML = renderBrandMark('title');
  dialog.querySelector('.st-esg-kicker')?.replaceChildren(BRAND_SUBTITLE);
  const titleText = dialog.querySelector('.st-esg-title-text');
  const titleCopy = titleText?.parentElement;
  titleText?.replaceChildren(BRAND_NAME);
  titleCopy?.prepend(titleText);
  dialog.querySelector('.st-esg-tabs')?.setAttribute('aria-label', `${BRAND_NAME}分页`);
  dialog.querySelector('.st-esg-title-text')?.insertAdjacentHTML('beforeend', ` <span class="st-esg-version-badge">v${EXTENSION_VERSION}</span>`);
  dialog.querySelector('#st-esg-inject')?.insertAdjacentHTML('afterend', '<div id="st-esg-undo-injection" class="menu_button menu_button_icon st-esg-secondary-action st-esg-hidden" title="撤回本次注入"><i class="fa-solid fa-rotate-left"></i><span>撤回注入</span></div>');
  dialog.querySelector('#st-esg-status')?.remove();
  dialog.querySelector('[data-tab="debug"] span')?.replaceChildren('调试信息');
  dialog.querySelector('[data-tab-panel="debug"] .st-esg-card-title')?.replaceChildren('提示词查看器');
  dialog.querySelector('[data-tab-panel="preset"] .st-esg-import-tools')?.replaceWith(...$(renderSourceModeControl('preset')).toArray());
  dialog.querySelector('[data-tab-panel="worldbook"] .st-esg-import-tools')?.replaceWith(...$(renderSourceModeControl('worldbook')).toArray());
  dialog.querySelector('.st-esg-scheme-group[data-scheme-type="worldbook"]')?.insertAdjacentHTML('afterend', '<div class="st-esg-actions-row st-esg-chat-worldbook-actions"><button id="st-esg-bind-worldbook-chat" class="menu_button menu_button_icon st-esg-secondary-action" type="button"><i class="fa-solid fa-link"></i><span>应用到当前聊天</span></button></div>');
  const presetPlacement = dialog.querySelector('#st-esg-preset-placement-slot');
  if (presetPlacement) {
    const extraOptions = targetDoc.createElement('details');
    extraOptions.id = 'st-esg-preset-placement-slot';
    extraOptions.className = 'st-esg-preset-extra-options';
    extraOptions.innerHTML = `<summary>额外选项</summary><div class="st-esg-preset-extra-options-body">${presetPlacement.innerHTML}</div>`;
    presetPlacement.replaceWith(extraOptions);
  }
  const presetSourceSelect = dialog.querySelector('#st-esg-source-preset');
  presetSourceSelect?.closest('.st-esg-grid')?.insertAdjacentHTML('afterend', '<div class="st-esg-actions-row st-esg-preset-export-actions"><button id="st-esg-export-current-preset" class="menu_button menu_button_icon st-esg-secondary-action" type="button"><i class="fa-solid fa-file-export"></i><span>导出当前预设</span></button></div>');
  const debugPanel = dialog.querySelector('[data-tab-panel="debug"]');
  debugPanel?.insertAdjacentHTML('afterbegin', '<div class="st-esg-card st-esg-generation-log-card"><div class="st-esg-card-head"><div><div class="st-esg-card-title">本次生成日志</div><div class="st-esg-card-desc">每次开始生成时清空，只保留本次生成流程。</div></div></div><pre id="st-esg-generation-log" class="st-esg-generation-log">尚未开始生成</pre></div>');
  const apiFields = dialog.querySelector('#st-esg-api-url')?.closest('.st-esg-grid');
  const apiUrlLabel = dialog.querySelector('#st-esg-api-url')?.closest('label');
  const apiKeyLabel = dialog.querySelector('#st-esg-api-key')?.closest('label');
  const apiModelLabel = dialog.querySelector('#st-esg-api-model')?.closest('label');
  const apiTemperatureLabel = dialog.querySelector('#st-esg-temperature')?.closest('label');
  const apiMaxTokensLabel = dialog.querySelector('#st-esg-max-tokens')?.closest('label');
  apiFields?.classList.add('st-esg-api-fields');
  apiUrlLabel?.classList.add('st-esg-api-custom-fields');
  apiKeyLabel?.classList.add('st-esg-api-custom-fields');
  apiModelLabel?.classList.add('st-esg-api-custom-fields');
  dialog.querySelector('#st-esg-fetch-models')?.classList.add('st-esg-api-custom-fields');
  dialog.querySelector('#st-esg-additional-parameters')?.classList.add('st-esg-api-custom-fields');
  const apiBody = dialog.querySelector('#st-esg-api-url')?.closest('.st-esg-collapsible-body');
  apiBody?.insertAdjacentHTML('afterbegin', `${renderSchemeManager('api')}<div class="st-esg-api-tabs"><button type="button" class="st-esg-api-tab" data-api-mode="custom">自定义</button><button type="button" class="st-esg-api-tab" data-api-mode="tavern">酒馆预设</button></div><div id="st-esg-api-tavern-panel" class="st-esg-api-mode-panel"><label>酒馆预设<select id="st-esg-tavern-profile" class="text_pole"></select></label><div class="st-esg-actions-row"><div id="st-esg-refresh-tavern-profiles" class="menu_button menu_button_icon st-esg-secondary-action"><i class="fa-solid fa-rotate"></i><span>刷新预设</span></div></div></div>`);
  apiBody?.querySelector('.st-esg-scheme-group[data-scheme-type="api"]')?.insertAdjacentHTML('beforebegin', renderApiRetrySettings());
  const apiSchemeManagers = apiBody?.querySelectorAll('.st-esg-scheme-group[data-scheme-type="api"]') || [];
  if (apiSchemeManagers.length > 1) apiSchemeManagers[apiSchemeManagers.length - 1].remove();
  if (apiKeyLabel && apiModelLabel) apiFields?.insertBefore(apiKeyLabel, apiModelLabel);
  if (apiTemperatureLabel && apiMaxTokensLabel) apiFields?.insertBefore(apiTemperatureLabel, apiMaxTokensLabel);
  const temperatureInput = dialog.querySelector('#st-esg-temperature');
  temperatureInput?.removeAttribute('max');
  temperatureInput?.setAttribute('step', 'any');
  const fetchModelsButton = dialog.querySelector('#st-esg-fetch-models');
  fetchModelsButton?.insertAdjacentHTML('afterend', '<div id="st-esg-additional-parameters" class="menu_button menu_button_icon st-esg-secondary-action"><i class="fa-solid fa-sliders"></i><span>附加参数</span></div>');
  dialog.querySelector('#st-esg-additional-parameters')?.classList.add('st-esg-api-custom-fields');
  const apiModel = dialog.querySelector('#st-esg-api-model');
  apiModel?.insertAdjacentHTML('afterend', '<select id="st-esg-api-model-picker" class="text_pole st-esg-api-model-picker st-esg-api-custom-fields" style="display:none;"></select><div id="st-esg-api-model-feedback" class="st-esg-model-feedback st-esg-api-custom-fields"></div>');
  const taskInput = dialog.querySelector('#st-esg-task');
  taskInput?.insertAdjacentHTML('afterend', '<div class="st-esg-task-components-help"><code>{{external_components}}</code> 会在生成时替换为当前启用的组件；不写则不会发送组件。</div>');
  const taskPanel = dialog.querySelector('[data-tab-panel="task"]');
  if (taskPanel) {
    const outputProtocolDetails = targetDoc.createElement('details');
    outputProtocolDetails.className = 'st-esg-card st-esg-collapsible st-esg-output-protocol-details';
    outputProtocolDetails.innerHTML = `
      <summary class="st-esg-collapsible-summary">尾部格式约束</summary>
      <div class="st-esg-collapsible-body">
        <div class="st-esg-card-desc st-esg-output-protocol-help">按所选身份原样作为提示词最后一条消息发送；留空则不插入。普通与锚点模式分别保存，不随任务方案保存。</div>
      <div class="st-esg-output-protocol-toolbar">
        <div id="st-esg-output-protocol-mode" class="st-esg-output-protocol-mode" role="group" aria-label="输出协议模式">
          <button type="button" class="st-esg-output-protocol-mode-button" data-output-protocol-mode="standard">普通模式</button>
          <button type="button" class="st-esg-output-protocol-mode-button" data-output-protocol-mode="anchor">锚点模式</button>
        </div>
        <label class="st-esg-output-protocol-role-label">消息角色
          <select id="st-esg-output-protocol-role" class="text_pole">
            <option value="system">system</option>
            <option value="user">user</option>
            <option value="assistant">assistant</option>
          </select>
        </label>
      </div>
      <textarea id="st-esg-output-protocol-text" class="text_pole textarea_compact st-esg-textarea" rows="12" spellcheck="false"></textarea>
      <div class="st-esg-actions-row">
        <button id="st-esg-reset-output-protocol" class="menu_button menu_button_icon st-esg-secondary-action" type="button"><i class="fa-solid fa-rotate-left"></i><span>恢复当前内置协议</span></button>
      </div>
      </div>`;
    taskPanel.appendChild(outputProtocolDetails);
  }
  const tagTextarea = dialog.querySelector('#st-esg-history-cleanup-tags');
  const tagCard = tagTextarea?.closest('.st-esg-card');
  const tagGrid = tagCard?.querySelector('.st-esg-grid');
  if (tagCard) {
    const historyRangeCard = targetDoc.createElement('details');
    historyRangeCard.className = 'st-esg-card st-esg-collapsible st-esg-history-range-card';
    historyRangeCard.innerHTML = '<summary class="st-esg-collapsible-summary">聊天记录范围</summary><div class="st-esg-collapsible-body"><div class="st-esg-history-range-options"><label class="st-esg-radio-row"><input id="st-esg-history-range-mode-visible" name="st-esg-history-range-mode" type="radio" value="visible" /><span>读取未隐藏消息</span><em>发送所有未被酒馆隐藏的聊天消息。</em></label><label class="st-esg-radio-row"><input id="st-esg-history-range-mode-recent" name="st-esg-history-range-mode" type="radio" value="recent" /><span>仅保留最近消息</span><em class="st-esg-history-range-recent-input"><span>最近</span><input id="st-esg-recent-message-count" class="text_pole" type="number" min="1" step="1" value="10" /><span>条</span><span class="st-esg-history-range-recent-note">隐藏消息也会计入。</span></em></label></div></div>';
    tagCard.parentNode?.insertBefore(historyRangeCard, tagCard);
  }
  if (tagCard && tagGrid) {
    const tagDetails = targetDoc.createElement('details');
    tagDetails.className = 'st-esg-card st-esg-collapsible st-esg-tag-cleanup-settings';
    tagDetails.innerHTML = `<summary class="st-esg-collapsible-summary">标签清理</summary><div class="st-esg-collapsible-body"><div class="st-esg-tag-cleanup-transfer"><span>规则文件</span><span class="st-esg-tag-cleanup-transfer-actions"><button id="st-esg-tag-cleanup-import-trigger" class="menu_button menu_button_icon st-esg-secondary-action" type="button"><i class="fa-solid fa-file-import"></i><span>导入</span></button><button id="st-esg-tag-cleanup-export" class="menu_button menu_button_icon st-esg-secondary-action" type="button"><i class="fa-solid fa-file-export"></i><span>导出</span></button></span></div><input id="st-esg-tag-cleanup-import-file" class="st-esg-hidden" type="file" accept="application/json,.json" />${tagGrid.outerHTML}</div>`;
    tagCard.replaceWith(tagDetails);
  }
  ['history', 'output'].forEach((type) => {
    const textarea = dialog.querySelector(`#st-esg-${type === 'history' ? 'history-cleanup-tags' : 'output-cleanup-tags'}`);
    textarea?.closest('label')?.replaceWith(...$(buildTagRuleManager(type)).toArray());
  });
  const runtimePanel = dialog.querySelector('[data-tab-panel="runtime"]');
  runtimePanel?.insertAdjacentHTML('afterbegin', '<div class="st-esg-card st-esg-data-entry-card"><div><strong>数据管理</strong><span>查看插件占用，清空整类数据，或处理隐藏归属记录。</span></div><button id="st-esg-open-data-management" class="menu_button menu_button_icon st-esg-secondary-action" type="button"><i class="fa-solid fa-database"></i><span>打开数据管理</span></button></div>');
  if (runtimePanel) {
    const shortcutDetails = targetDoc.createElement('details');
    shortcutDetails.className = 'st-esg-card st-esg-collapsible st-esg-shortcut-settings';
    shortcutDetails.innerHTML = '<summary class="st-esg-collapsible-summary">界面与快捷入口</summary><div class="st-esg-collapsible-body"><label class="st-esg-checkbox"><input id="st-esg-ball-visible" type="checkbox" /><span>悬浮球</span></label><div class="st-esg-ball-controls"><label class="st-esg-range-control"><span>大小 <output id="st-esg-ball-size-value">38px</output></span><input id="st-esg-ball-size" type="range" min="28" max="72" step="1" /></label><label class="st-esg-range-control"><span>透明度 <output id="st-esg-ball-opacity-value">82%</output></span><input id="st-esg-ball-opacity" type="range" min="20" max="100" step="1" /></label><label class="st-esg-checkbox st-esg-ball-animation-toggle"><input id="st-esg-ball-animation-enabled" type="checkbox" /><span>状态动画</span></label><label class="st-esg-checkbox"><input id="st-esg-ball-snap-enabled" type="checkbox" /><span>贴边吸附</span></label></div><label class="st-esg-checkbox"><input id="st-esg-qr-generate-enabled" type="checkbox" /><span>QR 栏显示“点击生成”</span></label><label class="st-esg-checkbox"><input id="st-esg-qr-inject-enabled" type="checkbox" /><span>QR 栏显示“点击注入”</span></label><label class="st-esg-checkbox st-esg-floor-panel-setting"><input id="st-esg-message-floor-panel-enabled" type="checkbox" /><span>最新楼层面板</span></label></div>';
    runtimePanel.appendChild(shortcutDetails);
  }
  if (runtimePanel) {
    const baiBaiDetails = runtimePanel.querySelector('#st-esg-baibai-history-enabled')?.closest('details');
    const promptSettings = targetDoc.createElement('details');
    promptSettings.className = 'st-esg-card st-esg-collapsible st-esg-prompt-settings';
    promptSettings.innerHTML = '<summary class="st-esg-collapsible-summary">提示词设置</summary><div class="st-esg-collapsible-body"></div>';
    const promptBody = promptSettings.querySelector('.st-esg-collapsible-body');
    const baiBaiBody = baiBaiDetails?.querySelector('.st-esg-collapsible-body');
    const baiBaiSection = targetDoc.createElement('div');
    baiBaiSection.className = 'st-esg-prompt-settings-section';
    baiBaiSection.innerHTML = '<div class="st-esg-prompt-settings-section-title">柏宝书记忆插件兼容</div>';
    while (baiBaiBody?.firstElementChild) baiBaiSection.appendChild(baiBaiBody.firstElementChild);
    promptBody.appendChild(baiBaiSection);
    const templateLabel = targetDoc.createElement('label');
    templateLabel.className = 'st-esg-checkbox st-esg-log-option';
    templateLabel.innerHTML = '<input id="st-esg-prompt-template-compat" type="checkbox" /><span>启用 ST-Prompt-Template 兼容</span><em>生成时支持 EJS 和变量读取；需要 ST-Prompt-Template 已加载。关闭时保持现有生成行为。</em>';
    const templateSection = targetDoc.createElement('div');
    templateSection.className = 'st-esg-prompt-settings-section';
    templateSection.innerHTML = '<div class="st-esg-prompt-settings-section-title">提示词模板语法兼容</div>';
    templateSection.appendChild(templateLabel);
    promptBody.appendChild(templateSection);
    if (baiBaiDetails) baiBaiDetails.replaceWith(promptSettings);
    else runtimePanel.appendChild(promptSettings);

    const legacyMemorySection = promptSettings.querySelector('.st-esg-prompt-settings-section');
    const memorySettings = targetDoc.createElement('details');
    memorySettings.className = 'st-esg-card st-esg-collapsible st-esg-memory-settings';
    memorySettings.innerHTML = '<summary class="st-esg-collapsible-summary">记忆设置</summary><div class="st-esg-collapsible-body st-esg-memory-source-groups"><section class="st-esg-memory-source-group"><div class="st-esg-memory-source-heading">柏宝书</div><div id="st-esg-baibai-memory-options" class="st-esg-memory-source-panel"></div></section><section class="st-esg-memory-source-group"><div class="st-esg-memory-source-heading">Anima</div><div id="st-esg-anima-memory-options" class="st-esg-memory-source-panel"><div class="st-esg-card-desc">使用 Anima 记忆前，请先在插件当前的世界书方案中启用 Anima 聊天世界书。</div><label class="st-esg-checkbox st-esg-log-option"><input id="st-esg-anima-worldbook-enabled" type="checkbox" /><span>读取 Anima 世界书</span><em>只在勾选时抓取 Anima 最新召回切片并覆盖快照。</em></label><label class="st-esg-checkbox st-esg-log-option"><input id="st-esg-anima-status-enabled" type="checkbox" /><span>读取 Anima 状态变量</span><em>实时读取最近可用的 anima_data；当前楼层没有时会向前回溯。</em></label></div></section></div>';
    const animaStatusLabel = memorySettings.querySelector('#st-esg-anima-status-enabled')?.closest('label');
    if (animaStatusLabel && !memorySettings.querySelector('#st-esg-anima-status-after-message-option')) {
      const afterMessageLabel = targetDoc.createElement('label');
      afterMessageLabel.id = 'st-esg-anima-status-after-message-option';
      // 最新楼层的状态变量尚未更新时出现顺序错误
      afterMessageLabel.className = 'st-esg-checkbox st-esg-log-option';
      afterMessageLabel.innerHTML = '<input id="st-esg-anima-status-after-message-enabled" type="checkbox" /><span>\u72b6\u6001\u53d8\u91cf\u63d2\u5165\u5bf9\u5e94\u697c\u5c42\u540e\u9762</span><em>\u5f00\u542f\u540e\uff0c\u5c06 Anima \u72b6\u6001\u53d8\u91cf\u63d2\u5165\u5b83\u6240\u5c5e\u7684 assistant \u697c\u5c42\u540e\uff0c\u907f\u514d\u6700\u65b0\u697c\u5c42\u7684\u72b6\u6001\u53d8\u91cf\u5c1a\u672a\u66f4\u65b0\u65f6\u51fa\u73b0\u987a\u5e8f\u9519\u8bef\u3002</em>';
      animaStatusLabel.insertAdjacentElement('afterend', afterMessageLabel);
    }
    const baibaiOptions = memorySettings.querySelector('#st-esg-baibai-memory-options');
    legacyMemorySection?.querySelectorAll('label').forEach((label) => baibaiOptions.appendChild(label));
    legacyMemorySection?.remove();
    promptSettings.querySelector('summary').textContent = '提示词语法';
    promptSettings.querySelector('.st-esg-prompt-settings-section-title').textContent = '提示词语法';
    runtimePanel.insertBefore(memorySettings, promptSettings);
  }
  ['task', 'preset', 'worldbook'].forEach((tab) => {
    const scheme = dialog.querySelector(`[data-tab-panel="${tab}"] > .st-esg-card > .st-esg-scheme-group`);
    const title = scheme?.parentElement?.querySelector('.st-esg-card-head');
    title?.insertAdjacentElement('afterend', scheme);
  });
  dialog.querySelector('#st-esg-close')?.insertAdjacentHTML('beforebegin', '<div id="st-esg-theme-toggle" class="st-esg-header-btn" role="button" tabindex="0" title="切换主题"><span class="st-esg-theme-glyph" aria-hidden="true"><i class="fa-solid fa-moon"></i></span></div>');
  targetDoc.body.appendChild(dialog);
  renderMultiTaskFramework();
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); togglePanel(false); });
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.target.closest?.('dialog') !== dialog) return;
    event.preventDefault();
    togglePanel(false);
  });
  dialog.addEventListener('close', () => {
    resetComponentEditMode();
    resetComponentLibraryFilters();
    targetDoc.getElementById('st-esg-ball')?.classList.remove('st-esg-ball-under-panel');
  });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) togglePanel(false); });
  bindPanelEvents();
  bindMultiTaskFrameworkEvents();
}

function collapseManualComponentCard() {
  const card = $t('#st-esg-add-component').closest('.st-esg-card');
  if (!card.length || card.parent().is('details')) return;
  const head = card.children('.st-esg-card-head').detach();
  const body = card.contents().detach();
  const details = $('<details class="st-esg-card st-esg-collapsible st-esg-manual-component-card"></details>');
  details.append('<summary class="st-esg-collapsible-summary">手动添加组件</summary>');
  const collapsibleBody = $('<div class="st-esg-collapsible-body"></div>');
  collapsibleBody.append(head).append(body);
  details.append(collapsibleBody);
  card.replaceWith(details);
}

function refreshHelpText() {
  const descriptions = [
    ['[data-tab-panel="task"] > .st-esg-card:not(.st-esg-output-protocol-details) .st-esg-card-desc', '编辑发送给模型的任务指令；组件占位符会在发送前替换为当前启用的组件内容。'],
    ['[data-tab-panel="preset"] > .st-esg-card:nth-child(2) .st-esg-card-desc', '选择要查看和编辑的预设；提示词编辑中的启用状态与内容会保存到当前方案。'],
    ['[data-tab-panel="worldbook"] > .st-esg-card:nth-child(2) .st-esg-card-desc', '选择方案后查看当前世界书状态；提示词编辑中可调整条目启用状态、内容和蓝绿灯。'],
    ['[data-tab-panel="debug"] .st-esg-card-desc', '查看本次生成流程、注入结果，以及发送给外置 API 的完整消息。'],
    ['.st-esg-manual-component-card .st-esg-card-desc', '添加一个全局、预设方案或当前角色专属的组件。'],
  ];
  descriptions.forEach(([selector, text]) => $t(selector).text(text));
  const optionDescriptions = [
    ['#st-esg-task-placement-enabled', '开启后可选择插入到某条预设条目之后；关闭时追加到预设末尾。'],
    ['#st-esg-replace-last-user-message', '开启后，预设中的 {{LastUserMessage}} 会替换为当前任务指令。'],
    ['#st-esg-omit-original-user-messages', '开启后，发送给外置 API 的消息中不包含原聊天记录里的 user 消息。'],
    ['#st-esg-compress-system', '将连续的 system 消息合并显示为一条，遇到其他角色消息时重新开始。'],
  ];
  optionDescriptions.forEach(([selector, text]) => $t(selector).closest('.st-esg-log-option').children('em').text(text));
  const modeDescriptions = {
    prompt: ['提示词编辑', '编辑当前来源的条目；启用状态和内容会参与提示词拼接，并由方案保存。'],
    import: ['导入到组件', '只从当前列表勾选条目并导入组件库；不参与提示词拼接，也不保存为方案。'],
  };
  ['preset', 'worldbook'].forEach((type) => {
    const mode = getSourceMode(type);
    const [title, desc] = modeDescriptions[mode] || modeDescriptions.prompt;
    const suffix = type === 'worldbook' ? '-worldbook' : '';
    $t(`#st-esg-source-mode-title${suffix}`).text(title);
    $t(`#st-esg-source-mode-desc${suffix}`).text(desc);
  });
}

function bindPanelEvents() {
  collapseManualComponentCard();
  $t([
    '[data-tab-panel="task"] > .st-esg-card:not(.st-esg-output-protocol-details) .st-esg-card-desc',
    '[data-tab-panel="preset"] > .st-esg-card:nth-child(2) .st-esg-card-desc',
    '[data-tab-panel="worldbook"] > .st-esg-card:nth-child(2) .st-esg-card-desc',
    '.st-esg-manual-component-card .st-esg-card-desc',
  ].join(', ')).remove();
  $t('.st-esg-card-title').filter(function () {
    return ['生成任务指令', '预设', '世界书', '提示词日志', '手动添加组件'].includes(textOf($(this).text()));
  }).each(function () {
    $(this).closest('.st-esg-card-head').remove();
  });
  refreshHelpText();
  applyTheme();
  $t('.st-esg-card-title').each(function () {
    const title = $(this);
    const desc = title.siblings('.st-esg-card-desc');
    if (!desc.length || title.find('.st-esg-info-toggle').length) return;
    const icon = $('<i class="fa-solid fa-circle-question st-esg-info-toggle" title="显示/隐藏说明"></i>');
    icon.on('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      desc.toggleClass('st-esg-show-desc');
    });
    title.append(icon);
  });
  $t('.st-esg-tag-rule-head .fa-circle-question').each(function () {
    const icon = $(this);
    if (icon.data('stEsgHelpBound')) return;
    const help = $(`<div class="st-esg-tag-rule-help">${escapeHtml(icon.attr('title') || '')}</div>`);
    icon.closest('.st-esg-tag-rule-head').after(help);
    icon.data('stEsgHelpBound', true).on('click.stEsgHelp', function (event) {
      event.preventDefault();
      event.stopPropagation();
      help.toggleClass('st-esg-show-desc');
    });
  });
  $t('#st-esg-preset-placement-slot .st-esg-log-option').add($t('#st-esg-compress-system').closest('.st-esg-log-option')).each(function () {
    const option = $(this);
    const desc = option.children('em');
    if (!desc.length || option.find('.st-esg-option-info-toggle').length) return;
    option.addClass('st-esg-option-with-info');
    const icon = $('<i class="fa-solid fa-circle-question st-esg-option-info-toggle" title="显示/隐藏说明"></i>');
    icon.on('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      option.toggleClass('st-esg-show-option-desc');
    });
    option.append(icon);
  });
  settings.enabled = true;
  $t('#st-esg-ball-visible').prop('checked', settings.ballVisible);
  $t('#st-esg-ball-size').val(getFloatingBallSize());
  $t('#st-esg-ball-size-value').text(`${getFloatingBallSize()}px`);
  $t('#st-esg-ball-opacity').val(Math.round(getFloatingBallOpacity() * 100));
  $t('#st-esg-ball-opacity-value').text(`${Math.round(getFloatingBallOpacity() * 100)}%`);
  $t('#st-esg-ball-animation-enabled').prop('checked', settings.ballAnimationEnabled);
  $t('#st-esg-ball-snap-enabled').prop('checked', settings.ballSnapEnabled);
  const floatingBallControls = targetDoc.querySelector('.st-esg-ball-controls');
  if (floatingBallControls) floatingBallControls.hidden = !settings.ballVisible;
  $t('#st-esg-qr-generate-enabled').prop('checked', settings.qrGenerateEnabled);
  $t('#st-esg-qr-inject-enabled').prop('checked', settings.qrInjectEnabled);
  $t('#st-esg-message-floor-panel-enabled').prop('checked', settings.messageFloorPanelEnabled);
  renderGenerationSettings();
  renderHistoryRangeUi();
  $t('#st-esg-task').val(settings.taskPrompt);
  renderOutputProtocolEditor();
  $t('#st-esg-task-placement-enabled').prop('checked', settings.taskPlacementEnabled);
  $t('#st-esg-replace-last-user-message').prop('checked', settings.replaceLastUserMessageWithTask);
  $t('#st-esg-omit-original-user-messages').prop('checked', settings.omitOriginalUserMessages);
  $t('#st-esg-baibai-history-enabled').prop('checked', settings.baiBaiBookHistoryEnabled);
  $t('#st-esg-baibai-state-enabled').prop('checked', settings.baiBaiBookStateEnabled);
  $t('#st-esg-anima-worldbook-enabled').prop('checked', settings.animaWorldbookEnabled);
  $t('#st-esg-anima-status-enabled').prop('checked', settings.animaStatusVariableEnabled);
  $t('#st-esg-preview').val(settings.lastGenerated);
  $t('#st-esg-temporary-task-instruction').val(temporaryTaskInstruction);
  renderGenerationHistory();
  renderGeneratedThinking();
  renderGenerationResultPanel();
  resizeGeneratedPreview();
  $t('#st-esg-compress-system').prop('checked', settings.compressSystemMessages);
  $t('#st-esg-api-url').val(settings.apiUrl);
  $t('#st-esg-api-key').val(settings.apiKey);
  $t('#st-esg-api-model').val(settings.apiModel);
  renderModelOptions();
  $t('#st-esg-max-tokens').val(settings.maxTokens);
  $t('#st-esg-temperature').val(settings.temperature);
  $t('#st-esg-streaming-enabled').prop('checked', settings.streamingEnabled);
  $t('#st-esg-api-retry-count').val(settings.apiRetryCount);
  $t('#st-esg-prompt-template-compat').prop('checked', settings.promptTemplateCompatEnabled);
  renderApiModeUi();
  renderMemorySettingsUi();
  refreshTavernProfiles({ notify: false });
  renderTagRuleManager('history');
  renderTagRuleManager('output');
  renderSourceModeUi();
  renderSourcePresetSelect();
  renderTaskPlacementOptions();
  renderAllSchemeOptions();
  renderComponentList(); renderPromptLog(); switchTab(settings.activeTab || 'workspace');
  $t('#st-esg-close').on('click', () => togglePanel(false));
  const cycleTheme = () => {
    settings.theme = nextThemeMode(settings.theme);
    applyTheme();
    saveSettings();
  };
  $t('#st-esg-theme-toggle')
    .on('click', cycleTheme)
    .on('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      cycleTheme();
    });
  $t('.st-esg-tab').on('click', function () { switchTab(String($(this).data('tab'))); });
  $t('.st-esg-collapsible').on('toggle.stEsgLayout', () => { void $t('.st-esg-panel-body').get(0)?.scrollHeight; });
  $t('#st-esg-add-component').on('click', addComponent);
  $t('#st-esg-component-target-library, #st-esg-import-target-library, #st-esg-worldbook-import-target-library').on('change', renderComponentLibraryTargetVisibility);
  $t('.st-esg-panel-body').off('change.stEsgPresetBinding').on('change.stEsgPresetBinding', '#st-esg-import-target-scope, #st-esg-worldbook-import-target-scope, #st-esg-component-scope', renderPresetBindingControls);
  $t('.st-esg-panel-body').on('change.stEsgLibraryTarget', '#st-esg-import-target-library, #st-esg-worldbook-import-target-library', renderComponentLibraryTargetVisibility);
  $t('.st-esg-mode-radio[name="preset_source_mode"]').on('change', function () {
    if (!$(this).prop('checked')) return;
    void changeSourceMode('preset', String($(this).val()));
  });
  $t('.st-esg-mode-radio[name="worldbook_source_mode"]').on('change', function () {
    if (!$(this).prop('checked')) return;
    void changeSourceMode('worldbook', String($(this).val()));
  });
  $t('#st-esg-source-preset').on('change', function () { const presetName = String($(this).val() || ''); settings.activeSourcePreset = presetName; if (getSourceMode('preset') === SOURCE_MODE_PROMPT) markSchemeDirty('preset'); else saveSettings(); scanImportCandidates({ explicitPresetName: presetName }); });
  $t('#st-esg-export-current-preset').on('click', () => { void exportCurrentEditedPreset(); });
  $t('.st-esg-panel-body').off('click.stEsgSourceImport').on('click.stEsgSourceImport', '#st-esg-import-preset-components', () => importCheckedCandidates('preset')).on('click.stEsgSourceImport', '#st-esg-import-worldbook-components', () => importCheckedCandidates('worldbook'));
  $t('#st-esg-copy-prompt-log').on('click', async () => {
    const copied = await copyTextToClipboard(lastPromptLogText);
    setStatus(copied ? '已复制提示词查看记录。' : '已选中提示词查看记录，可以手动复制。');
  });
  $t('#st-esg-clear-prompt-log').on('click', () => {
    lastPromptLogText = '';
    settings.lastPromptLog = '';
    renderPromptLog();
    saveSettings();
    setStatus('已清空提示词查看记录。');
  });
  $t('#st-esg-fetch-models').on('click', fetchApiModels);
  $t('#st-esg-additional-parameters').on('click', showApiAdditionalParametersDialog);
  $t('[data-tab-panel="workspace"]').off('click.stEsgAnchorPreview').on('click.stEsgAnchorPreview', '.st-esg-anchor-preview-button', function () {
    showAnchorInsertionPreviewDialog();
  });
  $t('[data-tab-panel="workspace"]').off('click.stEsgAnchorToggle').on('click.stEsgAnchorToggle', '#st-esg-anchor-plan [data-anchor-toggle]', function (event) {
    event.preventDefault();
    event.stopPropagation();
    const toggle = $(this);
    const card = toggle.closest('.st-esg-anchor-plan-item');
    const index = Number(card.attr('data-anchor-item-index'));
    const item = settings.lastGeneratedAnchorItems?.[index];
    if (!item) return;
    item.injectionEnabled = !isAnchorInsertionEnabled(item);
    updateAnchorPlanStatusUi();
    if (settings.messageFloorPanelEnabled) {
      messageFloorPanelState.anchorItems = settings.lastGeneratedAnchorItems.map((entry) => ({ ...entry }));
      renderMessageFloorPanel({ force: true });
    }
    scheduleAnchorEditPersistence();
  });
  $t('[data-tab-panel="workspace"]').off('input.stEsgAnchor change.stEsgAnchor').on('input.stEsgAnchor change.stEsgAnchor', '#st-esg-anchor-plan [data-anchor-field]', function () {
    const field = $(this);
    const card = field.closest('.st-esg-anchor-plan-item');
    const index = Number(card.attr('data-anchor-item-index'));
    const item = settings.lastGeneratedAnchorItems?.[index];
    const fieldName = String(field.attr('data-anchor-field') || '');
    if (!item || !['anchor', 'content'].includes(fieldName)) return;
    item[fieldName] = String(field.val() ?? '');
    if (settings.messageFloorPanelEnabled) {
      messageFloorPanelState.anchorItems = settings.lastGeneratedAnchorItems.map((entry) => ({ ...entry }));
      refreshMessageFloorPanelAnchorItem(index);
    }
    updateAnchorPlanStatusUi();
    scheduleAnchorEditPersistence();
  });
  $t('.st-esg-scheme-select').on('change', function () {
    const type = String($(this).data('scheme-type') || '');
    const selectedId = String($(this).val() || '');
    setSelectedSchemeId(type, selectedId);
    saveSettings();
  });
  $t('.st-esg-save-scheme-new').on('click', function () { handleSchemeAction(String($(this).data('scheme-type') || ''), 'new'); });
  $t('.st-esg-load-scheme').on('click', function () { handleSchemeAction(String($(this).data('scheme-type') || ''), 'load'); });
  $t('.st-esg-overwrite-scheme').on('click', function () { handleSchemeAction(String($(this).data('scheme-type') || ''), 'overwrite'); });
  $t('.st-esg-delete-scheme').on('click', function () { handleSchemeAction(String($(this).data('scheme-type') || ''), 'delete'); });
  $t('#st-esg-bind-worldbook-chat').on('click', () => { void applyWorldbookSchemeToCurrentChat(); });
  $t('#st-esg-open-data-management').on('click', openDataManagementDialog);
  $t('#st-esg-compress-system').on('change', function () { settings.compressSystemMessages = Boolean($(this).prop('checked')); saveSettings(); });
  targetDoc.getElementById('st-esg-ball-visible')?.addEventListener('change', function () {
    settings.ballVisible = Boolean(this.checked);
    const floatingBallControls = targetDoc.querySelector('.st-esg-ball-controls');
    if (floatingBallControls) floatingBallControls.hidden = !settings.ballVisible;
    saveSettings();
    renderFloatingBall();
  });
  $t('#st-esg-ball-size').on('input', function () {
    settings.ballSize = normalizeFloatingBallSize($(this).val());
    $t('#st-esg-ball-size-value').text(`${settings.ballSize}px`);
    scheduleSettingsSave();
    renderFloatingBall();
  });
  $t('#st-esg-ball-opacity').on('input', function () {
    settings.ballOpacity = normalizeFloatingBallOpacity(Number($(this).val()) / 100);
    $t('#st-esg-ball-opacity-value').text(`${Math.round(settings.ballOpacity * 100)}%`);
    scheduleSettingsSave();
    renderFloatingBall();
  });
  targetDoc.getElementById('st-esg-ball-animation-enabled')?.addEventListener('change', function () {
    settings.ballAnimationEnabled = Boolean(this.checked);
    saveSettings();
    setFloatingBallVisualState(floatingBallVisualState);
  });
  targetDoc.getElementById('st-esg-ball-snap-enabled')?.addEventListener('change', function () {
    settings.ballSnapEnabled = Boolean(this.checked);
    if (!settings.ballSnapEnabled) settings.ballDock = 'none';
    saveSettings();
    renderFloatingBall();
  });
  targetDoc.getElementById('st-esg-qr-generate-enabled')?.addEventListener('change', function () {
    settings.qrGenerateEnabled = Boolean(this.checked);
    saveSettings();
    void syncQuickReplyShortcuts({ notifyOnUnavailable: true });
  });
  targetDoc.getElementById('st-esg-qr-inject-enabled')?.addEventListener('change', function () {
    settings.qrInjectEnabled = Boolean(this.checked);
    saveSettings();
    void syncQuickReplyShortcuts({ notifyOnUnavailable: true });
  });
  targetDoc.getElementById('st-esg-message-floor-panel-enabled')?.addEventListener('change', function () {
    settings.messageFloorPanelEnabled = Boolean(this.checked);
    saveSettings();
    if (settings.messageFloorPanelEnabled) refreshMessageFloorPanelTarget();
    else {
      removeMessageFloorPanels();
      messageFloorPanelState = createFloorPanelState();
    }
  });
  $t('#st-esg-auto-generate').on('change', function () {
    settings.autoGenerate = Boolean($(this).prop('checked'));
    saveSettings();
    renderGenerationSettings();
  });
  $t('#st-esg-auto-generate-trigger').on('input', function () {
    settings.automaticGenerationTriggerText = String($(this).val() ?? '');
    scheduleSettingsSave();
  });
  $t('#st-esg-auto-inject').on('change', function () {
    settings.autoInject = Boolean($(this).prop('checked'));
    saveSettings();
    renderGenerationSettings();
  });
  $t('input[name="st-esg-history-range-mode"]').on('change', function () {
    if (!$(this).prop('checked')) return;
    settings.historyRangeMode = normalizeChatHistoryRangeMode(String($(this).val()));
    saveSettings();
    renderHistoryRangeUi();
  });
  $t('#st-esg-recent-message-count').on('input', function () {
    const raw = String($(this).val() ?? '').trim();
    if (!raw) return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    settings.recentMessageCount = Math.max(1, Math.floor(parsed));
    scheduleSettingsSave();
  }).on('change blur', function () {
    commitRecentMessageCountInput(this);
  });
  $t('#st-esg-status-placeholder-enabled').on('change', function () {
    settings.statusPlaceholderEnabled = Boolean($(this).prop('checked'));
    saveSettings();
  });
  $t('#st-esg-mvu-reprocess-on-inject').on('change', function () {
    settings.mvuReprocessOnInject = Boolean($(this).prop('checked'));
    saveSettings();
  });
  $t('#st-esg-task').on('input', function () {
    settings.taskPrompt = String($(this).val());
    markSchemeDirtyDeferred('task');
  });
  $t('[data-output-protocol-mode]').on('click', function (event) {
    event.preventDefault();
    const nextMode = String($(this).attr('data-output-protocol-mode') || 'standard');
    if (!['standard', 'anchor'].includes(nextMode) || nextMode === outputProtocolEditorMode) return;
    outputProtocolEditorMode = nextMode;
    renderOutputProtocolEditor();
    event.currentTarget.blur();
  });
  $t('#st-esg-output-protocol-text').on('input', function () {
    const keys = getOutputProtocolSettingKeys();
    settings[keys.text] = String($(this).val() ?? '');
    scheduleSettingsSave();
  });
  $t('#st-esg-output-protocol-role').on('change', function () {
    const keys = getOutputProtocolSettingKeys();
    settings[keys.role] = normalizeOutputProtocolRole(String($(this).val() || 'system'));
    saveSettings();
  });
  $t('#st-esg-reset-output-protocol').on('click', function (event) {
    event.preventDefault();
    const keys = getOutputProtocolSettingKeys();
    settings[keys.text] = DEFAULT_SETTINGS[keys.text];
    renderOutputProtocolEditor();
    saveSettings();
    setStatus(outputProtocolEditorMode === 'anchor' ? '已恢复锚点模式内置协议。' : '已恢复普通模式内置协议。');
    event.currentTarget.blur();
  });
  $t('#st-esg-temporary-task-instruction').on('input', function () {
    temporaryTaskInstruction = String($(this).val() ?? '');
    if (settings.generationMode === 'multi') {
      const task = getActiveMultiTask();
      if (task) replaceMultiTask(task.id, { extraInstruction: temporaryTaskInstruction });
      scheduleSettingsSave();
    }
  });
  $t('#st-esg-clear-temporary-task-instruction').on('click', function (event) {
    event.preventDefault();
    temporaryTaskInstruction = '';
    $t('#st-esg-temporary-task-instruction').val('');
    if (settings.generationMode === 'multi') {
      const task = getActiveMultiTask();
      if (task) replaceMultiTask(task.id, { extraInstruction: '' });
      saveSettings();
    }
    event.currentTarget.blur();
  });
  $t('#st-esg-task-placement-enabled').on('change', function () {
    settings.taskPlacementEnabled = Boolean($(this).prop('checked'));
    markSchemeDirty('preset');
    renderTaskPlacementOptions();
  });
  $t('#st-esg-task-placement-after').on('change', function () {
    settings.taskPlacementAfterSourceId = String($(this).val() || '');
    markSchemeDirty('preset');
  });
  $t('#st-esg-replace-last-user-message').on('change', function () {
    settings.replaceLastUserMessageWithTask = Boolean($(this).prop('checked'));
    markSchemeDirty('preset');
  });
  $t('#st-esg-omit-original-user-messages').on('change', function () {
    settings.omitOriginalUserMessages = Boolean($(this).prop('checked'));
    markSchemeDirty('preset');
  });
  $t('#st-esg-baibai-history-enabled').on('change', function () { settings.baiBaiBookHistoryEnabled = Boolean($(this).prop('checked')); saveSettings(); });
  $t('#st-esg-baibai-state-enabled').on('change', function () { settings.baiBaiBookStateEnabled = Boolean($(this).prop('checked')); saveSettings(); });
  $t('#st-esg-anima-worldbook-enabled').on('change', function () {
    settings.animaWorldbookEnabled = Boolean($(this).prop('checked'));
    if (!settings.animaWorldbookEnabled) clearAnimaWorldbookSnapshot();
    saveSettings();
  });
  $t('#st-esg-anima-status-enabled').on('change', function () {
    settings.animaStatusVariableEnabled = Boolean($(this).prop('checked'));
    if (!settings.animaWorldbookEnabled && !settings.animaStatusVariableEnabled) clearAnimaWorldbookSnapshot();
    renderMemorySettingsUi();
    saveSettings();
  });
  $t('#st-esg-anima-status-after-message-enabled').on('change', function () {
    settings.animaStatusAfterMessageEnabled = Boolean($(this).prop('checked'));
    saveSettings();
  });
  $t('#st-esg-reset-task').on('click', function () {
    settings.taskPrompt = DEFAULT_SETTINGS.taskPrompt;
    $t('#st-esg-task').val(settings.taskPrompt);
    markSchemeDirty('task');
    setStatus('已恢复默认提示词。');
  });
  $t('#st-esg-preview').on('input', function () {
    settings.lastGeneratedAnchorItems = [];
    settings.lastGeneratedAnchorWarnings = [];
    settings.lastGenerated = String($(this).val());
    settings.lastGeneratedStatusPlaceholderPresent = containsStatusPlaceholder(settings.lastGenerated);
    if (settings.generationMode === 'multi') {
      const task = getActiveMultiTask();
      if (task) replaceMultiTask(task.id, { output: settings.lastGenerated });
    }
    resizeGeneratedPreview();
    renderAnchorInsertionPlan([], []);
    if (settings.messageFloorPanelEnabled && messageFloorPanelState.target) {
      messageFloorPanelState.resultMode = 'standard';
      messageFloorPanelState.output = settings.lastGenerated;
      messageFloorPanelState.anchorItems = [];
      refreshMessageFloorPanelStreamContent();
    }
  });
  $t('#st-esg-api-url').on('input', function () { settings.apiUrl = String($(this).val()); markSchemeDirtyDeferred('api'); });
  $t('.st-esg-api-tab').on('click', function () {
    settings.apiMode = String($(this).data('api-mode') || 'custom');
    settings.useMainApi = false;
    markSchemeDirty('api');
    renderApiModeUi();
  });
  $t('#st-esg-tavern-profile').on('change', function () {
    settings.tavernProfile = String($(this).val() || '');
    markSchemeDirty('api');
    setStatus(settings.tavernProfile ? '已选择酒馆预设' : '已取消选择酒馆预设');
  });
  $t('#st-esg-refresh-tavern-profiles').on('click', function () { refreshTavernProfiles(); });
  $t('#st-esg-api-key').on('input', function () { settings.apiKey = String($(this).val()); markSchemeDirtyDeferred('api'); });
  $t('#st-esg-api-model').on('input', function () { settings.apiModel = String($(this).val()); markSchemeDirtyDeferred('api'); });
  $t('#st-esg-api-model-picker').on('change', function () {
    const selected = String($(this).val() || '');
    if (selected === '__manual__') {
      $(this).hide();
      $t('#st-esg-api-model').show().trigger('focus');
      return;
    }
    settings.apiModel = selected;
    $t('#st-esg-api-model').val(selected);
    markSchemeDirty('api');
  });
  $t('#st-esg-max-tokens').on('input', function () { settings.maxTokens = String($(this).val()); markSchemeDirtyDeferred('api'); });
  $t('#st-esg-temperature').on('input', function () { settings.temperature = String($(this).val()); markSchemeDirtyDeferred('api'); });
  $t('#st-esg-streaming-enabled').on('change', function () { settings.streamingEnabled = Boolean($(this).prop('checked')); markSchemeDirty('api'); });
  $t('#st-esg-api-retry-count').on('input', function () { settings.apiRetryCount = String($(this).val()); markSchemeDirtyDeferred('api'); });
  $t('#st-esg-api-retry-count').on('change blur', function () { settings.apiRetryCount = normalizeApiRetryCount($(this).val()); $(this).val(settings.apiRetryCount); markSchemeDirty('api'); });
  $t('#st-esg-prompt-template-compat').on('change', function () { settings.promptTemplateCompatEnabled = Boolean($(this).prop('checked')); saveSettings(); });
  $t('#st-esg-inject-mode').on('change', function () { settings.injectMode = String($(this).val()); saveSettings(); renderGenerationSettings(); });
  $t('#st-esg-rollback-before-generation').on('change', function () { settings.rollbackBeforeGeneration = Boolean($(this).prop('checked')); saveSettings(); });
  ['history', 'output'].forEach((type) => {
    $t(`#st-esg-${type}-rule-add`).on('click', () => addTagRule(type));
    $t(`#st-esg-${type}-rule-input`).on('keydown', function (event) { if (event.key === 'Enter') { event.preventDefault(); addTagRule(type); } });
    $t(`#st-esg-${type}-rule-mode`).on('change', function () {
      const isRegex = String($(this).val()) === 'regex';
      $t(`#st-esg-${type}-rule-input`).attr('placeholder', isRegex ? '<thinking>[\\s\\S]*?</thinking>' : 'thinking');
    });
    $t(`#st-esg-${type}-rule-list`).on('click', '.st-esg-tag-rule-delete', function () {
      const entries = getTagRuleEntries(type);
      entries.splice(Number($(this).data('rule-index')), 1);
      saveTagRuleEntries(type, entries);
      renderTagRuleManager(type);
    });
    if (type === 'history') {
      $t('#st-esg-history-rule-list').on('change', '.st-esg-history-rule-keep input', function () {
        const entries = getTagRuleEntries('history');
        const entry = entries[Number($(this).data('rule-index'))];
        if (!entry) return;
        entry.keep = Math.max(0, Math.floor(Number($(this).val()) || 0));
        saveTagRuleEntries('history', entries);
        $(this).val(entry.keep);
      });
    }
  });
  $t('#st-esg-tag-cleanup-import-trigger').on('click', () => $t('#st-esg-tag-cleanup-import-file').trigger('click'));
  $t('#st-esg-tag-cleanup-export').on('click', () => exportTagCleanupRules());
  $t('#st-esg-tag-cleanup-import-file').on('change', async function () {
    const file = this.files?.[0];
    this.value = '';
    await importTagCleanupRules(file);
  });
  $t('#st-esg-generate').on('click', (event) => {
    event.preventDefault();
    event.currentTarget.blur();
    if (settings.generationMode === 'multi') {
      const runningTaskIds = normalizeMultiTaskSettings(settings.multiTaskSettings).tasks
        .filter((task) => [MULTI_TASK_STATUS.QUEUED, MULTI_TASK_STATUS.GENERATING].includes(task.status))
        .map((task) => task.id);
      if (runningTaskIds.length) cancelMultiTaskGeneration(runningTaskIds);
      else void generateMultiTasks();
    } else void generateStatusbar();
  });
  $t('#st-esg-inject').on('click', (event) => {
    event.preventDefault();
    event.currentTarget.blur();
    if (settings.generationMode === 'multi') void injectMultiTasks();
    else void injectGeneratedStatusbar();
  });
  $t('#st-esg-undo-injection').on('click', () => {
    if (settings.generationMode === 'multi') void undoMultiTaskInjections(null, { requireConfirmation: true });
    else void undoLatestInjection();
  });
  $t('#st-esg-generation-error').on('click', '#st-esg-show-generated-content', () => {
    settings.lastGenerationError = null;
    setFloatingBallVisualState(settings.lastGenerated ? 'waiting' : 'idle');
    saveSettings();
    renderGenerationResultPanel();
  });
  refreshInjectionUndoState();
}

function mountUi() {
  if (!targetDoc.body) { targetWindow.setTimeout(mountUi, 500); return; }
  renderMagicWandMenuButton(); renderFloatingBall(); renderPluginPanel();
  refreshMessageFloorPanelTarget();
}

function mountUiWhenDocumentReady() {
  if (targetDoc.readyState === 'loading') {
    targetDoc.addEventListener('DOMContentLoaded', mountUi, { once: true });
    return;
  }
  mountUi();
}

function loadStylesheet() {
  if (targetDoc.getElementById(`${EXTENSION_ID}-style`)) return;
  const link = targetDoc.createElement('link');
  link.id = `${EXTENSION_ID}-style`;
  link.rel = 'stylesheet';
  link.href = new URL(`./style.css?ver=${EXTENSION_VERSION}`, import.meta.url).href;
  targetDoc.head.appendChild(link);
}

function init() {
  if (initialized) return;
  initialized = true;
  recentGenerationHistory = loadGenerationHistory(getGenerationHistoryStorage(), GENERATION_HISTORY_STORAGE_KEY);
  loadSettings();
  floatingBallVisualState = settings.lastGenerationError ? 'error' : 'idle';
  loadStylesheet(); mountUiWhenDocumentReady();
  updateQuickReplyShortcutActions();
  void syncQuickReplyShortcuts();
  startTavernDefaultSync();
  void restoreBoundWorldbookSchemeForCurrentChat();
  const context = getContext();
  registerPromptSourceCacheInvalidation(context);
  registerInjectionUndoInvalidation(context);
  registerMessageFloorPanelEvents(context);
  if (context.eventTypes.GENERATION_STARTED) context.eventSource.on(context.eventTypes.GENERATION_STARTED, handleGenerationStarted);
  if (context.eventTypes.GENERATION_ENDED) context.eventSource.on(context.eventTypes.GENERATION_ENDED, handleGenerationEnded);
  if (context.eventTypes.GENERATION_STOPPED) context.eventSource.on(context.eventTypes.GENERATION_STOPPED, handleGenerationStopped);
  if (context.eventTypes.MESSAGE_RECEIVED) context.eventSource.on(context.eventTypes.MESSAGE_RECEIVED, handleAssistantMessageReceived);
  if (context.eventTypes.CHARACTER_MESSAGE_RENDERED) context.eventSource.on(context.eventTypes.CHARACTER_MESSAGE_RENDERED, handleAssistantMessageRendered);
  if (context.eventTypes.CHAT_CHANGED) context.eventSource.on(context.eventTypes.CHAT_CHANGED, () => {
    invalidatePendingAutomaticGeneration({ abortActive: true });
    automaticGenerationBaseline = null;
    const currentChatId = getCurrentAnimaChatId();
    if (shouldClearAnimaSnapshotForChat(animaWorldbookSnapshotChatId, currentChatId)) {
      clearAnimaWorldbookSnapshot();
    }
    if (currentChatId) animaWorldbookSnapshotChatId = currentChatId;
    seedLastAutomaticTargetFromCurrentChat();
    refreshMessageFloorPanelTarget();
    void restoreBoundWorldbookSchemeForCurrentChat();
  });
  console.log(`[${EXTENSION_ID}] 已加载，dialog top layer，UI 挂载文档：${targetWindow === window ? 'current' : 'parent'}`);
}

init();
