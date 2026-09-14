const textOf = (value) => String(value ?? '');

export function readQqjPromptSnapshot(targetWindow = globalThis) {
  const bridge = targetWindow?.qqj_v3_public_bridge_v1;
  if (typeof bridge?.getPromptSnapshot !== 'function') {
    return { status: 'unavailable', sourceStatus: '', text: '' };
  }

  let snapshot;
  try {
    snapshot = bridge.getPromptSnapshot();
  } catch (_) {
    return { status: 'error', sourceStatus: '', text: '' };
  }

  const sourceStatus = String(snapshot?.status ?? '').trim();
  if (sourceStatus !== 'ready') {
    return { status: 'not-ready', sourceStatus, text: '' };
  }

  const parts = [textOf(snapshot?.prequel?.text), textOf(snapshot?.recall?.text)]
    .filter((text) => text.trim());
  if (!parts.length) return { status: 'empty', sourceStatus, text: '' };
  return { status: 'ready', sourceStatus, text: parts.join('\n\n') };
}
