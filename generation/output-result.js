import { parseAnchorOutput } from './anchor-output-protocol.js';
import { parseOutputProtocolResponse } from './output-protocol.js';

function isProtocolLikeLegacyText(value) {
  const text = String(value ?? '').trim();
  if (!text) return false;
  const withoutFence = text.replace(/^```(?:json)?\s*\r?\n/i, '').trim();
  if (!withoutFence.startsWith('{')) return false;
  try {
    const value = JSON.parse(withoutFence);
    if (value && typeof value === 'object' && !Array.isArray(value)) return true;
  } catch {
    // A truncated protocol-like object cannot be parsed strictly; inspect its field names below.
  }
  return /["']thinking["']\s*:/i.test(withoutFence);
}

export function normalizeGeneratedResult(rawText) {
  const anchor = parseAnchorOutput(rawText);
  if (anchor) {
    return {
      content: '',
      anchorItems: anchor.items,
      thinking: [anchor.thinking].filter(Boolean),
      mode: anchor.mode,
      complete: anchor.complete,
      usable: anchor.items.length > 0,
      warnings: anchor.warnings,
    };
  }

  const parsed = parseOutputProtocolResponse(rawText);
  if (!parsed) {
    return {
      content: '',
      thinking: [],
      mode: 'empty',
      complete: false,
      usable: false,
    };
  }

  const protocolLikeLegacy = parsed.mode === 'legacy' && isProtocolLikeLegacyText(rawText);
  if (protocolLikeLegacy) {
    return {
      content: '',
      thinking: [],
      mode: parsed.mode,
      complete: parsed.complete,
      usable: false,
    };
  }

  if (parsed.ambiguous) {
    return {
      content: '',
      thinking: [],
      mode: parsed.mode,
      complete: false,
      usable: false,
      ambiguous: true,
    };
  }

  return {
    content: parsed.content.trim(),
    thinking: [parsed.thinking].filter(Boolean),
    mode: parsed.mode,
    complete: parsed.complete,
    usable: true,
  };
}
