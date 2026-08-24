import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [indexSource, styleSource] = await Promise.all([
  readFile(new URL('../index.js', import.meta.url), 'utf8'),
  readFile(new URL('../style.css', import.meta.url), 'utf8'),
]);

test('single-component move action enters positioning mode instead of opening the group dialog', () => {
  assert.match(indexSource, /import \{ applyComponentPositionMove \} from '\.\/sources\/component-order\.js\?ver=/);
  assert.match(indexSource, /let componentMoveState = null/);
  assert.match(indexSource, /title="移动到指定位置" aria-label="移动到指定位置"/);

  const handler = indexSource.match(/list\.find\('\.st-esg-component-move-to'\)\.on\('click',[\s\S]*?\n\s*\}\);/)?.[0] || '';
  assert.match(handler, /componentMoveState = \{ sourceId: componentId, target: null \}/);
  assert.match(handler, /resetComponentLibraryFilters\(\)/);
  assert.doesNotMatch(handler, /requestTextInputDialog/);
  assert.doesNotMatch(handler, /moveComponentToGroup/);
});

test('positioning mode renders same-scope targets and an insertion preview', () => {
  assert.match(indexSource, /st-esg-component-position-mode/);
  assert.match(indexSource, /data-component-position-after=/);
  assert.match(indexSource, /data-component-position-group-start=/);
  assert.match(indexSource, /st-esg-component-position-target-top/);
  assert.match(indexSource, /st-esg-component-position-preview/);
  assert.match(indexSource, /将插入到这里/);
  assert.match(indexSource, /normalizeComponentScope\(item\.scope\) === moveSourceScope/);
  assert.match(indexSource, /normalizeComponentScope\(section\.scope\) === moveSourceScope/);
});

test('positioning mode disables ordinary library controls and cancels with edit context', () => {
  assert.match(indexSource, /renderComponentListToolbar\(componentMoveActive\)/);
  assert.match(indexSource, /componentMoveActive \? 'disabled' : ''/);
  assert.match(indexSource, /function resetComponentEditMode\(\)[\s\S]*componentMoveState = null/);
  assert.match(indexSource, /componentLibraryContextKey !== nextComponentLibraryContextKey[\s\S]*componentMoveState = null/);
  assert.match(indexSource, /componentMoveActive \? '' : componentEditMode/);
});

test('footer is replaced by cancel and confirm actions without rebuilding existing handlers', () => {
  assert.match(indexSource, /function renderComponentPositionMoveFooter\(\)/);
  assert.match(indexSource, /st-esg-component-position-footer/);
  assert.match(indexSource, />取消移动</);
  assert.match(indexSource, />确认移动</);
  assert.match(indexSource, /st-esg-component-position-confirm[^>]*\$\{moveResult\.moved \? '' : 'disabled'\}/);
  assert.match(indexSource, /settings\.components = moveResult\.components;[\s\S]*saveSettings\(\);[\s\S]*componentMoveState = null/);
});

test('positioning styles dim candidates, brighten the target, and use a two-button mobile footer', () => {
  assert.match(styleSource, /\.st-esg-component-position-mode \.st-esg-component-item\s*\{[^}]*opacity:\s*\.35/s);
  assert.match(styleSource, /\.st-esg-component-position-mode \.st-esg-component-item\.is-position-target\s*\{[^}]*opacity:\s*1/s);
  assert.match(styleSource, /\.st-esg-component-position-preview\s*\{[^}]*border/s);
  assert.match(styleSource, /\.st-esg-component-position-footer\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(styleSource, /padding-bottom:\s*max\([^;]*env\(safe-area-inset-bottom\)/s);
});
