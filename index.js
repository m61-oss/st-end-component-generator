import { getContext } from '../../../st-context.js';
import { yaml } from '../../../../lib.js';
import {
  COMPONENT_SCOPE_CHARACTER,
  COMPONENT_SCOPE_GLOBAL,
  COMPONENT_SCOPE_PRESET,
  SOURCE_PRESET,
  SOURCE_WORLDBOOK,
  collectPresetImportGroups,
  collectWorldbookImportCandidates,
  collectWorldbookImportCounts,
  collectWorldbookImportGroups,
  createComponentId,
  getActiveComponentsForContext,
  getComponentLibraryFolders,
  getComponentBindingName,
  getCurrentCharacterNameSafe,
  getWorldbookImportDisplayCategory,
  getCurrentPresetNameSafe,
  migrateLegacyComponentGroups,
  getPresetNamesSafe,
  normalizeComponent,
  normalizeComponentIds,
  normalizeComponentScope,
} from './sources/component-sources.js?ver=0.1.0';
import { extractModelIds, normalizeChatCompletionsUrl, normalizeModelsUrl } from './api/api-utils.js?ver=0.1.0';
import { containsStatusPlaceholder, injectStatusbarText, STATUS_PLACEHOLDER_TAG } from './injection/inject-utils.js?ver=0.1.0';
import { buildExternalStatusbarMessages, createRuntimePromptDiagnostics } from './generation/prompt-builder.js?ver=0.1.0';
import { renderPromptTemplate } from './generation/template-compat.js?ver=0.1.0';
import { getBaiBaiBookApi } from './sources/baibai-book.js?ver=0.1.0';
import { createPromptLog, createPromptLogViewModel, mergeConsecutiveSystemMessages } from './generation/prompt-log.js?ver=0.1.0';
import {
  clearImportSelectionsForScope,
  collectSelectedPromptSourceItems,
  normalizePromptSourceType,
  syncPromptSelectionsFromGroups,
} from './sources/source-selection.js?ver=0.1.0';
import { captureSchemeSnapshot, deleteScheme, findScheme, getWorldbookSchemeSourceNames, normalizeSchemeList, saveScheme } from './settings/scheme-utils.js?ver=0.1.0';
import { readOpenAiStream } from './api/stream-utils.js?ver=0.1.0';
import { extractConfiguredBlocks, stripConfiguredBlocks } from './injection/tag-rules.js?ver=0.1.0';
import { filterWorldbookPromptItems, normalizeWorldbookActivationMode } from './sources/worldbook-scan.js?ver=0.1.0';
import { getWorldInfoSettings } from '../../../world-info.js?ver=0.1.0';
import { createGenerationErrorRecord, isGenerationResponseError, markGenerationResponseError } from './generation/generation-error.js?ver=0.1.0';
import { getNotificationMethod } from './ui/notification-utils.js?ver=0.1.0';
import { getGenerationConflictAction } from './generation/generation-entry.js?ver=0.1.0';
import { resolveAutomaticAssistantMessageIndex } from './generation/auto-generation-trigger.js?ver=0.1.0';
import { resolveFloatingBallPosition } from './ui/floating-ball-position.js?ver=0.1.0';
import {
  buildApiRequestParts,
  parseApiAdditionalParameters,
  parseApiNumericSettings,
} from './api/api-request-parameters.js?ver=0.1.0';
import {
  createPromptSourceCacheState,
  loadWorldbookSourceGroups,
  markPromptSourceStructureDirty,
  markWorldbookSourceDirty,
  takeDirtyWorldbookSources,
} from './sources/prompt-source-cache.js?ver=0.1.0';

const EXTENSION_ID = 'st-end-component-generator';
const EXTENSION_VERSION = '0.1.0';
const PROMPT_TEMPLATE_COMPAT_STORAGE_KEY = `${EXTENSION_ID}.promptTemplateCompatEnabled`;
const SOURCE_MODE_PROMPT = 'prompt';
const SOURCE_MODE_IMPORT = 'import';
const WORLD_BOOK_FOLLOW_TAVERN = '__follow_tavern__';
const DEFAULT_COMPONENT_GROUP_VALUE = '__default_group__';
const MAX_OUTPUT_TOKENS = 65535;
const FLOATING_BALL_SIZE = 38;
const QR_SHORTCUT_SET_NAME = '外置文尾组件生成器快捷键';
const QR_SHORTCUT_ACTIONS_KEY = '__stEsgQuickReplyActions';
const WORLDBOOK_CATEGORY_ORDER = [
  ['global', '全局世界书'],
  ['character', '角色世界书'],
  ['chat', '聊天世界书'],
  ['plugin', '插件启用'],
  ['inactive', '未启用世界书'],
];

const DEFAULT_SETTINGS = {
  enabled: false,
  mode: 'manual',
  autoGenerate: null,
  autoInject: null,
  activeTab: 'workspace',
  taskPrompt: [
    '请不要续写正文。',
    '请根据当前对话与下方要求，为本次回复补充所需的文尾组件。',
    '',
    '{{external_components}}',
  ].join('\n'),
  apiUrl: '',
  apiKey: '',
  apiModel: '',
  apiModelOptions: [],
  maxTokens: String(MAX_OUTPUT_TOKENS),
  temperature: '1',
  additionalBodyYaml: '',
  excludedBodyYaml: '',
  additionalHeadersYaml: '',
  streamingEnabled: false,
  promptTemplateCompatEnabled: false,
  injectMode: 'replace',
  statusPlaceholderEnabled: false,
  mvuReprocessOnInject: true,
  historyCleanupTags: '',
  outputCleanupTags: '',
  lastGenerated: '',
  lastGeneratedStatusPlaceholderPresent: false,
  lastGeneratedThinking: [],
  lastGenerationError: null,
  lastPromptLog: '',
  compressSystemMessages: false,
  taskPlacementEnabled: false,
  taskPlacementAfterSourceId: '',
  replaceLastUserMessageWithTask: false,
  omitOriginalUserMessages: false,
  baiBaiBookHistoryEnabled: false,
  baiBaiBookStateEnabled: false,
  ballX: null,
  ballY: null,
  ballPositionVersion: 2,
  ballVisible: false,
  qrGenerateEnabled: false,
  qrInjectEnabled: false,
  theme: 'dark',
  activeSourcePreset: '',
  sourceMode: SOURCE_MODE_PROMPT,
  sourceModes: { preset: SOURCE_MODE_PROMPT, worldbook: SOURCE_MODE_PROMPT },
  promptSourceSnapshots: { preset: null, worldbook: null },
  promptSelections: {},
  importSelections: {},
  sourceContentOverrides: {},
  worldbookActivationOverrides: {},
  apiSchemes: [],
  taskSchemes: [],
  presetSchemes: [],
  worldbookSchemes: [],
  selectedApiSchemeId: '',
  selectedTaskSchemeId: '',
  selectedPresetSchemeId: '',
  selectedWorldbookSchemeId: '',
  activeSchemeIds: {},
  dirtySchemeTypes: {},
  components: [],
  componentGroups: [],
  defaultGroupEnabled: {},
  componentGroupsMigrated: false,
};

const targetWindow = (() => {
  try { return window.parent?.document?.body ? window.parent : window; } catch (_) { return window; }
})();
const targetDoc = targetWindow.document;
let initialized = false;
let settings = { ...DEFAULT_SETTINGS };
let importCandidates = [];
let importGroups = [];
const promptSourceCache = createPromptSourceCacheState();
let activeWorldbookGroupIndex = null;
let generationAbortController = null;
let lastRuntimeDiagnostics = {};
let lastPromptLogText = '';
let lastGeneratedThinking = [];
let tavernSyncTimer = null;
let lastTavernSourceSignature = '';
let listSearchQuery = '';
let listFilterMode = 'all';
let componentSearchQuery = '';
let componentFilterMode = 'all';
let componentEditMode = false;
let selectedComponentIds = new Set();
let quickReplySyncTimer = null;

const $t = (selectorOrHtml) => $(selectorOrHtml, targetDoc);
const textOf = (value) => String(value ?? '').trim();
const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function getQuickReplyApi() {
  return targetWindow.quickReplyApi ?? globalThis.quickReplyApi;
}

function getQuickReplyShortcutEntries() {
  return [
    {
      enabled: settings.qrGenerateEnabled,
      label: '点击生成',
      title: '生成文尾组件',
      message: '生成文尾组件快捷操作',
      action: 'generate',
    },
    {
      enabled: settings.qrInjectEnabled,
      label: '点击注入',
      title: '注入回复文尾',
      message: '注入文尾组件快捷操作',
      action: 'inject',
    },
  ];
}

