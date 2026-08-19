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

test('楼层面板使用边框盒并把正文宽度作为真正的最大宽度', () => {
  assert.match(styleSource, /\.st-esg-message-floor-panel\s*\{[^}]*box-sizing:\s*border-box[^}]*max-width:\s*100%[^}]*min-width:\s*0/s);
  assert.match(indexSource, /panel\.style\.width\s*=\s*'100%'/);
  assert.match(indexSource, /panel\.style\.maxWidth\s*=\s*`\$\{width\}px`/);
});

test('短内容自然收紧，长内容达到上限后才在字段内部滚动', () => {
  assert.match(indexSource, /function resizeMessageFloorTextarea\(/);
  assert.match(indexSource, /textarea\.style\.height\s*=\s*'auto'/);
  assert.match(indexSource, /textarea\.scrollHeight/);
  assert.doesNotMatch(styleSource, /\.st-esg-floor-output\s*\{[^}]*height:\s*clamp\(/s);
  assert.match(styleSource, /\.st-esg-floor-output\s*\{[^}]*min-height:\s*72px[^}]*max-height:/s);
  assert.doesNotMatch(styleSource, /\.st-esg-floor-anchor-item\[open\]\s*\{[^}]*height:\s*clamp\(/s);
  assert.match(styleSource, /\.st-esg-floor-anchor-item\s*\{[^}]*min-width:\s*0/s);
  assert.match(styleSource, /\.st-esg-floor-anchor-fields textarea\s*\{[^}]*max-height:/s);
  assert.match(styleSource, /\.st-esg-floor-anchor-item\s*\{[^}]*min-width:\s*0/s);
});

test('状态舞台取代独立状态文字和抽象线条并保留可访问状态名', () => {
  assert.match(indexSource, /getFloorPanelStatusStage/);
  assert.match(indexSource, /class="st-esg-floor-stage"/);
  assert.match(indexSource, /data-floor-stage-motion=/);
  assert.match(indexSource, /st-esg-floor-stage-lead/);
  assert.match(indexSource, /st-esg-floor-stage-shuttle/);
  assert.match(indexSource, /st-esg-floor-stage-text/);
  assert.match(indexSource, /st-esg-floor-stage-face/);
  assert.match(indexSource, /st-esg-floor-stage-tail/);
  assert.doesNotMatch(indexSource, /class="st-esg-floor-status"/);
  assert.doesNotMatch(indexSource, /class="st-esg-floor-motion"/);
});

test('状态舞台按状态编排符号动画且操作图标视觉尺寸更小', () => {
  assert.match(styleSource, /@keyframes st-esg-floor-shuttle-weave/);
  assert.match(styleSource, /@keyframes st-esg-floor-ready-bloom/);
  assert.match(styleSource, /@keyframes st-esg-floor-embed/);
  assert.match(styleSource, /@keyframes st-esg-floor-tangle/);
  assert.match(styleSource, /@keyframes st-esg-floor-tangle-tail/);
  assert.match(styleSource, /\.st-esg-floor-compact-action\s*\{[^}]*width:\s*28px[^}]*height:\s*28px/s);
  assert.match(styleSource, /\.st-esg-floor-compact-action i\s*\{[^}]*font-size:\s*10px/s);
  assert.match(styleSource, /prefers-reduced-motion:[\s\S]*\.st-esg-floor-stage \*/);
});

test('floor panel textarea overflow overrides host styles after adaptive resizing', () => {
  assert.match(
    indexSource,
    /textarea\.style\.setProperty\(\s*'overflow-y',\s*contentHeight > maxHeight \+ 1 \? 'auto' : 'hidden',\s*'important',?\s*\)/,
  );
});

test('打开悬浮球不再吞掉页面的下一次真实点击', () => {
  assert.doesNotMatch(indexSource, /function suppressNextClickAfterFloatingBallOpen/);
  assert.match(indexSource, /targetWindow\.setTimeout\(\(\) => openPanelFromFloatingBall\(\),\s*0\)/);
});

test('日间与夜间主题的通用强调色不再使用高饱和系统蓝', () => {
  assert.doesNotMatch(styleSource, /\.st-esg-theme-dark\s*\{[^}]*--esg-primary:\s*#0A84FF/s);
  assert.doesNotMatch(styleSource, /\.st-esg-theme-light\s*\{[^}]*--esg-primary:\s*#007AFF/s);
});
