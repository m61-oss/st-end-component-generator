import { buildBaiBaiBookInjections } from '../sources/baibai-book.js';
import { applyAnimaWorldbookOverrides, getAnimaEntryKind, replaceAnimaStatusMacros } from '../sources/anima-memory.js';
import { stripHistoryBlocksByRules } from '../injection/tag-rules.js';
import { buildOutputProtocolMessage } from './output-protocol.js';
import { CHAT_HISTORY_RANGE_VISIBLE, selectChatHistoryMessages } from './chat-history-range.js';

const textOf = (value) => String(value ?? '').trim();

function getRecentChatText(chat, { includeUserMessages = true, historyCleanupTags = '', historyRangeMode = CHAT_HISTORY_RANGE_VISIBLE, recentMessageCount = 10 } = {}) {
  return stripHistoryBlocksByRules(selectChatHistoryMessages(chat, { mode: historyRangeMode, recentMessageCount }), historyCleanupTags)
    .filter((item) => includeUserMessages || !item?.is_user)
    .map((item) => `${item?.is_user ? '用户' : '助手'}：${item?.mes || ''}`)
    .join('\n\n');
}

function getRecentChatMessages(chat, { historyCleanupTags = '', historyRangeMode = CHAT_HISTORY_RANGE_VISIBLE, recentMessageCount = 10 } = {}) {
  const sourceChat = Array.isArray(chat) ? chat : [];
  const selectedMessages = selectChatHistoryMessages(sourceChat, { mode: historyRangeMode, recentMessageCount })
    .map((item) => ({ ...item, __stEsgSourceMessageIndex: sourceChat.indexOf(item) }));
  return stripHistoryBlocksByRules(selectedMessages, historyCleanupTags)
    .map((item) => ({
      role: item?.is_user ? 'user' : 'assistant',
      content: textOf(item?.mes),
      originalUserMessage: Boolean(item?.is_user),
      sourceMessageIndex: Number.isInteger(item?.__stEsgSourceMessageIndex)
        ? item.__stEsgSourceMessageIndex
        : sourceChat.indexOf(item),
    }))
    .filter((message) => textOf(message.content));
}

const IN_CHAT_ROLE_ORDER = ['system', 'user', 'assistant'];

function normalizeDepth(value, fallback = 4) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.floor(number));
}

function normalizeInjectionOrder(value, fallback = 100) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return number;
}

function getWorldbookEntryRole(entry) {
  const role = entry?.role ?? entry?.extensions?.role ?? entry?.position?.role;
  if (role === 0 || textOf(role) === '0') return 'system';
  if (role === 1 || textOf(role) === '1') return 'user';
  if (role === 2 || textOf(role) === '2') return 'assistant';
  return normalizeRole(role);
}

function buildInChatInjectionMessages(injections = []) {
  const groups = new Map();
  for (const injection of Array.isArray(injections) ? injections : []) {
    const content = textOf(injection?.content);
    if (!content) continue;
    const depth = normalizeDepth(injection?.depth, 0);
    const order = normalizeInjectionOrder(injection?.order);
    const role = normalizeRole(injection?.role);
    const preserveSystemMessage = Boolean(injection?.preserveSystemMessage);
    const key = `${depth}\u0000${order}\u0000${role}\u0000${preserveSystemMessage}`;
    if (!groups.has(key)) groups.set(key, { depth, order, role, preserveSystemMessage, contents: [] });
    groups.get(key).contents.push(content);
  }

  return [...groups.values()]
    .sort((a, b) => a.depth - b.depth || b.order - a.order || IN_CHAT_ROLE_ORDER.indexOf(a.role) - IN_CHAT_ROLE_ORDER.indexOf(b.role))
    .map((group) => {
      const message = {
        role: group.role,
        content: group.contents.join('\n'),
        injected: true,
        injectionDepth: group.depth,
        injectionOrder: group.order,
      };
      if (group.preserveSystemMessage) {
        Object.defineProperty(message, 'preserveSystemMessage', { value: true, enumerable: false });
      }
      return message;
    });
}

function applyInChatInjections(chatMessages, injections = [], depthReferenceMessages = []) {
  const workingMessages = [
    ...(Array.isArray(chatMessages) ? chatMessages : []),
    ...(Array.isArray(depthReferenceMessages) ? depthReferenceMessages : []),
  ].reverse();
  const injectionMessages = buildInChatInjectionMessages(injections);
  let totalInsertedMessages = 0;
  let index = 0;

  while (index < injectionMessages.length) {
    const depth = injectionMessages[index].injectionDepth;
    const roleMessages = [];
    while (index < injectionMessages.length && injectionMessages[index].injectionDepth === depth) {
      const { injectionDepth, injectionOrder, ...message } = injectionMessages[index];
      roleMessages.push(message);
      index += 1;
    }
    const injectIndex = Math.min(depth + totalInsertedMessages, workingMessages.length);
    workingMessages.splice(injectIndex, 0, ...roleMessages);
    totalInsertedMessages += roleMessages.length;
  }

  return workingMessages.reverse().filter((message) => !message?._depthReferenceOnly);
}

