import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const css = fs.readFileSync(path.join(repoRoot, 'style.css'), 'utf8');

assert.match(css, /\.st-esg-dialog,\s*\.st-esg-scheme-name-dialog\s*\{[^}]*--mainFontSize:\s*var\(--st-esg-font-size\)\s*!important;[^}]*--mainFontFamily:[^;]+!important;[^}]*font-family:\s*var\(--mainFontFamily\)\s*!important;[^}]*font-size:\s*var\(--st-esg-font-size\)\s*!important;/s);
assert.match(css, /\.st-esg-dialog\s+\.menu_button,\s*\.st-esg-scheme-name-dialog\s+\.menu_button\s*\{[^}]*font-size:\s*var\(--st-esg-control-font-size\)\s*!important;/s);
assert.match(css, /\.st-esg-dialog\s+\.menu_button\s*>\s*span,\s*\.st-esg-scheme-name-dialog\s+\.menu_button\s*>\s*span\s*\{[^}]*font-size:\s*inherit\s*!important;/s);
assert.match(css, /\.st-esg-scheme-name-dialog\s+\.text_pole\s*\{[^}]*font-size:\s*var\(--st-esg-input-font-size\)\s*!important;/s);
assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.st-esg-dialog,\s*\.st-esg-scheme-name-dialog\s*\{[^}]*--st-esg-font-size:\s*12px;/s);
