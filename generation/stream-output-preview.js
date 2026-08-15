import { parseOutputProtocolStreamPreview } from './output-protocol.js';

const PROTOCOL_MODES = new Set(['json', 'loose-json']);

export function normalizeStreamOutputPreview(rawText) {
  const raw = String(rawText ?? '');
  const parsed = parseOutputProtocolStreamPreview(raw);
  if (!parsed) {
    return {
      text: '',
      thinking: '',
      mode: 'empty',
      protocol: false,
    };
  }

  const protocol = PROTOCOL_MODES.has(parsed.mode);
  return {
    text: String(parsed.content ?? ''),
    thinking: protocol ? String(parsed.thinking ?? '') : '',
    mode: parsed.mode,
    protocol,
  };
}