function normalizeMessageIndex(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function insertAnchoredInjections(messages, injections = []) {
  const groups = new Map();
  const fallback = [];
  for (const injection of Array.isArray(injections) ? injections : []) {
    const content = textOf(injection?.content);
    if (!content) continue;
    const messageIndex = normalizeMessageIndex(injection?.messageIndex);
    const message = {
      role: normalizeRole(injection?.role),
      content,
      injected: true,
      animaStatusInjection: true,
    };
    if (messageIndex === null) {
      fallback.push(message);
      continue;
    }
    if (!groups.has(messageIndex)) groups.set(messageIndex, []);
    groups.get(messageIndex).push(message);
  }

  const result = Array.isArray(messages) ? messages : [];
  for (const [messageIndex, anchoredMessages] of groups.entries()) {
    const targetIndex = result.findIndex((message) => message?.sourceMessageIndex === messageIndex);
    if (targetIndex >= 0) result.splice(targetIndex + 1, 0, ...anchoredMessages);
    else fallback.push(...anchoredMessages);
  }
  if (fallback.length) {
    const lastAssistantIndex = result.findLastIndex((message) => message?.role === 'assistant');
    result.splice(lastAssistantIndex >= 0 ? lastAssistantIndex + 1 : result.length, 0, ...fallback);
  }
  return result;
}

function getCharacterName(context) {
  const characterId = textOf(context?.characterId) || textOf(context?.this_chid);
  const character = context?.characters?.[characterId];
  return textOf(context?.name2 || context?.characterName || character?.name || character?.data?.name || '角色');
}

function getSelectedCharacter(context) {
  const characterId = textOf(context?.characterId) || textOf(context?.this_chid);
  return context?.characters?.[characterId] || {};
}

function getCharacterField(context, field) {
  const cardFields = getCharacterCardFieldsSafe(context);
  const fieldMap = {
    description: cardFields.description,
    personality: cardFields.personality,
    scenario: cardFields.scenario,
    mes_example: cardFields.mesExamples,
    persona: cardFields.persona,
  };
  if (textOf(fieldMap[field])) return textOf(fieldMap[field]);
  const character = getSelectedCharacter(context);
  return textOf(character?.[field] || character?.data?.[field]);
}

function getCharacterCardFieldsSafe(context) {
  if (typeof context?.getCharacterCardFields !== 'function') return {};
  try {
    return context.getCharacterCardFields({ chid: context?.characterId ?? context?.this_chid }) || {};
  } catch {
    try {
      return context.getCharacterCardFields() || {};
    } catch {
      return {};
    }
  }
}

function getRuntimeMarkerContent(markerType, context, worldbooks = null) {
  switch (textOf(markerType)) {
    case 'charDescription':
      return getCharacterField(context, 'description');
    case 'charPersonality':
      return getCharacterField(context, 'personality');
    case 'scenario':
      return getCharacterField(context, 'scenario');
    case 'dialogueExamples':
      return [
        ...(worldbooks?.emTop || []),
        getCharacterField(context, 'mes_example'),
        ...(worldbooks?.emBottom || []),
      ].map(textOf).filter(Boolean).join('\n');
    case 'personaDescription':
      return getCharacterField(context, 'persona') || textOf(context?.powerUserSettings?.persona_description || context?.power_user?.persona_description || context?.personaDescription);
    default:
      return '';
  }
}

export function createRuntimePromptDiagnostics({ context, promptSourceItems, runtimeInsertions } = {}) {
  const markerTypes = (Array.isArray(promptSourceItems) ? promptSourceItems : [])
    .map((item) => textOf(item?.markerType))
    .filter(Boolean);
  return {
    characterFields: {
      characterId: textOf(context?.characterId) || textOf(context?.this_chid),
      descriptionLength: getCharacterField(context, 'description').length,
      personalityLength: getCharacterField(context, 'personality').length,
      scenarioLength: getCharacterField(context, 'scenario').length,
      dialogueExamplesLength: getCharacterField(context, 'mes_example').length,
      personaLength: getCharacterField(context, 'persona').length,
    },
    selectedPromptMarkers: [...new Set(markerTypes)],
    runtimeInsertions: runtimeInsertions || null,
  };
}

function getUserName(context) {
  return textOf(context?.name1 || context?.userName || 'User');
}

function getCurrentPreset(targetWindow, context) {
  const candidates = [targetWindow, targetWindow?.parent, globalThis].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const preset = candidate?.getPreset?.('in_use');
      if (preset && Array.isArray(preset.prompts)) return preset;
    } catch {}
  }
  const helper = targetWindow?.TavernHelper;
  const presetName = textOf(helper?.getCurrentPresetName?.() || helper?.getSelectedPresetName?.() || context?.presetName);
  if (!presetName) return null;
  try {
    return helper?.getPreset?.(presetName) || null;
  } catch {
    return null;
  }
}

function getPromptIdentifier(prompt) {
  return textOf(prompt?.identifier || prompt?.id || prompt?.name);
}

