import assert from 'node:assert/strict';
import {
  buildBaiBaiBookInjections,
  selectBaiBaiBookSnapshot,
} from '../sources/baibai-book.js';

const api = {
  getInjectedHistory() {
    return { relativeText: '昨天，主角在王宫得知北境来信。' };
  },
  getSnapshot(options) {
    return {
      point: options,
      state: { time: '2026/12/17 20:10', location: '东塔书房', locationPath: ['王国', '王宫', '东塔书房'] },
      protagonist: { identity: '侦察员', condition: '疲惫' },
      scenes: [
        { id: 'kingdom', name: '王国', path: ['王国'], parentId: '', desc: '北方的古老王国' },
        { id: 'palace', name: '王宫', path: ['王国', '王宫'], parentId: 'kingdom', desc: '王室居所' },
        { id: 'study', name: '东塔书房', path: ['王国', '王宫', '东塔书房'], parentId: 'palace', desc: '堆满古籍的房间' },
        { id: 'harbor', name: '港口', path: ['王国', '港口'], parentId: 'kingdom', desc: '临海港口' },
      ],
      items: [{ name: '银钥匙', qty: 1, carried: true, desc: '能打开旧塔的门' }],
      plans: [
        { kind: 'plan', content: '查明北境来信的来源', status: 'open', createdTime: '2026/12/14 19:15', targetTime: '本周末' },
        { kind: 'suspense', content: '未知发件人的目的', status: 'open', createdTime: '2026/12/15 09:30' },
        { kind: 'plan', content: '已经完成的旧计划', status: 'resolved' },
      ],
      npcs: [
        { name: '艾琳', title: '宫廷书记官', condition: '正在整理档案', location: '王宫', important: true },
        { name: '诺亚', title: '守门人', location: '东塔书房' },
        { name: '莉娜', title: '宫女', location: '王宫' },
        { name: '米娅', title: '商人', location: '港口' },
      ],
      vars: { trust: { protagonist: 2 } },
      itemLog: [{ name: '银钥匙', kind: 'add', time: '夜晚' }],
    };
  },
  getFloor(floor) {
    return { floor, memory: { valid: floor === 3 } };
  },
};

const context = {
  substituteParams: (value) => String(value).replace('{{user}}', '林屿桐'),
  chat: [
    { is_user: true, mes: '我们到了王宫。' },
    { is_user: false, mes: '艾琳递来一封信。' },
    { is_user: true, mes: '我拆开信封。' },
    { is_user: false, mes: '信中提到北境的异常。' },
  ],
};

const beforeSnapshot = selectBaiBaiBookSnapshot(api, context);
assert.deepEqual(beforeSnapshot.point, { floor: 3, at: 'after' });

const apiWithoutSummary = {
  ...api,
  getFloor() {
    return { memory: { valid: false } };
  },
};
const priorSnapshot = selectBaiBaiBookSnapshot(apiWithoutSummary, context);
assert.deepEqual(priorSnapshot.point, { floor: 3, at: 'before' });

const injections = buildBaiBaiBookInjections({
  api,
  context,
  includeHistory: true,
  includeState: true,
});

assert.equal(injections.length, 2);
assert.equal(injections[0].role, 'system');
assert.equal(injections[0].depth, 9999);
assert.match(injections[0].content, /\[历史剧情摘要\]/);
assert.match(injections[0].content, /主角在王宫得知北境来信/);
assert.match(injections[0].content, /〔记忆系统私密简报｜仅你可见〕下列内容由记忆系统在幕后提供,仅供你参考以保持剧情连贯一致。/);
assert.match(injections[0].content, /〔私密简报结束〕以上仅供你了解前情。/);
assert.equal(injections[1].depth, 1);
assert.equal(injections[0].preserveSystemMessage, true);
assert.equal(injections[1].preserveSystemMessage, true);
assert.match(injections[1].content, /\[当前状态\]/);
assert.match(injections[1].content, /当前时间:2026\/12\/17 20:10/);
assert.match(injections[1].content, /当前地点:东塔书房/);
assert.match(injections[1].content, /王国（北方的古老王国） › 王宫（王室居所） › 东塔书房（堆满古籍的房间）/);
assert.match(injections[1].content, /其他已知地点[\s\S]*王国 › 港口/);
assert.match(injections[1].content, /侦察员/);
assert.match(injections[1].content, /\[主角当前状态\]\n林屿桐:/);
assert.match(injections[1].content, /银钥匙 ×1 —— 能打开旧塔的门/);
assert.match(injections[1].content, /艾琳/);
assert.match(injections[1].content, /主要角色[\s\S]*艾琳\(·宫廷书记官\) 〔状态:正在整理档案;在:王宫〕/);
assert.match(injections[1].content, /在场角色[\s\S]*诺亚/);
assert.match(injections[1].content, /同区域角色[\s\S]*莉娜/);
assert.match(injections[1].content, /其他已知角色[\s\S]*米娅/);
assert.match(injections[1].content, /查明北境来信的来源/);
assert.match(injections[1].content, /p1\. \[计划\][\s\S]*\(立于 2026\/12\/14 19:15 · 目标 本周末\)/);
assert.match(injections[1].content, /p2\. \[悬念\][\s\S]*\(立于 2026\/12\/15 09:30\)/);
assert.match(injections[1].content, /trust/);
assert.doesNotMatch(injections[1].content, /已经完成的旧计划|itemLog|物品变动|近期已了结/);
assert.doesNotMatch(injections[1].content, /状态栏生成时可参考|剧情记录结束|自然续写正文|不要复述简报本身/);
assert.match(injections[1].content, /〔私密简报结束〕以上仅供你了解前情。/);

assert.deepEqual(buildBaiBaiBookInjections({ api, context, includeHistory: false, includeState: false }), []);
assert.equal(buildBaiBaiBookInjections({ api, context, includeHistory: true, includeState: false }).length, 1);
assert.equal(buildBaiBaiBookInjections({ api, context, includeHistory: false, includeState: true }).length, 1);

console.log('baibai-book tests passed');
