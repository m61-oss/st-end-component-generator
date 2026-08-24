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
  assert.match(handler, /componentMoveState = \{[\s\S]*sourceId: componentId,[\s\S]*target: null,[\s\S]*eligibleComponentIds:/);
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

test('single-theater move enters the same positioning interaction without a group dialog', () => {
  assert.match(indexSource, /let theaterMoveState = null/);
  const handler = indexSource.match(/host\.find\('\.st-esg-theater-move-to'\)\.on\('click',[\s\S]*?\n\s*\}\);/)?.[0] || '';
  assert.match(handler, /theaterMoveState = \{ sourceId: item\.id, target: null \}/);
  assert.doesNotMatch(handler, /requestTextInputDialog/);
  assert.match(indexSource, /data-theater-position-after=/);
  assert.match(indexSource, /data-theater-position-group-start=/);
  assert.match(indexSource, /theaterMoveState\?\.target/);
});

test('positioning mode disables ordinary library controls and cancels with edit context', () => {
  assert.match(indexSource, /renderComponentListToolbar\(componentMoveActive\)/);
  assert.match(indexSource, /componentMoveActive \? 'disabled' : ''/);
  assert.match(indexSource, /function resetComponentEditMode\(\)[\s\S]*componentMoveState = null/);
  assert.match(indexSource, /componentLibraryContextKey !== nextComponentLibraryContextKey[\s\S]*componentMoveState = null/);
  assert.match(indexSource, /componentMoveActive \? '' : componentEditMode/);
  assert.match(indexSource, /shouldRefreshComponentLibrary[\s\S]*componentMoveState/);
  assert.match(indexSource, /shouldRefreshComponentList[\s\S]*componentMoveState/);
});

test('theater positioning is cleared by every library context reset', () => {
  assert.match(indexSource, /shouldRefreshComponentLibrary[\s\S]*componentMoveState \|\| theaterMoveState/);
  assert.match(indexSource, /shouldRefreshComponentList[\s\S]*componentMoveState \|\| theaterMoveState/);
  assert.match(indexSource, /function resetComponentEditMode\(\)[\s\S]*componentMoveState = null;[\s\S]*theaterMoveState = null/);
  assert.match(indexSource, /componentLibraryContextKey !== nextComponentLibraryContextKey\)[^\n]*\{[^}]*componentMoveState = null;[^}]*theaterMoveState = null;/);

  const componentHandler = indexSource.match(/list\.find\('\.st-esg-component-move-to'\)\.on\('click',[\s\S]*?\n\s*\}\);/)?.[0] || '';
  const theaterHandler = indexSource.match(/host\.find\('\.st-esg-theater-move-to'\)\.on\('click',[\s\S]*?\n\s*\}\);/)?.[0] || '';
  assert.match(componentHandler, /theaterMoveState = null/);
  assert.match(theaterHandler, /componentMoveState = null/);
  assert.match(indexSource, /st-esg-theater-edit-exit[\s\S]*theaterMoveState = null/);
});

test('footer is replaced by cancel and confirm actions without rebuilding existing handlers', () => {
  assert.match(indexSource, /function renderComponentPositionMoveFooter\(\)/);
  assert.match(indexSource, /st-esg-component-position-footer/);
  assert.match(indexSource, />取消移动</);
  assert.match(indexSource, />确认移动</);
  assert.match(indexSource, /st-esg-component-position-confirm[^>]*\$\{moveResult\.moved \? '' : 'disabled'\}/);
  assert.match(indexSource, /settings\.components = confirmedResult\.components;[\s\S]*componentMoveState = null;[\s\S]*saveSettings\(\)/);
  assert.match(indexSource, /settings\.theaterComponents = confirmedResult\.components;[\s\S]*theaterMoveState = null;[\s\S]*saveSettings\(\)/);
  assert.match(indexSource, /class="st-esg-footer-actions st-esg-component-position-footer"/);
});

test('positioning styles dim candidates, brighten the target, and reuse the horizontal footer actions', () => {
  assert.match(styleSource, /\.st-esg-component-position-mode \.st-esg-component-item\s*\{[^}]*opacity:\s*\.35/s);
  assert.match(styleSource, /\.st-esg-component-position-mode \.st-esg-component-item\.is-position-target\s*\{[^}]*opacity:\s*1/s);
  assert.match(styleSource, /\.st-esg-component-position-preview\s*\{[^}]*border/s);
  assert.doesNotMatch(styleSource, /\.st-esg-component-position-footer\s*\{[^}]*grid-template-columns/s);
  assert.match(styleSource, /\.st-esg-footer-actions\s*\{[^}]*display:\s*flex/s);
  assert.match(styleSource, /padding-bottom:\s*max\([^;]*env\(safe-area-inset-bottom\)/s);
});