const NATIVE_PRESET_MARKER_NAMES = new Map([
  ['world info (before)', 'worldInfoBefore'],
  ['world info (after)', 'worldInfoAfter'],
  ['char description', 'charDescription'],
  ['char personality', 'charPersonality'],
  ['scenario', 'scenario'],
  ['persona description', 'personaDescription'],
  ['chat examples', 'dialogueExamples'],
  ['chat history', 'chatHistory'],
]);

function getNativePresetMarkerType(value) {
  const identifier = typeof value === 'object' ? getPromptIdentifier(value) : textOf(value);
  if ([
    'worldInfoBefore',
    'worldInfoAfter',
    'charDescription',
    'charPersonality',
    'scenario',
    'personaDescription',
    'dialogueExamples',
    'chatHistory',
  ].includes(identifier)) return identifier;

  const name = typeof value === 'object' ? textOf(value?.name).toLowerCase() : '';
  return NATIVE_PRESET_MARKER_NAMES.get(name) || '';
}

function createNativePresetMarkerPrompt(identifier) {
  const clean = textOf(identifier);
  const markerType = getNativePresetMarkerType(clean);
  if (!markerType) return null;
  return {
    identifier: markerType,
    role: 'system',
    marker: true,
    content: '',
  };
}

function getActivePresetPromptOrder(preset) {
  const lists = Array.isArray(preset?.prompt_order) ? preset.prompt_order : [];
  const preferred = lists.find((list) => String(list?.character_id) === '100001' && Array.isArray(list?.order));
  return (preferred || lists.find((list) => Array.isArray(list?.order)))?.order || [];
}

function getOrderedEnabledPrompts(preset) {
  const prompts = Array.isArray(preset?.prompts) ? preset.prompts : [];
  const promptMap = new Map(prompts.map((prompt) => [getPromptIdentifier(prompt), prompt]).filter(([id]) => Boolean(id)));
  const orderList = getActivePresetPromptOrder(preset);
  const used = new Set();
  const ordered = [];
  for (const orderItem of orderList) {
    const id = textOf(orderItem?.identifier);
    const prompt = promptMap.get(id) || createNativePresetMarkerPrompt(id);
    if (id) used.add(id);
    if (!prompt || orderItem?.enabled === false) continue;
    ordered.push(prompt);
  }
  if (orderList.length) return ordered;
  for (const prompt of prompts) {
    const id = getPromptIdentifier(prompt);
    if (!id || used.has(id) || prompt?.enabled === false) continue;
    ordered.push(prompt);
  }
  return ordered;
}

function getLastUserMessage(context) {
  for (let index = (Array.isArray(context?.chat) ? context.chat : []).length - 1; index >= 0; index -= 1) {
    const item = context.chat[index];
    if (item?.is_user && textOf(item?.mes)) return item.mes;
  }
  return '';
}

function replaceMacros(content, { context, latestMessage, lastUserMessageOverride = '', includeUserMessages = true, historyCleanupTags = '', historyRangeMode = CHAT_HISTORY_RANGE_VISIBLE, recentMessageCount = 10, animaStatus = null, animaYaml = null }) {
  const chatHistory = getRecentChatText(context?.chat, { includeUserMessages, historyCleanupTags, historyRangeMode, recentMessageCount });
  const charName = getCharacterName(context);
  const userName = getUserName(context);
  const lastUserMessage = textOf(lastUserMessageOverride) || getLastUserMessage(context);
  const replacements = {
    '{{char}}': charName,
    '{{user}}': userName,
    '{{lastMessage}}': latestMessage?.mes || '',
    '{{lastAssistantMessage}}': latestMessage?.mes || '',
    '{{lastUserMessage}}': lastUserMessage,
    '{{LastUserMessage}}': lastUserMessage,
    '{{recentChat}}': chatHistory,
    '{{chatHistory}}': chatHistory,
    '{{description}}': context?.characters?.[context?.characterId ?? context?.this_chid]?.description || context?.characters?.[context?.characterId ?? context?.this_chid]?.data?.description || '',
    '{{scenario}}': context?.characters?.[context?.characterId ?? context?.this_chid]?.scenario || context?.characters?.[context?.characterId ?? context?.this_chid]?.data?.scenario || '',
    '{{personality}}': context?.characters?.[context?.characterId ?? context?.this_chid]?.personality || context?.characters?.[context?.characterId ?? context?.this_chid]?.data?.personality || '',
  };
  const replaced = Object.entries(replacements).reduce((text, [key, value]) => text.split(key).join(String(value ?? '')), String(content || ''));
  return replaceAnimaStatusMacros(replaced, animaStatus, { yamlLibrary: animaYaml });
}

function normalizeRole(role) {
  const clean = textOf(role).toLowerCase();
  if (['system', 'assistant', 'user'].includes(clean)) return clean;
  return 'system';
}

function applySubstituteParams(content, substituteParams) {
  const text = String(content || '');
  if (typeof substituteParams !== 'function') return text;
  try {
    return String(substituteParams(text) ?? '');
  } catch {
    return text;
  }
}

