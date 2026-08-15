import { parseOutputProtocolStreamPreview } from './output-protocol.js';
import { parseAnchorOutput } from './anchor-output-protocol.js';

const PROTOCOL_MODES = new Set(['json', 'loose-json', 'anchor-json']);

export function normalizeStreamOutputPreview(rawText) {
  const raw = String(rawText ?? '');
  const anchor = parseAnchorOutput(raw);
  if (anchor) {
    return {
      text: anchor.items.map((item) => item.content).join('\n\n'),
      thinking: anchor.thinking,
      mode: anchor.mode,
      protocol: true,
    };
  }
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
