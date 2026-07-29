import assert from 'node:assert/strict';
import { injectStatusbarText } from '../inject-utils.js';

const statusbar = '<roleplay_options>\n...\n</roleplay_options>';

assert.equal(
  injectStatusbarText('正文', statusbar, { mode: 'append' }),
  '正文\n\n<roleplay_options>\n...\n</roleplay_options>',
);

assert.equal(
  injectStatusbarText('正文\n<status>旧状态</status>', '<status>新状态</status>', { mode: 'replace' }),
  '正文\n<status>新状态</status>',
);

assert.equal(
  injectStatusbarText('正文\n<行动选项>旧选项</行动选项>', '<行动选项>新选项</行动选项>', { mode: 'replace' }),
  '正文\n<行动选项>新选项</行动选项>',
);

assert.ok(!injectStatusbarText('正文', statusbar, { mode: 'append' }).includes('ST-STATUSBAR'));

assert.equal(
  injectStatusbarText('正文\n\n<!-- ST-STATUSBAR-START -->\n旧状态\n<!-- ST-STATUSBAR-END -->', statusbar, { mode: 'replace' }),
  '正文\n\n<!-- ST-STATUSBAR-START -->\n旧状态\n<!-- ST-STATUSBAR-END -->\n\n<roleplay_options>\n...\n</roleplay_options>',
);

assert.equal(
  injectStatusbarText(
    '<stxbar>保留内容</stxbar>\n<st.bar>旧状态</st.bar>',
    '<st.bar>新状态</st.bar>',
    { mode: 'replace' },
  ),
  '<stxbar>保留内容</stxbar>\n<st.bar>新状态</st.bar>',
);

assert.equal(
  injectStatusbarText(
    '正文\n<status>旧状态一</status>\n中间内容\n<status kind="secondary">旧状态二</status>',
    '<status>新状态</status>',
    { mode: 'replace' },
  ),
  '正文\n<status>新状态</status>\n中间内容\n<status>新状态</status>',
);

assert.equal(
  injectStatusbarText(
    '正文\n<StatusPlaceHolderImpl/>\n中间\n<StatusPlaceHolderImpl/>',
    '生成内容\n<StatusPlaceHolderImpl/>',
    { mode: 'append', normalizeStatusPlaceholder: true },
  ),
  '正文\n中间\n\n生成内容\n<StatusPlaceHolderImpl/>',
);

assert.equal(
  injectStatusbarText(
    '正文',
    '生成内容\n<StatusPlaceHolderImpl/>',
    { mode: 'append', normalizeStatusPlaceholder: true },
  ),
  '正文\n\n生成内容\n<StatusPlaceHolderImpl/>',
);

assert.equal(
  injectStatusbarText('正文', '生成内容', { mode: 'append', normalizeStatusPlaceholder: true }),
  '正文\n\n生成内容',
);

console.log('inject-utils tests passed');
