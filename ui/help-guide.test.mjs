import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [indexSource, styleSource, guideSource, tourSource] = await Promise.all([
  readFile(new URL('../index.js', import.meta.url), 'utf8'),
  readFile(new URL('../style.css', import.meta.url), 'utf8'),
  readFile(new URL('./help-guide.js', import.meta.url), 'utf8'),
  readFile(new URL('./help-tour.js', import.meta.url), 'utf8').catch(() => ''),
]);

test('the plugin keeps one global help entry and no contextual help entry', () => {
  assert.match(indexSource, /data-help-guide-open/);
  assert.doesNotMatch(indexSource, /data-help-guide-rules/);
  assert.doesNotMatch(indexSource, /st-esg-info-toggle|st-esg-option-info-toggle|st-esg-component-section-info/);
  assert.equal((indexSource.match(/fa-circle-question/g) || []).length, 1);
});

test('quick start launches a guided tour of the real plugin pages', () => {
  assert.match(guideSource, /data-help-tour-start/);
  assert.doesNotMatch(guideSource, /data-help-step-content|data-help-step-previous|data-help-step-next/);
  assert.match(tourSource, /export const HELP_TOUR_STEPS/);
  assert.match(tourSource, /export function renderHelpTour/);
  for (const tab of ['runtime', 'task', 'preset', 'workspace']) {
    assert.match(tourSource, new RegExp(`tab: '${tab}'`));
  }
  assert.match(indexSource, /function startHelpTour/);
  assert.match(indexSource, /function applyHelpTourStep/);
  assert.match(indexSource, /switchTab\(step\.tab\)/);
});

test('automation is taught in context and opens the general generation settings page', () => {
  assert.match(tourSource, /openGenerationSettings: true/);
  assert.match(tourSource, /#st-esg-auto-generate/);
  assert.match(tourSource, /#st-esg-auto-inject/);
  assert.match(tourSource, /#st-esg-rollback-before-generation/);
  assert.match(indexSource, /showMultiTaskSettingsDialog\('general'\)/);
  assert.match(indexSource, /closeHelpTourGenerationSettings/);
});

test('persistent help keeps useful references without memory-source or automation articles', () => {
  for (const label of ['载入', '另存', '覆盖', '绑定聊天', '删除']) assert.match(guideSource, new RegExp(`>${label}<`));
  for (const label of ['生成', '注入', '提示词模式', '导入组件', '单任务', '多任务']) assert.match(guideSource, new RegExp(label));
  assert.match(guideSource, /data-help-topic="batch"/);
  assert.match(guideSource, /data-help-topic="scheme-binding"/);
  assert.match(guideSource, /data-help-topic="component-scheme"/);
  assert.match(guideSource, /data-help-topic="cleanup"/);
  assert.doesNotMatch(guideSource, /data-help-topic="memory"|data-help-topic="automation"|记忆来源/);
  assert.doesNotMatch(guideSource, /HELP_SECTIONS|st-esg-help-accordion|data-help-section/);
});

test('guided tour uses a compact coachmark and visible target highlight', () => {
  assert.match(styleSource, /\.st-esg-help-tour\s*\{[^}]*position:\s*absolute;/s);
  assert.match(styleSource, /\.st-esg-help-tour-focus\s*\{[^}]*position:\s*absolute;/s);
  assert.match(styleSource, /\.st-esg-help-tour-actions\s*\{[^}]*display:\s*flex;/s);
  assert.match(styleSource, /\.st-esg-help-scheme-legend\s*\{[^}]*grid-template-columns:\s*repeat\(5,/s);
  assert.match(styleSource, /\.st-esg-help-comparison\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s);
  assert.match(styleSource, /@media \(max-width:\s*520px\)[\s\S]*?\.st-esg-help-tour/s);
});

test('guided tour frames functional regions without tracing individual controls', () => {
  assert.match(tourSource, /targetSelectors:\s*\['\.st-esg-api-fields'\]/);
  assert.match(tourSource, /targetSelectors:\s*\['\[data-tab-panel="task"\] > \.st-esg-card:not\(\.st-esg-output-protocol-details\)'\]/);
  assert.match(tourSource, /openGenerationSettings:\s*true,[\s\S]*?groupTargets:\s*true/s);
  assert.match(indexSource, /function renderHelpTourFocus\([^)]*\)/);
  assert.match(indexSource, /step\.groupTargets/);
  assert.doesNotMatch(styleSource, /\.st-esg-help-tour-target\s*\{/);
});

test('guided-tour assets use a cache revision independent from the package version', () => {
  assert.match(indexSource, /const UI_ASSET_REVISION = 'help-tour-\d+'/);
  assert.match(indexSource, /style\.css\?ver=\$\{EXTENSION_VERSION\}&rev=\$\{UI_ASSET_REVISION\}/);
  assert.match(indexSource, /help-guide\.js\?ver=0\.2\.3-help-tour-\d+/);
  assert.match(indexSource, /help-tour\.js\?ver=0\.2\.3-help-tour-\d+/);
});
