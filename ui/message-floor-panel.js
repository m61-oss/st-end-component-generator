const FLOOR_PANEL_STATUS = Object.freeze({
  IDLE: 'idle',
  GENERATING: 'generating',
  READY: 'ready',
  INJECTED: 'injected',
  ERROR: 'error',
});

const STATUS_LABELS = Object.freeze({
  [FLOOR_PANEL_STATUS.GENERATING]: '生成中',
  [FLOOR_PANEL_STATUS.READY]: '生成完成 · 待注入',
  [FLOOR_PANEL_STATUS.INJECTED]: '已注入',
  [FLOOR_PANEL_STATUS.ERROR]: '生成失败',
});

const ACTION_MODELS = Object.freeze({
  [FLOOR_PANEL_STATUS.IDLE]: Object.freeze({ action: 'generate', icon: 'fa-sparkles', label: '生成组件' }),
  [FLOOR_PANEL_STATUS.GENERATING]: Object.freeze({ action: 'stop', icon: 'fa-stop', label: '停止生成' }),
  [FLOOR_PANEL_STATUS.READY]: Object.freeze({ action: 'inject', icon: 'fa-file-import', label: '注入回复' }),
  [FLOOR_PANEL_STATUS.INJECTED]: Object.freeze({ action: 'undo', icon: 'fa-rotate-left', label: '撤回注入' }),
  [FLOOR_PANEL_STATUS.ERROR]: Object.freeze({ action: 'retry', icon: 'fa-rotate-right', label: '重试' }),
});

const ACTION_MODEL_GROUPS = Object.freeze({
  [FLOOR_PANEL_STATUS.IDLE]: Object.freeze([ACTION_MODELS[FLOOR_PANEL_STATUS.IDLE]]),
  [FLOOR_PANEL_STATUS.GENERATING]: Object.freeze([ACTION_MODELS[FLOOR_PANEL_STATUS.GENERATING]]),
  [FLOOR_PANEL_STATUS.READY]: Object.freeze([
    Object.freeze({ action: 'generate', icon: 'fa-rotate-right', label: '重新生成' }),
    ACTION_MODELS[FLOOR_PANEL_STATUS.READY],
  ]),
  [FLOOR_PANEL_STATUS.INJECTED]: Object.freeze([
    Object.freeze({ action: 'generate', icon: 'fa-rotate-right', label: '重新生成' }),
    ACTION_MODELS[FLOOR_PANEL_STATUS.INJECTED],
  ]),
  [FLOOR_PANEL_STATUS.ERROR]: Object.freeze([ACTION_MODELS[FLOOR_PANEL_STATUS.ERROR]]),
});

const STATUS_STAGE_MODELS = Object.freeze({
  [FLOOR_PANEL_STATUS.IDLE]: Object.freeze({
    label: '空闲', lead: '｡･ﾟ', shuttle: '', text: '织幕在打盹', face: '(˘ω˘)', tail: 'ﾟ･｡', motion: 'dozing',
  }),
  [FLOOR_PANEL_STATUS.GENERATING]: Object.freeze({
    label: '生成中', lead: '✦･ﾟ', shuttle: '⋈', text: '正在编织', face: '(ง •̀ω•́)ง', tail: '･ﾟ✧', motion: 'weaving',
  }),
  [FLOOR_PANEL_STATUS.READY]: Object.freeze({
    label: '生成完成，待注入', lead: '｡･:*:･ﾟ✦', shuttle: '', text: '织好啦', face: '(｡•̀ᴗ-)✧', tail: 'ﾟ･:*:･｡', motion: 'ready',
  }),
  [FLOOR_PANEL_STATUS.INJECTED]: Object.freeze({
    label: '已注入', lead: '◇ ･ﾟ', shuttle: '', text: '内容嵌好啦', face: '(๑˃ᴗ˂)ﻭ', tail: 'ﾟ･ ◈', motion: 'embedded',
  }),
  [FLOOR_PANEL_STATUS.ERROR]: Object.freeze({
    label: '生成失败', lead: '⌁ ･ﾟ', shuttle: '', text: '线团打结了', face: '(｡•́︿•̀｡)', tail: 'ﾟ･ ⌁', motion: 'tangled',
  }),
});

