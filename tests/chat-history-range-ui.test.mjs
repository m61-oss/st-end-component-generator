import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const renderStart = source.indexOf('function renderPluginPanel()');
const renderEnd = source.indexOf('\nfunction ', renderStart + 10);
const renderFunction = source.slice(renderStart, renderEnd);

assert.match(source, /historyRangeMode:\s*CHAT_HISTORY_RANGE_VISIBLE/);
assert.match(source, /recentMessageCount:\s*10/);
assert.match(source, /historyRangeMode:\s*settings\.historyRangeMode/);
assert.match(source, /recentMessageCount:\s*settings\.recentMessageCount/);
assert.match(renderFunction, /id="st-esg-history-range-mode-visible"[^>]*type="radio"/);
assert.match(renderFunction, /id="st-esg-history-range-mode-recent"[^>]*type="radio"/);
assert.match(renderFunction, /id="st-esg-recent-message-count"[^>]*value="10"/);
assert.match(source, /#st-esg-history-range-mode-\$\{mode\}/);
assert.match(source, /#st-esg-recent-message-count/);

console.log('chat-history-range UI tests passed');
