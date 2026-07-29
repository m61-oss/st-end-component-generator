import assert from 'node:assert/strict';
import { filterWorldbookPromptItems, getWorldbookScanText, isWorldbookEntryActivated } from '../worldbook-scan.js';

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