function getActiveWorldbookNames(targetWindow) {
  const names = [];
  const seen = new Set();
  const add = (name) => {
    const clean = textOf(name);
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    names.push(clean);
  };
  try {
    const globalNames = targetWindow?.TavernHelper?.getGlobalWorldbookNames?.() || [];
    (Array.isArray(globalNames) ? globalNames : [globalNames]).forEach(add);
  } catch {}
  try {
    const charBooks = targetWindow?.TavernHelper?.getCharWorldbookNames?.('current') || {};
    add(charBooks.primary);
    (Array.isArray(charBooks.additional) ? charBooks.additional : []).forEach(add);
  } catch {}
  try {
    add(targetWindow?.TavernHelper?.getChatWorldbookName?.('current'));
  } catch {}
  return names;
}

async function loadWorldbookEntries(targetWindow, name) {
  try {
    if (typeof targetWindow?.SillyTavern?.loadWorldInfo === 'function') {
      const book = await targetWindow.SillyTavern.loadWorldInfo(name);
      const entries = book?.entries || book;
      return Array.isArray(entries) ? entries : Object.values(entries || {});
    }
  } catch {}
  try {
    if (typeof targetWindow?.TavernHelper?.getWorldbook === 'function') {
      const book = await targetWindow.TavernHelper.getWorldbook(name);
      return Array.isArray(book) ? book : Object.values(book?.entries || book || {});
    }
  } catch {}
  return [];
}

function isWorldbookEntryEnabled(entry) {
  if (!entry) return false;
  if (typeof entry.disable === 'boolean') return !entry.disable;
  if (typeof entry.enabled === 'boolean') return entry.enabled;
  return true;
}

function getWorldbookInsertionBucket(entry) {
  const position = entry?.position;
  if (position === 0 || textOf(position) === '0' || textOf(position) === 'before_char' || textOf(position) === 'before_character_definition') return 'before';
  if (position === 1 || textOf(position) === '1' || textOf(position) === 'after_char' || textOf(position) === 'after_character_definition') return 'after';
  if (position === 2 || textOf(position) === '2' || textOf(position) === 'an_top' || textOf(position) === 'author_note_top' || textOf(position) === 'before_author_note') return 'anTop';
  if (position === 3 || textOf(position) === '3' || textOf(position) === 'an_bottom' || textOf(position) === 'author_note_bottom' || textOf(position) === 'after_author_note') return 'anBottom';
  if (position === 4 || textOf(position) === '4' || textOf(position) === 'at_depth') return 'atDepth';
  if (position === 5 || textOf(position) === '5' || textOf(position) === 'em_top' || textOf(position) === 'example_messages_top') return 'emTop';
  if (position === 6 || textOf(position) === '6' || textOf(position) === 'em_bottom' || textOf(position) === 'example_messages_bottom') return 'emBottom';
  if (position === 7 || textOf(position) === '7' || textOf(position) === 'outlet') return 'outlet';
  if (typeof position === 'object' && position) {
    const type = textOf(position.type);
    if (type === 'before_character_definition' || type === 'before_char') return 'before';
    if (type === 'after_character_definition' || type === 'after_char') return 'after';
    if (type === 'an_top' || type === 'author_note_top' || type === 'before_author_note') return 'anTop';
    if (type === 'an_bottom' || type === 'author_note_bottom' || type === 'after_author_note') return 'anBottom';
    if (type === 'at_depth') return 'atDepth';
    if (type === 'em_top' || type === 'example_messages_top') return 'emTop';
    if (type === 'em_bottom' || type === 'example_messages_bottom') return 'emBottom';
    if (type === 'outlet') return 'outlet';
  }
  return 'after';
}

function getWorldbookEntryOrder(entry) {
  return normalizeInjectionOrder(entry?.injection_order ?? entry?.injectionOrder ?? entry?.order ?? entry?.insertion_order ?? entry?.extensions?.order ?? entry?.position?.order, 100);
}

function getWorldbookEntryDepth(entry) {
  return normalizeDepth(entry?.depth ?? entry?.extensions?.depth ?? entry?.injection_depth ?? entry?.injectionDepth ?? entry?.position?.depth, 4);
}

function stringifyWorldbookPosition(position) {
  if (typeof position === 'object' && position) return textOf(position.type || JSON.stringify(position));
  return textOf(position);
}

