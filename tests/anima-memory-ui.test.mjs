import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
assert.match(source, /记忆设置/);
assert.match(source, /st-esg-memory-source-baibai/);
assert.match(source, /st-esg-memory-source-anima/);
assert.match(source, /st-esg-memory-source-none/);
assert.match(source, /st-esg-anima-worldbook-enabled/);
assert.match(source, /st-esg-anima-status-enabled/);
assert.match(source, /抓取 Anima 最新召回切片并覆盖快照/);
assert.doesNotMatch(source, /重 roll 不会清空/);
assert.doesNotMatch(source, /不会创建缺失的 \[anima_status\] 条目/);
assert.doesNotMatch(source, /st-esg-anima-memory-enabled/);
assert.match(source, /提示词语法/);

const scrollStart = source.indexOf('function scrollWorldbookCardIntoView');
const scrollEnd = source.indexOf('\n}', scrollStart) + 2;
assert.ok(scrollStart >= 0 && scrollEnd > scrollStart, 'worldbook scroll helper exists');
const scrollHelper = source.slice(scrollStart, scrollEnd);
assert.doesNotMatch(scrollHelper, /scrollIntoView/);
assert.match(scrollHelper, /panelBody/);

console.log('Anima memory UI tests passed');
