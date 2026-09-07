import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [indexSource, styleSource, guideSource] = await Promise.all([
  readFile(new URL('../index.js', import.meta.url), 'utf8'),
  readFile(new URL('../style.css', import.meta.url), 'utf8'),
  readFile(new URL('./help-guide.js', import.meta.url), 'utf8'),
]);

test('the plugin keeps one global help entry and no contextual help entry', () => {
  assert.match(indexSource, /data-help-guide-open/);
  assert.doesNotMatch(indexSource, /data-help-guide-rules/);
  assert.doesNotMatch(indexSource, /st-esg-info-toggle|st-esg-option-info-toggle|st-esg-component-section-info/);
  assert.equal((indexSource.match(/fa-circle-question/g) || []).length, 1);
});

test('quick start presents one of five steps at a time with previous and next actions', () => {
  assert.match(guideSource, /export const HELP_STEP_COUNT = 5/);
  assert.match(guideSource, /export function renderHelpStep/);
  assert.match(guideSource, /data-help-step-content/);
  assert.match(guideSource, /data-help-step-progress/);
  assert.match(guideSource, /data-help-step-previous/);
  assert.match(guideSource, /data-help-step-next/);
  assert.match(indexSource, /renderHelpStep\(currentStep\)/);
  assert.match(indexSource, /currentStep -= 1/);
  assert.match(indexSource, /currentStep \+= 1/);
  assert.match(indexSource, /if \(currentStep >= HELP_STEP_COUNT - 1\) finish\(\)/);
});

test('persistent help emphasizes scheme icons, core comparisons, and optional advanced topics', () => {
  for (const label of ['载入', '另存', '覆盖', '绑定聊天', '删除']) assert.match(guideSource, new RegExp(`>${label}<`));
  for (const label of ['生成', '注入', '提示词模式', '导入组件', '单任务', '多任务']) assert.match(guideSource, new RegExp(label));
  assert.match(guideSource, /data-help-topic="batch"/);
  assert.match(guideSource, /data-help-topic="automation"/);
  assert.match(guideSource, /data-help-topic="component-scheme"/);
  assert.match(guideSource, /data-help-topic="memory"/);
  assert.match(guideSource, /data-help-topic="cleanup"/);
  assert.doesNotMatch(guideSource, /HELP_SECTIONS|st-esg-help-accordion|data-help-section/);
});

test('help layout gives the step guide clear hierarchy without card-like text walls', () => {
  assert.match(styleSource, /\.st-esg-help-quick-start\s*\{[^}]*display:\s*grid;[^}]*grid-template-rows:/s);
  assert.match(styleSource, /\.st-esg-help-step-number\s*\{[^}]*font-size:\s*22px;/s);
  assert.match(styleSource, /\.st-esg-help-scheme-legend\s*\{[^}]*grid-template-columns:\s*repeat\(5,/s);
  assert.match(styleSource, /\.st-esg-help-comparison\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s);
  assert.match(styleSource, /@media \(max-width:\s*520px\)[\s\S]*?\.st-esg-help-scheme-legend/s);
});
