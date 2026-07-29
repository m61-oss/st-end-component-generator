import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const styleSource = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

assert.match(
  indexSource,
  /<label class="st-esg-switch st-esg-switch-sm"><input class="st-esg-component-enabled" type="checkbox"/,
  'component items should render their enabled control as the compact switch variant',
);
assert.match(
  indexSource,
  /<span class="st-esg-component-name">\$\{escapeHtml\(item\.name \|\| '未命名组件'\)\}<\/span>/,
  'component names should remain a separate, truncatable label beside the switch',
);

assert.match(
  indexSource,
  /class="st-esg-component-group-enabled" type="checkbox" data-group-id=/,
  'component groups should render a distinct compact enabled switch',
);
assert.match(
  indexSource,
  /st-esg-component-folder-is-disabled/,
  'disabled folders should expose a class for visual dimming and struck counts',
);
assert.match(
  indexSource,
  /st-esg-component-folder-title[\s\S]*?st-esg-component-folder-count[\s\S]*?\$\{control\}/,
  'folder counts should render before the enable control so every control shares a column',
);

const componentToggleHandler = indexSource.match(/\$t\('\.st-esg-component-enabled'\)\.on\('change', function \(\) \{[\s\S]*?\n  }\);/);
assert.ok(componentToggleHandler, 'component enabled changes should have an event handler');
assert.match(
  componentToggleHandler[0],
  /saveSettings\(\);\s*renderComponentList\(\);/,
  'component enabled changes should rerender folder counts immediately',
);

assert.match(
  indexSource,
  /const componentViewState = captureComponentLibraryViewState\(\);\s*const openFolderStateIds = componentViewState\.openFolders;/,
  'component list rendering should retain expanded component-library state before a refresh',
);
assert.match(
  indexSource,
  /data-folder-state-id="\$\{escapeHtml\(folderStateId\)\}" \$\{openFolderStateIds\.has\(folderStateId\) \? 'open' : ''\}/,
  'rerendered folders should restore their previous expanded state',
);

assert.match(
  indexSource,
  /const defaultGroup = \{ groupId: '', name: '默认分组', enabled: settings\.defaultGroupEnabled\?\.\[section\.scope\] !== false, items: library\.ungrouped, isDefault: true \};/,
  'ungrouped components should render inside a virtual default group with a scope-specific gate',
);
assert.match(
  indexSource,
  /library\.groups\.reduce\(\(sum, group\) => sum \+ group\.items\.length, library\.ungrouped\.length\)/,
  'section counts should include both grouped and ungrouped components',
);

