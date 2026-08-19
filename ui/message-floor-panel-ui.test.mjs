import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [indexSource, styleSource] = await Promise.all([
  readFile(new URL('../index.js', import.meta.url), 'utf8'),
  readFile(new URL('../style.css', import.meta.url), 'utf8'),
]);

test('楼层面板把操作收进顶部并提供整栏展开和底部收起', () => {
  assert.match(indexSource, /data-floor-compact-toggle/);
  assert.match(indexSource, /data-floor-action-group/);
  assert.match(indexSource, /data-floor-collapse/);
  assert.doesNotMatch(indexSource, /class="st-esg-floor-actions"/);
});

test('楼层流式预览只在用户原本位于底部时跟随新文本', () => {
  assert.match(indexSource, /messageFloorPanelFollowBottom/);
  assert.match(indexSource, /isPreviewNearBottom\(output\)/);
  assert.match(indexSource, /output\.scrollTop\s*=\s*output\.scrollHeight/);
});

test('楼层面板不超出正文宽度且展开的锚点卡片保持固定阅读高度', () => {
  assert.match(styleSource, /\.st-esg-message-floor-panel\s*\{[^}]*max-width:\s*100%[^}]*min-width:\s*0/s);
  assert.match(styleSource, /\.st-esg-floor-output\s*\{[^}]*height:\s*clamp\(/s);
  assert.match(styleSource, /\.st-esg-floor-anchor-item\[open\]\s*\{[^}]*height:\s*clamp\(/s);
  assert.match(styleSource, /\.st-esg-floor-anchor-item\s*\{[^}]*min-width:\s*0/s);
});

test('打开悬浮球不再吞掉页面的下一次真实点击', () => {
  assert.doesNotMatch(indexSource, /function suppressNextClickAfterFloatingBallOpen/);
  assert.match(indexSource, /targetWindow\.setTimeout\(\(\) => openPanelFromFloatingBall\(\),\s*0\)/);
});

test('日间与夜间主题的通用强调色不再使用高饱和系统蓝', () => {
  assert.doesNotMatch(styleSource, /\.st-esg-theme-dark\s*\{[^}]*--esg-primary:\s*#0A84FF/s);
  assert.doesNotMatch(styleSource, /\.st-esg-theme-light\s*\{[^}]*--esg-primary:\s*#007AFF/s);
});