async function collectRuntimeWorldbookInserts(targetWindow, substituteParams, { animaWorldbookEntries = [], animaStatus = null, animaStatusMessageIndex = null, animaYaml = null } = {}) {
  const buckets = createEmptyWorldbookInserts();
  for (const name of getActiveWorldbookNames(targetWindow)) {
    const entries = applyAnimaWorldbookOverrides(await loadWorldbookEntries(targetWindow, name), animaWorldbookEntries);
    for (const entry of entries) {
      if (!isWorldbookEntryEnabled(entry)) continue;
      const entryKind = getAnimaEntryKind(entry);
      const content = textOf(applySubstituteParams(replaceAnimaStatusMacros(entry?.content, animaStatus, { yamlLibrary: animaYaml }), substituteParams));
      if (!content) continue;
      const bucket = getWorldbookInsertionBucket(entry);
      const role = getWorldbookEntryRole(entry);
      const depth = getWorldbookEntryDepth(entry);
      const order = getWorldbookEntryOrder(entry);
      buckets.debug.push({
        bookName: name,
        uid: textOf(entry?.uid ?? entry?.id ?? entry?.key),
        position: stringifyWorldbookPosition(entry?.position),
        bucket,
        depth,
        role,
        order,
        contentPreview: content.slice(0, 80),
      });
      if (entryKind === 'status' && normalizeMessageIndex(animaStatusMessageIndex) !== null) {
        buckets.animaStatus.push({ role, content, messageIndex: normalizeMessageIndex(animaStatusMessageIndex), source: 'animaStatus' });
        continue;
      }
      if (bucket === 'atDepth') {
        buckets.atDepth.push({
          role,
          content,
          depth,
          order,
          source: 'worldbook',
        });
      } else if (bucket === 'anTop' || bucket === 'anBottom' || bucket === 'emTop' || bucket === 'emBottom') {
        buckets[bucket].unshift(content);
      } else {
        buckets[bucket].push(content);
      }
    }
  }
  return buckets;
}

function createEmptyWorldbookInserts() {
  return { before: [], after: [], anTop: [], anBottom: [], atDepth: [], emTop: [], emBottom: [], outlet: [], animaStatus: [], debug: [] };
}

function collectPromptSourceWorldbookInserts(items = [], substituteParams, animaStatus = null, animaYaml = null, animaStatusMessageIndex = null) {
  const buckets = createEmptyWorldbookInserts();
  for (const item of Array.isArray(items) ? items : []) {
    if (!isWorldbookSourceItem(item)) continue;
    const itemKind = getAnimaEntryKind(item);
    const hasPlacementMetadata = ['worldbookPosition', 'worldbookDepth', 'worldbookRole', 'worldbookOrder']
      .some((key) => Object.prototype.hasOwnProperty.call(item, key));
    const content = textOf(applySubstituteParams(replaceAnimaStatusMacros(item?.content, animaStatus, { yamlLibrary: animaYaml }), substituteParams));
    if (!content) continue;
    if (itemKind === 'status' && normalizeMessageIndex(animaStatusMessageIndex) !== null) {
      buckets.animaStatus.push({ role: getWorldbookEntryRole(item), content, messageIndex: normalizeMessageIndex(animaStatusMessageIndex), source: 'animaStatus' });
      continue;
    }
    if (!hasPlacementMetadata) continue;
    const entry = {
      position: item.worldbookPosition,
      depth: item.worldbookDepth,
      role: item.worldbookRole,
      order: item.worldbookOrder,
    };
    const bucket = getWorldbookInsertionBucket(entry);
    const role = getWorldbookEntryRole(entry);
    const depth = getWorldbookEntryDepth(entry);
    const order = getWorldbookEntryOrder(entry);
    buckets.debug.push({
      bookName: textOf(item?.source),
      uid: textOf(item?.sourceUid ?? item?.key),
      position: stringifyWorldbookPosition(item.worldbookPosition),
      bucket,
      depth,
      role,
      order,
      contentPreview: content.slice(0, 80),
    });
    if (bucket === 'atDepth') {
      buckets.atDepth.push({ role, content, depth, order, source: 'worldbook' });
    } else if (bucket === 'anTop' || bucket === 'anBottom' || bucket === 'emTop' || bucket === 'emBottom') {
      buckets[bucket].unshift(content);
    } else {
      buckets[bucket].push(content);
    }
  }
  return buckets;
}

function getAuthorNoteMetadata(targetWindow, context) {
  const metadata = context?.chat_metadata || targetWindow?.chat_metadata || {};
  return {
    prompt: textOf(metadata.note_prompt),
    position: normalizeDepth(metadata.note_position, 1),
    depth: normalizeDepth(metadata.note_depth, 4),
    role: getWorldbookEntryRole({ role: metadata.note_role ?? 0 }),
  };
}

function buildAuthorNoteInChatInjection(targetWindow, context, worldbooks) {
  const metadata = getAuthorNoteMetadata(targetWindow, context);
  const parts = [
    ...worldbooks.anTop,
    metadata.prompt,
    ...worldbooks.anBottom,
  ].map(textOf).filter(Boolean);
  if (!parts.length || metadata.position !== 1) return null;
  return {
    role: metadata.role,
    content: parts.join('\n'),
    depth: metadata.depth,
    order: 100,
    source: 'authorNote',
  };
}

function replaceRuntimeMarkerMessages(messages, markerType, role, contents) {
  let inserted = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.runtimeMarkerType !== markerType) continue;
    const sourceItemId = messages[index]?.sourceItemId;
    const insertMessages = contents.map(textOf).filter(Boolean).map((content) => ({ role, content, sourceItemId }));
    const replacements = inserted ? [] : insertMessages;
    messages.splice(index, 1, ...replacements);
    inserted += replacements.length;
  }
  return inserted;
}

