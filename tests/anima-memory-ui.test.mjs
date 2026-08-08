import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
assert.match(source, /st-esg-memory-source-baibai/);
assert.match(source, /st-esg-memory-source-anima/);
assert.match(source, /st-esg-memory-source-none/);
assert.match(source, /st-esg-anima-worldbook-enabled/);
assert.match(source, /st-esg-anima-status-enabled/);
assert.match(source, /st-esg-anima-status-after-message-enabled/);
assert.match(source, /st-esg-anima-status-after-message-option/);
assert.match(source, /settings\.animaStatusAfterMessageEnabled/);
assert.match(
  source,
  /使用 Anima 记忆前，请先在插件当前的世界书方案中启用 Anima 聊天世界书。/,
  'Anima options should remind users to enable its chat worldbook in the active plugin scheme',
);
assert.match(source, /\\u907f\\u514d\\u6700\\u65b0\\u697c\\u5c42/);
assert.doesNotMatch(source, /\\u5bf9\\u5e94\\u697c\\u5c42\\u88ab\\u804a\\u5929\\u8303\\u56f4\\u6392\\u9664/);
assert.doesNotMatch(source, /st-esg-anima-memory-enabled/);

const scrollStart = source.indexOf('function scrollWorldbookCardIntoView');
const scrollEnd = source.indexOf('\n}', scrollStart) + 2;
assert.ok(scrollStart >= 0 && scrollEnd > scrollStart, 'worldbook scroll helper exists');
const scrollHelper = source.slice(scrollStart, scrollEnd);
assert.doesNotMatch(scrollHelper, /scrollIntoView/);
assert.match(scrollHelper, /panelBody/);

console.log('Anima memory UI tests passed');
