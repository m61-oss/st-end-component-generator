import assert from 'node:assert/strict';
import {
  filterWorldbookPromptItems,
  getWorldbookScanText,
  isWorldbookEntryActivated,
  parseWorldbookRegex,
  splitWorldbookKeywords,
} from '../sources/worldbook-scan.js';

const chat = [
  { is_user: true, mes: '很久以前的地点' },
  { is_user: false, mes: '上一层提到月光' },
  { is_system: true, mes: '隐藏层中的机密词' },
  { is_user: true, mes: '当前对话出现月光' },
];

assert.equal(getWorldbookScanText(chat, 2), '当前对话出现月光\n上一层提到月光');
assert.equal(isWorldbookEntryActivated({ activationMode: 'blue', key: ['不存在'] }, { scanText: '' }), true);
assert.equal(isWorldbookEntryActivated({ activationMode: 'green', key: ['月光'] }, { scanText: getWorldbookScanText(chat, 2) }), true);
assert.equal(isWorldbookEntryActivated({ activationMode: 'green', key: ['机密词'] }, { scanText: getWorldbookScanText(chat, 2) }), false);
assert.equal(isWorldbookEntryActivated({
  activationMode: 'green',
  key: '世界书::内部条目标识',
  worldbookKeys: ['星光', '月光'],
}, { scanText: getWorldbookScanText(chat, 2) }), true, 'imported entries should match any worldbook activation keyword');

const items = filterWorldbookPromptItems([
  { scope: '世界书', activationMode: 'blue', key: ['蓝灯'] },
  { scope: '世界书', activationMode: 'green', key: ['月光'] },
  { scope: '世界书', activationMode: 'green', key: ['不存在'] },
  { scope: '预设', content: 'preset' },
], { chat, scanDepth: 2 });
assert.deepEqual(items.map((item) => item.activationMode || item.scope), ['blue', 'green', '预设']);

console.log('worldbook-scan tests passed');

// Plugin selections must win over Tavern's own entry toggle. An entry that is disabled in
// Tavern can still be checked inside the plugin, and it has to reach the prompt.
assert.equal(isWorldbookEntryActivated({
  activationMode: 'blue',
  enabled: false,
  key: ['\u4e0d\u5b58\u5728'],
}, { scanText: '' }), true, 'tavern-disabled entry must stay activatable when the plugin selected it');

assert.equal(isWorldbookEntryActivated({
  activationMode: 'green',
  disable: true,
  key: ['\u6708\u5149'],
}, { scanText: getWorldbookScanText(chat, 2) }), true, 'tavern-disabled green entry must still match its keyword');

const tavernDisabledItems = filterWorldbookPromptItems([
  { scope: '\u4e16\u754c\u4e66', activationMode: 'blue', enabled: false, key: ['\u84dd\u706f'] },
  { scope: '\u4e16\u754c\u4e66', activationMode: 'green', disable: true, key: ['\u6708\u5149'] },
  { scope: '\u4e16\u754c\u4e66', activationMode: 'green', enabled: false, key: ['\u4e0d\u5b58\u5728'] },
], { chat, scanDepth: 2 });
assert.deepEqual(
  tavernDisabledItems.map((item) => item.activationMode),
  ['blue', 'green'],
  'tavern-disabled entries follow plugin selection and normal lamp rules',
);

console.log('worldbook-scan tavern-disabled selection tests passed');


// Green-light keywords must be scanned against the history the model will actually receive. A
// keyword that only survives inside a block the cleanup rules strip must not activate its entry.
const taggedChat = [
  { is_user: false, mes: '普通正文<thinking>机密词</thinking>' },
  { is_user: true, mes: '用户发言' },
];

assert.equal(
  getWorldbookScanText(taggedChat, 2, { historyCleanupRules: [{ rule: 'thinking', keep: 0 }] }),
  '用户发言\n普通正文',
  'scan text must exclude content removed by the history cleanup rules',
);

assert.equal(
  filterWorldbookPromptItems(
    [{ scope: '世界书', activationMode: 'green', key: ['机密词'] }],
    { chat: taggedChat, scanDepth: 2, historyCleanupRules: [{ rule: 'thinking', keep: 0 }] },
  ).length,
  0,
  'a keyword only present inside a stripped block must not trigger the green lamp',
);