function applyRuntimeTemplateInsertions(messages, { context, worldbooks }) {
  const beforeWorldbook = worldbooks.before.join('\n\n');
  const afterWorldbook = worldbooks.after.join('\n\n');
  const insertions = {
    charInfoLength: getCharacterField(context, 'description').length,
    userInfoLength: getRuntimeMarkerContent('personaDescription', context).length,
    worldbookBeforeCount: worldbooks.before.length,
    worldbookAfterCount: worldbooks.after.length,
    worldbookAtDepthCount: worldbooks.atDepth.length,
    authorNoteWorldbookCount: worldbooks.anTop.length + worldbooks.anBottom.length,
    exampleMessageWorldbookCount: worldbooks.emTop.length + worldbooks.emBottom.length,
    outletWorldbookCount: worldbooks.outlet.length,
    worldbookDebug: worldbooks.debug,
    insertedMessageCount: 0,
  };
  insertions.insertedMessageCount += replaceRuntimeMarkerMessages(messages, 'worldInfoBefore', 'system', [beforeWorldbook]);
  insertions.insertedMessageCount += replaceRuntimeMarkerMessages(messages, 'worldInfoAfter', 'system', [afterWorldbook]);
  return insertions;
}

function isWorldbookSourceItem(item) {
  return textOf(item?.scope) === '世界书';
}

function isWorldInfoMarker(markerType) {
  return ['worldInfoBefore', 'worldInfoAfter'].includes(textOf(markerType));
}

function buildChatHistoryMessages(context, { includeUserMessages = true, historyCleanupTags = '', historyRangeMode = CHAT_HISTORY_RANGE_VISIBLE, recentMessageCount = 10, inChatInjections = [], depthReferenceMessages = [], anchoredInjections = [] } = {}) {
  const chatMessages = getRecentChatMessages(context?.chat, { historyCleanupTags, historyRangeMode, recentMessageCount });
  const messages = applyInChatInjections(chatMessages, inChatInjections, depthReferenceMessages);
  const filteredMessages = includeUserMessages ? messages : messages.filter((message) => !message?.originalUserMessage);
  return insertAnchoredInjections(filteredMessages, anchoredInjections);
}

function buildPromptSourceMessages(promptSourceItems, { context, latestMessage, substituteParams, lastUserMessageOverride = '', includeUserMessages = true, historyCleanupTags = '', historyRangeMode = CHAT_HISTORY_RANGE_VISIBLE, recentMessageCount = 10, inChatInjections = [], depthReferenceMessages = [], anchoredInjections = [], worldbooks = null, worldbookSourceControlled = false, animaStatus = null, animaStatusMessageIndex = null, animaYaml = null }) {
  const items = Array.isArray(promptSourceItems) ? promptSourceItems : [];
  const worldbookItems = items.filter(isWorldbookSourceItem);
  const hasWorldInfoMarker = items.some((item) => isWorldInfoMarker(item?.markerType));
  let worldbookInserted = false;
  const messages = [];

  for (const item of items) {
    const sourceItemId = getPromptSourceItemId(item);
    const markerType = textOf(item?.markerType);
    if (isWorldbookSourceItem(item) && hasWorldInfoMarker) continue;

    if (isWorldInfoMarker(markerType)) {
      if (item?.locked && !(worldbookSourceControlled && isWorldInfoMarker(markerType) && worldbookItems.length)) {
        messages.push({ role: normalizeRole(item?.role), content: '', runtimeMarkerType: markerType, sourceItemId });
        continue;
      }
      if (worldbookItems.length) {
        if (worldbookInserted) continue;
        worldbookInserted = true;
        for (const worldbookItem of worldbookItems) {
          if (getAnimaEntryKind(worldbookItem) === 'status' && normalizeMessageIndex(animaStatusMessageIndex) !== null) continue;
          const content = textOf(applySubstituteParams(replaceAnimaStatusMacros(worldbookItem?.content, animaStatus, { yamlLibrary: animaYaml }), substituteParams));
          if (content) messages.push({ role: normalizeRole(worldbookItem?.role), content, sourceItemId: getPromptSourceItemId(worldbookItem) });
        }
      } else {
        messages.push({ role: normalizeRole(item?.role), content: '', runtimeMarkerType: markerType, sourceItemId });
      }
      continue;
    }

    if (markerType === 'chatHistory') {
      messages.push(...buildChatHistoryMessages(context, { includeUserMessages, historyCleanupTags, historyRangeMode, recentMessageCount, inChatInjections, depthReferenceMessages, anchoredInjections }).map((message) => ({
        ...message,
        sourceItemId,
        sourceMarkerType: markerType,
      })));
      continue;
    }

    const runtimeMarkerContent = getRuntimeMarkerContent(markerType, context, worldbooks);
    const rawContent = runtimeMarkerContent || replaceMacros(item?.content, { context, latestMessage, lastUserMessageOverride, includeUserMessages, historyCleanupTags, historyRangeMode, recentMessageCount, animaStatus, animaYaml });
    const content = textOf(applySubstituteParams(rawContent, substituteParams));
    if (content) messages.push({ role: normalizeRole(item?.role), content, sourceItemId });
  }

  return messages;
}

