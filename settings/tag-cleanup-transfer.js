export const TAG_CLEANUP_FORMAT = 'st-esg-tag-cleanup';
export const TAG_CLEANUP_VERSION = 1;

export function buildTagCleanupImportSummary({ addedHistoryCount = 0, updatedHistoryCount = 0, addedOutputCount = 0 } = {}) {
  const addedCount = addedHistoryCount + addedOutputCount;
  const parts = [];
  if (addedCount > 0) parts.push(`新增 ${addedCount} 条${updatedHistoryCount > 0 ? '' : '规则'}`);
  if (updatedHistoryCount > 0) parts.push(`更新 ${updatedHistoryCount} 条历史规则`);
  return parts.length ? `导入完成：${parts.join('，')}。` : '导入完成：没有新增或更新。';
}

function normalizeHistoryRule(entry, strict = false) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    if (strict) throw new Error('聊天记录清理规则格式不正确。');
    return null;
  }
  const rule = typeof entry.rule === 'string' ? entry.rule.trim() : '';
  const keep = Number(entry.keep);
  if (!rule || !Number.isFinite(keep) || keep < 0) {
    if (strict) throw new Error('聊天记录清理规则内容不正确。');
    return null;
  }
  return { rule, keep: Math.floor(keep) };
}

function normalizeOutputRule(entry, strict = false) {
  const rule = typeof entry === 'string' ? entry.trim() : '';
  if (!rule) {
    if (strict) throw new Error('生成内容剥离规则内容不正确。');
    return null;
  }
  return rule;
}

function normalizeHistoryRules(entries, strict = false) {
  if (!Array.isArray(entries)) {
    if (strict) throw new Error('聊天记录清理规则列表不存在。');
    return [];
  }
  return entries.map((entry) => normalizeHistoryRule(entry, strict)).filter(Boolean);
}

function normalizeOutputRules(entries, strict = false) {
  if (!Array.isArray(entries)) {
    if (strict) throw new Error('生成内容剥离规则列表不存在。');
    return [];
  }
  return entries.map((entry) => normalizeOutputRule(entry, strict)).filter(Boolean);
}

export function createTagCleanupExportPackage({ historyRules = [], outputRules = [] } = {}) {
  return {
    format: TAG_CLEANUP_FORMAT,
    version: TAG_CLEANUP_VERSION,
    historyRules: normalizeHistoryRules(historyRules),
    outputRules: normalizeOutputRules(outputRules),
  };
}

export function mergeTagCleanupImport(bundle, { historyRules = [], outputRules = [] } = {}) {
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) throw new Error('标签清理规则文件格式不正确。');
  if (bundle.format !== TAG_CLEANUP_FORMAT) throw new Error('这不是织幕的标签清理规则文件。');
  if (bundle.version !== TAG_CLEANUP_VERSION) throw new Error('暂不支持这个标签清理规则文件版本。');

  const importedHistory = normalizeHistoryRules(bundle.historyRules, true);
  const importedOutput = normalizeOutputRules(bundle.outputRules, true);
  const mergedHistory = [];
  const historyIndex = new Map();
  for (const entry of normalizeHistoryRules(historyRules)) {
    const index = historyIndex.get(entry.rule);
    if (index === undefined) {
      historyIndex.set(entry.rule, mergedHistory.length);
      mergedHistory.push(entry);
    } else {
      mergedHistory[index] = entry;
    }
  }
  const mergedOutput = [...new Set(normalizeOutputRules(outputRules))];
  const outputSet = new Set(mergedOutput);
  const newlyAddedHistory = new Set();
  const updatedHistory = new Set();
  let addedOutputCount = 0;

  for (const entry of importedHistory) {
    const index = historyIndex.get(entry.rule);
    if (index === undefined) {
      historyIndex.set(entry.rule, mergedHistory.length);
      mergedHistory.push({ ...entry });
      newlyAddedHistory.add(entry.rule);
      continue;
    }
    if (mergedHistory[index].keep !== entry.keep && !newlyAddedHistory.has(entry.rule)) updatedHistory.add(entry.rule);
    mergedHistory[index] = { ...entry };
  }

  for (const rule of importedOutput) {
    if (outputSet.has(rule)) continue;
    outputSet.add(rule);
    mergedOutput.push(rule);
    addedOutputCount += 1;
  }

  return {
    historyRules: mergedHistory,
    outputRules: mergedOutput,
    addedHistoryCount: newlyAddedHistory.size,
    updatedHistoryCount: updatedHistory.size,
    addedOutputCount,
  };
}
