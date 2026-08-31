import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexSource = await readFile(new URL('../index.js', import.meta.url), 'utf8');
const controllerSource = await readFile(new URL('../generation/multi-task-controller.js', import.meta.url), 'utf8');
const styleSource = await readFile(new URL('../style.css', import.meta.url), 'utf8');
const workspaceSource = await readFile(new URL('./multi-task-workspace.js', import.meta.url), 'utf8');
const settingsDialogSource = await readFile(new URL('./multi-task-settings-dialog.js', import.meta.url), 'utf8');
const taskControllerSource = await readFile(new URL('../generation/multi-task-task-controller.js', import.meta.url), 'utf8');

test('multi-task generation freezes scheme runtimes and executes through the concurrency queue', () => {
  assert.match(controllerSource, /createMultiTaskRunPlan\(/);
  assert.match(controllerSource, /resolveMultiTaskRuntimeSettings\(/);
  assert.match(controllerSource, /runMultiTaskQueue\(/);
  assert.match(controllerSource, /async function generate\(/);
  assert.match(controllerSource, /multiState\.concurrency/);
});

test('request building accepts task-owned settings and stream callbacks', () => {
  assert.match(indexSource, /buildMessages\(latestMessage,\s*sourceSettings/);
  assert.match(controllerSource, /callExternalApi\(latest\.message,\s*controller\.signal,\s*entry\.runtime/);
  assert.match(controllerSource, /onPreview:\s*\(text\)\s*=>\s*updateStream/);
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
  assert.match(controllerSource, /function cancelGeneration\(taskIds = null\)/);
  assert.match(controllerSource, /currentTask\?\.runId !== plan\.runId[\s\S]{0,180}AbortError/);
  assert.match(controllerSource, /status\.QUEUED,\s*status\.GENERATING/);
  assert.match(taskControllerSource, /cancelGeneration\(\[activeTask\.id\]\)/);
});

test('new tasks inherit the currently selected component scheme', () => {
  assert.match(taskControllerSource, /componentSchemeId:\s*textOf\(settings\.selectedComponentSchemeId\)/);
  assert.match(taskControllerSource, /defaultSchemeId\(settings\.selectedPresetSchemeId\)/);
  assert.match(taskControllerSource, /defaultSchemeId\(settings\.selectedWorldbookSchemeId\)/);
});

test('Tavern-default tasks resolve preset-scoped components from the live Tavern preset', () => {
  assert.match(indexSource, /sourceSettings\.presetRuntimeMode === 'tavern'[\s\S]{0,220}delete componentOptions\.presetSchemeId/);
});

test('completion-order auto injection queues each task as soon as it becomes ready', () => {
  assert.match(controllerSource, /const enqueueAutoInjection = \(taskId\)[\s\S]{0,500}enqueueInjection\(taskId/);
  assert.match(controllerSource, /nextStatus === 'ready'[\s\S]{0,500}else enqueueAutoInjection\(taskId\)/);
  assert.match(controllerSource, /enqueueInjection\(taskId,[\s\S]{0,220}expectedRunId:\s*plan\.runId/);
  assert.doesNotMatch(controllerSource, /if \(settings\.autoInject && completed\)[\s\S]{0,160}injectMultiTasks/);
});

test('automatic injection can coordinate ready results by configured task order', () => {
  assert.match(controllerSource, /createTaskOrderInjectionCoordinator/);
  assert.match(controllerSource, /multiState\.injectionOrder === MULTI_TASK_INJECTION_ORDER_TASK/);
  assert.match(controllerSource, /orderCoordinator\.ready\(taskId\)/);
  assert.match(controllerSource, /orderCoordinator\?\.skip\(taskId\)/);
});

test('stale or cancelled task transitions release task-order injection before returning', () => {
  assert.match(controllerSource, /if \(!currentTask \|\| currentTask\.runId !== plan\.runId\) \{[\s\S]{0,180}orderCoordinator\?\.skip\(taskId\);[\s\S]{0,80}return;/);
});

test('deferred automatic injection rechecks task state to prevent duplicate manual injection', () => {
  assert.match(controllerSource, /canEnqueueTaskAutoInjection\(currentTask, plan\.runId\)/);
  const start = controllerSource.indexOf('const enqueueAutoInjection');
  const source = controllerSource.slice(start, start + 650);
  assert.match(source, /status:\s*status\.PENDING_INJECTION/);
  assert.match(source, /scheduleRender\(\)/);
});

test('manual injection locks each result before it enters the serialized queue', () => {
  const start = controllerSource.indexOf('async function inject(');
  const end = controllerSource.indexOf('async function injectBatchNow', start);
  const source = controllerSource.slice(start, end);

  assert.match(source, /replaceTask\(task\.id,\s*\{\s*status:\s*status\.PENDING_INJECTION\s*\}\)/);
  assert.match(source, /\[status\.READY,\s*status\.UNDONE\]\.includes\(task\.status\)/);
  assert.match(source, /scheduleRender\(\)/);
});

test('floor panel generates all tasks while injection and undo stay scoped to the current floor', () => {
  const start = indexSource.indexOf('async function runMessageFloorPanelAction');
  const end = indexSource.indexOf('function bindMessageFloorPanel', start);
  const source = indexSource.slice(start, end);

  assert.match(source, /scopeMultiTaskFloorPanelSettings\(/);
  assert.match(source, /planMultiTaskFloorActions\(/);
  assert.match(source, /generateMultiTasks\(floorActions\.generateTaskIds\)/);
  assert.match(source, /injectMultiTasks\(floorActions\.injectTaskIds\)/);
  assert.match(source, /undoMultiTaskInjections\(floorActions\.undoTaskIds/);
});

test('running generation disables mode switching and guards the mode click handler', () => {
  assert.match(indexSource, /renderGenerationModeSwitch\(mode,\s*\{\s*switchingDisabled:\s*running\s*\}\)/);
  const start = indexSource.indexOf(".on('click.stEsgMultiTask', '[data-generation-mode]'");
  const source = indexSource.slice(start, start + 650);
  assert.match(source, /isAnyGenerationRunning\(\)/);
});

test('quick reply injection follows the active generation mode', () => {
  const start = indexSource.indexOf('function updateQuickReplyShortcutActions');
  const source = indexSource.slice(start, start + 420);
  assert.match(source, /settings\.generationMode === 'multi'/);
  assert.match(source, /injectMultiTasks\(\)/);
  assert.match(source, /injectGeneratedStatusbar\(\)/);
});

test('multi-task settings expose an immediate injection interval from zero to ten seconds', () => {
  assert.match(settingsDialogSource, /name=\\?"injectionIntervalSeconds\\?"[^>]*min=\\?"0\\?"[^>]*max=\\?"10\\?"[^>]*step=\\?"0\.5/);
  assert.match(settingsDialogSource, /injectionIntervalSeconds[\s\S]*addEventListener\('change'/);
});

test('multi-task settings expose automatic injection order and save it immediately', () => {
  assert.match(settingsDialogSource, /name=\\?"injectionOrder/);
  assert.match(settingsDialogSource, /value=\\?"completion/);
  assert.match(settingsDialogSource, /value=\\?"task/);
  assert.match(settingsDialogSource, /injectionOrder[\s\S]*addEventListener\('change'/);
});

test('active multi-task streaming reuses the single-task incremental thinking renderer', () => {
  const start = indexSource.indexOf('updateActiveStream:');
  const source = indexSource.slice(start, start + 700);

  assert.match(source, /updateStreamedThinking\(streamed\.thinking\)/);
  assert.doesNotMatch(source, /renderGeneratedThinking\(/);
});

test('concurrency and injection interval share one row and one combined explanation', () => {
  assert.match(settingsDialogSource, /st-esg-multi-task-runtime-row[\s\S]{0,1600}name=\\?"concurrency[\s\S]{0,1600}name=\\?"injectionIntervalSeconds[\s\S]{0,1600}name=\\?"injectionOrder/);
  assert.match(settingsDialogSource, /st-esg-multi-task-runtime-help[^>]*>超出并发数的任务会自动排队；自动注入可按完成顺序即时注入，或等待前项后按任务顺序注入；失败或停止的任务会自动跳过；注入间隔范围为 0–10 秒。/);
});

test('generation settings distinguish headings by weight without changing their size', () => {
  assert.match(styleSource, /\.st-esg-generation-mode-settings-shell > header \.st-esg-card-title\s*\{[^}]*font-weight:\s*800/);
  assert.match(styleSource, /\.st-esg-generation-settings-section-title strong\s*\{[^}]*font-size:\s*13px;[^}]*font-weight:\s*750/);
  assert.match(styleSource, /\.st-esg-multi-task-settings-heading > strong\s*\{[^}]*font-size:\s*13px;[^}]*font-weight:\s*750/);
});
