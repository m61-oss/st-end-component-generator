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
const renderComponentStart = indexSource.indexOf('function renderComponentList()');
const renderComponentEnd = indexSource.indexOf('\nfunction ', renderComponentStart + 10);
const renderComponentFunction = indexSource.slice(renderComponentStart, renderComponentEnd);
const renderComponentBuildPhase = renderComponentFunction.slice(0, renderComponentFunction.indexOf("list.find('.st-esg-component-library-card').on"));

assert.match(indexSource, /st-esg-history-range-recent-note/);
assert.match(styleSource, /#st-esg-dialog \.st-esg-history-range-recent-input input\s*\{[^}]*width:\s*48px !important;[^}]*flex:\s*0 0 48px;/s);
assert.doesNotMatch(styleSource, /\.st-esg-dialog \.st-esg-tab:active[^\{]*\{[^}]*transform:/s, 'tabs should not move when pressed');
assert.match(styleSource, /\.st-esg-tab\s*\{[^}]*touch-action:\s*manipulation;/s, 'tabs should respond directly to touch input');
assert.match(indexSource, /#st-esg-recent-message-count'\)\.on\('input'/);
assert.match(indexSource, /\.on\('change blur'/);
assert.match(indexSource, /if \(!raw\) return;/, 'empty recent-message input should remain editable until blur');

assert.match(toggleFunction, /dialog\.show\(\)/, 'the outer panel should not enter the native modal top layer');
assert.doesNotMatch(toggleFunction, /dialog\.showModal\(\)/, 'the outer panel must allow other overlays above it');
assert.match(styleSource, /\.st-esg-dialog\s*\{[^}]*z-index:\s*2147483647 !important;/s, 'the main panel should stay above other floating controls');
assert.match(styleSource, /#st-esg-ball\s*\{[^}]*z-index:\s*8999 !important;/s);
assert.match(ballFunction, /setPointerCapture/);
assert.match(ballFunction, /pointercancel/);
assert.match(ballFunction, /suppressClick/);
assert.doesNotMatch(renderComponentFunction, /settings\.components\s*=\s*settings\.components\.map/, 'rendering should not normalize and replace the full component array');
assert.doesNotMatch(renderComponentBuildPhase, /saveSettings\(\)/, 'rendering should not persist the whole settings object');
assert.match(toggleFunction, /componentLibraryContextKey/, 'opening the panel should use the component context cache');
assert.match(toggleFunction, /!importGroups\.length \|\| promptSourceCache\.structureDirty/, 'source scanning should be skipped when its cache is clean');

console.log('interaction UI tests passed');