function buildPresetPromptSourceItems(preset, { context, latestMessage, substituteParams, lastUserMessageOverride = '', includeUserMessages = true, historyCleanupTags = '', historyRangeMode = CHAT_HISTORY_RANGE_VISIBLE, recentMessageCount = 10, animaStatus = null, animaYaml = null }) {
  return getOrderedEnabledPrompts(preset).map((prompt) => {
    const identifier = getPromptIdentifier(prompt);
    const markerType = getNativePresetMarkerType(prompt);
    return {
      scope: '预设',
      sourceUid: identifier,
      identifier,
      name: prompt?.name || identifier,
      role: prompt?.role,
      markerType,
      locked: Boolean(markerType),
      content: markerType ? '' : applySubstituteParams(replaceMacros(prompt?.content, { context, latestMessage, lastUserMessageOverride, includeUserMessages, historyCleanupTags, historyRangeMode, recentMessageCount, animaStatus, animaYaml }), substituteParams),
    };
  });
}

function getPromptSourceItemId(item) {
  return textOf(item?.key || item?.sourceUid || item?.identifier || item?.id || item?.name);
}

function getPromptSourceDeduplicationKey(item) {
  const markerType = textOf(item?.markerType);
  if (markerType) return `marker:${markerType}`;
  const sourceIdentity = textOf(item?.sourceUid || item?.identifier || item?.id || item?.key || item?.name);
  return `source:${textOf(item?.scope)}\u0000${textOf(item?.source)}\u0000${sourceIdentity}`;
}

function dedupePromptSourceItems(items) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const key = getPromptSourceDeduplicationKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeMissingPresetMarkers(promptSourceItems, preset, options) {
  const selectedItems = Array.isArray(promptSourceItems) ? promptSourceItems : [];
  if (!selectedItems.length || selectedItems.some((item) => textOf(item?.markerType))) return selectedItems;
  const presetItems = buildPresetPromptSourceItems(preset, options);
  if (!presetItems.some((item) => textOf(item?.markerType))) return selectedItems;

  const selectedById = new Map();
  selectedItems.forEach((item) => {
    const id = getPromptSourceItemId(item);
    if (id && !selectedById.has(id)) selectedById.set(id, item);
  });

  const used = new Set();
  const merged = [];
  presetItems.forEach((presetItem) => {
    if (textOf(presetItem?.markerType)) {
      merged.push(presetItem);
      return;
    }
    const selected = selectedById.get(getPromptSourceItemId(presetItem));
    if (selected) {
      used.add(selected);
      merged.push(selected);
    } else if (textOf(presetItem?.content)) {
      merged.push(presetItem);
    }
  });

  selectedItems.forEach((item) => {
    if (!used.has(item)) merged.push(item);
  });
  return merged;
}

function buildComponentText(components, substituteParams, animaStatus = null, animaYaml = null) {
  return (Array.isArray(components) ? components : [])
    .map((item) => applySubstituteParams(replaceAnimaStatusMacros(item.content || '', animaStatus, { yamlLibrary: animaYaml }), substituteParams))
    .filter(textOf)
    .join('\n\n');
}

const EXTERNAL_COMPONENTS_PLACEHOLDER = '{{external_components}}';

async function buildPluginTaskMessage({ taskPrompt, components, theaterComponents, substituteParams, renderTemplate, animaStatus = null, animaYaml = null }) {
  const task = applySubstituteParams(replaceAnimaStatusMacros(taskPrompt, animaStatus, { yamlLibrary: animaYaml }), substituteParams);
  const allComponents = [
    ...(Array.isArray(components) ? components : []),
    ...(Array.isArray(theaterComponents) ? theaterComponents : []),
  ];
  const expandedTask = task.includes(EXTERNAL_COMPONENTS_PLACEHOLDER)
    ? task.split(EXTERNAL_COMPONENTS_PLACEHOLDER).join(buildComponentText(allComponents, substituteParams, animaStatus, animaYaml))
    : task;
  return renderTemplate ? await renderTemplate(expandedTask) : expandedTask;
}

function insertTaskMessage(messages, taskMessage, taskPlacement) {
  const protocolMessage = buildOutputProtocolMessage();
  const afterSourceId = textOf(taskPlacement?.enabled ? taskPlacement?.afterSourceId : '');
  if (!afterSourceId) {
    messages.push(taskMessage, protocolMessage);
    return;
  }
  const index = afterSourceId === TASK_PLACEMENT_AFTER_CHAT_HISTORY
    ? messages.findLastIndex((message) => textOf(message?.sourceMarkerType) === 'chatHistory')
    : messages.findLastIndex((message) => textOf(message?.sourceItemId) === afterSourceId);
  messages.splice(index >= 0 ? index + 1 : messages.length, 0, taskMessage);
  messages.push(protocolMessage);
}

function stripInternalMessageFields(messages) {
  messages.forEach((message) => {
    delete message.runtimeMarkerType;
    delete message.sourceItemId;
    delete message.sourceMarkerType;
    delete message.injected;
    delete message.originalUserMessage;
    delete message.sourceMessageIndex;
    delete message.animaStatusInjection;
  });
  return messages;
}