function updateQuickReplyShortcutActions() {
  targetWindow[QR_SHORTCUT_ACTIONS_KEY] = {
    generate: () => generateStatusbar('quickReply'),
    inject: () => injectGeneratedStatusbar(),
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

function loadSettings() {
  const storedSettings = getSettingsStore();
  const hadActiveSchemeIds = Object.prototype.hasOwnProperty.call(storedSettings, 'activeSchemeIds');
  settings = Object.assign({ ...DEFAULT_SETTINGS }, storedSettings);
  try {
    const localValue = targetWindow.localStorage?.getItem(PROMPT_TEMPLATE_COMPAT_STORAGE_KEY);
    if (localValue === 'true' || localValue === 'false') settings.promptTemplateCompatEnabled = localValue === 'true';
  } catch (_) {}
  if (typeof settings.autoGenerate !== 'boolean') settings.autoGenerate = settings.mode !== 'manual';
  if (typeof settings.promptTemplateCompatEnabled !== 'boolean') settings.promptTemplateCompatEnabled = false;
  if (typeof settings.autoInject !== 'boolean') settings.autoInject = settings.mode === 'autoInject';
  if (typeof settings.mvuReprocessOnInject !== 'boolean') settings.mvuReprocessOnInject = true;
  lastPromptLogText = textOf(settings.lastPromptLog);
  lastGeneratedThinking = Array.isArray(settings.lastGeneratedThinking) ? settings.lastGeneratedThinking.map((item) => String(item || '')).filter(Boolean) : [];
  settings.lastPromptLog = '';
  if (!Array.isArray(settings.components)) settings.components = [];
  if (!Array.isArray(settings.componentGroups)) settings.componentGroups = [];
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
  if (!settings.promptSelections || typeof settings.promptSelections !== 'object') settings.promptSelections = {};
  if (!settings.importSelections || typeof settings.importSelections !== 'object') settings.importSelections = {};
  if (!settings.promptSourceSnapshots || typeof settings.promptSourceSnapshots !== 'object') settings.promptSourceSnapshots = {};
  for (const type of ['preset', 'worldbook']) {
    if (!Array.isArray(settings.promptSourceSnapshots[type]?.items)) settings.promptSourceSnapshots[type] = null;
  }
  if (!settings.sourceContentOverrides || typeof settings.sourceContentOverrides !== 'object') settings.sourceContentOverrides = {};
  if (!settings.worldbookActivationOverrides || typeof settings.worldbookActivationOverrides !== 'object') settings.worldbookActivationOverrides = {};
  if (![SOURCE_MODE_PROMPT, SOURCE_MODE_IMPORT].includes(settings.sourceMode)) settings.sourceMode = SOURCE_MODE_PROMPT;
  if (!settings.sourceModes || typeof settings.sourceModes !== 'object') settings.sourceModes = {};
  for (const type of ['preset', 'worldbook']) {
    if (![SOURCE_MODE_PROMPT, SOURCE_MODE_IMPORT].includes(settings.sourceModes[type])) settings.sourceModes[type] = settings.sourceMode;
  }
  settings.streamingEnabled = Boolean(settings.streamingEnabled);
  if (!['dark', 'light'].includes(settings.theme)) settings.theme = 'dark';
  if (settings.historyCleanupTags === undefined) settings.historyCleanupTags = String(settings.cleanupTags || '');
  if (settings.outputCleanupTags === undefined) settings.outputCleanupTags = '';
  if (!hadActiveSchemeIds || !settings.activeSchemeIds || typeof settings.activeSchemeIds !== 'object') {
    settings.activeSchemeIds = {
      api: textOf(settings.selectedApiSchemeId),
      task: textOf(settings.selectedTaskSchemeId),
      preset: textOf(settings.selectedPresetSchemeId),
      worldbook: textOf(settings.selectedWorldbookSchemeId),
    };
  }
  if (!settings.dirtySchemeTypes || typeof settings.dirtySchemeTypes !== 'object') settings.dirtySchemeTypes = {};
  settings.taskPlacementEnabled = Boolean(settings.taskPlacementEnabled);
  settings.taskPlacementAfterSourceId = textOf(settings.taskPlacementAfterSourceId);
  settings.replaceLastUserMessageWithTask = Boolean(settings.replaceLastUserMessageWithTask);
  settings.omitOriginalUserMessages = Boolean(settings.omitOriginalUserMessages);
  settings.baiBaiBookHistoryEnabled = Boolean(settings.baiBaiBookHistoryEnabled);
  settings.baiBaiBookStateEnabled = Boolean(settings.baiBaiBookStateEnabled);
  settings.qrGenerateEnabled = Boolean(settings.qrGenerateEnabled);
  settings.qrInjectEnabled = Boolean(settings.qrInjectEnabled);
  if (settings.ballPositionVersion !== 2) {
    settings.ballX = null;
    settings.ballY = null;
    settings.ballPositionVersion = 2;
  }
  settings.components = normalizeComponentIds(
    settings.components.map((item) => normalizeComponent(item, targetWindow, getContext())),
    targetWindow.crypto,
  );
  normalizePresetComponentBindings();
}

function saveSettings() {
  Object.assign(getSettingsStore(), settings);
  try {
    targetWindow.localStorage?.setItem(PROMPT_TEMPLATE_COMPAT_STORAGE_KEY, String(Boolean(settings.promptTemplateCompatEnabled)));
  } catch (_) {}
  getContext().saveSettingsDebounced();
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

function getEnabledComponents() {
  return getActiveComponentsForContext(settings.components, targetWindow, getContext(), {
    presetSchemeId: getActiveSchemeId('preset'),
    componentGroups: settings.componentGroups,
    defaultGroupEnabled: settings.defaultGroupEnabled,
  });
}

function createNewComponentId() {
  return createComponentId(new Set(settings.components.map((component) => textOf(component?.id)).filter(Boolean)), targetWindow.crypto);
}

function createNewComponentGroupId() {
  return createComponentId(new Set(settings.componentGroups.map((group) => textOf(group?.id)).filter(Boolean)), targetWindow.crypto);
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

function resizeTextareaToContent(textarea, fallbackMinHeight = 0) {
  if (!textarea) return;
  const computed = targetWindow.getComputedStyle(textarea);
  const cssMinHeight = parseFloat(computed.minHeight) || 0;
  const minHeight = Math.max(fallbackMinHeight, cssMinHeight);
  textarea.style.setProperty('height', '0px', 'important');
  textarea.style.setProperty('min-height', '0px', 'important');
  textarea.style.setProperty('max-height', 'none', 'important');
  const contentHeight = Math.ceil(textarea.scrollHeight) + 12;
  textarea.style.setProperty('min-height', `${minHeight}px`, 'important');
  textarea.style.setProperty('height', `${Math.max(contentHeight, minHeight)}px`, 'important');
  textarea.style.setProperty('overflow-y', 'hidden', 'important');
}

function resizeGeneratedPreview() {
  const preview = $t('#st-esg-preview').get(0);
  if (!preview || preview.classList.contains('st-esg-hidden')) return;
  resizeTextareaToContent(preview, 160);
}

function resizeTaskPrompt() {
  resizeTextareaToContent($t('#st-esg-task').get(0), 160);
}

function scheduleGeneratedPreviewResize() {
  if (typeof targetWindow.requestAnimationFrame === 'function') {
    targetWindow.requestAnimationFrame(() => resizeGeneratedPreview());
  } else {
    resizeGeneratedPreview();
  }
}

function renderGeneratedThinking(blocks = lastGeneratedThinking) {
  const box = $t('#st-esg-thinking-panel');
  if (!box.length) return;
  const entries = Array.isArray(blocks) ? blocks.filter(Boolean) : [];
  if (!entries.length) { box.empty().addClass('st-esg-hidden'); return; }
  const label = entries.length === 1 ? '1 段思维链' : `${entries.length} 段思维链`;
  box.html(`<details class="st-esg-thinking-details"><summary><span class="st-esg-thinking-title"><i class="fa-solid fa-brain"></i>思维链</span><em>${label} · 不会注入</em></summary><pre>${escapeHtml(entries.join('\n\n'))}</pre></details>`).removeClass('st-esg-hidden');
}

function applyGeneratedResult(rawText) {
  const result = extractConfiguredBlocks(rawText, settings.outputCleanupTags);
  settings.lastGenerated = result.body.trim();
  settings.lastGeneratedStatusPlaceholderPresent = containsStatusPlaceholder(rawText);
  lastGeneratedThinking = result.blocks;
  settings.lastGeneratedThinking = result.blocks;
  settings.lastGenerationError = null;
  $t('#st-esg-preview').val(settings.lastGenerated);
  renderGeneratedThinking();
  renderGenerationResultPanel();
  resizeGeneratedPreview();
  return settings.lastGenerated;
}

async function buildMessages(latestMessage) {
  const context = getContext();
  const components = getEnabledComponents();
  const promptSourceItems = await ensurePromptSourceItemsForGeneration();
  const templateStats = { enabled: Boolean(settings.promptTemplateCompatEnabled), renderCount: 0, changedCount: 0 };
  const messages = await buildExternalStatusbarMessages({
    targetWindow,
    context,
    latestMessage,
    taskPrompt: settings.taskPrompt,
    components,
    promptSourceItems,
    worldbookSourceControlled: getSourceMode('worldbook') === SOURCE_MODE_PROMPT || getPromptSourceSnapshotItems('worldbook').length > 0,
    historyCleanupTags: settings.historyCleanupTags,
    substituteParams: context.substituteParams,
    taskPlacement: { enabled: settings.taskPlacementEnabled, afterSourceId: settings.taskPlacementAfterSourceId },
    replaceLastUserMessageWithTask: settings.replaceLastUserMessageWithTask,
    omitOriginalUserMessages: settings.omitOriginalUserMessages,
    renderTemplate: null,
    baiBaiBook: {
      api: getBaiBaiBookApi(targetWindow),
      context,
      substituteParams: context.substituteParams,
      includeHistory: settings.baiBaiBookHistoryEnabled,
      includeState: settings.baiBaiBookStateEnabled,
    },
  });
  if (settings.promptTemplateCompatEnabled) {
    for (const message of messages) {
      const source = String(message?.content ?? '');
      const rendered = await renderPromptTemplate({ targetWindow, content: source, enabled: true });
      templateStats.renderCount += 1;
      if (rendered !== source) templateStats.changedCount += 1;
      message.content = rendered;
    }
  }
  lastRuntimeDiagnostics = createRuntimePromptDiagnostics({ context, promptSourceItems: messages.promptSourceItems || promptSourceItems, runtimeInsertions: messages.runtimeInsertions });
  lastRuntimeDiagnostics.promptTemplateCompat = {
    ...templateStats,
    status: !templateStats.enabled
      ? 'disabled'
      : (templateStats.changedCount > 0 ? 'rendered' : 'rendered-unchanged'),
    scope: 'allMessages',
  };
  return messages;
}

function setGeneratingState(isGenerating) {
  const button = $t('#st-esg-generate');
  if (!button.length) return;
  button.find('i').attr('class', isGenerating ? 'fa-solid fa-stop' : 'fa-solid fa-sparkles');
  button.find('span').text(isGenerating ? '停止生成' : '生成文尾组件');
}

async function callExternalApi(latestMessage, signal) {
  const apiUrl = normalizeChatCompletionsUrl(settings.apiUrl);
  const model = textOf(settings.apiModel);
  if (!apiUrl || !model) throw new Error('请先在“API 设置”里填写 API 地址和模型名称。');
  const numeric = parseApiNumericSettings(settings);
  const additional = parseApiAdditionalParameters(settings, yaml);
  const builtMessages = await buildMessages(latestMessage);
  const messages = settings.compressSystemMessages ? mergeConsecutiveSystemMessages(builtMessages) : builtMessages;
  const { body, headers } = buildApiRequestParts(
    {
      model,
      messages,
      max_tokens: numeric.maxTokens,
      temperature: numeric.temperature,
      stream: Boolean(settings.streamingEnabled),
    },
    {
      'Content-Type': 'application/json',
      ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
    },
    additional,
  );
  const streamingEnabled = Boolean(body.stream);
  lastPromptLogText = createPromptLog({ apiUrl, apiKey: settings.apiKey, model, maxTokens: String(numeric.maxTokens), temperature: String(numeric.temperature), messages, extensionVersion: EXTENSION_VERSION, runtimeDiagnostics: lastRuntimeDiagnostics, compressSystemMessages: settings.compressSystemMessages });
  settings.lastPromptLog = '';
  saveSettings();
  renderPromptLog();
  console.log(`[${EXTENSION_ID}] prompt log`, { summary: createPromptLogViewModel(lastPromptLogText).summary, diagnostics: lastRuntimeDiagnostics });
  const response = await fetch(apiUrl, {
    method: 'POST',
    signal,
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) throw markGenerationResponseError(new Error(`API 请求失败：${response.status} ${(await response.text().catch(() => '')).slice(0, 160)}`));
  if (streamingEnabled) {
    const streamed = await readOpenAiStream(response, (_, fullText) => {
      applyGeneratedResult(fullText);
      switchTab('workspace');
    });
    if (!streamed.trim()) throw markGenerationResponseError(new Error('API 返回为空。'));
    return streamed;
  }
  const data = await response.json().catch((error) => { throw markGenerationResponseError(error); });
  const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';
  if (!content.trim()) throw markGenerationResponseError(new Error('API 返回为空。'));
  return content;
}

function injectStatusbar(message, text) {
  const rawStatusbarText = settings.lastGeneratedStatusPlaceholderPresent
    ? `${text}\n${STATUS_PLACEHOLDER_TAG}`
    : text;
  message.mes = injectStatusbarText(message.mes, text, {
    mode: settings.injectMode,
    normalizeStatusPlaceholder: settings.statusPlaceholderEnabled,
    rawStatusbarText,
  });
}

async function generateStatusbar(entryType = 'manual', targetMessageIndex = null) {
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
  const context = getContext();
  const latest = targetMessageIndex === null
    ? getLatestAssistantMessage(context.chat)
    : getAssistantMessageAtIndex(context.chat, targetMessageIndex);
  if (!latest) {
    const error = new Error('没有找到可用于生成的助手回复。');
    notifyStatus(error.message, 'warning');
    return '';
  }
  notifyStatus('正在生成文尾组件……', 'info');
  generationAbortController = new AbortController();
  setGeneratingState(true);
  let result = '';
  try {
    if (!settings.apiUrl || !settings.apiModel) {
      notifyStatus('请先在“API 配置”里填写 API 地址和模型名称。', 'warning');
      return '';
    }
    result = await callExternalApi(latest.message, generationAbortController.signal);
  }
  catch (error) {
    if (error?.name === 'AbortError') {
      notifyStatus('已停止生成。提示词查看器内容已保留。', 'warning');
    } else if (isGenerationResponseError(error)) {
      recordGenerationError('生成', error);
      notifyStatus(error?.message || '生成失败。', 'error');
    } else {
      notifyStatus(error?.message || '生成失败。', 'error');
    }
    return '';
  } finally {
    generationAbortController = null;
    setGeneratingState(false);
  }
  applyGeneratedResult(result);
  saveSettings();
  switchTab('workspace');
  if (settings.autoInject && result) await injectGeneratedStatusbar(latest.index);
  else notifyStatus('已生成文尾组件内容，等待检查或注入。');
  return settings.lastGenerated;
}

async function injectGeneratedStatusbar(targetMessageIndex = null) {
  const context = getContext();
  const latest = targetMessageIndex === null
    ? getLatestAssistantMessage(context.chat)
    : getAssistantMessageAtIndex(context.chat, targetMessageIndex);
  if (!latest) {
    const error = new Error('没有找到可注入的助手回复。');
    notifyStatus(error.message, 'warning');
    return;
  }
  try {
    const text = settings.lastGenerated || $t('#st-esg-preview').val() || await generateStatusbar('manual', targetMessageIndex);
    if (!text) return;
    const injectedText = cleanGeneratedText(text);
    injectStatusbar(latest.message, injectedText);
    if (Array.isArray(latest.message.swipes) && Number.isInteger(latest.message.swipe_id)) latest.message.swipes[latest.message.swipe_id] = latest.message.mes;
    if (settings.mvuReprocessOnInject && containsMvuUpdateVariable(injectedText)) {
      try {
        await reprocessMvuVariables(context, latest.index);
      } catch (error) {
        console.warn(`[${EXTENSION_ID}] failed to reprocess MVU variables after injection`, error);
      }
    }
    context.updateMessageBlock(latest.index, latest.message);
    const messageUpdatedEvent = context.eventTypes?.MESSAGE_UPDATED;
    if (messageUpdatedEvent && context.eventSource?.emit) {
      await context.eventSource.emit(messageUpdatedEvent, latest.index);
    }
    try {
      const saveResult = await context.saveChat();
      if (saveResult === false) throw new Error('聊天保存接口返回失败');
      notifyStatus('已注入到最新助手回复。');
    } catch (saveError) {
      notifyStatus('已注入，但聊天保存失败，刷新后可能丢失。', 'warning');
    }
  } catch (error) {
    notifyStatus(error?.message || '注入失败。', 'error');
  }
}

async function handleAssistantMessageReceived(messageId) {
  const context = getContext();
  const targetMessageIndex = resolveAutomaticAssistantMessageIndex(messageId, context.chat);
  if (!settings.autoGenerate || targetMessageIndex === null) return;
  await generateStatusbar('automatic', targetMessageIndex);
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
  saveSettings();
  renderGenerationResultPanel();
  switchTab('workspace');
}

function renderGenerationResultPanel() {
  const error = settings.lastGenerationError;
  const preview = $t('#st-esg-preview');
  const thinking = $t('#st-esg-thinking-panel');
  const panel = $t('#st-esg-generation-error');
  if (!preview.length || !panel.length) return;
  const card = preview.closest('.st-esg-card');
  card.find('.st-esg-generation-result-title').text(error ? '报错日志' : '生成内容');
  card.find('.st-esg-generation-result-desc').text(error ? '本次操作未完成。请根据错误详情检查后再次尝试。' : '这里是文尾组件生成结果。你可以先检查，再注入回复文尾末尾。');
  preview.toggleClass('st-esg-hidden', Boolean(error));
  thinking.toggleClass('st-esg-hidden', Boolean(error));
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
  if (!lastPromptLogText) {
    summaryBox.html('<span>暂无提示词查看记录</span>');
    viewBox.html('<div class="st-esg-empty st-esg-empty-small">生成一次文尾组件后，这里会按消息分栏显示最终发送给 API 的提示词。</div>');
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
  const key = TAG_RULE_CONFIG[type]?.setting;
  return String(settings[key] || '').split('\n').map((item) => item.trim()).filter(Boolean);
}

function saveTagRuleEntries(type, entries) {
  const key = TAG_RULE_CONFIG[type]?.setting;
  settings[key] = entries.join('\n');
  saveSettings();
}

function buildTagRuleManager(type) {
  const config = TAG_RULE_CONFIG[type];
  return `<div class="st-esg-tag-rule-manager" data-tag-rule-type="${type}"><div class="st-esg-tag-rule-head"><span>${config.title}</span><i class="fa-solid fa-circle-question" title="${config.description} 普通标签匹配成对标签；正则匹配完整内容。"></i></div><div class="st-esg-tag-rule-add"><select id="st-esg-${type}-rule-mode" class="text_pole"><option value="tag">标签</option><option value="regex">正则</option></select><input id="st-esg-${type}-rule-input" class="text_pole" type="text" placeholder="thinking" /><button id="st-esg-${type}-rule-add" class="menu_button st-esg-secondary-action st-esg-tag-rule-add-button" type="button" title="添加规则"><i class="fa-solid fa-plus"></i></button></div><div id="st-esg-${type}-rule-list" class="st-esg-tag-rule-list"></div></div>`;
}

function renderTagRuleManager(type) {
  const list = $t(`#st-esg-${type}-rule-list`);
  if (!list.length) return;
  const entries = getTagRuleEntries(type);
  list.html(entries.map((entry, index) => {
    const isRegex = entry.startsWith('re:');
    const display = isRegex ? entry.slice(3) : `<${entry}>...</${entry}>`;
    return `<div class="st-esg-tag-rule-item"><span class="st-esg-tag-rule-kind">${isRegex ? '正则' : '标签'}</span><code>${escapeHtml(display)}</code><button class="menu_button st-esg-tag-rule-delete" type="button" data-rule-index="${index}" title="删除规则"><i class="fa-solid fa-trash"></i></button></div>`;
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
  if (!entries.includes(value)) entries.push(value);
  saveTagRuleEntries(type, entries);
  input.val('');
  renderTagRuleManager(type);
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
    const additional = parseApiAdditionalParameters(settings, yaml);
    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
        ...additional.additionalHeaders,
      },
    });
    if (!response.ok) throw new Error(`拉取模型失败：${response.status} ${(await response.text().catch(() => '')).slice(0, 160)}`);
    const models = extractModelIds(await response.json());
    if (!models.length) throw new Error('没有从接口返回中识别到模型。');
    settings.apiModelOptions = models;
    if (!textOf(settings.apiModel)) settings.apiModel = models[0];
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
};

function isWorldbookGroup(group) {
  return group?.scope === SOURCE_WORLDBOOK;
}

function renderSchemeManager(type) {
  const label = SCHEME_CONFIG[type]?.label || '方案';
  return `<div class="st-esg-scheme-group" data-scheme-type="${type}"><label class="st-esg-scheme-picker"><span>方案：</span><select id="st-esg-${type}-scheme" class="text_pole st-esg-scheme-select" data-scheme-type="${type}"></select></label><div class="st-esg-scheme-actions"><button class="st-esg-icon-btn st-esg-load-scheme" type="button" title="载入方案" aria-label="载入方案" data-scheme-type="${type}"><i class="fa-solid fa-download"></i></button><button class="st-esg-icon-btn st-esg-save-scheme-new" type="button" title="另存方案" aria-label="另存方案" data-scheme-type="${type}"><i class="fa-solid fa-plus"></i></button><button class="st-esg-icon-btn st-esg-overwrite-scheme" type="button" title="覆盖方案" aria-label="覆盖方案" data-scheme-type="${type}"><i class="fa-solid fa-file-pen"></i></button><button class="st-esg-icon-btn st-esg-delete-scheme st-esg-icon-danger" type="button" title="删除方案" aria-label="删除方案" data-scheme-type="${type}"><i class="fa-solid fa-trash"></i></button></div></div>`;
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
    ? '未保存方案，默认使用当前修改后内容'
    : id === WORLD_BOOK_FOLLOW_TAVERN
      ? '酒馆默认'
      : findScheme(getSchemeList(type), id)?.name || '未选择方案';
  current.textContent = `当前方案：${label}`;
}

function markSchemeDirty(type) {
  if (!SCHEME_CONFIG[type]) return;
  setSelectedSchemeId(type, '');
  setActiveSchemeId(type, '');
  settings.dirtySchemeTypes[type] = true;
  renderSchemeOptions(type);
  saveSettings();
}

function markSchemeClean(type, id) {
  setActiveSchemeId(type, id);
  settings.dirtySchemeTypes[type] = false;
  if (type === 'preset' && initialized) renderComponentList();
}

function requestTextInputDialog({ title, label, placeholder = '', value = '', options = null }) {
  return new Promise((resolve) => {
    const dialog = targetDoc.createElement('dialog');
    dialog.className = `st-esg-scheme-name-dialog st-esg-theme-${settings.theme === 'light' ? 'light' : 'dark'}`;
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
  dialog.className = `st-esg-api-additional-dialog st-esg-theme-${settings.theme === 'light' ? 'light' : 'dark'}`;
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
  dialog.querySelector('form').addEventListener('submit', (event) => {
    event.preventDefault();
    const draft = {
      additionalBodyYaml: includeBody.value,
      excludedBodyYaml: excludeBody.value,
      additionalHeadersYaml: includeHeaders.value,
    };
    try {
      parseApiAdditionalParameters(draft, yaml);
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
  return getActiveSchemeId('worldbook') === WORLD_BOOK_FOLLOW_TAVERN;
}

function isFollowingTavernPreset() {
  return getActiveSchemeId('preset') === WORLD_BOOK_FOLLOW_TAVERN;
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
  return captureSchemeSnapshot(type, settings, importGroups, { isWorldbookGroup });
}

function applyApiScheme(snapshot) {
  Object.assign(settings, {
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
  });
  $t('#st-esg-api-url').val(settings.apiUrl);
  $t('#st-esg-api-key').val(settings.apiKey);
  $t('#st-esg-api-model').val(settings.apiModel);
  $t('#st-esg-max-tokens').val(settings.maxTokens);
  $t('#st-esg-temperature').val(settings.temperature);
  $t('#st-esg-streaming-enabled').prop('checked', settings.streamingEnabled);
  $t('#st-esg-prompt-template-compat').prop('checked', settings.promptTemplateCompatEnabled);
  renderModelOptions();
}

function applyTaskScheme(snapshot) {
  settings.taskPrompt = String(snapshot.taskPrompt || '');
  $t('#st-esg-task').val(settings.taskPrompt);
  resizeTaskPrompt();
}

async function applyPresetScheme(snapshot) {
  setSourceMode('preset', snapshot.sourceMode);
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
  Object.assign(settings.importSelections, snapshot.importSelections || {});
  Object.assign(settings.sourceContentOverrides, snapshot.sourceContentOverrides || {});
  $t('#st-esg-replace-last-user-message').prop('checked', settings.replaceLastUserMessageWithTask);
  $t('#st-esg-omit-original-user-messages').prop('checked', settings.omitOriginalUserMessages);
  renderImportCandidates();
  renderTaskPlacementOptions();
}

async function applyWorldbookScheme(snapshot) {
  setSourceMode('worldbook', snapshot.sourceMode);
  renderSourceModeUi();
  const wanted = getWorldbookSchemeSourceNames(snapshot);
  settings.promptSelections = clearImportSelectionsForScope(settings.promptSelections, SOURCE_WORLDBOOK);
  settings.importSelections = clearImportSelectionsForScope(settings.importSelections, SOURCE_WORLDBOOK);
  settings.sourceContentOverrides = clearImportSelectionsForScope(settings.sourceContentOverrides, SOURCE_WORLDBOOK);
  settings.worldbookActivationOverrides = clearImportSelectionsForScope(settings.worldbookActivationOverrides, SOURCE_WORLDBOOK);
  Object.assign(settings.promptSelections, snapshot.promptSelections || {});
  Object.assign(settings.importSelections, snapshot.importSelections || {});
  Object.assign(settings.sourceContentOverrides, snapshot.sourceContentOverrides || {});
  Object.assign(settings.worldbookActivationOverrides, snapshot.worldbookActivationOverrides || {});
  // Do not eagerly load every book while applying a scheme. Lazy loading restores entry details
  // when they are opened or needed for generation, avoiding a mobile UI freeze on large libraries.
  await scanImportCandidates({ explicitWorldbookSources: wanted, worldbookPromptSelections: settings.promptSelections });
  renderImportCandidates({ renderPreset: false });
}

async function applyFollowTavernWorldbook() {
  settings.worldbookActivationOverrides = {};
  await scanImportCandidates();
  renderImportCandidates({ renderPreset: false });
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
  const name = textOf(worldbookName);
  if (!name) return;
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
    notifyStatus('导入模式下不能修改方案。', 'warning');
    return;
  }
  const list = getSchemeList(type);
  const selectedId = textOf($t(`#st-esg-${type}-scheme`).val());
  if (action === 'new') {
    const name = await requestSchemeName(type);
    if (!name) { notifyStatus('请先输入方案名。', 'warning'); return; }
    const next = saveScheme(list, name, currentSchemeSnapshot(type));
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
    if (!targetWindow.confirm(`确认删除方案“${name}”？此操作无法恢复。`)) return;
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
      await applyFollowTavernWorldbook();
      markSchemeClean(type, selectedId);
      saveSettings();
      renderSchemeOptions(type);
      notifyStatus('已载入世界书酒馆默认。');
      return;
    }
    const scheme = findScheme(list, selectedId);
    if (!scheme) { notifyStatus('请先选择要载入的方案。', 'warning'); return; }
    if (!targetWindow.confirm(`确认载入方案“${scheme.name}”？当前未保存的修改将丢失。`)) return;
    setSelectedSchemeId(type, selectedId);
    await applyScheme(type, scheme.snapshot || {});
    markSchemeClean(type, selectedId);
    renderSchemeOptions(type);
    notifyStatus(`已载入${config.label}方案：${scheme.name}`);
  }
}

function switchTab(tabName) {
  const aliases = { sources: 'preset', api: 'runtime', output: 'workspace' };
  const nextTab = aliases[tabName] || tabName || 'workspace';
  const leavingComponentLibrary = nextTab !== 'components';
  const shouldRefreshComponentLibrary = leavingComponentLibrary
    && (componentEditMode || componentSearchQuery || componentFilterMode !== 'all');
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
  targetDoc.getElementById('st-esg-ball')?.classList.toggle('st-esg-ball-under-panel', shouldOpen);
  applyTheme();
  if (shouldOpen) {
    resetComponentEditMode();
    resetComponentLibraryFilters();
    renderComponentList();
    closeSillyTavernOverlays();
    targetDoc.body.appendChild(dialog);
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    scanImportCandidates().catch(() => {});
    if (settings.activeTab === 'workspace') scheduleGeneratedPreviewResize();
  } else if (dialog.open && typeof dialog.close === 'function') {
    resetComponentEditMode();
    resetComponentLibraryFilters();
    dialog.close();
  } else {
    resetComponentEditMode();
    resetComponentLibraryFilters();
    dialog.removeAttribute('open');
  }
  $t('#st-esg-menu-button').toggleClass('selected', shouldOpen);
  $t('#st-esg-ball').toggleClass('selected', shouldOpen);
}

function suppressNextClickAfterFloatingBallOpen() {
  // The browser dispatches click after pointerup. By then the modal exists at the same coordinates.
  targetDoc.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true, once: true });
}

function renderMagicWandMenuButton(retry = 0) {
  if (targetDoc.getElementById('st-esg-menu-button')) return;
  if (retry > 30) return;
  const menu = targetDoc.getElementById('extensions_menu') || targetDoc.getElementById('extensionsMenu');
  if (!menu) { targetWindow.setTimeout(() => renderMagicWandMenuButton(retry + 1), 500); return; }
  const button = targetDoc.createElement('div');
  button.id = 'st-esg-menu-button';
  button.className = 'list-group-item flex-container flexGap5 interactable';
  button.tabIndex = 0;
  button.title = '外置文尾组件生成器';
  button.innerHTML = '<span><i class="fa-solid fa-wand-magic-sparkles"></i></span><span>文尾组件</span>';
  button.addEventListener('click', () => togglePanel(true));
  menu.prepend(button);
}

function renderFloatingBall() {
  if (!settings.ballVisible) { $t('#st-esg-ball').remove(); return; }
  const existingBall = targetDoc.getElementById('st-esg-ball');
  if (existingBall) {
    applyFloatingBallPosition(existingBall);
    existingBall.classList.toggle('st-esg-ball-under-panel', Boolean(getDialog()?.open));
    return;
  }
  const ball = targetDoc.createElement('div');
  ball.id = 'st-esg-ball';
  ball.title = '外置文尾组件生成器';
  ball.innerHTML = '<i class="fa-solid fa-layer-group"></i>';
  const theme = settings.theme === 'light' ? 'light' : 'dark';
  applyThemeClass(ball, theme);
  applyFloatingBallPosition(ball);
  ball.classList.toggle('st-esg-ball-under-panel', Boolean(getDialog()?.open));
  targetDoc.body.appendChild(ball);
  let dragging = false, moved = false, startX = 0, startY = 0, originLeft = 0, originTop = 0;
  const onMove = (event) => {
    if (!dragging) return;
    const dx = event.clientX - startX, dy = event.clientY - startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    ball.style.left = `${clamp(originLeft + dx, 0, targetWindow.innerWidth - FLOATING_BALL_SIZE)}px`;
    ball.style.top = `${clamp(originTop + dy, 0, targetWindow.innerHeight - FLOATING_BALL_SIZE)}px`;
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    targetWindow.removeEventListener('pointermove', onMove);
    targetWindow.removeEventListener('pointerup', onUp);
    const left = Number.parseFloat(ball.style.left);
    const top = Number.parseFloat(ball.style.top);
    settings.ballX = Number.isFinite(left) ? left : 16;
    settings.ballY = Number.isFinite(top) ? top : 16;
    saveSettings();
    if (!moved) {
      suppressNextClickAfterFloatingBallOpen();
      togglePanel(true);
    }
  };
  ball.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault(); dragging = true; moved = false;
    startX = event.clientX; startY = event.clientY;
    const left = Number.parseFloat(ball.style.left);
    const top = Number.parseFloat(ball.style.top);
    originLeft = Number.isFinite(left) ? left : 16;
    originTop = Number.isFinite(top) ? top : 16;
    targetWindow.addEventListener('pointermove', onMove); targetWindow.addEventListener('pointerup', onUp);
  });
}

function renderComponentListToolbar() {
  return `<div class="st-esg-list-toolbar st-esg-component-list-toolbar"><input type="text" class="st-esg-search-input st-esg-component-search-input text_pole" placeholder="搜索组件..." value="${escapeHtml(componentSearchQuery)}"><select class="st-esg-filter-select st-esg-component-filter-select text_pole"><option value="all" ${componentFilterMode === 'all' ? 'selected' : ''}>全部</option><option value="enabled" ${componentFilterMode === 'enabled' ? 'selected' : ''}>仅启用</option><option value="disabled" ${componentFilterMode === 'disabled' ? 'selected' : ''}>仅禁用</option></select><span class="st-esg-list-count"></span></div>`;
}

function getFloatingBallPosition() {
  return resolveFloatingBallPosition({
    savedLeft: settings.ballX,
    savedTop: settings.ballY,
    viewportWidth: targetWindow.innerWidth,
    viewportHeight: targetWindow.innerHeight,
    ballSize: FLOATING_BALL_SIZE,
  });
}

function applyFloatingBallPosition(ball) {
  const position = getFloatingBallPosition();
  ball.style.left = `${position.left}px`;
  ball.style.top = `${position.top}px`;
  ball.style.removeProperty('bottom');
  if (settings.ballX !== position.left || settings.ballY !== position.top) {
    settings.ballX = position.left;
    settings.ballY = position.top;
    saveSettings();
  }
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

function renderComponentList() {
  const list = $t('#st-esg-component-list');
  if (!list.length) return;
  pruneSelectedComponentIds();
  const componentViewState = captureComponentLibraryViewState();
  const openFolderStateIds = componentViewState.openFolders;
  const openComponentIds = componentViewState.openItems;
  const editButton = componentEditMode ? '' : '<button class="menu_button menu_button_icon st-esg-secondary-action st-esg-component-edit-toggle" type="button"><i class="fa-solid fa-pen-to-square"></i><span>编辑</span></button>';
  const editToolbar = componentEditMode ? '<div class="st-esg-component-edit-toolbar"><span class="st-esg-component-edit-selection-count">未选择项目</span><span class="st-esg-component-batch-actions"><button class="menu_button menu_button_icon st-esg-secondary-action st-esg-component-batch-move" type="button" title="移动到分组" aria-label="移动到分组" disabled><i class="fa-solid fa-folder-open"></i><span>移动到</span></button><button class="menu_button menu_button_icon st-esg-secondary-action st-esg-icon-danger st-esg-component-batch-delete" type="button" title="删除选中组件" aria-label="删除选中组件" disabled><i class="fa-solid fa-trash"></i><span>删除</span></button><button class="menu_button menu_button_icon st-esg-secondary-action st-esg-component-edit-exit" type="button" title="退出编辑" aria-label="退出编辑"><i class="fa-solid fa-check"></i><span>退出</span></button></span></div>' : '';
  const wrapLibrary = (content) => `<div class="st-esg-card st-esg-component-library-card"><div class="st-esg-card-head"><div class="st-esg-card-title">组件库</div>${editButton}</div>${editToolbar}${renderComponentListToolbar()}${content}</div>`;
  settings.components = settings.components.map((item) => normalizeComponent(item, targetWindow, getContext()));
  const sections = [
    { scope: COMPONENT_SCOPE_GLOBAL, title: '全局组件', desc: '启用后始终参与文尾组件生成。' },
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
      const isOpen = openComponentIds.has(item.id);
      const control = componentEditMode
        ? `<label class="st-esg-checkbox st-esg-component-select-label" title="选择组件"><input class="st-esg-component-select" type="checkbox" data-component-id="${escapeHtml(item.id)}" aria-label="选择组件" ${selectedComponentIds.has(item.id) ? 'checked' : ''} /></label>`
        : `<label class="st-esg-switch st-esg-switch-sm"><input class="st-esg-component-enabled" type="checkbox" ${item.enabled === false ? '' : 'checked'} /><span></span></label>`;
      const actions = componentEditMode
        ? `<span class="st-esg-component-item-actions"><button class="st-esg-icon-btn st-esg-component-move-up" type="button" title="上移" aria-label="上移" ${siblingPosition <= 0 ? 'disabled' : ''}><i class="fa-solid fa-chevron-up"></i></button><button class="st-esg-icon-btn st-esg-component-move-down" type="button" title="下移" aria-label="下移" ${siblingPosition < 0 || siblingPosition >= siblingIndexes.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-down"></i></button><button class="st-esg-icon-btn st-esg-component-move-to" type="button" title="移动到分组" aria-label="移动到分组"><i class="fa-solid fa-folder-open"></i></button><button class="st-esg-icon-btn st-esg-icon-danger st-esg-component-delete" type="button" title="删除组件" aria-label="删除组件"><i class="fa-solid fa-trash"></i></button></span>`
        : '';
      return `<details class="st-esg-component-item" data-component-id="${escapeHtml(item.id)}" ${isOpen ? 'open' : ''}><summary class="st-esg-component-item-head"><span class="st-esg-component-name">${escapeHtml(item.name || '未命名组件')}</span>${control}${actions}</summary><div class="st-esg-component-preview" data-loaded="${isOpen ? 'true' : 'false'}">${isOpen ? renderComponentPreview(item) : ''}</div></details>`;
    };
    const defaultGroup = { groupId: '', name: '默认分组', enabled: settings.defaultGroupEnabled?.[section.scope] !== false, items: library.ungrouped, isDefault: true };
    const groupHtml = [...library.groups, defaultGroup].map((group) => {
      const folderStateId = `${section.scope}::${group.isDefault ? '__default__' : group.groupId}`;
      const groupEnabled = group.enabled !== false;
      const enabledCount = group.items.filter((item) => item.enabled !== false).length;
      const control = componentEditMode
        ? `<label class="st-esg-checkbox st-esg-component-select-label" title="选择本组"><input class="st-esg-component-group-select" type="checkbox" data-group-id="${escapeHtml(group.groupId)}" data-default-group-scope="${group.isDefault ? escapeHtml(section.scope) : ''}" aria-label="选择本组" /></label>`
        : group.isDefault
          ? `<label class="st-esg-switch st-esg-switch-sm" title="启用默认分组"><input class="st-esg-component-default-group-enabled" type="checkbox" data-scope="${escapeHtml(section.scope)}" ${groupEnabled ? 'checked' : ''} /><span></span></label>`
          : `<label class="st-esg-switch st-esg-switch-sm" title="启用此分组"><input class="st-esg-component-group-enabled" type="checkbox" data-group-id="${escapeHtml(group.groupId)}" ${groupEnabled ? 'checked' : ''} /><span></span></label>`;
      const { groupPosition, siblingGroups } = group.isDefault ? { groupPosition: -1, siblingGroups: [] } : getComponentGroupSiblingGroups(group.groupId);
      const actions = componentEditMode ? (group.isDefault ? '' : `<span class="st-esg-component-group-actions"><button class="st-esg-icon-btn st-esg-component-group-move-up" type="button" data-group-id="${escapeHtml(group.groupId)}" title="上移分组" aria-label="上移分组" ${groupPosition <= 0 ? 'disabled' : ''}><i class="fa-solid fa-chevron-up"></i></button><button class="st-esg-icon-btn st-esg-component-group-move-down" type="button" data-group-id="${escapeHtml(group.groupId)}" title="下移分组" aria-label="下移分组" ${groupPosition < 0 || groupPosition >= siblingGroups.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-down"></i></button><button class="st-esg-icon-btn st-esg-component-group-rename" type="button" data-group-id="${escapeHtml(group.groupId)}" title="重命名分组" aria-label="重命名分组"><i class="fa-solid fa-pen"></i></button><button class="st-esg-icon-btn st-esg-icon-danger st-esg-component-group-delete" type="button" data-group-id="${escapeHtml(group.groupId)}" title="删除分组" aria-label="删除分组"><i class="fa-solid fa-trash"></i></button></span>`) : '';
      const body = group.items.length ? group.items.map(renderComponentItem).join('') : '<div class="st-esg-empty st-esg-empty-small">暂无组件</div>';
      return `<details class="st-esg-component-folder${groupEnabled ? '' : ' st-esg-component-folder-is-disabled'}" data-group-id="${escapeHtml(group.groupId)}" data-default-group="${group.isDefault ? 'true' : 'false'}" data-folder-state-id="${escapeHtml(folderStateId)}" ${openFolderStateIds.has(folderStateId) ? 'open' : ''}><summary class="st-esg-component-folder-head"><span class="st-esg-component-folder-title">${escapeHtml(group.name)}</span><em class="st-esg-component-folder-count${groupEnabled ? '' : ' is-disabled'}">${enabledCount}/${group.items.length}</em>${control}${actions}<i class="fa-solid fa-chevron-down st-esg-component-folder-caret"></i></summary><div class="st-esg-component-folder-body">${body}</div></details>`;
    }).join('');
    const sectionContent = groupHtml;
    const createGroupButton = componentEditMode ? `<button class="st-esg-icon-btn st-esg-component-group-create" type="button" data-scope="${escapeHtml(section.scope)}" title="新建分组" aria-label="新建分组"><i class="fa-solid fa-folder-plus"></i></button>` : '';
    return `<details class="st-esg-component-section" open><summary class="st-esg-component-section-head"><div><span class="st-esg-import-group-title">${section.title}</span><i class="fa-solid fa-circle-question st-esg-component-section-info" title="${escapeHtml(section.desc)}"></i>${createGroupButton}</div><em>${count} 个</em></summary><div class="st-esg-component-section-body">${sectionContent}</div></details>`;
  }).join('')));
  list.find('.st-esg-component-section-info').remove();
  const currentPresetSchemeName = getPresetSchemeById(getActiveSchemeId('preset'))?.name || '未保存方案';
  list.find('.st-esg-component-section').eq(1).find('.st-esg-import-group-title').after(`<small class="st-esg-component-section-context">当前预设：${escapeHtml(currentPresetSchemeName)}</small>`);
  const currentCharacterName = getCurrentCharacterNameSafe(getContext()) || '未选择角色';
  list.find('.st-esg-component-section').eq(2).find('.st-esg-import-group-title').after(`<small class="st-esg-component-section-context">当前角色：${escapeHtml(currentCharacterName)}</small>`);
  saveSettings();
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
    applyComponentListFilters();
  });
  list.find('.st-esg-component-filter-select').on('change', function () {
    componentFilterMode = String($(this).val() || 'all');
    applyComponentListFilters();
  });
  list.find('.st-esg-component-batch-move').on('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    pruneSelectedComponentIds();
    const selectedComponents = settings.components.filter((component) => selectedComponentIds.has(textOf(component?.id)));
    const scopes = new Set(selectedComponents.map((component) => normalizeComponentScope(component.scope)));
    if (!selectedComponents.length) return;
    if (scopes.size !== 1) { notifyStatus('所选组件属于不同归属，请分别移动。', 'warning'); return; }
    const [scope] = scopes;
    const groups = settings.componentGroups.filter((group) => normalizeComponentScope(group?.scope) === scope);
    if (!groups.length && selectedComponents.every((component) => !textOf(component?.groupId))) { notifyStatus('所选组件已在默认分组中，请先创建其他分组。', 'warning'); return; }
    const selected = await requestTextInputDialog({
      title: '移动组件',
      label: '目标分组',
      value: DEFAULT_COMPONENT_GROUP_VALUE,
      options: [{ value: DEFAULT_COMPONENT_GROUP_VALUE, label: '默认分组' }, ...groups.map((group) => ({ value: group.id, label: group.name }))],
    });
    if (!selected) return;
    if (!moveComponentsToGroup(selectedComponents.map((component) => component.id), selected === DEFAULT_COMPONENT_GROUP_VALUE ? '' : selected)) return;
    selectedComponentIds.clear();
    saveSettings();
    renderComponentList();
    notifyStatus('已移动选中的组件。');
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
  list.find('.st-esg-component-move-to').on('click', async function (event) {
    event.preventDefault();
    const componentId = textOf($(this).closest('.st-esg-component-item').attr('data-component-id'));
    const component = findComponentById(componentId);
    if (!component) return;
    const scope = normalizeComponentScope(component.scope);
    const groups = settings.componentGroups.filter((group) => normalizeComponentScope(group?.scope) === scope);
    if (!groups.length && !textOf(component.groupId)) { notifyStatus('组件已在默认分组中，请先创建其他分组。', 'warning'); return; }
    const currentValue = textOf(component.groupId) || DEFAULT_COMPONENT_GROUP_VALUE;
    const selected = await requestTextInputDialog({
      title: '移动组件',
      label: '目标分组',
      value: currentValue,
      options: [{ value: DEFAULT_COMPONENT_GROUP_VALUE, label: '默认分组' }, ...groups.map((group) => ({ value: group.id, label: group.name }))],
    });
    if (!selected) return;
    if (!moveComponentToGroup(componentId, selected === DEFAULT_COMPONENT_GROUP_VALUE ? '' : selected)) return;
    saveSettings();
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
    if (!this.open) return;
    const preview = this.querySelector('.st-esg-component-preview');
    if (!preview || preview.dataset.loaded === 'true') return;
    const item = findComponentById($(this).attr('data-component-id'));
    if (!item) return;
    preview.innerHTML = renderComponentPreview(item);
    preview.dataset.loaded = 'true';
  });
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
    renderComponentList();
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
}

function addComponent() {
  const name = textOf($t('#st-esg-component-name').val());
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
  const scopeSelect = sourceType === 'worldbook' ? '#st-esg-worldbook-import-target-scope' : '#st-esg-import-target-scope';
  const scope = textOf($t(scopeSelect).val()) || COMPONENT_SCOPE_GLOBAL;
  const presetSchemeId = scope === COMPONENT_SCOPE_PRESET
    ? textOf($t(sourceType === 'worldbook' ? '#st-esg-worldbook-import-preset-scheme' : '#st-esg-import-preset-scheme').val())
    : '';
  if (scope === COMPONENT_SCOPE_PRESET && !getPresetSchemeById(presetSchemeId)) {
    notifyStatus('请先选择要绑定的预设方案。', 'warning');
    return null;
  }
  const presetScheme = getPresetSchemeById(presetSchemeId);
  return { scope, presetSchemeId, bindName: scope === COMPONENT_SCOPE_PRESET ? presetScheme.name : getComponentBindingName(scope, targetWindow, getContext()) };
}

function resetComponentEditMode() {
  componentEditMode = false;
  selectedComponentIds.clear();
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

function moveComponentToGroup(componentId, targetGroupId) {
  const sourceIndex = settings.components.findIndex((item) => textOf(item?.id) === textOf(componentId));
  const component = settings.components[sourceIndex];
  if (!component) return false;
  const scope = normalizeComponentScope(component.scope);
  const groupId = textOf(targetGroupId);
  if (groupId && !settings.componentGroups.some((group) => textOf(group?.id) === groupId && normalizeComponentScope(group?.scope) === scope)) return false;
  if (textOf(component.groupId) === groupId) return false;
  settings.components.splice(sourceIndex, 1);
  component.groupId = groupId;
  let insertIndex = settings.components.length;
  settings.components.forEach((item, index) => {
    if (normalizeComponentScope(item?.scope) === scope && textOf(item?.groupId) === groupId) insertIndex = index + 1;
  });
  settings.components.splice(insertIndex, 0, component);
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

function getPromptSourceSnapshotItems(type) {
  const snapshot = settings.promptSourceSnapshots?.[getSourceType(type)];
  return Array.isArray(snapshot?.items) ? snapshot.items : [];
}

function clearImportSelections(type) {
  const sourceType = getSourceType(type);
  const sourceScope = sourceType === 'worldbook' ? SOURCE_WORLDBOOK : SOURCE_PRESET;
  settings.importSelections = clearImportSelectionsForScope(settings.importSelections, sourceScope);
}

async function capturePromptSourceSnapshot(type) {
  const sourceType = getSourceType(type);
  const items = await ensurePromptSourceItemsForGeneration({ refreshSources: false });
  settings.promptSourceSnapshots[sourceType] = {
    items: items.filter((item) => getSourceType(item) === sourceType),
  };
}

async function changeSourceMode(type, mode) {
  const sourceType = getSourceType(type);
  const nextMode = mode === SOURCE_MODE_IMPORT ? SOURCE_MODE_IMPORT : SOURCE_MODE_PROMPT;
  if (nextMode === SOURCE_MODE_IMPORT && getSourceMode(sourceType) !== SOURCE_MODE_IMPORT) {
    await capturePromptSourceSnapshot(sourceType);
    clearImportSelections(sourceType);
  }
  if (nextMode === SOURCE_MODE_PROMPT) settings.promptSourceSnapshots[sourceType] = null;
  setSourceMode(sourceType, nextMode);
  saveSettings();
  renderSourceModeUi();
  if (!importGroups.length) await scanImportCandidates();
  else renderImportCandidates({ renderPreset: sourceType === 'preset', renderWorldbook: sourceType === 'worldbook' });
}

function getSourceSelectionStore(item) {
  return getSourceMode(item) === SOURCE_MODE_IMPORT ? settings.importSelections : settings.promptSelections;
}

function getSourceSelection(item) {
  if (item?.locked) return item.enabled !== false;
  const store = getSourceSelectionStore(item);
  if (Object.prototype.hasOwnProperty.call(store, item.key)) return store[item.key] !== false;
  return getSourceMode(item) === SOURCE_MODE_PROMPT ? item.enabled !== false : false;
}

function setSourceSelection(item, checked) {
  if (!item?.key || item?.locked) return;
  const sourceType = item?.scope === SOURCE_WORLDBOOK ? 'worldbook' : 'preset';
  getSourceSelectionStore(item)[item.key] = Boolean(checked);
  if (getSourceMode(sourceType) === SOURCE_MODE_PROMPT) markSchemeDirty(sourceType);
  saveSettings();
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
  const promptGroups = groups.filter((group) => getSourceMode(group) === SOURCE_MODE_PROMPT);
  const before = JSON.stringify(settings.promptSelections || {});
  settings.promptSelections = syncPromptSelectionsFromGroups(promptGroups, settings.promptSelections, (group) => isWorldbookGroup(group) ? isFollowingTavernWorldbook() : isFollowingTavernPreset());
  if (JSON.stringify(settings.promptSelections || {}) !== before) saveSettings();
  return promptGroups.reduce((sum, group) => sum + (group?.loaded && Array.isArray(group.items) ? group.items.length : 0), 0);
}

async function ensurePromptSourceItemsForGeneration() {
  const currentSignature = getTavernSourceSignature();
  if (promptSourceCache.signature && currentSignature !== promptSourceCache.signature) {
    markPromptSourceStructureDirty(promptSourceCache);
  }
  if (!importGroups.length || promptSourceCache.structureDirty) await scanImportCandidates({ loadWorldbookCounts: false });
  const dirtyWorldbooks = new Set(takeDirtyWorldbookSources(promptSourceCache));
  importGroups
    .filter((group) => group?.scope === SOURCE_WORLDBOOK && dirtyWorldbooks.has(group.source))
    .forEach((group) => {
      group.loaded = false;
      group.loading = false;
      group.items = [];
    });
  const activeWorldbookGroups = importGroups.filter((group) => getSourceMode(group) === SOURCE_MODE_PROMPT && group?.scope === SOURCE_WORLDBOOK && group.category !== 'inactive' && !group.loaded && !group.loading);
  await loadWorldbookSourceGroups(
    activeWorldbookGroups,
    (worldbookName) => collectWorldbookImportCandidates(targetWindow, worldbookName),
  );
  syncPromptSelectionsFromLoadedGroups(activeWorldbookGroups);
  importCandidates = importGroups.flatMap((group) => group.items || []);
  renderImportCandidates({ renderPreset: false });
  const promptGroups = importGroups.filter((group) => getSourceMode(group) === SOURCE_MODE_PROMPT);
  const selected = collectSelectedPromptSourceItems(promptGroups, settings.promptSelections, settings.sourceContentOverrides);
  const sourceItems = isFollowingTavernPreset() && getSourceMode('preset') === SOURCE_MODE_PROMPT
    ? [
      ...selected.filter((item) => item?.scope === SOURCE_WORLDBOOK),
      ...importGroups
        .filter((group) => !isWorldbookGroup(group) && group.loaded)
        .flatMap((group) => group.items || [])
        .filter((item) => item?.enabled !== false),
    ]
    : isFollowingTavernWorldbook() && getSourceMode('worldbook') === SOURCE_MODE_PROMPT
    ? [
      ...selected.filter((item) => item?.scope !== SOURCE_WORLDBOOK),
      ...importGroups
        .filter((group) => isWorldbookGroup(group) && group.category !== 'inactive' && group.loaded)
        .flatMap((group) => group.items || [])
        .filter((item) => item?.enabled !== false),
    ]
    : selected;
  const snapshotItems = ['preset', 'worldbook'].flatMap((type) => (
    getSourceMode(type) === SOURCE_MODE_IMPORT ? getPromptSourceSnapshotItems(type) : []
  ));
  return filterWorldbookPromptItems([...sourceItems, ...snapshotItems], {
    chat: getContext().chat,
    scanDepth: getWorldbookScanDepth(),
    activationModeForItem: isFollowingTavernWorldbook() ? (item) => item?.activationMode : getWorldbookActivationMode,
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
  return `<div class="st-esg-segmented-control-wrapper"><div class="st-esg-segmented-control"><label><input type="radio" name="${radioName}" value="prompt" class="st-esg-mode-radio" checked><span>编辑模式</span></label><label><input type="radio" name="${radioName}" value="import" class="st-esg-mode-radio"><span>导入模式</span></label></div></div>${target}`;
}

function getPresetTaskPlacementItems() {
  return importGroups
    .filter((group) => group?.scope !== SOURCE_WORLDBOOK && group.loaded && Array.isArray(group.items))
    .flatMap((group) => group.items
      .filter((item) => item?.key && (textOf(item.content) || textOf(item.markerType)))
      .map((item) => ({ id: item.key, label: `${group.source || group.group} / ${item.name}` })));
}

function getSourceContentValue(item) {
  if (item?.key && Object.prototype.hasOwnProperty.call(settings.sourceContentOverrides, item.key)) {
    return String(settings.sourceContentOverrides[item.key] ?? '');
  }
  return String(item?.content ?? '');
}

function setSourceContentOverride(item, value) {
  if (!item?.key || item?.locked) return;
  const original = String(item.content ?? '');
  const next = String(value ?? '');
  if (next === original) {
    delete settings.sourceContentOverrides[item.key];
  } else {
    settings.sourceContentOverrides[item.key] = next;
  }
  markSchemeDirty(item?.scope === SOURCE_WORLDBOOK ? 'worldbook' : 'preset');
  saveSettings();
}

function getWorldbookActivationMode(item) {
  const override = item?.key && settings.worldbookActivationOverrides?.[item.key];
  return normalizeWorldbookActivationMode(override || item?.activationMode, 'green');
}

function setWorldbookActivationMode(item, mode) {
  if (!item?.key) return;
  const normalized = normalizeWorldbookActivationMode(mode);
  const nativeMode = normalizeWorldbookActivationMode(item.activationMode, 'green');
  if (normalized === nativeMode) delete settings.worldbookActivationOverrides[item.key];
  else settings.worldbookActivationOverrides[item.key] = normalized;
  markSchemeDirty('worldbook');
  saveSettings();
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
    return `<pre class="st-esg-source-content-preview">${escapeHtml(value || '暂无内容')}</pre>`;
  }
  if (item?.markerType && !value) {
    return '<div class="st-esg-empty st-esg-empty-small">运行时插入，无可编辑内容。</div>';
  }
  const textarea = `<textarea class="text_pole textarea_compact st-esg-textarea st-esg-source-content" rows="7" data-group-index="${groupIndex}" data-item-index="${itemIndex}" ${item?.locked ? 'readonly' : ''}>${escapeHtml(value)}</textarea>`;
  if (item?.locked) return textarea;
  const restoreAction = item.key && Object.prototype.hasOwnProperty.call(settings.sourceContentOverrides, item.key)
    ? `<button class="menu_button st-esg-source-restore" type="button" data-group-index="${groupIndex}" data-item-index="${itemIndex}">恢复原生</button>`
    : '';
  return `${textarea}<div class="st-esg-source-actions"><button class="menu_button st-esg-source-confirm" type="button" data-group-index="${groupIndex}" data-item-index="${itemIndex}">确认</button><button class="menu_button st-esg-source-cancel" type="button" data-group-index="${groupIndex}" data-item-index="${itemIndex}">取消</button>${restoreAction}</div>`;
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
  if (items.some((item) => item.id === settings.taskPlacementAfterSourceId)) {
    select.val(settings.taskPlacementAfterSourceId);
  } else {
    select.val('');
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

function applyThemeClass(element, theme) {
  if (!element) return;
  element.classList.toggle('st-esg-theme-dark', theme === 'dark');
  element.classList.toggle('st-esg-theme-light', theme === 'light');
}

function applyTheme() {
  const theme = settings.theme === 'light' ? 'light' : 'dark';
  applyThemeClass(getDialog(), theme);
  applyThemeClass(targetDoc.getElementById('st-esg-ball'), theme);
  $t('#st-esg-theme-toggle i').attr('class', `fa-solid ${theme === 'dark' ? 'fa-moon' : 'fa-sun'}`);
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
      const searchableText = `${item.name || ''}\n${item.content || ''}`.toLocaleLowerCase();
      const matchesQuery = !query || searchableText.includes(query);
      const matchesFilter = listFilterMode === 'all'
        || (listFilterMode === 'enabled' && getSourceSelection(item))
        || (listFilterMode === 'modified' && item.key && Object.prototype.hasOwnProperty.call(settings.sourceContentOverrides, item.key));
      const visible = matchesQuery && matchesFilter;
      row.toggleClass('st-esg-hidden', !visible);
      if (visible) visibleCount += 1;
    });
    toolbar.find('.st-esg-list-count').text(`${visibleCount} / ${items.length}`);
  });
}

function scrollWorldbookCardIntoView() {
  const worldbookBox = targetDoc.getElementById('st-esg-worldbook-candidates');
  const card = worldbookBox?.closest?.('.st-esg-card');
  if (!card) return;
  targetWindow.requestAnimationFrame(() => card.scrollIntoView({ block: 'start', inline: 'nearest' }));
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
    .map((_, option) => textOf($(option).text()))
    .get()
    .filter(Boolean);
  if (selectedLabels.length) return selectedLabels;
  const value = $t('#world_info').val() || [];
  return (Array.isArray(value) ? value : [value]).map(textOf).filter(Boolean);
}

function getActiveSavedWorldbookSources() {
  if (isFollowingTavernWorldbook()) return [];
  const scheme = findScheme(getSchemeList('worldbook'), getActiveSchemeId('worldbook') || getSelectedSchemeId('worldbook'));
  return scheme ? getWorldbookSchemeSourceNames(scheme.snapshot || {}) : [];
}

async function scanImportCandidates({ explicitPresetName = '', explicitWorldbookSources = null, worldbookPromptSelections = null, loadWorldbookCounts = true } = {}) {
  const context = getContext();
  const cachedWorldbookGroups = new Map(importGroups
    .filter((group) => group?.scope === SOURCE_WORLDBOOK && group.loaded && !promptSourceCache.dirtyWorldbooks.has(group.source))
    .map((group) => [group.source, group]));
  // An explicit list is supplied while applying a saved scheme. It must win even if the
  // previously active scheme was Tavern default until the load operation finishes.
  const followingTavernWorldbook = isFollowingTavernWorldbook() && !Array.isArray(explicitWorldbookSources);
  const selectedWorldNames = followingTavernWorldbook ? getSelectedGlobalWorldbookNamesFromDom() : [];
  const savedWorldbookSources = Array.isArray(explicitWorldbookSources)
    ? explicitWorldbookSources
    : getActiveSavedWorldbookSources();
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
    explicitWorldbookNames: followingTavernWorldbook ? null : savedWorldbookSources,
  });
  const worldbookCounts = loadWorldbookCounts
    ? await collectWorldbookImportCounts({
      targetWindow,
      context,
      selectedWorldNames,
      explicitWorldbookNames: followingTavernWorldbook ? null : savedWorldbookSources,
      promptSelections: worldbookPromptSelections || (getSourceMode('worldbook') === SOURCE_MODE_PROMPT && !followingTavernWorldbook ? settings.promptSelections : {}),
    })
    : [];
  const worldbookCountMap = new Map(worldbookCounts.map((item) => [item.name, item]));
  importGroups = [
    ...collectPresetImportGroups({ targetWindow, context, presetName: settings.activeSourcePreset }),
    ...worldbookGroups.map((group) => {
      const cached = cachedWorldbookGroups.get(group.source);
      return {
        ...group,
        ...(worldbookCountMap.get(group.source) || {}),
        ...(cached ? { loaded: true, items: cached.items, error: cached.error } : {}),
      };
    }),
  ];
  const syncedCount = syncPromptSelectionsFromLoadedGroups(importGroups);
  activeWorldbookGroupIndex = null;
  importCandidates = importGroups.flatMap((group) => group.items || []);
  renderImportCandidates();
  renderTaskPlacementOptions();
  promptSourceCache.structureDirty = false;
  promptSourceCache.signature = getTavernSourceSignature();
  lastTavernSourceSignature = promptSourceCache.signature;
  setStatus(getSourceMode('preset') === SOURCE_MODE_PROMPT || getSourceMode('worldbook') === SOURCE_MODE_PROMPT
    ? `已同步 ${syncedCount} 个已加载条目的酒馆勾选状态。世界书会在进入详情页时同步。`
    : `已列出 ${importGroups.length} 个来源。世界书会在进入详情页时加载。`);
}

