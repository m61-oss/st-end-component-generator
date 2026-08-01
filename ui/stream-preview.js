export function createStreamPreviewController({
  intervalMs = 80,
  schedule = (callback, delay) => setTimeout(callback, delay),
  cancel = (handle) => clearTimeout(handle),
  onPreview = () => {},
} = {}) {
  let latestText = '';
  let lastPreviewText = '';
  let pendingHandle = null;
  let disposed = false;

  const emit = () => {
    pendingHandle = null;
    if (disposed || latestText === lastPreviewText) return;
    lastPreviewText = latestText;
    onPreview(latestText);
  };

  return {
    push(value) {
      if (disposed) return;
      latestText = String(value ?? '');
      if (pendingHandle === null) pendingHandle = schedule(emit, intervalMs);
    },
    flush() {
      if (disposed) return;
      if (pendingHandle !== null) {
        cancel(pendingHandle);
        pendingHandle = null;
      }
      emit();
    },
    getText() {
      return latestText;
    },
    dispose() {
      if (pendingHandle !== null) cancel(pendingHandle);
      pendingHandle = null;
      disposed = true;
    },
  };
}
