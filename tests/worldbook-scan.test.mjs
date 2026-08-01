import assert from 'node:assert/strict';
import { filterWorldbookPromptItems, getWorldbookScanText, isWorldbookEntryActivated } from '../sources/worldbook-scan.js';

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