// The cleanup rules must not blind the scan to text that survives cleanup.
assert.equal(
  filterWorldbookPromptItems(
    [{ scope: '世界书', activationMode: 'green', key: ['普通正文'] }],
    { chat: taggedChat, scanDepth: 2, historyCleanupRules: [{ rule: 'thinking', keep: 0 }] },
  ).length,
  1,
  'keywords in surviving text still activate their entry',
);

console.log('worldbook-scan cleanup-before-scan tests passed');

assert.deepEqual(
  splitWorldbookKeywords('坂田银时, /<content>[\\s\\S]{0,20}坂田,银时<\\/content>/i, 银魂'),
  ['坂田银时', '/<content>[\\s\\S]{0,20}坂田,银时<\\/content>/i', '银魂'],
  'commas inside a slash-delimited regex must not split the native keyword field',
);
assert.equal(parseWorldbookRegex('/a\\/b/i')?.test('A/B'), true, 'escaped slashes should work in native-style regex keywords');
assert.equal(parseWorldbookRegex('/broken[/'), null, 'invalid regex-like text must fall back to ordinary keyword matching');
assert.equal(
  isWorldbookEntryActivated({ activationMode: 'green', worldbookKeys: ['/broken[/'] }, { scanText: 'literal /broken[/ text' }),
  true,
  'invalid regex-like text should remain usable as a literal keyword',
);
assert.equal(
  isWorldbookEntryActivated({ activationMode: 'green', worldbookKeys: ['/<content>[\\s\\S]*?坂田银时[\\s\\S]*?<\\/content>/i'] }, {
    scanText: '<content>坂田银时正在吃饭</content>\n[角色|坂田银时]',
  }),
  true,
  'valid regex keywords should scan the complete history text',
);
assert.equal(
  isWorldbookEntryActivated({ activationMode: 'green', worldbookKeys: ['/{{char}}/i'] }, {
    scanText: 'GINTOKI appears in the injected statusbar',
    substituteKeyword: (keyword) => keyword.replace('{{char}}', 'Gintoki'),
  }),
  true,
  'standard Tavern macro substitution should run before keyword matching',
);
assert.equal(
  isWorldbookEntryActivated({ activationMode: 'green', worldbookKeys: ['Moon'], caseSensitive: true }, { scanText: 'moon' }),
  false,
  'plain keywords should respect Tavern case sensitivity',
);
assert.equal(
  isWorldbookEntryActivated({ activationMode: 'green', worldbookKeys: ['cat'], matchWholeWords: true }, { scanText: 'concatenate' }),
  false,
  'plain keywords should respect Tavern whole-word matching',
);
assert.equal(
  isWorldbookEntryActivated({ activationMode: 'green', worldbookKeys: ['cat'], matchWholeWords: true }, { scanText: 'a cat appears' }),
  true,
  'whole-word keywords should still match a standalone word',
);
const globalRegexEntry = { activationMode: 'green', worldbookKeys: ['/cat/g'] };
assert.equal(isWorldbookEntryActivated(globalRegexEntry, { scanText: 'cat' }), true);
assert.equal(isWorldbookEntryActivated(globalRegexEntry, { scanText: 'cat' }), true, 'global regex state must not leak between scans');
assert.equal(
  isWorldbookEntryActivated({ activationMode: 'green', key: 'internal-entry-id', worldbookKeys: [] }, { scanText: 'internal-entry-id' }),
  false,
  'clearing the editable keyword field must not fall back to the plugin internal entry id',
);

console.log('worldbook-scan native keyword tests passed');

// The plugin-level recent-message range is also the upper bound for green-light scans.
// Recent mode intentionally keeps a native-hidden message when it falls inside the range.
const recentRangeChat = [
  { is_user: true, mes: '旧消息中的后台角色关键词' },
  { is_user: false, mes: '最近一条但被酒馆隐藏', extra: { [Symbol.for('ignore')]: true } },
  { is_user: true, mes: '最新正文' },
];
assert.equal(
  getWorldbookScanText(recentRangeChat, 10, { historyRangeMode: 'recent', recentMessageCount: 2 }),
  '最新正文\n最近一条但被酒馆隐藏',
  'recent mode should scan only the selected range and keep hidden messages inside that range',
);
assert.equal(
  filterWorldbookPromptItems(
    [{ scope: '\u4e16\u754c\u4e66', activationMode: 'green', key: ['旧消息中的后台角色关键词'] }],
    { chat: recentRangeChat, scanDepth: 10, historyRangeMode: 'recent', recentMessageCount: 2 },
  ).length,
  0,
  'messages outside the recent range must not activate a green-light entry',
);

console.log('worldbook-scan history-range tests passed');
