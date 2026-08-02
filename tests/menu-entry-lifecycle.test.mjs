import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const menuFunction = source.match(/function renderMagicWandMenuButton\([^)]*\) \{([\s\S]*?)\n\}/)?.[1] || '';

assert.ok(menuFunction, 'menu entry should have a dedicated mounting function');
assert.doesNotMatch(menuFunction, /retry\s*[=>]/, 'menu entry mounting should not stop after a fixed retry count');
assert.match(menuFunction, /setInterval/, 'menu entry mounting should keep waiting for a lazy-loaded menu');
assert.match(source, /if \(targetDoc\.readyState === 'loading'\)[\s\S]*?DOMContentLoaded/, 'UI mounting should wait until the host document is ready');

console.log('menu-entry-lifecycle tests passed');
