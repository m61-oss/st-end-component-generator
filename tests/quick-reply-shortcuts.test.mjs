import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const shortcutFunction = source.match(/function getQuickReplyShortcutEntries\(\) \{([\s\S]*?)\n\}/)?.[1] || '';

assert.doesNotMatch(shortcutFunction, /icon:\s*['"]fa-/, 'Quick Reply shortcuts should be text-only');
assert.match(source, /const props = \{\s*icon: '',/, 'Quick Reply sync should clear icons from existing shortcuts');
