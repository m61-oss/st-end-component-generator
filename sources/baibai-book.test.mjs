import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBaiBaiBookInjections } from './baibai-book.js';

function createContext() {
  return {
    chat: [{ is_user: false, is_system: false, mes: '上一条回复' }],
    characterId: '0',
    characters: [{ name: '角色A', avatar: 'character-a.png' }],
    extensionSettings: {
      baibai_book: {
        varsGlobalTemplate: { meaning: '全局变量含义', rule: '全局变量变化规则' },
        varsTemplateByChar: {
          'character-a.png': { meaning: '角色变量含义', rule: '角色变量变化规则' },
        },
      },
    },
    chatMetadata: {
      baibai_book: {
        varsTemplate: { meaning: '聊天变量含义', rule: '聊天变量变化规则' },
      },
    },
  };
}

function createApi() {
  return {
    getFloor() {
      return { memory: { valid: true } };
    },
    getSnapshot() {
      return {
        state: { time: '2025年1月1日', location: '万事屋' },
        protagonist: {
          age: '20岁',
          ageTime: '2024年1月1日',
          identity: '侦探',
        },
        items: [],
        scenes: [],
        npcs: [
          {
            name: '角色A',
            gender: '女',
            age: '18岁',
            ageTime: '2024年1月1日',
            relation: '主角的朋友,长期互相照应',
            ties: '与角色B是姐妹；与组织有旧约',
            title: '助手',
            personality: '谨慎',
            location: '万事屋',
          },
        ],
        plans: [],
        vars: { favor: 3 },
      };
    },
  };
}

test('injects BaiBai age, relations, ties and variable meanings without changing the state wrapper', () => {
  const [injection] = buildBaiBaiBookInjections({
    api: createApi(),
    context: createContext(),
    includeState: true,
  });

  assert.equal(injection.role, 'system');
  assert.match(injection.content, /〔记忆系统私密简报｜仅你可见〕/);
  assert.match(injection.content, /年龄：约21岁/);
  assert.match(injection.content, /角色A\(·女·约19岁\(2024年时18岁\)·助手\)/);
  assert.match(injection.content, /与主角:主角的朋友,长期互相照应/);
  assert.match(injection.content, /角色长期关系\(血缘\/婚姻\/主仆\/宿敌等，不因是否在场而失效\):/);
  assert.match(injection.content, /角色A:与角色B是姐妹;与组织有旧约/);
  assert.match(injection.content, /变量含义\(仅帮你理解上面的值,不要输出\):/);
  assert.match(injection.content, /全局变量含义/);
  assert.match(injection.content, /角色变量含义/);
  assert.match(injection.content, /聊天变量含义/);
  assert.doesNotMatch(injection.content, /变化规则/);
  assert.match(injection.content, /〔私密简报结束〕以上仅供你了解前情。/);
});