async function loadImportGroup(groupIndex) {
  const group = importGroups[groupIndex];
  if (!group || group.loaded || group.loading || group.scope !== SOURCE_WORLDBOOK) return;
  group.uiOpen = true;
  group.loading = true;
  renderImportCandidates({ renderPreset: false });
  scrollWorldbookCardIntoView();
  try {
    group.items = await collectWorldbookImportCandidates(targetWindow, group.source);
    group.loaded = true;
    syncPromptSelectionsFromLoadedGroups([group]);
    setStatus(`已加载 ${group.source}：${group.items.length} 个条目。`);
  } catch (error) {
    group.error = error?.message || '加载失败';
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
      ? group.items.filter((item) => getSourceSelection(item)).length
      : Number(group.pluginEnabledCount || 0);
    const category = getWorldbookImportDisplayCategory(group, {
      pluginEnabledCount: currentEnabledCount,
      followingTavern: isFollowingTavernWorldbook(),
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
      const checked = getSourceSelection(item);
      const isWorldbookItem = group.scope === SOURCE_WORLDBOOK;
      const meta = [item.role ? `role: ${item.role}` : '', item.scope || '', item.sourceUid ? `id: ${item.sourceUid}` : ''].filter(Boolean).join(' | ');
      const summaryLabel = item.locked
        ? `<span class="st-esg-import-label"><i class="fa-solid fa-lock"></i><span>${escapeHtml(item.name)}</span></span>`
        : `<label class="st-esg-checkbox"><input class="st-esg-import-check" type="checkbox" ${checked ? 'checked' : ''} /><span>${escapeHtml(item.name)}</span></label>`;
      const modifiedMark = item.key && Object.prototype.hasOwnProperty.call(settings.sourceContentOverrides, item.key)
        ? '<i class="fa-solid fa-pen st-esg-source-modified-mark" title="内容已修改" aria-label="内容已修改"></i>'
        : '';
      const worldbookMode = isWorldbookItem
        ? (() => {
            const mode = getWorldbookActivationMode(item);
            const label = mode === 'blue' ? '蓝灯' : '绿灯';
            return `<button class="menu_button st-esg-worldbook-mode st-esg-worldbook-mode-${mode}" type="button" title="${label}" aria-label="${label}" aria-pressed="${mode === 'green'}" data-group-index="${group.groupIndex}" data-item-index="${itemIndex}"><span class="st-esg-worldbook-switch-thumb"></span></button>`;
          })()
        : '';
      const summary = `${summaryLabel}${modifiedMark}${worldbookMode}<button class="menu_button st-esg-source-expand" type="button" title="展开内容"><i class="fa-solid fa-chevron-down"></i></button>`;
      const worldbookMeta = isWorldbookItem
        ? `<div class="st-esg-worldbook-meta"><div class="st-esg-card-desc">主关键词：${escapeHtml(Array.isArray(item.worldbookKeys) ? item.worldbookKeys.join('，') : item.worldbookKeys || '无')}</div></div>`
        : '';
      return `<details class="st-esg-import-item ${item.locked ? 'st-esg-import-item-locked' : ''}" data-group-index="${group.groupIndex}" data-item-index="${itemIndex}"><summary>${summary}</summary><div class="st-esg-source-detail"><div class="st-esg-card-desc">${escapeHtml(meta)}</div>${worldbookMeta}${renderSourceContentEditor(item, group.groupIndex, itemIndex)}</div></details>`;
    }).join('');
  };
  const renderGroup = (group) => {
    const shouldOpen = group.uiOpen || viewState.openGroups.has(group.groupIndex) || (group.loaded && group.scope !== SOURCE_WORLDBOOK);
    return `<details class="st-esg-import-group" data-group-index="${group.groupIndex}" ${shouldOpen ? 'open' : ''}><summary class="st-esg-import-group-head"><div><div class="st-esg-import-group-title">${escapeHtml(group.group)}</div><div class="st-esg-card-desc">${group.loaded ? `${group.items.length} 个可导入条目` : '未加载，点开读取'}</div></div></summary><div class="st-esg-import-group-list">${groupBody(group)}</div></details>`;
  };
  const renderWorldbookRow = (group) => {
    const total = group.loaded ? group.items.length : Number(group.entryCount || 0);
    const enabled = group.loaded ? group.items.filter((item) => getSourceSelection(item)).length : Number(group.pluginEnabledCount || 0);
    const count = total ? `${enabled}/${total}` : '暂无条目';
    return `<button class="st-esg-worldbook-row" type="button" data-group-index="${group.groupIndex}"><span>${escapeHtml(group.group)}</span><em>${count}</em><i class="fa-solid fa-chevron-right"></i></button>`;
  };
  const renderWorldbookDetail = (group) => `<div class="st-esg-worldbook-detail" data-group-index="${group.groupIndex}"><div class="st-esg-detail-head"><button class="menu_button st-esg-back-worldbooks" type="button" title="返回世界书列表" aria-label="返回世界书列表"><i class="fa-solid fa-arrow-left"></i></button><div><div class="st-esg-import-group-title">${escapeHtml(group.group)}</div><div class="st-esg-card-desc">${group.loading ? '正在加载条目...' : group.loaded ? `${group.items.length} 个可导入条目` : '准备加载这本世界书'}</div></div>${group.loaded ? '<button class="menu_button st-esg-import-detail-toggle" type="button">全选条目</button>' : ''}</div><div class="st-esg-import-group-list">${renderListToolbar()}${groupBody(group)}</div></div>`;
  const detailGroup = activeWorldbookGroupIndex === null ? null : groupsWithIndex.find((group) => group.groupIndex === activeWorldbookGroupIndex && group.scope === SOURCE_WORLDBOOK);
  const worldbookSection = detailGroup
    ? renderWorldbookDetail(detailGroup)
    : (worldbookGroups.length ? `<details class="st-esg-import-scope" open><summary class="st-esg-import-scope-summary"><span>世界书</span><em>${worldbookGroups.length} 本来源</em></summary><div class="st-esg-import-scope-body">${[...worldbookCategories.values()].filter((category) => category.groups.length).map((category) => `<details class="st-esg-import-category" open><summary class="st-esg-import-category-summary"><span>${escapeHtml(category.categoryLabel)}</span><em>${category.groups.length} 本</em></summary><div class="st-esg-import-category-body">${category.groups.map(renderWorldbookRow).join('')}</div></details>`).join('')}</div></details>` : '');
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
  $t('.st-esg-import-check').off('.stEsgSource');
  $t('.st-esg-import-check').on('click.stEsgSource', (event) => event.stopPropagation());
  $t('.st-esg-import-check').on('change.stEsgSource', function () {
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
  $t('.st-esg-source-content').off('.stEsgSourceContent');
  $t('.st-esg-source-content').on('click.stEsgSourceContent', (event) => event.stopPropagation());
  $t('.st-esg-source-confirm').off('.stEsgSourceContent');
  $t('.st-esg-source-confirm').on('click.stEsgSourceContent', function (event) {
    event.preventDefault();
    event.stopPropagation();
    const group = importGroups[Number($(this).data('group-index'))];
    const item = group?.items?.[Number($(this).data('item-index'))];
    const detail = $(this).closest('.st-esg-source-detail');
    const textarea = detail.find('.st-esg-source-content');
    setSourceContentOverride(item, textarea.val());
    textarea.val(getSourceContentValue(item));
    renderImportCandidates();
    setStatus('已保存条目内容。');
  });
  $t('.st-esg-source-cancel').off('.stEsgSourceContent');
  $t('.st-esg-source-cancel').on('click.stEsgSourceContent', function (event) {
    event.preventDefault();
    event.stopPropagation();
    const group = importGroups[Number($(this).data('group-index'))];
    const item = group?.items?.[Number($(this).data('item-index'))];
    const detail = $(this).closest('.st-esg-source-detail');
    detail.find('.st-esg-source-content').val(getSourceContentValue(item));
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
    markSchemeDirty(item.scope === SOURCE_WORLDBOOK ? 'worldbook' : 'preset');
    saveSettings();
    renderImportCandidates();
    setStatus('已恢复原生内容。');
  });
  if (renderWorldbook) $t('.st-esg-import-detail-toggle').on('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    const checks = $(this).closest('.st-esg-worldbook-detail').find('.st-esg-import-check');
    const shouldCheck = checks.toArray().some((item) => !$(item).prop('checked'));
    checks.prop('checked', shouldCheck);
    syncSelectionForChecks(checks);
    $(this).text(shouldCheck ? '取消全选' : '全选条目');
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
    notifyStatus('当前是编辑模式：勾选会用于生成提示词，不会导入组件库。', 'warning');
    return;
  }
  const checked = $t('.st-esg-import-check:checked').toArray();
  if (!checked.length) { notifyStatus('请先勾选要导入的候选组件。', 'warning'); return; }
  const target = getImportTarget(sourceType);
  if (!target) { notifyStatus('请先选择导入目标。', 'warning'); return; }
  const { scope: targetScope, presetSchemeId, bindName } = target;
  let added = 0;
  for (const checkbox of checked) {
    const row = $(checkbox).closest('.st-esg-import-item');
    const group = importGroups[Number(row.data('group-index'))];
    const item = group?.items?.[Number(row.data('item-index'))];
    if (!item || getSourceType(item) !== getSourceType(sourceType)) continue;
    const importedComponent = { name: item.name, scope: targetScope, presetSchemeId, bindName, content: item.content, enabled: true, source: item.source, sourceType: item.scope, sourceOrder: item.sourceOrder, sourceUid: item.sourceUid, groupId: '' };
    settings.components.push({ id: createNewComponentId(), ...importedComponent });
    added += 1;
  }
  saveSettings(); renderComponentList(); renderImportCandidates(); notifyStatus(`已新增导入 ${added} 个组件。`);
}

function buildPluginPanelMarkup() {
  const modeCard = `<div class="st-esg-card"><div class="st-esg-card-head"><div><div class="st-esg-card-title">运行模式</div><div class="st-esg-card-desc">控制插件是否监听正文生成，以及生成后是否自动注入。</div></div></div><select id="st-esg-mode" class="text_pole st-esg-select"><option value="autoInject">自动生成，并自动注入回复文尾</option><option value="autoReview">自动生成，但手动确认注入</option><option value="manual">手动点击生成，手动注入</option></select></div>`;
  const importAction = (id, label) => `<div class="st-esg-actions-row st-esg-source-import-action"><div id="${id}" class="menu_button menu_button_icon st-esg-secondary-action"><i class="fa-solid fa-file-import"></i><span>${label}</span></div></div>`;
  return `<div class="st-esg-shell"><div class="st-esg-panel-header"><div class="st-esg-panel-title"><div class="st-esg-title-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></div><div><div class="st-esg-kicker">SillyTavern 插件</div><div class="st-esg-title-text">外置文尾组件生成器</div></div></div><div id="st-esg-close" class="menu_button fa-solid fa-xmark" title="关闭面板"></div></div><div class="st-esg-panel-body"><nav class="st-esg-tabs" aria-label="外置文尾组件生成器分页"><button class="st-esg-tab" type="button" data-tab="workspace"><i class="fa-solid fa-sparkles"></i><span>生成</span></button><button class="st-esg-tab" type="button" data-tab="task"><i class="fa-solid fa-pen-to-square"></i><span>任务指令</span></button><button class="st-esg-tab" type="button" data-tab="preset"><i class="fa-solid fa-list-check"></i><span>预设</span></button><button class="st-esg-tab" type="button" data-tab="worldbook"><i class="fa-solid fa-book-open"></i><span>世界书</span></button><button class="st-esg-tab" type="button" data-tab="runtime"><i class="fa-solid fa-sliders"></i><span>运行设置</span></button><button class="st-esg-tab" type="button" data-tab="components"><i class="fa-solid fa-layer-group"></i><span>组件库</span></button><button class="st-esg-tab" type="button" data-tab="debug"><i class="fa-solid fa-list"></i><span>提示词日志</span></button></nav><section class="st-esg-tab-panel" data-tab-panel="workspace">${modeCard}<div class="st-esg-card"><div class="st-esg-card-head"><div><div class="st-esg-card-title">生成内容</div><div class="st-esg-card-desc">这里是文尾组件生成结果。你可以先检查，再注入回复文尾末尾。</div></div></div><textarea id="st-esg-preview" class="text_pole textarea_compact st-esg-textarea st-esg-preview" rows="11" placeholder="生成后的文尾组件会出现在这里。"></textarea></div><div class="st-esg-card"><div class="st-esg-card-head"><div><div class="st-esg-card-title">注入方式</div><div class="st-esg-card-desc">直接注入模型输出原文，不再添加插件自定义包裹标记。</div></div></div><select id="st-esg-inject-mode" class="text_pole st-esg-select"><option value="replace">正文已有同名成对标签时替换</option><option value="append">始终追加到最新回复末尾</option></select></div><div class="st-esg-card st-esg-compact-card"><label class="st-esg-checkbox"><input id="st-esg-ball-visible" type="checkbox" /><span>显示可选悬浮快捷按钮</span></label></div></section><section class="st-esg-tab-panel" data-tab-panel="task"><div class="st-esg-card">${renderSchemeManager('task')}<div class="st-esg-card-head"><div><div class="st-esg-card-title">生成任务指令</div><div class="st-esg-card-desc">编辑最终发送给模型的任务指令；{{external_components}} 的位置会插入组件库内容，不写则不发送组件。</div></div></div><textarea id="st-esg-task" class="text_pole textarea_compact st-esg-textarea" rows="7"></textarea><div class="st-esg-actions-row"><div id="st-esg-reset-task" class="menu_button menu_button_icon st-esg-secondary-action"><i class="fa-solid fa-rotate-left"></i><span>恢复默认提示词</span></div></div></div></section><section class="st-esg-tab-panel" data-tab-panel="preset"><div class="st-esg-card st-esg-import-tools"><div class="st-esg-card-head"><div><div id="st-esg-source-mode-title" class="st-esg-card-title">提示词模式</div><div id="st-esg-source-mode-desc" class="st-esg-card-desc">当前勾选会作为外置生成时启用的来源，不会导入组件库。</div></div></div><div class="st-esg-grid"><label>来源模式<select id="st-esg-source-mode" class="text_pole"><option value="prompt">提示词模式</option><option value="import">导入组件库模式</option></select></label><label>导入到<select id="st-esg-import-target-scope" class="text_pole"><option>全局</option><option>预设</option><option>角色</option></select></label></div>${importAction('st-esg-import-preset-components', '导入预设勾选')}</div><div class="st-esg-card">${renderSchemeManager('preset')}<div class="st-esg-card-head"><div><div class="st-esg-card-title">预设</div><div class="st-esg-card-desc">用选择框切换预设；下方只显示当前选择的预设条目。</div></div></div><div class="st-esg-grid"><label>选择预设<select id="st-esg-source-preset" class="text_pole"></select></label></div><div id="st-esg-preset-placement-slot" class="st-esg-scheme-box"><label class="st-esg-checkbox st-esg-log-option"><input id="st-esg-task-placement-enabled" type="checkbox" /><span>自定义任务指令插入位置</span><em>开启后插入到指定预设条目之后；关闭时仍追加到末尾。</em></label><div id="st-esg-task-placement-row" class="st-esg-grid"><label>插入到这条预设之后<select id="st-esg-task-placement-after" class="text_pole"></select></label></div><label class="st-esg-checkbox st-esg-log-option"><input id="st-esg-replace-last-user-message" type="checkbox" /><span>用任务指令替换 {{LastUserMessage}}</span><em>开启后预设里的 {{LastUserMessage}} 会使用当前任务指令内容。</em></label><label class="st-esg-checkbox st-esg-log-option"><input id="st-esg-omit-original-user-messages" type="checkbox" /><span>不发送原用户输入</span><em>开启后聊天历史里的 user 消息不会发送给外置 API。</em></label></div><div id="st-esg-preset-candidates" class="st-esg-import-list"></div></div></section><section class="st-esg-tab-panel" data-tab-panel="worldbook"><div class="st-esg-card st-esg-import-tools st-esg-worldbook-mode-card"><div class="st-esg-card-head"><div><div id="st-esg-source-mode-title-worldbook" class="st-esg-card-title">提示词模式</div><div id="st-esg-source-mode-desc-worldbook" class="st-esg-card-desc">当前勾选会作为外置生成时启用的来源，不会导入组件库。</div></div></div><div class="st-esg-grid"><label>世界书来源模式<select id="st-esg-source-mode-worldbook" class="text_pole"><option value="prompt">提示词模式</option><option value="import">导入组件库模式</option></select></label></div>${importAction('st-esg-import-worldbook-components', '导入世界书勾选')}</div><div class="st-esg-card"><div class="st-esg-card-head"><div><div class="st-esg-card-title">世界书</div><div class="st-esg-card-desc">这里是独立的世界书列表；点进某本世界书后只替换这张卡片。</div></div></div>${renderSchemeManager('worldbook')}<div id="st-esg-worldbook-candidates" class="st-esg-import-list"></div></div></section><section class="st-esg-tab-panel" data-tab-panel="runtime"><details class="st-esg-card st-esg-collapsible"><summary class="st-esg-collapsible-summary">API配置</summary><div class="st-esg-collapsible-body">${renderSchemeManager('api')}<div class="st-esg-grid"><label>API 地址<input id="st-esg-api-url" class="text_pole" type="text" placeholder="例如 https://api.openai.com/v1" /></label><label>模型名称<input id="st-esg-api-model" class="text_pole" type="text" list="st-esg-model-options" placeholder="例如 gpt-4o-mini / deepseek-chat" /><datalist id="st-esg-model-options"></datalist></label><label>最大输出<input id="st-esg-max-tokens" class="text_pole" type="number" min="1" step="1" /></label><label>温度<input id="st-esg-temperature" class="text_pole" type="number" min="0" max="2" step="0.1" /></label></div><label class="st-esg-secret-label">API Key<input id="st-esg-api-key" class="text_pole" type="password" placeholder="可选。多数独立 API 需要填写。" /></label><label class="st-esg-checkbox st-esg-log-option"><input id="st-esg-streaming-enabled" type="checkbox" /><span>启用流式传输</span><em>开启后生成结果会随着 API 返回逐步显示。</em></label><div class="st-esg-actions-row"><div id="st-esg-fetch-models" class="menu_button menu_button_icon st-esg-secondary-action"><i class="fa-solid fa-cloud-arrow-down"></i><span>拉取模型</span></div></div></div></details><div class="st-esg-card"><div class="st-esg-card-head"><div><div class="st-esg-card-title">标签清理</div><div class="st-esg-card-desc">分别处理拼接提示词时的聊天历史，以及生成内容注入前的思维链标签。</div></div></div><div class="st-esg-grid"><label>聊天历史清理标签<textarea id="st-esg-history-cleanup-tags" class="text_pole textarea_compact st-esg-textarea" rows="4"></textarea></label><label>生成内容剥离标签<textarea id="st-esg-output-cleanup-tags" class="text_pole textarea_compact st-esg-textarea" rows="4"></textarea></label></div></div><details class="st-esg-card st-esg-collapsible"><summary class="st-esg-collapsible-summary">柏宝书记忆库</summary><div class="st-esg-collapsible-body"><label class="st-esg-checkbox st-esg-log-option"><input id="st-esg-baibai-history-enabled" type="checkbox" /><span>注入此前剧情</span><em>注入柏宝书整理的历史记忆。</em></label><label class="st-esg-checkbox st-esg-log-option"><input id="st-esg-baibai-state-enabled" type="checkbox" /><span>注入故事现状</span><em>注入人物、物品、相关人物、未结束事项和持续记录的变量。</em></label></div></details></section><section class="st-esg-tab-panel" data-tab-panel="components"><div class="st-esg-card"><div class="st-esg-card-head"><div><div class="st-esg-card-title">手动添加组件</div><div class="st-esg-card-desc">组件库只管理最终会发送的组件；从预设和世界书导入请去“预设/世界书”页。</div></div></div><div class="st-esg-grid"><label>组件名<input id="st-esg-component-name" class="text_pole" type="text" /></label><label>归属<select id="st-esg-component-scope" class="text_pole"><option>全局</option><option>预设</option><option>角色</option></select></label></div><textarea id="st-esg-component-content" class="text_pole textarea_compact st-esg-textarea" rows="5"></textarea><div class="st-esg-actions-row"><div id="st-esg-add-component" class="menu_button menu_button_icon st-esg-secondary-action"><i class="fa-solid fa-plus"></i><span>添加到组件库</span></div></div></div><div id="st-esg-component-list" class="st-esg-component-list"></div></section><section class="st-esg-tab-panel" data-tab-panel="debug"><div class="st-esg-card"><div class="st-esg-card-head"><div><div class="st-esg-card-title">提示词日志</div><div class="st-esg-card-desc">按 API messages 分栏查看；复制日志仍会复制完整 JSON，不保存 API Key。</div></div></div><label class="st-esg-checkbox st-esg-log-option"><input id="st-esg-compress-system" type="checkbox" /><span>压缩连续系统消息</span><em>将连续 system 合并为一条，遇到 user/assistant 会断开。</em></label><div id="st-esg-prompt-log-summary" class="st-esg-prompt-log-summary"></div><div id="st-esg-prompt-log-view" class="st-esg-prompt-log-view"></div><textarea id="st-esg-prompt-log" class="st-esg-hidden-log" readonly></textarea><div class="st-esg-actions-row"><div id="st-esg-copy-prompt-log" class="menu_button menu_button_icon st-esg-secondary-action"><i class="fa-solid fa-copy"></i><span>复制完整日志</span></div><div id="st-esg-clear-prompt-log" class="menu_button menu_button_icon st-esg-secondary-action"><i class="fa-solid fa-eraser"></i><span>清空日志</span></div></div></div></section></div><div class="st-esg-panel-footer"><div id="st-esg-status" class="st-esg-status-pill"><span class="st-esg-dot"></span><span>准备就绪</span></div><div class="st-esg-footer-actions"><div id="st-esg-generate" class="menu_button menu_button_icon st-esg-primary-action"><i class="fa-solid fa-sparkles"></i><span>生成文尾组件</span></div><div id="st-esg-inject" class="menu_button menu_button_icon st-esg-secondary-action"><i class="fa-solid fa-file-import"></i><span>注入回复文尾</span></div></div></div></div>`;
}

function buildGenerationSettingsMarkup() {
  return `<details class="st-esg-card st-esg-collapsible st-esg-generation-settings"><summary class="st-esg-collapsible-summary">生成设置</summary><div class="st-esg-collapsible-body"><label class="st-esg-checkbox st-esg-log-option"><input id="st-esg-auto-generate" type="checkbox" /><span>监听正文结束自动生成</span></label><label class="st-esg-checkbox st-esg-log-option"><input id="st-esg-auto-inject" type="checkbox" /><span>生成结束以后自动注入</span></label><label id="st-esg-inject-mode-row" class="st-esg-generation-inject-mode">注入方式：<select id="st-esg-inject-mode" class="text_pole st-esg-select"><option value="replace">正文已有同名标签时直接覆盖</option><option value="append">始终追加到末尾</option></select></label><label class="st-esg-checkbox st-esg-log-option"><input id="st-esg-status-placeholder-enabled" type="checkbox" /><span>将 MVU 状态标签固定到正文末尾</span><em>检测正文或生成内容中的 &lt;StatusPlaceHolderImpl/&gt;，清理重复项并在最终文末保留一个。</em></label><div class="st-esg-card-desc">覆盖模式仅支持成对的尖括号标签（如 &lt;status&gt;…&lt;/status&gt;）。[status]、【状态】等格式无法识别，会自动改为追加。</div></div></details>`;
}

function renderGenerationSettings() {
  const settingsBody = targetDoc.querySelector('.st-esg-generation-settings .st-esg-collapsible-body');
  const statusPlaceholderSetting = settingsBody?.querySelector('#st-esg-status-placeholder-enabled')?.closest('label');
  const injectionModeDescription = settingsBody?.querySelector('.st-esg-card-desc');
  if (injectionModeDescription && statusPlaceholderSetting) {
    settingsBody.insertBefore(injectionModeDescription, statusPlaceholderSetting);
  }
  if (statusPlaceholderSetting && !targetDoc.getElementById('st-esg-mvu-reprocess-on-inject')) {
    statusPlaceholderSetting.insertAdjacentHTML('afterend', '<label class="st-esg-checkbox st-esg-log-option"><input id="st-esg-mvu-reprocess-on-inject" type="checkbox" /><span>注入变量更新后重处理 MVU 变量</span><em>仅本次注入内容含有 &lt;UpdateVariable&gt; 时执行；未安装 MVU 会自动跳过。</em></label>');
  }
  $t('#st-esg-auto-generate').prop('checked', settings.autoGenerate);
  $t('#st-esg-auto-inject').prop('checked', settings.autoInject);
  $t('#st-esg-inject-mode').val(settings.injectMode);
  $t('#st-esg-status-placeholder-enabled').prop('checked', settings.statusPlaceholderEnabled);
  $t('#st-esg-mvu-reprocess-on-inject').prop('checked', settings.mvuReprocessOnInject);
}

function renderPluginPanel() {
  if (targetDoc.getElementById('st-esg-dialog')) return;
  const dialog = targetDoc.createElement('dialog');
  dialog.id = 'st-esg-dialog';
  dialog.className = 'st-esg-dialog';
  dialog.innerHTML = buildPluginPanelMarkup();
  dialog.querySelector('#st-esg-status')?.remove();
  dialog.querySelector('[data-tab="debug"] span')?.replaceChildren('提示词查看器');
  dialog.querySelector('[data-tab-panel="debug"] .st-esg-card-title')?.replaceChildren('提示词查看器');
  dialog.querySelector('[data-tab-panel="preset"] .st-esg-import-tools')?.replaceWith(...$(renderSourceModeControl('preset')).toArray());
  dialog.querySelector('[data-tab-panel="worldbook"] .st-esg-import-tools')?.replaceWith(...$(renderSourceModeControl('worldbook')).toArray());
  const presetPlacement = dialog.querySelector('#st-esg-preset-placement-slot');
  if (presetPlacement) {
    const extraOptions = targetDoc.createElement('details');
    extraOptions.id = 'st-esg-preset-placement-slot';
    extraOptions.className = 'st-esg-preset-extra-options';
    extraOptions.innerHTML = `<summary>额外选项</summary><div class="st-esg-preset-extra-options-body">${presetPlacement.innerHTML}</div>`;
    presetPlacement.replaceWith(extraOptions);
  }
  const workspace = dialog.querySelector('[data-tab-panel="workspace"]');
  const injectionCard = workspace?.querySelector('#st-esg-inject-mode')?.closest('.st-esg-card');
  const modeCard = workspace?.querySelector('#st-esg-mode')?.closest('.st-esg-card');
  modeCard?.replaceWith(...$(buildGenerationSettingsMarkup()).toArray());
  injectionCard?.remove();
  workspace?.querySelector('#st-esg-preview')?.closest('.st-esg-card')?.classList.add('st-esg-generation-content');
  const apiFields = dialog.querySelector('#st-esg-api-url')?.closest('.st-esg-grid');
  const apiKeyLabel = dialog.querySelector('#st-esg-api-key')?.closest('label');
  const apiModelLabel = dialog.querySelector('#st-esg-api-model')?.closest('label');
  const apiTemperatureLabel = dialog.querySelector('#st-esg-temperature')?.closest('label');
  const apiMaxTokensLabel = dialog.querySelector('#st-esg-max-tokens')?.closest('label');
  apiFields?.classList.add('st-esg-api-fields');
  if (apiKeyLabel && apiModelLabel) apiFields?.insertBefore(apiKeyLabel, apiModelLabel);
  if (apiTemperatureLabel && apiMaxTokensLabel) apiFields?.insertBefore(apiTemperatureLabel, apiMaxTokensLabel);
  const temperatureInput = dialog.querySelector('#st-esg-temperature');
  temperatureInput?.removeAttribute('max');
  temperatureInput?.setAttribute('step', 'any');
  const fetchModelsButton = dialog.querySelector('#st-esg-fetch-models');
  fetchModelsButton?.insertAdjacentHTML('afterend', '<div id="st-esg-additional-parameters" class="menu_button menu_button_icon st-esg-secondary-action"><i class="fa-solid fa-sliders"></i><span>附加参数</span></div>');
  const apiModel = dialog.querySelector('#st-esg-api-model');
  apiModel?.insertAdjacentHTML('afterend', '<select id="st-esg-api-model-picker" class="text_pole st-esg-api-model-picker" style="display:none;"></select><div id="st-esg-api-model-feedback" class="st-esg-api-model-feedback"></div>');
  const preview = dialog.querySelector('#st-esg-preview');
  preview?.closest('.st-esg-card')?.querySelector('.st-esg-card-title')?.classList.add('st-esg-generation-result-title');
  preview?.closest('.st-esg-card')?.querySelector('.st-esg-card-desc')?.classList.add('st-esg-generation-result-desc');
  const taskInput = dialog.querySelector('#st-esg-task');
  taskInput?.insertAdjacentHTML('afterend', '<div class="st-esg-task-components-help"><code>{{external_components}}</code> 会在生成时替换为当前启用的文尾组件；不写则不会发送组件。</div>');
  preview?.insertAdjacentHTML('beforebegin', '<div id="st-esg-thinking-panel" class="st-esg-hidden"></div><div id="st-esg-generation-error" class="st-esg-generation-error st-esg-hidden"></div>');
  const tagTextarea = dialog.querySelector('#st-esg-history-cleanup-tags');
  const tagCard = tagTextarea?.closest('.st-esg-card');
  const tagGrid = tagCard?.querySelector('.st-esg-grid');
  if (tagCard && tagGrid) {
    const tagDetails = targetDoc.createElement('details');
    tagDetails.className = 'st-esg-card st-esg-collapsible st-esg-tag-cleanup-settings';
    tagDetails.innerHTML = `<summary class="st-esg-collapsible-summary">标签清理</summary><div class="st-esg-collapsible-body">${tagGrid.outerHTML}</div>`;
    tagCard.replaceWith(tagDetails);
  }
  ['history', 'output'].forEach((type) => {
    const textarea = dialog.querySelector(`#st-esg-${type === 'history' ? 'history-cleanup-tags' : 'output-cleanup-tags'}`);
    textarea?.closest('label')?.replaceWith(...$(buildTagRuleManager(type)).toArray());
  });
  const ballCard = dialog.querySelector('[data-tab-panel="workspace"] .st-esg-compact-card');
  const runtimePanel = dialog.querySelector('[data-tab-panel="runtime"]');
  if (ballCard && runtimePanel) {
    const shortcutDetails = targetDoc.createElement('details');
    shortcutDetails.className = 'st-esg-card st-esg-collapsible st-esg-shortcut-settings';
    shortcutDetails.innerHTML = '<summary class="st-esg-collapsible-summary">界面与快捷入口</summary><div class="st-esg-collapsible-body"><label class="st-esg-checkbox"><input id="st-esg-ball-visible" type="checkbox" /><span>显示可选悬浮快捷按钮</span></label><label class="st-esg-checkbox"><input id="st-esg-qr-generate-enabled" type="checkbox" /><span>QR 栏显示“点击生成”</span></label><label class="st-esg-checkbox"><input id="st-esg-qr-inject-enabled" type="checkbox" /><span>QR 栏显示“点击注入”</span></label></div>';
    ballCard.replaceWith(shortcutDetails);
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
  }
  ['task', 'preset', 'worldbook'].forEach((tab) => {
    const scheme = dialog.querySelector(`[data-tab-panel="${tab}"] > .st-esg-card > .st-esg-scheme-group`);
    const title = scheme?.parentElement?.querySelector('.st-esg-card-head');
    title?.insertAdjacentElement('afterend', scheme);
  });
  dialog.querySelector('#st-esg-close')?.insertAdjacentHTML('beforebegin', '<div id="st-esg-theme-toggle" class="st-esg-header-btn" title="切换主题"><i class="fa-solid fa-moon"></i></div>');
  targetDoc.body.appendChild(dialog);
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); togglePanel(false); });
  dialog.addEventListener('close', () => {
    resetComponentEditMode();
    resetComponentLibraryFilters();
    targetDoc.getElementById('st-esg-ball')?.classList.remove('st-esg-ball-under-panel');
  });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) togglePanel(false); });
  bindPanelEvents();
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
    ['[data-tab-panel="workspace"] .st-esg-generation-content .st-esg-card-desc', '显示最近一次生成的正文，注入前可以直接检查和编辑。'],
    ['[data-tab-panel="task"] .st-esg-card-desc', '编辑发送给模型的任务指令；组件占位符会在发送前替换为当前启用的组件内容。'],
    ['[data-tab-panel="preset"] > .st-esg-card:nth-child(2) .st-esg-card-desc', '选择要查看和编辑的预设；编辑模式下的勾选与内容会保存到当前方案。'],
    ['[data-tab-panel="worldbook"] > .st-esg-card:nth-child(2) .st-esg-card-desc', '选择方案后查看当前世界书状态；编辑模式下可调整条目勾选、内容和蓝绿灯。'],
    ['[data-tab-panel="runtime"] .st-esg-card-desc', '分别处理聊天历史清理规则和生成结果中的思维链剥离规则。'],
    ['[data-tab-panel="debug"] .st-esg-card-desc', '查看本次发送给外置 API 的消息分栏与概要信息。'],
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
    prompt: ['编辑模式', '编辑当前来源的条目；勾选和内容会参与提示词拼接，并由方案保存。'],
    import: ['导入模式', '只从当前列表勾选条目并导入组件库；不参与提示词拼接，也不保存为方案。'],
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
    '[data-tab-panel="task"] > .st-esg-card .st-esg-card-desc',
    '[data-tab-panel="preset"] > .st-esg-card:nth-child(2) .st-esg-card-desc',
    '[data-tab-panel="worldbook"] > .st-esg-card:nth-child(2) .st-esg-card-desc',
    '.st-esg-manual-component-card .st-esg-card-desc',
  ].join(', ')).remove();
  $t('.st-esg-card-title').filter(function () {
    return ['生成任务指令', '预设', '世界书', '提示词日志', '提示词查看器', '手动添加组件'].includes(textOf($(this).text()));
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
  $t('#st-esg-qr-generate-enabled').prop('checked', settings.qrGenerateEnabled);
  $t('#st-esg-qr-inject-enabled').prop('checked', settings.qrInjectEnabled);
  renderGenerationSettings();
  $t('#st-esg-task').val(settings.taskPrompt);
  $t('#st-esg-task-placement-enabled').prop('checked', settings.taskPlacementEnabled);
  $t('#st-esg-replace-last-user-message').prop('checked', settings.replaceLastUserMessageWithTask);
  $t('#st-esg-omit-original-user-messages').prop('checked', settings.omitOriginalUserMessages);
  $t('#st-esg-baibai-history-enabled').prop('checked', settings.baiBaiBookHistoryEnabled);
  $t('#st-esg-baibai-state-enabled').prop('checked', settings.baiBaiBookStateEnabled);
  $t('#st-esg-preview').val(settings.lastGenerated);
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
  $t('#st-esg-prompt-template-compat').prop('checked', settings.promptTemplateCompatEnabled);
  renderTagRuleManager('history');
  renderTagRuleManager('output');
  renderSourceModeUi();
  renderSourcePresetSelect();
  renderTaskPlacementOptions();
  renderAllSchemeOptions();
  renderComponentList(); renderPromptLog(); switchTab(settings.activeTab || 'workspace');
  $t('#st-esg-close').on('click', () => togglePanel(false));
  $t('#st-esg-theme-toggle').on('click', () => { settings.theme = settings.theme === 'dark' ? 'light' : 'dark'; applyTheme(); saveSettings(); });
  $t('.st-esg-tab').on('click', function () { switchTab(String($(this).data('tab'))); });
  $t('.st-esg-collapsible').on('toggle.stEsgLayout', () => { void $t('.st-esg-panel-body').get(0)?.scrollHeight; });
  $t('#st-esg-add-component').on('click', addComponent);
  $t('.st-esg-panel-body').off('change.stEsgPresetBinding').on('change.stEsgPresetBinding', '#st-esg-import-target-scope, #st-esg-worldbook-import-target-scope, #st-esg-component-scope', renderPresetBindingControls);
  $t('.st-esg-mode-radio[name="preset_source_mode"]').on('change', function () {
    if (!$(this).prop('checked')) return;
    void changeSourceMode('preset', String($(this).val()));
  });
  $t('.st-esg-mode-radio[name="worldbook_source_mode"]').on('change', function () {
    if (!$(this).prop('checked')) return;
    void changeSourceMode('worldbook', String($(this).val()));
  });
  $t('#st-esg-source-preset').on('change', function () { const presetName = String($(this).val() || ''); settings.activeSourcePreset = presetName; if (getSourceMode('preset') === SOURCE_MODE_PROMPT) markSchemeDirty('preset'); else saveSettings(); scanImportCandidates({ explicitPresetName: presetName }); });
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
  $t('#st-esg-compress-system').on('change', function () { settings.compressSystemMessages = Boolean($(this).prop('checked')); saveSettings(); });
  targetDoc.getElementById('st-esg-ball-visible')?.addEventListener('change', function () {
    settings.ballVisible = Boolean(this.checked);
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
  $t('#st-esg-auto-generate').on('change', function () {
    settings.autoGenerate = Boolean($(this).prop('checked'));
    saveSettings();
    renderGenerationSettings();
  });
  $t('#st-esg-auto-inject').on('change', function () {
    settings.autoInject = Boolean($(this).prop('checked'));
    saveSettings();
    renderGenerationSettings();
  });
  $t('#st-esg-status-placeholder-enabled').on('change', function () {
    settings.statusPlaceholderEnabled = Boolean($(this).prop('checked'));
    saveSettings();
  });
  $t('#st-esg-mvu-reprocess-on-inject').on('change', function () {
    settings.mvuReprocessOnInject = Boolean($(this).prop('checked'));
    saveSettings();
  });
  $t('#st-esg-task').on('input', function () { settings.taskPrompt = String($(this).val()); resizeTaskPrompt(); markSchemeDirty('task'); saveSettings(); });
  $t('#st-esg-task-placement-enabled').on('change', function () {
    settings.taskPlacementEnabled = Boolean($(this).prop('checked'));
    markSchemeDirty('preset');
    saveSettings();
    renderTaskPlacementOptions();
  });
  $t('#st-esg-task-placement-after').on('change', function () {
    settings.taskPlacementAfterSourceId = String($(this).val() || '');
    markSchemeDirty('preset');
    saveSettings();
  });
  $t('#st-esg-replace-last-user-message').on('change', function () {
    settings.replaceLastUserMessageWithTask = Boolean($(this).prop('checked'));
    markSchemeDirty('preset');
    saveSettings();
  });
  $t('#st-esg-omit-original-user-messages').on('change', function () {
    settings.omitOriginalUserMessages = Boolean($(this).prop('checked'));
    markSchemeDirty('preset');
    saveSettings();
  });
  $t('#st-esg-baibai-history-enabled').on('change', function () { settings.baiBaiBookHistoryEnabled = Boolean($(this).prop('checked')); saveSettings(); });
  $t('#st-esg-baibai-state-enabled').on('change', function () { settings.baiBaiBookStateEnabled = Boolean($(this).prop('checked')); saveSettings(); });
  $t('#st-esg-reset-task').on('click', function () {
    settings.taskPrompt = DEFAULT_SETTINGS.taskPrompt;
    $t('#st-esg-task').val(settings.taskPrompt);
    resizeTaskPrompt();
    markSchemeDirty('task');
    saveSettings();
    setStatus('已恢复默认提示词。');
  });
  $t('#st-esg-preview').on('input', function () {
    settings.lastGenerated = String($(this).val());
    settings.lastGeneratedStatusPlaceholderPresent = containsStatusPlaceholder(settings.lastGenerated);
    resizeGeneratedPreview();
    saveSettings();
  });
  $t('#st-esg-api-url').on('input', function () { settings.apiUrl = String($(this).val()); markSchemeDirty('api'); saveSettings(); });
  $t('#st-esg-api-key').on('input', function () { settings.apiKey = String($(this).val()); markSchemeDirty('api'); saveSettings(); });
  $t('#st-esg-api-model').on('input', function () { settings.apiModel = String($(this).val()); markSchemeDirty('api'); saveSettings(); });
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
    saveSettings();
  });
  $t('#st-esg-max-tokens').on('input', function () { settings.maxTokens = String($(this).val()); markSchemeDirty('api'); saveSettings(); });
  $t('#st-esg-temperature').on('input', function () { settings.temperature = String($(this).val()); markSchemeDirty('api'); saveSettings(); });
  $t('#st-esg-streaming-enabled').on('change', function () { settings.streamingEnabled = Boolean($(this).prop('checked')); markSchemeDirty('api'); saveSettings(); });
  $t('#st-esg-prompt-template-compat').on('change', function () { settings.promptTemplateCompatEnabled = Boolean($(this).prop('checked')); saveSettings(); });
  $t('#st-esg-inject-mode').on('change', function () { settings.injectMode = String($(this).val()); saveSettings(); });
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
  });
  $t('#st-esg-generate').on('click', () => generateStatusbar());
  $t('#st-esg-inject').on('click', () => injectGeneratedStatusbar());
  $t('#st-esg-generation-error').on('click', '#st-esg-show-generated-content', () => {
    settings.lastGenerationError = null;
    saveSettings();
    renderGenerationResultPanel();
  });
}

function mountUi() {
  if (!targetDoc.body) { targetWindow.setTimeout(mountUi, 500); return; }
  renderMagicWandMenuButton(); renderFloatingBall(); renderPluginPanel();
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
  loadSettings(); loadStylesheet(); mountUi();
  updateQuickReplyShortcutActions();
  void syncQuickReplyShortcuts();
  startTavernDefaultSync();
  const context = getContext();
  registerPromptSourceCacheInvalidation(context);
  if (context.eventTypes.MESSAGE_RECEIVED) context.eventSource.on(context.eventTypes.MESSAGE_RECEIVED, handleAssistantMessageReceived);
  console.log(`[${EXTENSION_ID}] 已加载，dialog top layer，UI 挂载文档：${targetWindow === window ? 'current' : 'parent'}`);
}

init();
