const textOf = (value) => String(value ?? '').trim();

function getRules(value) {
  const lines = Array.isArray(value) ? value : String(value || '').split('\n');
  return lines.map((line) => textOf(line)).filter(Boolean).flatMap((line) => {
    if (line.startsWith('re:')) {
      try {
        return [{ regex: new RegExp(line.slice(3), 'gi'), capture: true }];
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

export function extractConfiguredBlocks(value, rules = '') {
  return applyRules(value, getRules(rules), true);
}
