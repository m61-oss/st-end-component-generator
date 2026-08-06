import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const styleSource = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const toggleStart = indexSource.indexOf('function togglePanel(');
const toggleEnd = indexSource.indexOf('\nfunction ', toggleStart + 10);
const toggleFunction = indexSource.slice(toggleStart, toggleEnd);
const ballStart = indexSource.indexOf('function renderFloatingBall()');
const ballEnd = indexSource.indexOf('\nfunction ', ballStart + 10);
const ballFunction = indexSource.slice(ballStart, ballEnd);

assert.match(indexSource, /st-esg-history-range-recent-note/);
assert.match(styleSource, /#st-esg-dialog \.st-esg-history-range-recent-input input\s*\{[^}]*width:\s*48px !important;[^}]*flex:\s*0 0 48px;/s);
assert.match(indexSource, /#st-esg-recent-message-count'\)\.on\('input'/);
assert.match(indexSource, /\.on\('change blur'/);
assert.match(indexSource, /if \(!raw\) return;/, 'empty recent-message input should remain editable until blur');

assert.match(toggleFunction, /dialog\.show\(\)/, 'the outer panel should not enter the native modal top layer');
assert.doesNotMatch(toggleFunction, /dialog\.showModal\(\)/, 'the outer panel must allow other overlays above it');
assert.match(styleSource, /\.st-esg-dialog\s*\{[^}]*z-index:\s*9000 !important;/s);
assert.match(styleSource, /#st-esg-ball\s*\{[^}]*z-index:\s*8999 !important;/s);
assert.match(ballFunction, /setPointerCapture/);
assert.match(ballFunction, /pointercancel/);
assert.match(ballFunction, /suppressClick/);

console.log('interaction UI tests passed');
