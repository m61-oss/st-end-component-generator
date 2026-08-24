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
  assert.match(handler, /componentMoveState = \{[\s\S]*sourceIds: \[componentId\],[\s\S]*target: null,[\s\S]*eligibleComponentIds:[\s\S]*batch: false/);
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
  const button = indexSource.match(/<button class="st-esg-icon-btn st-esg-theater-move-to"[\s\S]*?<\/button>/)?.[0] || '';
  assert.match(button, /fa-arrow-down-wide-short/);
  assert.doesNotMatch(button, /fa-folder-open/);
  const handler = indexSource.match(/host\.find\('\.st-esg-theater-move-to'\)\.on\('click',[\s\S]*?\n\s*\}\);/)?.[0] || '';
  assert.match(handler, /theaterMoveState = \{ sourceIds: \[item\.id\], target: null, batch: false \}/);
  assert.doesNotMatch(handler, /requestTextInputDialog/);
  assert.match(indexSource, /data-theater-position-after=/);
  assert.match(indexSource, /data-theater-position-group-start=/);
  assert.match(indexSource, /theaterMoveState\?\.target/);
});

test('batch move actions enter positioning mode without opening a group dialog', () => {
  const componentButton = indexSource.match(/<button class="menu_button menu_button_icon st-esg-secondary-action st-esg-component-batch-move"[\s\S]*?<\/button>/)?.[0] || '';
  const theaterButton = indexSource.match(/<button class="menu_button menu_button_icon st-esg-secondary-action st-esg-theater-batch-move"[\s\S]*?<\/button>/)?.[0] || '';
  assert.match(componentButton, /fa-arrow-down-wide-short/);
  assert.match(theaterButton, /fa-arrow-down-wide-short/);

  const componentHandler = indexSource.match(/list\.find\('\.st-esg-component-batch-move'\)\.on\('click',[\s\S]*?\n\s*\}\);/)?.[0] || '';
  assert.match(componentHandler, /sourceIds: selectedComponents\.map/);
  assert.match(componentHandler, /batch: true/);
  assert.match(componentHandler, /所选组件属于不同归属/);
  assert.doesNotMatch(componentHandler, /requestTextInputDialog/);
  assert.doesNotMatch(componentHandler, /moveComponentsToGroup/);

  const theaterHandler = indexSource.match(/host\.find\('\.st-esg-theater-batch-move'\)\.on\('click',[\s\S]*?\n\s*\}\);/)?.[0] || '';
  assert.match(theaterHandler, /sourceIds: selectedItems\.map/);
  assert.match(theaterHandler, /batch: true/);
  assert.doesNotMatch(theaterHandler, /requestTextInputDialog/);
  assert.doesNotMatch(theaterHandler, /moveTheaterItemToGroup/);
});

test('batch positioning excludes every selected source and uses count preview copy', () => {
  assert.match(indexSource, /const moveSourceIdSet = new Set\(componentMoveState\?\.sourceIds \|\| \[\]\)/);
  assert.match(indexSource, /!moveSourceIdSet\.has\(textOf\(item\.id\)\)/);
  assert.match(indexSource, /componentMoveState\?\.batch[\s\S]*个选中条目/);
  assert.match(indexSource, /const moveSourceIdSet = new Set\(theaterMoveState\?\.sourceIds \|\| \[\]\)/);
  assert.match(indexSource, /!moveSourceIdSet\.has\(textOf\(item\.id\)\)/);
  assert.match(indexSource, /theaterMoveState\?\.batch[\s\S]*个选中条目/);
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
  assert.match(indexSource, /componentMoveState\?\.batch[\s\S]*selectedComponentIds\.clear\(\);[\s\S]*componentEditMode = false/);
  assert.match(indexSource, /theaterMoveState\?\.batch[\s\S]*selectedTheaterIds\.clear\(\);[\s\S]*theaterEditMode = false/);
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