assert.doesNotMatch(indexSource, /function findImportedComponentIndex\(/, 'imports should not look up and overwrite an existing component');
assert.match(
  indexSource,
  /settings\.components\.push\(\{ id: createNewComponentId\(\), \.\.\.importedComponent \}\);/,
  'every imported candidate should create an independent component entry',
);

assert.match(
  indexSource,
  /let componentEditMode = false;\s*let selectedComponentIds = new Set\(\);/,
  'component library should keep transient edit-mode selection outside saved settings',
);
assert.match(
  indexSource,
  /st-esg-component-edit-toggle[\s\S]*?fa-solid fa-pen-to-square/,
  'component library header should expose an edit-mode entry point',
);
assert.match(
  indexSource,
  /st-esg-component-edit-toolbar[\s\S]*?st-esg-component-edit-exit/,
  'edit mode should render a toolbar with an explicit exit action',
);
assert.match(
  indexSource,
  /st-esg-component-select[\s\S]*?type="checkbox"/,
  'component rows should render selection checkboxes in edit mode',
);
assert.match(
  indexSource,
  /st-esg-component-group-select[\s\S]*?type="checkbox"/,
  'component groups should render tri-state selection checkboxes in edit mode',
);
assert.match(
  indexSource,
  /\.prop\('indeterminate',/,
  'group selection state should use the checkbox indeterminate DOM property',
);

assert.match(
  indexSource,
  /function requestTextInputDialog\(/,
  'scheme names and component groups should share one themed text-input dialog helper',
);
assert.match(
  indexSource,
  /function requestSchemeName\(type\)[\s\S]*?requestTextInputDialog\(/,
  'scheme name requests should reuse the generic text-input dialog',
);
assert.match(
  indexSource,
  /st-esg-component-group-create[\s\S]*?data-scope=/,
  'edit mode should expose a scope-specific group creation action',
);
assert.match(
  indexSource,
  /st-esg-component-group-rename[\s\S]*?st-esg-component-group-delete/,
  'edit-mode group headers should expose rename and delete actions',
);
assert.match(
  indexSource,
  /components\.forEach\(\(component\) => \{\s*if \(textOf\(component\?\.groupId\) === groupId\) component\.groupId = '';/,
  'deleting a group should move members to ungrouped rather than deleting them',
);

assert.match(indexSource, /function moveComponentWithinGroup\(/, 'edit mode should provide id-based intra-group reordering');
assert.match(indexSource, /siblingIndexes\.indexOf\(sourceIndex\)/, 'reordering should locate neighbors within the same group instead of using adjacent array indexes');
assert.match(indexSource, /function captureComponentLibraryViewState\(/, 'component reordering should preserve library view state');
assert.match(indexSource, /function restoreComponentLibraryViewState\(/, 'component reordering should restore library view state');
assert.match(indexSource, /st-esg-component-move-up[\s\S]*?st-esg-component-move-down/, 'edit-mode rows should expose ordered move controls');
assert.match(indexSource, /st-esg-component-move-to[\s\S]*?st-esg-component-delete/, 'edit-mode rows should expose move-to and delete controls');
assert.match(indexSource, /st-esg-component-name-input[\s\S]*?st-esg-component-content/, 'expanded edit-mode components should offer name and content editing fields');
assert.match(indexSource, /st-esg-component-edit-confirm[\s\S]*?st-esg-component-edit-cancel/, 'component content editing should provide confirm and cancel actions');
assert.match(indexSource, /selectedComponentIds\.delete\(componentId\)/, 'deleting a component should remove its selection state');

assert.match(indexSource, /st-esg-component-batch-move[\s\S]*?st-esg-component-batch-delete/, 'edit toolbar should expose batch move and delete actions');
assert.match(indexSource, /function moveComponentsToGroup\(/, 'batch move should have a dedicated relative-order-preserving operation');
assert.match(indexSource, /selectedComponents\.map\(\(component\) => component\.id\)/, 'batch moves should preserve selected components\' current array order');
assert.match(indexSource, /new Set\(selectedComponents\.map\(\(component\) => normalizeComponentScope\(component\.scope\)\)\)/, 'batch move should reject selections spanning multiple scopes');
assert.match(indexSource, /确认删除选中的 \$\{selectedComponentIds\.size\} 个组件/, 'batch deletion should confirm the selected count');
assert.match(styleSource, /\.st-esg-scheme-name-dialog\s*\{[^}]*overflow:\s*visible/, 'the shared selector dialog should not clip its native select popup');
assert.match(styleSource, /\.st-esg-component-section-body\s*\{[^}]*border:\s*1px solid var\(--esg-border\)[^}]*overflow:\s*hidden/, 'each component scope should use one shared enclosing frame');
assert.match(indexSource, /group\.isDefault \? '' : `<span class="st-esg-component-group-actions">/, 'default groups should not render rename or delete actions in edit mode');
assert.match(indexSource, /st-esg-component-default-group-enabled/, 'default groups should have a distinct gate control');
assert.match(indexSource, /defaultGroupEnabled: \{\}/, 'default group gate state should be stored separately from user groups');

assert.match(
  indexSource,
  /let componentSearchQuery = '';\s*let componentFilterMode = 'all';/,
  'component-library search and filter state should be independent from import-list state',
);
assert.match(
  indexSource,
  /function renderComponentListToolbar\(\)/,
  'component library should render its own cross-scope search toolbar',
);
assert.match(
  indexSource,
  /<option value="disabled"[^>]*>仅禁用<\/option>/,
  'component filters should include a disabled-only mode',
);
assert.match(
  indexSource,
  /const searchableText = `\$\{item\.name \|\| ''\}\\n\$\{item\.content \|\| ''\}`\.toLocaleLowerCase\(\);/,
  'component search should match both component names and content',
);
assert.match(
  indexSource,
  /componentFilterMode === 'enabled' && item\.enabled !== false/,
  'enabled filtering should use the component toggle only',
);
assert.match(
  indexSource,
  /componentFilterMode === 'disabled' && item\.enabled === false/,
  'disabled filtering should use the component toggle only',
);

assert.match(indexSource, /function moveComponentGroupWithinScope\(/, 'component groups should have an id-based scope-local reorder operation');
assert.match(indexSource, /siblingGroups\.sort\(\(left, right\) => Number\(left\.order\) - Number\(right\.order\)\)/, 'group reordering should use sorted neighbors instead of arithmetic order values');
assert.match(indexSource, /st-esg-component-group-move-up[\s\S]*?st-esg-component-group-move-down/, 'edit-mode group headers should expose up and down controls');
assert.match(indexSource, /group\.isDefault \? '' : `<span class="st-esg-component-group-actions">[\s\S]*?st-esg-component-group-move-up/, 'default groups should not expose group ordering controls');
assert.match(indexSource, /const keepEmptyGroup = !filterActive;/, 'empty user groups should remain visible whenever component filters are inactive');

assert.match(indexSource, /function applyThemeClass\(element, theme\)/, 'theme classes should be reusable for extension controls mounted outside the dialog');
assert.match(indexSource, /applyThemeClass\(ball, theme\);/, 'new floating balls should receive the active theme class');
assert.match(indexSource, /function getFloatingBallPosition\(\)/, 'floating ball positions should be normalized before rendering');
assert.match(indexSource, /targetWindow\.innerWidth - FLOATING_BALL_SIZE/, 'floating ball positions should be constrained to the current viewport width');
assert.match(styleSource, /#st-esg-ball \{[^}]*var\(--esg-bg-card, #/s, 'floating ball colors should have visible fallbacks outside the dialog theme scope');
assert.match(indexSource, /const ball = targetDoc\.createElement\('div'\);/, 'floating balls should use a neutral target-document element like the working GGD floating control');
assert.match(indexSource, /targetDoc\.getElementById\('st-esg-ball-visible'\)\?\.addEventListener\('change'/, 'the floating-ball setting should bind directly in the target document');
assert.match(indexSource, /event\.pointerType === 'mouse' && event\.button !== 0/, 'floating ball dragging should preserve touch input');
assert.match(styleSource, /#st-esg-ball \{[^}]*z-index:\s*2147483646 !important/s, 'floating balls should use the working mobile control\'s top page layer');
assert.match(styleSource, /#st-esg-ball \{[^}]*touch-action:\s*none/s, 'floating balls should preserve touch dragging on mobile');
assert.match(styleSource, /#st-esg-ball \{[^}]*border:\s*1px solid var\(--esg-text-main, #E0E0E0\)[^}]*cursor:\s*grab[^}]*box-shadow:\s*var\(--esg-shadow/s, 'floating balls should retain this extension\'s visual style');
assert.match(indexSource, /st-esg-ball-under-panel/, 'opening the plugin panel should explicitly hide the floating ball');
assert.match(styleSource, /#st-esg-ball\.st-esg-ball-under-panel\s*\{\s*display:\s*none/, 'the floating ball should not intercept the plugin panel');
assert.match(indexSource, /qrGenerateEnabled: false,\s*qrInjectEnabled: false/, 'QR shortcuts should have independent saved visibility settings');
assert.match(indexSource, /function syncQuickReplyShortcuts\(/, 'the extension should synchronize its QR shortcut set through the Quick Replies API');
assert.match(indexSource, /const QR_SHORTCUT_SET_NAME = '外置文尾组件生成器快捷键';/, 'QR shortcuts should use a dedicated set instead of changing user QR sets');
assert.match(indexSource, /label: '点击生成',[\s\S]*?action: 'generate'/, 'the generate QR should retain a direct plugin action');
assert.match(indexSource, /label: '点击注入',[\s\S]*?action: 'inject'/, 'the inject QR should retain a direct plugin action');
assert.match(indexSource, /quickReply\.onExecute = async \(\) => await targetWindow\[QR_SHORTCUT_ACTIONS_KEY\]\?\.\[shortcut\.action\]\?\.\(\);/, 'QR clicks should call plugin actions directly instead of sending slash command text');
assert.match(indexSource, /id="st-esg-qr-generate-enabled"[\s\S]*?id="st-esg-qr-inject-enabled"/, 'shortcut settings should expose independent generate and inject switches');