export async function buildExternalStatusbarMessages({ targetWindow, context, latestMessage, taskPrompt, components, theaterComponents, promptSourceItems, worldbookSourceControlled = false, historyCleanupTags = '', historyRangeMode = CHAT_HISTORY_RANGE_VISIBLE, recentMessageCount = 10, substituteParams, taskPlacement, replaceLastUserMessageWithTask = false, omitOriginalUserMessages = false, baiBaiBook = null, animaStatus = null, animaStatusMessageIndex = null, animaWorldbookEntries = [], animaYaml = null, renderTemplate = null }) {
  const hasSelectedPromptSources = Array.isArray(promptSourceItems) && promptSourceItems.length > 0;
  const preset = getCurrentPreset(targetWindow, context);
  const worldbooks = worldbookSourceControlled
    ? collectPromptSourceWorldbookInserts(promptSourceItems, substituteParams, animaStatus, animaYaml, animaStatusMessageIndex)
    : await collectRuntimeWorldbookInserts(targetWindow, substituteParams, { animaWorldbookEntries, animaStatus, animaStatusMessageIndex, animaYaml });
  const authorNoteInjection = buildAuthorNoteInChatInjection(targetWindow, context, worldbooks);
  const baiBaiBookInjections = buildBaiBaiBookInjections(baiBaiBook || {});
  const inChatInjections = [
    ...(authorNoteInjection ? [authorNoteInjection] : []),
    ...worldbooks.atDepth,
    ...baiBaiBookInjections,
  ];
  const anchoredInjections = worldbooks.animaStatus || [];
  const taskContent = await buildPluginTaskMessage({ taskPrompt, components, theaterComponents, substituteParams, renderTemplate, animaStatus, animaYaml });
  const depthReferenceMessages = taskPlacement?.enabled
    ? [{ role: 'user', content: taskContent, _depthReferenceOnly: true }]
    : [];
  const includeUserMessages = !omitOriginalUserMessages;
  const lastUserMessageOverride = replaceLastUserMessageWithTask ? taskContent : '';
  const selectedPromptSourceItems = dedupePromptSourceItems(promptSourceItems);
  const sourceItems = hasSelectedPromptSources
    ? mergeMissingPresetMarkers(selectedPromptSourceItems, preset, { context, latestMessage, substituteParams, lastUserMessageOverride, includeUserMessages, historyCleanupTags, historyRangeMode, recentMessageCount, animaStatus, animaYaml })
    : buildPresetPromptSourceItems(preset, { context, latestMessage, substituteParams, lastUserMessageOverride, includeUserMessages, historyCleanupTags, historyRangeMode, recentMessageCount, animaStatus, animaYaml });
  const activePromptSourceItems = dedupePromptSourceItems(sourceItems);
  const hasWorldInfoMarker = activePromptSourceItems.some((item) => isWorldInfoMarker(item?.markerType));
  const positionedWorldbookKeys = new Set(worldbooks.debug.map((item) => textOf(item.uid)).filter(Boolean));
  const promptSourceItemsForBuild = worldbookSourceControlled
    ? activePromptSourceItems.filter((item) => {
      if (normalizeMessageIndex(animaStatusMessageIndex) !== null && getAnimaEntryKind(item) === 'status') return false;
      if (!isWorldbookSourceItem(item)) return true;
      const itemKey = textOf(item?.sourceUid ?? item?.key);
      const hasPlacementMetadata = ['worldbookPosition', 'worldbookDepth', 'worldbookRole', 'worldbookOrder']
        .some((key) => Object.prototype.hasOwnProperty.call(item, key));
      return !(hasPlacementMetadata && (
        hasWorldInfoMarker
        || (positionedWorldbookKeys.has(itemKey) && worldbooks.atDepth.some((injection) => injection.content === textOf(item?.content)))
      ));
    })
    : activePromptSourceItems;
  const promptMessages = buildPromptSourceMessages(promptSourceItemsForBuild, { context, latestMessage, substituteParams, lastUserMessageOverride, includeUserMessages, historyCleanupTags, historyRangeMode, recentMessageCount, inChatInjections, depthReferenceMessages, anchoredInjections, worldbooks, worldbookSourceControlled, animaStatus, animaStatusMessageIndex, animaYaml });
  const hasChatHistoryMarker = promptSourceItemsForBuild.some((item) => textOf(item?.markerType) === 'chatHistory');
  const messages = [
    ...promptMessages,
    ...(!hasSelectedPromptSources && !hasChatHistoryMarker ? buildChatHistoryMessages(context, { includeUserMessages, historyCleanupTags, historyRangeMode, recentMessageCount, inChatInjections, depthReferenceMessages, anchoredInjections }) : []),
  ];
  messages.promptSourceItems = promptSourceItemsForBuild;
  messages.runtimeInsertions = applyRuntimeTemplateInsertions(messages, { context, worldbooks });
  insertTaskMessage(messages, { role: 'user', content: taskContent }, taskPlacement);
  return stripInternalMessageFields(messages);
}
import { TASK_PLACEMENT_AFTER_CHAT_HISTORY } from '../settings/task-placement.js';
