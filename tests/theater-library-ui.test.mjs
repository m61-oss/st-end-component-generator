import assert from 'node:assert/strict';
import fs from 'node:fs';

const indexSource = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const styleSource = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');

assert.match(indexSource, /关闭随机时只发送已启用的条目/);
assert.match(indexSource, /从小剧场库中的全部条目随机抽取/);
assert.match(indexSource, /placeholder="搜索条目\.\.\."/);
assert.match(indexSource, /st-esg-theater-random-fields/);
assert.match(indexSource, /THEATER_RANDOM_MODE_ENABLED/);
assert.match(indexSource, /value="enabled"[^>]*>已启用条目随机/);
assert.match(indexSource, /st-esg-theater-group-content/);
assert.match(indexSource, /st-esg-theater-group-toggle-items/);
assert.match(styleSource, /\.st-esg-theater-random-fields \{[^}]*grid-template-columns: auto minmax\(0, 1fr\) auto minmax\(88px, 120px\)/s);
assert.match(indexSource, /st-esg-component-library-card st-esg-library-collapsible/);
assert.match(indexSource, /st-esg-library-collapsible st-esg-theater-library-card/);
assert.equal((indexSource.match(/st-esg-library-card-summary/g) || []).length, 2);
assert.match(indexSource, /const theaterRandomSettingsMarkup =/);
assert.match(indexSource, /\$\{editToolbar\}\$\{theaterRandomSettingsMarkup\}<div class="st-esg-list-toolbar/);
assert.match(styleSource, /\.st-esg-library-collapsible:not\(\[open\]\)[\s\S]*st-esg-component-edit-toggle/);
assert.match(styleSource, /\.st-esg-library-card-summary \{[^}]*min-height: 34px/s);
assert.match(styleSource, /\.st-esg-library-card-body \{ padding: 8px; }/);
assert.match(styleSource, /\.st-esg-library-card-body > \.st-esg-list-toolbar \{[^}]*top: 0;[^}]*margin: 0 0 8px;/s);

console.log('theater-library UI tests passed');
