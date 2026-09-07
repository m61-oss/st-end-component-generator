import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [indexSource, styleSource, guideSource] = await Promise.all([
  readFile(new URL('../index.js', import.meta.url), 'utf8'),
  readFile(new URL('../style.css', import.meta.url), 'utf8'),
  readFile(new URL('./help-guide.js', import.meta.url), 'utf8').catch(() => ''),
]);

test('one global help entry replaces scattered question-mark toggles', () => {
  assert.match(indexSource, /data-help-guide-open/);
  assert.match(indexSource, /data-help-guide-rules[^>]*>规则说明</);
  assert.doesNotMatch(indexSource, /st-esg-info-toggle|st-esg-option-info-toggle|st-esg-component-section-info/);
  assert.doesNotMatch(indexSource, /st-esg-tag-rule-head \.fa-circle-question/);
  assert.doesNotMatch(styleSource, /st-esg-info-toggle|st-esg-option-info-toggle|st-esg-component-section-info|st-esg-tag-rule-help/);
});

test('help guide groups concise explanations into six practical sections', () => {
  assert.match(guideSource, /export function renderHelpGuide/);
  for (const section of ['quick-start', 'multi-task', 'schemes', 'sources', 'automation', 'memory-cleanup']) {
    assert.match(guideSource, new RegExp(`id: '${section}'`));
  }
  assert.match(guideSource, /\{\{external_components\}\}/);
  assert.match(guideSource, /加入批量/);
  assert.match(guideSource, /应用到当前聊天/);
  assert.match(guideSource, /生成内容剥离/);
});

test('help guide uses an accessible single-open accordion and responsive reading layout', () => {
  assert.match(guideSource, /<details[^>]*data-help-section/);
  assert.match(guideSource, /aria-label="使用帮助分类"/);
  assert.match(indexSource, /function showHelpGuideDialog/);
  assert.match(indexSource, /setAttribute\('aria-labelledby', 'st-esg-help-title'\)/);
  assert.match(indexSource, /returnFocus\?\.focus\?\.\(\{ preventScroll: true \}\)/);
  assert.match(indexSource, /addEventListener\('toggle',[\s\S]*?item\.open = false/);
  assert.match(styleSource, /\.st-esg-help-dialog\s*\{[^}]*width:\s*min\(560px,[^}]*overflow:\s*hidden;/s);
  assert.match(styleSource, /\.st-esg-help-body\s*\{[^}]*overflow:\s*auto;/s);
  assert.match(styleSource, /@media \(max-width:\s*520px\)[\s\S]*?\.st-esg-help-dialog/s);
});
