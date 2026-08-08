import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const styleSource = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

assert.match(indexSource, /const MAX_OUTPUT_TOKENS = 65535;/, 'maximum tokens should default to 65535');
assert.match(indexSource, /maxTokens:\s*String\(MAX_OUTPUT_TOKENS\),\s*temperature:\s*'1',\s*additionalBodyYaml:\s*'',\s*excludedBodyYaml:\s*'',\s*additionalHeadersYaml:\s*'',/, 'API defaults should include editable limits and three additional-parameter drafts');
assert.doesNotMatch(indexSource, /querySelector\('#st-esg-max-tokens'\)\?\.closest\('label'\)\?\.remove\(\)/, 'the maximum-token input must remain visible');
assert.match(indexSource, /apiFields\?\.insertBefore\(apiTemperatureLabel, apiMaxTokensLabel\);/, 'temperature should render before maximum tokens');
assert.match(indexSource, /\$t\('#st-esg-max-tokens'\)\.val\(settings\.maxTokens\);/, 'the maximum-token input should render its saved value');
assert.match(indexSource, /\$t\('#st-esg-max-tokens'\)\.on\('input', function \(\) \{ settings\.maxTokens = String\(\$\(this\)\.val\(\)\); markSchemeDirty\('api'\); saveSettings\(\); \}\);/, 'maximum-token edits should persist and dirty the API scheme');

