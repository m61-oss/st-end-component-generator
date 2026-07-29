export function extractStreamDelta(payload) {
  const choice = payload?.choices?.[0] || {};
  return String(choice?.delta?.content ?? choice?.text ?? '');
}

export async function readOpenAiStream(response, onDelta = () => {}) {
  if (!response?.body?.getReader) throw new Error('API stream response is not readable.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  const flushEvents = () => {
    const events = buffer.split(/\n\n/);
    buffer = events.pop() || '';
    for (const event of events) {
      const lines = event.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith('data:'));
      for (const line of lines) {
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        let payload = null;
        try { payload = JSON.parse(data); } catch (_) { continue; }
        const delta = extractStreamDelta(payload);
        if (!delta) continue;
        fullText += delta;
        onDelta(delta, fullText);
      }
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    flushEvents();
  }
  buffer += decoder.decode();
  if (buffer.trim()) {
    buffer += '\n\n';
    flushEvents();
  }
  return fullText;
}
