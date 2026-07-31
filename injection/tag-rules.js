const textOf = (value) => String(value ?? '').trim();

function createConfiguredRegex(value) {
  const source = String(value || '');
  if (source.startsWith('/')) {
    const closingSlash = source.lastIndexOf('/');
    const flags = source.slice(closingSlash + 1);
    if (closingSlash > 0 && /^[a-z]*$/i.test(flags)) {
      return new RegExp(source.slice(1, closingSlash), flags);
    }
  }
  return new RegExp(source, 'gi');
}

function getRules(value) {
  const lines = Array.isArray(value) ? value : String(value || '').split('\n');
  return lines.map((line) => textOf(line)).filter(Boolean).flatMap((line) => {
    if (line.startsWith('re:')) {
      try {
        return [{ regex: createConfiguredRegex(line.slice(3)), capture: true }];
      } catch {
        return [];
      }
    }
    if (!/^[^\s<>/]+$/u.test(line)) return [];
    const escaped = line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return [{ regex: new RegExp(`<${escaped}(?=\\s|>)[^>]*>([\\s\\S]*?)<\\/${escaped}\\s*>`, 'gi'), capture: true }];
  });
}

function applyRules(value, rules, collectBlocks) {
  let body = String(value || '');
  const blocks = [];
  for (const rule of rules) {
    body = body.replace(rule.regex, (match, ...args) => {
      if (collectBlocks) {
        const captures = args.slice(0, -2);
        blocks.push(String(captures.find((capture) => capture !== undefined) ?? match).trim());
      }
      return '';
    });
  }
  return { body, blocks: blocks.filter(Boolean) };
}

export function stripConfiguredBlocks(value, rules = '') {
  return applyRules(value, getRules(rules), false).body;
}

export function stripHistoryBlocksByRules(chat, configuredRules = []) {
  const rules = Array.isArray(configuredRules)
    ? configuredRules.map((item) => ({ rule: textOf(item?.rule), keep: Math.max(0, Math.floor(Number(item?.keep) || 0)) })).filter((item) => item.rule)
    : String(configuredRules || '').split('\n').map((rule) => ({ rule: textOf(rule), keep: 0 })).filter((item) => item.rule);
  const source = Array.isArray(chat) ? chat : [];
  let newerAssistantReplies = 0;
  const result = new Array(source.length);
  for (let index = source.length - 1; index >= 0; index -= 1) {
    const item = source[index] || {};
    let mes = String(item.mes || '');
    for (const rule of rules) {
      if (newerAssistantReplies >= rule.keep) mes = stripConfiguredBlocks(mes, rule.rule);
    }
    result[index] = { ...item, mes };
    if (!item.is_user) newerAssistantReplies += 1;
  }
  return result;
}

export function extractConfiguredBlocks(value, rules = '') {
  return applyRules(value, getRules(rules), true);
}