assert.match(
  indexSource,
  /const apiFields = dialog\.querySelector\('#st-esg-api-url'\)\?\.closest\('\.st-esg-grid'\);[\s\S]*?apiFields\?\.classList\.add\('st-esg-api-fields'\);[\s\S]*?apiFields\?\.insertBefore\(apiKeyLabel, apiModelLabel\);/,
  'rendered API settings should move Key below URL and above model in one ordered group',
);
assert.match(styleSource, /\.st-esg-api-fields\s*\{[^}]*grid-template-columns:\s*1fr/, 'primary API fields should remain vertically ordered at every width');

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
assert.match(
  indexSource,
  /st-esg-component-group-content[\s\S]*?st-esg-component-group-items/,
  'component groups should wrap their items in a dedicated container',
);
assert.match(indexSource, /st-esg-component-group-toggle-items/, 'component groups should expose a bulk item toggle');
assert.match(
  indexSource,
  /st-esg-component-group-toggle-items[\s\S]*?groupItems\.every\(\(item\) => item\.enabled !== false\)[\s\S]*?saveSettings\(\);\s*renderComponentList\(\);/,
  'component groups should toggle all member enabled states without changing the group gate',
);
assert.match(styleSource, /\.st-esg-component-group-content\s*\{/, 'component group controls should have a bordered container');

const componentToggleHandler = indexSource.match(/\$t\('\.st-esg-component-enabled'\)\.on\('change', function \(\) \{[\s\S]*?\n  }\);/);
assert.ok(componentToggleHandler, 'component enabled changes should have an event handler');
assert.match(
  componentToggleHandler[0],
  /saveSettings\(\);\s*renderComponentList\(\);/,
  'component enabled changes should rerender folder counts immediately',
);

assert.match(
  indexSource,
  /const componentViewState = captureComponentLibraryViewState\(\);\s*const currentLibraryOpen = list\.find\('\.st-esg-component-library-card'\)\.prop\('open'\);[\s\S]*?const openFolderStateIds = componentViewState\.openFolders;/,
  'component list rendering should retain library and folder state before a refresh',
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
assert.match(indexSource, /resolveFloatingBallPosition\(\{[\s\S]*?savedLeft:\s*settings\.ballX,[\s\S]*?savedTop:\s*settings\.ballY,/, 'floating ball rendering should delegate saved-coordinate validation to the tested resolver');
assert.match(indexSource, /targetWindow\.innerWidth - getFloatingBallSize\(\)/, 'floating ball positions should be constrained with the configured width');
assert.match(styleSource, /#st-esg-ball \{[^}]*var\(--esg-bg-card, #/s, 'floating ball colors should have visible fallbacks outside the dialog theme scope');
assert.match(indexSource, /const ball = targetDoc\.createElement\('div'\);/, 'floating balls should use a neutral target-document element like the working GGD floating control');
assert.match(indexSource, /targetDoc\.getElementById\('st-esg-ball-visible'\)\?\.addEventListener\('change'/, 'the floating-ball setting should bind directly in the target document');
assert.match(indexSource, /event\.pointerType === 'mouse' && event\.button !== 0/, 'floating ball dragging should preserve touch input');
assert.match(styleSource, /#st-esg-ball \{[^}]*z-index:\s*8999 !important/s, 'floating balls should stay below Tavern and other extension overlays');
assert.match(styleSource, /#st-esg-ball \{[^}]*touch-action:\s*none/s, 'floating balls should preserve touch dragging on mobile');
assert.match(styleSource, /#st-esg-ball \{[^}]*border:\s*1px solid var\(--esg-text-main, #E0E0E0\)[^}]*cursor:\s*grab[^}]*box-shadow:\s*var\(--esg-shadow/s, 'floating balls should retain this extension\'s visual style');
assert.match(indexSource, /id="st-esg-ball-visible"[^>]*\/><span>悬浮球<\/span>/, 'the floating ball toggle should be labelled 悬浮球');
assert.match(indexSource, /id="st-esg-ball-size"[^>]*type="range"[^>]*min="28"[^>]*max="72"/, 'floating ball size should use a persisted range control');
assert.match(indexSource, /id="st-esg-ball-opacity"[^>]*type="range"[^>]*min="20"[^>]*max="100"/, 'floating ball opacity should use a persisted range control');
assert.match(indexSource, /ballSize:\s*38/, 'existing floating ball size should remain the default');
assert.match(indexSource, /ballOpacity:\s*0\.82/, 'existing floating ball opacity should remain the default');
assert.match(indexSource, /ball\.style\.setProperty\('--st-esg-ball-size'/, 'floating ball size should be applied through a live CSS property');
assert.match(indexSource, /ball\.style\.setProperty\('--st-esg-ball-opacity'/, 'floating ball opacity should be applied through a live CSS property');
assert.match(styleSource, /#st-esg-ball \{[^}]*width:\s*var\(--st-esg-ball-size\)[^}]*height:\s*var\(--st-esg-ball-size\)[^}]*opacity:\s*var\(--st-esg-ball-opacity\)/s, 'floating ball size and opacity should no longer be fixed in CSS');
assert.match(indexSource, /getFloatingBallSize\(\)/, 'floating ball bounds should use the configured size');
assert.match(indexSource, /#st-esg-ball-size'\)\.on\('input'/, 'the size range should preview while dragging');
assert.match(indexSource, /#st-esg-ball-opacity'\)\.on\('input'/, 'the opacity range should preview while dragging');
assert.match(indexSource, /st-esg-ball-under-panel/, 'opening the plugin panel should explicitly hide the floating ball');
assert.match(styleSource, /#st-esg-ball\.st-esg-ball-under-panel\s*\{\s*display:\s*none/, 'the floating ball should not intercept the plugin panel');
assert.match(indexSource, /qrGenerateEnabled: false,\s*qrInjectEnabled: false/, 'QR shortcuts should have independent saved visibility settings');
assert.match(indexSource, /function syncQuickReplyShortcuts\(/, 'the extension should synchronize its QR shortcut set through the Quick Replies API');
assert.match(indexSource, /const QR_SHORTCUT_SET_NAME = '外置文尾组件生成器快捷键';/, 'QR shortcuts should use a dedicated set instead of changing user QR sets');
assert.match(indexSource, /label: '点击生成',[\s\S]*?action: 'generate'/, 'the generate QR should retain a direct plugin action');
assert.match(indexSource, /label: '点击注入',[\s\S]*?action: 'inject'/, 'the inject QR should retain a direct plugin action');
assert.match(indexSource, /quickReply\.onExecute = async \(\) => await targetWindow\[QR_SHORTCUT_ACTIONS_KEY\]\?\.\[shortcut\.action\]\?\.\(\);/, 'QR clicks should call plugin actions directly instead of sending slash command text');
assert.match(indexSource, /id="st-esg-qr-generate-enabled"[\s\S]*?id="st-esg-qr-inject-enabled"/, 'shortcut settings should expose independent generate and inject switches');
assert.match(indexSource, /id="st-esg-mvu-reprocess-on-inject"/, 'generation settings should expose the MVU variable reprocessing switch');
assert.match(indexSource, /id="st-esg-undo-injection"[\s\S]*?fa-rotate-left[\s\S]*?<span>撤回注入<\/span>/, 'a hidden undo action should be mounted beside the inject action');
assert.match(indexSource, /\$t\('#st-esg-undo-injection'\)\.on\('click', \(\) => undoLatestInjection\(\)\);/, 'the undo action should call the guarded restoration flow');
assert.match(styleSource, /@media \(max-width: 640px\)[\s\S]*?#st-esg-undo-injection span\s*\{\s*display:\s*none/s, 'the undo action should become icon-only on narrow screens');
assert.match(indexSource, /\$t\('#st-esg-mvu-reprocess-on-inject'\)\.prop\('checked', settings\.mvuReprocessOnInject\);/, 'generation settings should render the saved MVU reprocessing preference');
assert.match(indexSource, /\$t\('#st-esg-mvu-reprocess-on-inject'\)\.on\('change', function \(\) \{\s*settings\.mvuReprocessOnInject = Boolean\(\$\(this\)\.prop\('checked'\)\);\s*saveSettings\(\);\s*\}\);/s, 'changing the MVU reprocessing switch should persist immediately');

const generationSettingsFunction = indexSource.slice(
  indexSource.indexOf('function renderGenerationSettings()'),
  indexSource.indexOf('function renderPluginPanel()'),
);
assert.match(generationSettingsFunction, /const statusPlaceholderSetting = settingsBody\?\.querySelector\('#st-esg-status-placeholder-enabled'\)\?\.closest\('label'\);/, 'generation settings should identify the existing status-placeholder setting as the placement anchor');
assert.match(generationSettingsFunction, /settingsBody\.insertBefore\(injectionModeDescription, statusPlaceholderSetting\);/, 'the replacement-mode description should appear directly below the injection mode');
assert.match(generationSettingsFunction, /statusPlaceholderSetting\.insertAdjacentHTML\('afterend', '[\s\S]*?id="st-esg-mvu-reprocess-on-inject"/, 'the MVU reprocessing switch should appear immediately after the status-placeholder setting');
assert.doesNotMatch(generationSettingsFunction, /settingsBody\.insertAdjacentHTML\('beforeend', '[\s\S]*?id="st-esg-mvu-reprocess-on-inject"/, 'the MVU reprocessing switch must not be appended after the replacement-mode description');
assert.match(styleSource, /@media \(max-width: 640px\) \{[\s\S]*?\.st-esg-dialog \{\s*align-items:\s*center !important;/, 'mobile dialogs should be vertically centered instead of bottom-aligned');
assert.match(indexSource, /className = 'st-esg-prompt-settings-section';[\s\S]*?柏宝书记忆插件兼容/, 'prompt settings should group the BaiBai Book controls under a dedicated compatibility heading');
assert.match(indexSource, /className = 'st-esg-prompt-settings-section';[\s\S]*?提示词模板语法兼容/, 'prompt settings should group the template-compatibility control under its own heading');
assert.match(indexSource, /baiBaiSection\.appendChild\(baiBaiBody\.firstElementChild\);/, 'both BaiBai Book controls should stay together inside their compatibility group');
assert.match(indexSource, /templateSection\.appendChild\(templateLabel\);/, 'the template switch should stay inside the template compatibility group');
assert.match(styleSource, /\.st-esg-prompt-settings-section-title\s*\{/, 'compatibility groups should have a dedicated section-title style');

const presetSchemeFunction = indexSource.slice(
  indexSource.indexOf('async function applyPresetScheme(snapshot)'),
  indexSource.indexOf('async function applyWorldbookScheme(snapshot)'),
);
assert.match(
  presetSchemeFunction,
  /settings\.promptSelections = clearImportSelectionsForScope\(settings\.promptSelections, COMPONENT_SCOPE_PRESET\);[\s\S]*?settings\.importSelections = clearImportSelectionsForScope\(settings\.importSelections, COMPONENT_SCOPE_PRESET\);[\s\S]*?Object\.assign\(settings\.promptSelections, snapshot\.promptSelections \|\| \{\}\);[\s\S]*?Object\.assign\(settings\.importSelections, snapshot\.importSelections \|\| \{\}\);/,
  'preset schemes should restore prompt and import selections into independent stores, just like worldbook schemes',
);
assert.doesNotMatch(
  presetSchemeFunction,
  /else if \(Object\.prototype\.hasOwnProperty\.call\(snapshot\.importSelections \|\| \{\}, key\)\)/,
  'preset import selections must never be copied into prompt selections',
);
assert.match(
  indexSource,
  /\$t\('#st-esg-source-preset'\)\.on\('change', function \(\) \{[\s\S]*?if \(getSourceMode\('preset'\) === SOURCE_MODE_PROMPT\) markSchemeDirty\('preset'\);[\s\S]*?scanImportCandidates\(\{ explicitPresetName: presetName \}\); \}\);/,
  'changing the preset source should only dirty a saved scheme in prompt mode, not import mode',
);
assert.match(
  indexSource,
  /st-esg-task-components-help[\s\S]*?\{\{external_components\}\}/,
  'the task page should keep a visible explanation of the external-components placeholder near the task input',
);
assert.match(styleSource, /\.st-esg-task-components-help\s*\{/, 'the task placeholder explanation should have dedicated small-text styling');

const sourceModeUiFunction = indexSource.slice(
  indexSource.indexOf('function renderSourceModeUi()'),
  indexSource.indexOf('function renderSourceModeControl(type)'),
);
assert.match(
  indexSource,
  /COMPONENT_SCOPE_PRESET,\s*SOURCE_PRESET,\s*SOURCE_WORLDBOOK,/,
  'preset import mode must import the same source scope constant used by clearImportSelections',
);
assert.match(
  sourceModeUiFunction,
  /\.toggleClass\('st-esg-hidden', !editable\)\.prop\('disabled', !editable\)/,
  'import mode should hard-hide and disable scheme mutation buttons instead of relying on inline display toggles',
);

const worldbookSchemeState = indexSource.slice(
  indexSource.indexOf('function isFollowingTavernWorldbook()'),
  indexSource.indexOf('function requestTextInputDialog()'),
);
assert.match(
  worldbookSchemeState,
  /function isFollowingTavernWorldbook\(\) \{\s*return getActiveSchemeId\('worldbook'\) === WORLD_BOOK_FOLLOW_TAVERN && !settings\.dirtySchemeTypes\?\.worldbook;/,
  'a modified Tavern-default worldbook draft must stop following Tavern while retaining its selected scheme',
);
assert.match(
  indexSource,
  /function markSchemeDirty\(type\) \{[\s\S]*?settings\.dirtySchemeTypes\[type\] = true;[\s\S]*?renderSchemeOptions\(type\);/,
  'dirtying a scheme should retain the current selection and only mark the working copy unsaved',
);
assert.doesNotMatch(
  indexSource.slice(indexSource.indexOf('function markSchemeDirty(type)'), indexSource.indexOf('function markSchemeClean(type')),
  /setSelectedSchemeId\(type, ''\)|setActiveSchemeId\(type, ''\)/,
  'dirtying a scheme must not clear the scheme selector or active base scheme',
);
assert.match(
  indexSource,
  /const label = settings\.dirtySchemeTypes\?\.\[type\]\s*\? '未保存方案'/,
  'the current-scheme label should say only that the working copy is unsaved',
);

const tavernWorldbookLoadStart = indexSource.indexOf("if (type === 'worldbook' && selectedId === WORLD_BOOK_FOLLOW_TAVERN)");
const tavernWorldbookLoadEnd = indexSource.indexOf('\n    }', tavernWorldbookLoadStart);
const tavernWorldbookLoadBranch = indexSource.slice(tavernWorldbookLoadStart, tavernWorldbookLoadEnd);
assert.ok(tavernWorldbookLoadStart >= 0, 'the Tavern-default worldbook load branch should exist');
assert.ok(
  tavernWorldbookLoadBranch.indexOf('markSchemeClean(type, selectedId)')
    < tavernWorldbookLoadBranch.indexOf('await applyFollowTavernWorldbook()'),
  'Tavern default must become active before scanning worldbooks so cached groups mirror Tavern entry states',
);

const worldbookScanFunction = indexSource.slice(
  indexSource.indexOf('async function scanImportCandidates('),
  indexSource.indexOf('async function loadImportGroup('),
);
assert.match(
  worldbookScanFunction,
  /collectWorldbookImportGroups\(\{[\s\S]*?selectedWorldNames,[\s\S]*?explicitWorldbookNames: followingTavernWorldbook \? null : settings\.worldbookDraftSources,[\s\S]*?\}\)/,
  'the worldbook directory should combine Tavern\'s complete catalog with saved-scheme sources so missing records remain visible',
);
assert.doesNotMatch(
  worldbookScanFunction,
  /collectWorldbookImportCounts\(/,
  'opening the directory must not eagerly load every worldbook merely to show counts',
);
assert.match(indexSource, /\['failed', '读取失败'\]/, 'failed worldbooks should have their own category');
assert.match(indexSource, /return '点击查看'/, 'failed rows should invite the user to open the failure detail');
assert.match(indexSource, /删除这条世界书记录/, 'failure detail should let the user remove the stale scheme record');
assert.match(indexSource, /未匹配的旧方案条目/);
assert.match(indexSource, /未匹配上 UID/);
assert.match(indexSource, /删除该条记录/);
assert.match(
  indexSource,
  /`\$\{renderUnmatchedWorldbookRecords\(group\)\}\$\{renderListToolbar\(\)\}\$\{groupBody\(group\)\}`/,
  'unmatched legacy records should appear above the search toolbar and current UID entries',
);
assert.match(
  styleSource,
  /\.st-esg-worldbook-failure \.st-esg-remove-worldbook-record\s*\{[^}]*display:\s*inline-flex\s*!important;[^}]*flex-direction:\s*row\s*!important;[^}]*white-space:\s*nowrap\s*!important;/s,
  'the worldbook record delete button should stay horizontal',
);
assert.match(
  styleSource,
  /\.st-esg-unmatched-worldbook \+ \.st-esg-list-toolbar\s*\{[^}]*margin:\s*8px 0 6px;/s,
  'the search toolbar must not use its first-child negative margin after unmatched records',
);

// Placement while a scheme is active is decided by the plugin selection, not by re-grouping the
// directory. A tavern-default scheme that was only just edited has no captured source list yet, so
// the plugin-enabled check must fall back to Tavern's assignment instead of emptying every category.
assert.match(
  indexSource,
  /schemeEnabled: !isFollowingTavernWorldbook\(\) && isWorldbookSourceEnabledByPlugin\(group\)/,
  'books enabled by the active scheme should be categorised as plugin-enabled immediately',
);
assert.match(
  indexSource,
  /function isWorldbookSourceEnabledByPlugin\(group\) \{[\s\S]*?isTavernDefaultWorldbookScheme\(\)[\s\S]*?hasEnabledWorldbookSource\(getSourceSelectionStore\(group\), group\?\.source\)/,
  'custom schemes should classify books from explicit enabled entries while Tavern-default drafts retain their native fallback',
);
assert.match(
  indexSource,
  /function startBackgroundWorldbookCounts\(\)/,
  'worldbook counts should be filled asynchronously after the directory has rendered',
);
assert.match(
  indexSource,
  /group\.category !== 'inactive' \|\| !followingTavernWorldbook/,
  'opening an inactive Tavern worldbook must not synchronize its native enabled flags into plugin selections',
);
// While a scheme drives the list its snapshot is authoritative, so a book loaded then must be tagged
// as not following Tavern; otherwise opening one entry seeds the whole book from Tavern's own flags.
assert.match(
  indexSource,
  /followsTavernState: followingTavernWorldbook/,
  'scheme-driven worldbooks must not inherit tavern activation when their entries load',
);
assert.match(
  indexSource,
  /resolveWorldbookSelection\(item, store, followsTavernState\)/,
  'worldbook rows and background counts should use the same tested selection resolver',
);
// The Tavern default owns no snapshot, so its checkboxes must mirror Tavern even after the draft
// turns dirty. Deciding this with isFollowingTavernWorldbook forced every entry to report 0/total.
assert.match(
  indexSource,
  /function isTavernDefaultWorldbookScheme\(\) \{\s*return getActiveSchemeId\('worldbook'\) === WORLD_BOOK_FOLLOW_TAVERN;/,
  'mirroring Tavern must not depend on whether the worldbook draft is dirty',
);
assert.match(
  indexSource,
  /<span class="st-esg-history-rule-keep">保留 <input/,
  'the retention label and number input must share one inline container instead of using a vertically styled label',
);
assert.match(
  indexSource,
  /\$\{config\.description\}.*“保留”只作用于当前规则/s,
  'history cleanup help should retain the original rule explanation before its retention explanation',
);
assert.match(
  indexSource,
  /worldbookInitialized: false,[\s\S]*?worldbookDraftSources: \[\],/,
  'new installs should track first-run worldbook initialization and a persistent working-source draft separately',
);
assert.match(
  indexSource,
  /if \(settings\.worldbookInitialized !== true\) \{[\s\S]*?setSelectedSchemeId\('worldbook', WORLD_BOOK_FOLLOW_TAVERN\);[\s\S]*?setActiveSchemeId\('worldbook', WORLD_BOOK_FOLLOW_TAVERN\);/,
  'a first-time user should start from Tavern default without manually loading it',
);

const componentEditorConfirmHandler = indexSource.slice(
  indexSource.indexOf("list.on('click.stEsgComponentEditor', '.st-esg-component-edit-confirm'"),
  indexSource.indexOf("list.on('click.stEsgComponentEditor', '.st-esg-component-edit-cancel'"),
);
assert.match(
  componentEditorConfirmHandler,
  /updateComponentEditorSummary\(editor, item\);/,
  'saving an existing component should patch only its own visible summary',
);
assert.doesNotMatch(
  componentEditorConfirmHandler,
  /renderComponentList\(\);/,
  'saving an existing component must not rebuild the complete component library',
);
const schemeActionFunction = indexSource.slice(
  indexSource.indexOf('async function handleSchemeAction(type, action)'),
  indexSource.indexOf('function renderComponentPreview(item)'),
);
assert.match(
  schemeActionFunction,
  /if \(type === 'worldbook' && isTavernDefaultWorldbookScheme\(\)\) \{[\s\S]*?await prepareTavernWorldbookSchemeSnapshot\(\);[\s\S]*?\}[\s\S]*?currentSchemeSnapshot\(type\)/,
  'saving a new scheme from Tavern default must hydrate unloaded active worldbooks before capturing the snapshot',
);
assert.match(
  schemeActionFunction,
  /const snapshot = currentSchemeSnapshot\(type\);[\s\S]*?saveScheme\(list, name, snapshot\)[\s\S]*?settings\.worldbookDraftSources = getWorldbookSchemeSourceNames\(snapshot\);/,
  'a newly saved worldbook scheme should immediately adopt its own static source list',
);
assert.match(
  indexSource,
  /async function prepareTavernWorldbookSchemeSnapshot\(\)[\s\S]*?let completed = activeGroups\.filter\(\(group\) => group\.loaded && Array\.isArray\(group\.items\)\)\.length;/,
  'save progress should count active books that were already loaded',
);
assert.match(
  indexSource,
  /async function readWorldbookItemsForGroup\(group\)[\s\S]*?group\.backgroundItemsPromise[\s\S]*?collectWorldbookImportCandidates/,
  'background counts, detail loading, and scheme saving should share one per-group worldbook read',
);
assert.match(
  worldbookScanFunction,
  /group\.loaded \|\| Array\.isArray\(group\.backgroundItems\) \|\| group\.backgroundItemsPromise[\s\S]*?backgroundItems: cached\.backgroundItems[\s\S]*?backgroundItemsPromise: cached\.backgroundItemsPromise/,
  'rebuilding the worldbook directory should retain completed and in-flight background reads',
);
assert.match(
  schemeActionFunction,
  /if \(isSchemeMutationLocked\(type, action\)\) \{[\s\S]*?return;/,
  'scheme mutation handlers should reject save, overwrite, and delete actions while a source is in import mode',
);

const defaultTaskPrompt = indexSource.slice(
  indexSource.indexOf('taskPrompt: ['),
  indexSource.indexOf("  apiUrl: '',"),
);
assert.match(defaultTaskPrompt, /taskPrompt:\s*\[[\s\S]*?\{\{external_components\}\}[\s\S]*?\]\.join/, 'the default task prompt should retain the component insertion point');
assert.match(defaultTaskPrompt, /现在停止生成正文，为最新的正文补充下面这些内容。/, 'the default task prompt should explicitly stop prose continuation');
assert.match(defaultTaskPrompt, /上方为需要补充的内容，现在开始输出思考过程并按规则和格式输出需要补充的内容，禁止额外生成正文。/, 'the default task prompt should request only the missing components');
assert.match(indexSource, /taskPlacementEnabled:\s*true,/, 'fresh installs should enable custom task placement');
assert.match(indexSource, /taskPlacementAfterSourceId:\s*TASK_PLACEMENT_AFTER_CHAT_HISTORY,/, 'fresh installs should use semantic Chat History placement');
assert.match(indexSource, /replaceLastUserMessageWithTask:\s*true,/, 'fresh installs should replace LastUserMessage with the task');
assert.match(indexSource, /const isFreshInstall = Object\.keys\(storedSettings\)\.length === 0;/, 'settings loading should distinguish a fresh install from an existing settings object');
assert.match(indexSource, /if \(!isFreshInstall && !Object\.prototype\.hasOwnProperty\.call\(storedSettings, 'taskPlacementEnabled'\)\) settings\.taskPlacementEnabled = false;/, 'old settings objects without the placement option must retain the legacy disabled behavior');
assert.match(indexSource, /if \(!isFreshInstall && !Object\.prototype\.hasOwnProperty\.call\(storedSettings, 'replaceLastUserMessageWithTask'\)\) settings\.replaceLastUserMessageWithTask = false;/, 'old settings objects without LastUserMessage replacement must retain the legacy disabled behavior');
assert.doesNotMatch(defaultTaskPrompt, /\u5206\u6790/, 'the default task prompt must not suppress model reasoning output');
assert.doesNotMatch(indexSource, /现在只输出需要追加的内容，不解释，不输出分析过程。/, 'the default task prompt must not suppress model reasoning output');

assert.match(indexSource, /worldbookKeywordOverrides:\s*\{\}/, 'worldbook keyword overrides need their own plugin-side settings store');
assert.match(indexSource, /class="text_pole[^"]*st-esg-worldbook-keywords"/, 'worldbook edit mode should expose one native-style primary-keyword field');
assert.match(indexSource, /splitWorldbookKeywords\(String\(keywordInput\.val\(\) \?\? ''\)\)/, 'saving the shared editor should parse its comma-separated keyword field');
assert.match(indexSource, /delete settings\.sourceContentOverrides\[item\.key\];[\s\S]*?delete settings\.worldbookKeywordOverrides\[item\.key\];/, 'restore native should remove content and primary-keyword overrides together');
assert.match(indexSource, /hasSourceItemOverride\(item\)/, 'modified filtering and badges should share content-or-keyword override detection');
assert.doesNotMatch(indexSource, /const worldbookMeta = isWorldbookItem/, 'worldbook details must not render a second primary-keyword block outside the editor');
assert.match(indexSource, /st-esg-worldbook-keywords-readonly/, 'import mode should retain one read-only primary-keyword display');
