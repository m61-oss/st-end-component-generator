const textOf = (value) => String(value ?? '');

function getTrailingOpenTag(content) {
  const match = textOf(content).trim().match(/<([A-Za-z0-9_\-\u4e00-\u9fff]+)(?:\s[^>]*)?>$/u);
  return match?.[1] || '';
}

function isOnlyClosingTag(content, tag) {
  return textOf(content).trim() === `</${tag}>`;
}

function createDiagnostics(messages) {
  const emptyBlocks = [];
  for (let index = 0; index < messages.length - 1; index += 1) {
    const tag = getTrailingOpenTag(messages[index]?.content);
    if (!tag) continue;
    if (isOnlyClosingTag(messages[index + 1]?.content, tag)) {
      emptyBlocks.push({ tag, startIndex: index, endIndex: index + 1 });
    }
  }
  return { emptyBlocks };
}

function mergeDiagnostics(baseDiagnostics, runtimeDiagnostics) {
  if (!runtimeDiagnostics || typeof runtimeDiagnostics !== 'object') return baseDiagnostics;
  return { ...baseDiagnostics, ...runtimeDiagnostics };
}

function normalizeMessages(messages) {
  return (Array.isArray(messages) ? messages : []).map((message) => ({
    role: textOf(message?.role || 'user'),
    content: textOf(message?.content),
  }));
}

function estimateTokenCount(content) {
  const text = textOf(content).trim();
  if (!text) return 0;
  const cjkChars = (text.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/gu) || []).length;
  const nonCjkText = text.replace(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/gu, ' ');
  const wordLikeTokens = (nonCjkText.match(/[A-Za-z0-9_]+|[^\sA-Za-z0-9_]/gu) || []).length;
  return Math.max(1, Math.ceil(cjkChars + wordLikeTokens * 0.75));
}

export function mergeConsecutiveSystemMessages(messages = []) {
  const cleanMessages = (Array.isArray(messages) ? messages : []).map((message) => ({
    ...normalizeMessages([message])[0],
    preserveSystemMessage: Boolean(message?.preserveSystemMessage),
  }));
  const merged = [];
  for (const message of cleanMessages) {
    const previous = merged[merged.length - 1];
    if (message.role === 'system' && previous?.role === 'system' && !message.preserveSystemMessage && !previous.preserveSystemMessage) {
      previous.content = [previous.content, message.content].filter(Boolean).join('\n\n');
    } else {
      const next = { role: message.role, content: message.content };
      if (message.preserveSystemMessage) Object.defineProperty(next, 'preserveSystemMessage', { value: true, enumerable: false });
      merged.push(next);
    }
  }
  return merged;
}

export function createPromptLogViewModel(logText = '') {
  let parsed = null;
  try {
    parsed = JSON.parse(textOf(logText));
  } catch (_) {
    parsed = null;
  }
  const messages = normalizeMessages(parsed?.request?.messages).map((message, index) => ({
    index,
    role: message.role,
    content: message.content,
    characterCount: message.content.length,
    tokenEstimate: estimateTokenCount(message.content),
    tokenEstimateLabel: `约 ${estimateTokenCount(message.content)} tokens`,
  }));
  const totalTokenEstimate = messages.reduce((sum, message) => sum + message.tokenEstimate, 0);
  return {
    summary: {
      createdAt: textOf(parsed?.createdAt),
      model: textOf(parsed?.request?.model),
      messageCount: Number(parsed?.summary?.messageCount) || messages.length,
      characterCount: Number(parsed?.summary?.characterCount) || messages.reduce((sum, message) => sum + message.characterCount, 0),
      tokenEstimate: totalTokenEstimate,
      tokenEstimateLabel: `约 ${totalTokenEstimate} tokens`,
      extensionVersion: textOf(parsed?.summary?.extensionVersion),
      compressedSystemMessages: Boolean(parsed?.summary?.compressedSystemMessages),
      promptTemplateCompat: {
        enabled: Boolean(parsed?.diagnostics?.promptTemplateCompat?.enabled),
        status: textOf(parsed?.diagnostics?.promptTemplateCompat?.status) || 'disabled',
        renderCount: Number(parsed?.diagnostics?.promptTemplateCompat?.renderCount) || 0,
        changedCount: Number(parsed?.diagnostics?.promptTemplateCompat?.changedCount) || 0,
      },
    },
    messages,
  };
}

export function createPromptLog({
  apiUrl = '',
  apiKey = '',
  model = '',
  maxTokens = '',
  temperature = '',
  messages = [],
  createdAt = new Date().toISOString(),
  extensionVersion = '',
  runtimeDiagnostics = {},
  compressSystemMessages = false,
} = {}) {
  const cleanMessages = compressSystemMessages ? mergeConsecutiveSystemMessages(messages) : normalizeMessages(messages);
  const characterCount = cleanMessages.reduce((sum, message) => sum + message.content.length, 0);
  return JSON.stringify({
    createdAt,
    summary: {
      messageCount: cleanMessages.length,
      characterCount,
      hasApiKey: Boolean(apiKey),
      extensionVersion: textOf(extensionVersion),
      compressedSystemMessages: Boolean(compressSystemMessages),
    },
    diagnostics: mergeDiagnostics(createDiagnostics(cleanMessages), runtimeDiagnostics),
    request: {
      apiUrl: textOf(apiUrl),
      model: textOf(model),
      max_tokens: Number(maxTokens) || 800,
      temperature: Number(temperature) || 0.7,
      messages: cleanMessages,
    },
  }, null, 2);
}