function normalizeStatus(status) {
  return Object.values(FLOOR_PANEL_STATUS).includes(status) ? status : FLOOR_PANEL_STATUS.IDLE;
}

function fingerprintMessageText(messageText) {
  const value = String(messageText ?? '');
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${value.length}:${(hash >>> 0).toString(16)}`;
}

function createFloorPanelTarget({ chatId = '', messageIndex = null, messageText = '' } = {}) {
  const index = Number(messageIndex);
  return {
    chatId: String(chatId ?? ''),
    messageIndex: Number.isInteger(index) ? index : null,
    fingerprint: fingerprintMessageText(messageText),
  };
}

function isFloorPanelTargetCurrent(target, { chatId = '', messageIndex = null, messageText = '' } = {}) {
  if (!target || typeof target !== 'object') return false;
  const current = createFloorPanelTarget({ chatId, messageIndex, messageText });
  return target.chatId === current.chatId
    && target.messageIndex === current.messageIndex
    && target.fingerprint === current.fingerprint;
}

function isFloorPanelTargetAddressable(target, current) {
  if (!target || !current) return false;
  return target.chatId === current.chatId
    && target.messageIndex === current.messageIndex;
}

function createFloorPanelState({ enabled = false } = {}) {
  return {
    enabled: Boolean(enabled),
    expanded: false,
    status: FLOOR_PANEL_STATUS.IDLE,
    resultMode: 'standard',
    thinking: '',
    output: '',
    anchorItems: [],
    error: null,
    target: null,
    generation: 0,
    streaming: false,
    injected: false,
  };
}

function nextFloorPanelGeneration(state, target) {
  const current = state && typeof state === 'object' ? state : createFloorPanelState();
  return {
    ...current,
    expanded: false,
    status: FLOOR_PANEL_STATUS.GENERATING,
    resultMode: 'standard',
    thinking: '',
    output: '',
    anchorItems: [],
    error: null,
    target: target || null,
    generation: Number(current.generation || 0) + 1,
    streaming: true,
    injected: false,
  };
}

function isFloorPanelGenerationCurrent(state, generation, target) {
  if (!state || typeof state !== 'object') return false;
  if (state.generation !== generation) return false;
  if (!state.target || !target) return false;
  return state.target.chatId === target.chatId
    && state.target.messageIndex === target.messageIndex
    && state.target.fingerprint === target.fingerprint;
}

function getFloorPanelStatusLabel(status) {
  return STATUS_LABELS[normalizeStatus(status)] || '';
}

function getFloorPanelActionModel(status) {
  return ACTION_MODELS[normalizeStatus(status)] || ACTION_MODELS[FLOOR_PANEL_STATUS.IDLE];
}

function getFloorPanelActionModels(status) {
  return ACTION_MODEL_GROUPS[normalizeStatus(status)] || ACTION_MODEL_GROUPS[FLOOR_PANEL_STATUS.IDLE];
}

function getFloorPanelStatusStage(status) {
  return STATUS_STAGE_MODELS[normalizeStatus(status)] || STATUS_STAGE_MODELS[FLOOR_PANEL_STATUS.IDLE];
}

function canEditFloorPanelResult({ status, streaming = false } = {}) {
  return normalizeStatus(status) === FLOOR_PANEL_STATUS.READY && streaming !== true;
}

export {
  FLOOR_PANEL_STATUS,
  canEditFloorPanelResult,
  createFloorPanelState,
  createFloorPanelTarget,
  fingerprintMessageText,
  getFloorPanelActionModel,
  getFloorPanelActionModels,
  getFloorPanelStatusStage,
  getFloorPanelStatusLabel,
  isFloorPanelGenerationCurrent,
  isFloorPanelTargetAddressable,
  isFloorPanelTargetCurrent,
  nextFloorPanelGeneration,
};
