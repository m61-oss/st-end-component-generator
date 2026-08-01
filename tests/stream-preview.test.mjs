import assert from 'node:assert/strict';

const module = await import('../ui/stream-preview.js').catch(() => ({}));
assert.equal(typeof module.createStreamPreviewController, 'function', 'a stream preview controller should be exported');

const scheduled = [];
const cancelled = [];
const previews = [];
const controller = module.createStreamPreviewController({
  intervalMs: 80,
  schedule: (callback, delay) => {
    const handle = { callback, delay };
    scheduled.push(handle);
    return handle;
  },
  cancel: (handle) => cancelled.push(handle),
  onPreview: (text) => previews.push(text),
});

controller.push('A');
controller.push('AB');
assert.equal(scheduled.length, 1, 'rapid chunks should share one scheduled preview update');
assert.equal(scheduled[0].delay, 80);
scheduled[0].callback();
assert.deepEqual(previews, ['AB'], 'the scheduled update should render only the newest accumulated text');
assert.equal(controller.getText(), 'AB');

controller.push('ABC');
controller.flush();
assert.deepEqual(previews, ['AB', 'ABC'], 'flush should immediately render the newest pending text once');
assert.equal(cancelled.length, 1, 'flush should cancel its pending timer');

controller.push('ABCD');
controller.dispose();
assert.equal(cancelled.length, 2, 'dispose should cancel pending work');
assert.deepEqual(previews, ['AB', 'ABC'], 'disposed pending work must not render');

console.log('stream-preview tests passed');
