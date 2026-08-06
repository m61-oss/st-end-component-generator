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
assert.match(renderFunction, /historyRangeCard\.className\s*=\s*'st-esg-card st-esg-collapsible st-esg-history-range-card'/);
assert.match(renderFunction, /<summary class="st-esg-collapsible-summary">聊天记录范围<\/summary>/);
assert.match(renderFunction, /<div class="st-esg-collapsible-body"><div class="st-esg-history-range-options">/);
assert.doesNotMatch(renderFunction, /st-esg-history-range-card[\s\S]*st-esg-card-title/,
  'chat history range should use the shared collapsible summary instead of a card title that receives a question mark');
assert.match(source, /#st-esg-history-range-mode-\$\{mode\}/);
assert.match(source, /#st-esg-recent-message-count/);

console.log('chat-history-range UI tests passed');
