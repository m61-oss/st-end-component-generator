import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');

function createEventHarness() {
  const timers = new Map();
  const logs = [];
  const effects = [];
  let timerId = 0;
  const baseline = { messageIndex: 34 };
  const pendingTarget = { messageIndex: 34 };
  const scope = {
    settings: { enabled: true, autoGenerate: true },
    automaticGenerationLogActive: true,
    automaticGenerationBaseline: baseline,
    automaticGenerationEndTimer: null,
    automaticGenerationRevision: 1,
    generationAbortController: null,
    activeAutomaticTarget: null,
    pendingAutomaticTargets: new Map([[34, pendingTarget]]),
    targetWindow: {
      setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
      clearTimeout(id) { timers.delete(id); },
    },
    beginAutomaticGenerationLog() { effects.push('begin'); },
    logAutomaticGenerationStage(...details) { logs.push(details.join(' ')); },
    syncFloorVariableDepthZeroPrompt() { effects.push('floor-variable'); },
    stopAnimaWorldbookCapture() { effects.push('stop-capture'); },
    isAnimaWorldbookEnabled() { return false; },
    getContext() { return { chat: [] }; },
    captureAutomaticGenerationBaseline() { return { next: true }; },
    runGenerationEndedAutomaticGeneration(receivedBaseline, revision) {
      effects.push('generate');
      assert.equal(receivedBaseline, baseline);
      assert.equal(revision, 1);
    },
  };
  vm.createContext(scope);
  for (const name of ['invalidatePendingAutomaticGeneration', 'handleGenerationStarted', 'handleGenerationEnded']) {
    const start = source.indexOf(`function ${name}(`);
    const end = source.indexOf('\nfunction ', start + 1);
    vm.runInContext(source.slice(start, end), scope);
  }
  return { scope, timers, logs, effects, baseline, pendingTarget };
}

test('prompt dry runs preserve a completed reply waiting for automatic generation', () => {
  const { scope, timers, effects, logs } = createEventHarness();
  scope.handleGenerationEnded();
  const scheduledTimer = scope.automaticGenerationEndTimer;
  effects.length = 0;

  scope.handleGenerationStarted('normal', {}, true);

  assert.equal(scope.automaticGenerationEndTimer, scheduledTimer);
  assert.equal(scope.automaticGenerationRevision, 1);
  assert.equal(scope.pendingAutomaticTargets.size, 1);
  assert.deepEqual(effects, []);
  assert.ok(logs.some(line => line.includes('generation-dry-run') && line.includes('dryRun=是') && line.includes('normal')));
  timers.get(scheduledTimer)();
  assert.deepEqual(effects, ['generate']);
});

test('prompt dry runs preserve an active body generation baseline and pending target', () => {
  const { scope, baseline, pendingTarget } = createEventHarness();
  scope.handleGenerationStarted('normal', {}, true);
  assert.equal(scope.automaticGenerationBaseline, baseline);
  assert.equal(scope.pendingAutomaticTargets.get(34), pendingTarget);
});

test('real body generation still cancels old waits and records its event type', () => {
  const { scope, timers, logs } = createEventHarness();
  scope.handleGenerationEnded();
  scope.handleGenerationStarted('swipe', {}, false);
  assert.equal(timers.size, 0);
  assert.equal(scope.pendingAutomaticTargets.size, 0);
  assert.equal(scope.automaticGenerationRevision, 2);
  assert.equal(scope.automaticGenerationBaseline.next, true);
  assert.ok(logs.some(line => line.includes('dryRun=否') && line.includes('swipe')));
});

test('hosts omitting the dry-run argument retain normal generation behavior', () => {
  const { scope } = createEventHarness();
  scope.handleGenerationStarted('normal');
  assert.equal(scope.automaticGenerationRevision, 2);
  assert.equal(scope.pendingAutomaticTargets.size, 0);
});
