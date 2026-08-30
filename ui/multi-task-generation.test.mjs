import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexSource = await readFile(new URL('../index.js', import.meta.url), 'utf8');
const workspaceSource = await readFile(new URL('./multi-task-workspace.js', import.meta.url), 'utf8');

test('multi-task generation freezes scheme runtimes and executes through the concurrency queue', () => {
  assert.match(indexSource, /createMultiTaskRunPlan\(/);
  assert.match(indexSource, /resolveMultiTaskRuntimeSettings\(/);
  assert.match(indexSource, /runMultiTaskQueue\(/);
  assert.match(indexSource, /async function generateMultiTasks\(/);
  assert.match(indexSource, /settings\.multiTaskSettings\.concurrency|multiTaskState\.concurrency/);
});

test('request building accepts task-owned settings and stream callbacks', () => {
  assert.match(indexSource, /buildMessages\(latestMessage,\s*sourceSettings/);
  assert.match(indexSource, /callExternalApi\(latest\.message,\s*controller\.signal,\s*entry\.runtime/);
  assert.match(indexSource, /onPreview:\s*\(text\)\s*=>\s*updateMultiTaskStream/);
});

test('task and footer actions are enabled and route by generation mode', () => {
  assert.doesNotMatch(workspaceSource, /data-multi-task-action="generate" disabled/);
  assert.doesNotMatch(workspaceSource, /data-multi-task-action="inject" disabled/);
  assert.match(indexSource, /action === 'generate'/);
  assert.match(indexSource, /settings\.generationMode === 'multi'[\s\S]{0,700}generateMultiTasks/);
});

test('active task hydration preserves anchor results instead of clearing them', () => {
  assert.match(indexSource, /settings\.lastGeneratedAnchorItems\s*=\s*Array\.isArray\(view\.anchorItems\)/);
  assert.match(indexSource, /settings\.lastGeneratedResultMode\s*=\s*view\.resultMode === 'anchor'/);
});

test('queued and running tasks can be cancelled before another run starts', () => {
  assert.match(indexSource, /function cancelMultiTaskGeneration\(taskIds = null\)/);
  assert.match(indexSource, /currentTask\?\.runId !== plan\.runId[\s\S]{0,180}AbortError/);
  assert.match(indexSource, /MULTI_TASK_STATUS\.QUEUED,\s*MULTI_TASK_STATUS\.GENERATING/);
  assert.match(indexSource, /cancelMultiTaskGeneration\(\[activeTask\.id\]\)/);
});

test('new tasks inherit the currently selected component scheme', () => {
  assert.match(indexSource, /componentSchemeId:\s*textOf\(settings\.selectedComponentSchemeId\)/);
  assert.match(indexSource, /getMultiTaskDefaultSchemeId\(settings\.selectedPresetSchemeId\)/);
  assert.match(indexSource, /getMultiTaskDefaultSchemeId\(settings\.selectedWorldbookSchemeId\)/);
});

test('Tavern-default tasks resolve preset-scoped components from the live Tavern preset', () => {
  assert.match(indexSource, /sourceSettings\.presetRuntimeMode === 'tavern'[\s\S]{0,220}delete componentOptions\.presetSchemeId/);
});

test('auto injection queues each task as soon as it becomes ready', () => {
  assert.match(indexSource, /status === 'ready'[\s\S]{0,500}enqueueMultiTaskInjection\(taskId/);
  assert.match(indexSource, /enqueueMultiTaskInjection\(taskId,[\s\S]{0,220}expectedRunId:\s*plan\.runId/);
  assert.doesNotMatch(indexSource, /if \(settings\.autoInject && completed\)[\s\S]{0,160}injectMultiTasks/);
});

test('multi-task settings expose an immediate injection interval from zero to ten seconds', () => {
  assert.match(indexSource, /name="injectionIntervalSeconds"[^>]*min="0"[^>]*max="10"[^>]*step="0\.5"/);
  assert.match(indexSource, /\[name="injectionIntervalSeconds"\][\s\S]{0,180}addEventListener\('change'/);
});

test('active multi-task streaming reuses the single-task incremental thinking renderer', () => {
  const start = indexSource.indexOf('function updateMultiTaskStream');
  const end = indexSource.indexOf('function normalizeMultiTaskGeneratedResult', start);
  const source = indexSource.slice(start, end);

  assert.match(source, /updateStreamedThinking\(streamed\.thinking\)/);
  assert.doesNotMatch(source, /renderGeneratedThinking\(/);
});

test('concurrency and injection interval share one row and one combined explanation', () => {
  assert.match(indexSource, /class="st-esg-multi-task-runtime-row"[\s\S]{0,900}name="concurrency"[\s\S]{0,900}name="injectionIntervalSeconds"/);
  assert.match(indexSource, /class="st-esg-multi-task-runtime-help"[^>]*>超出并发数的任务会自动排队；任务完成后按完成顺序分批注入，间隔范围为 0–10 秒。/);
});
