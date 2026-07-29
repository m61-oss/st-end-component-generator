import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const shortcutFunction = source.match(/function getQuickReplyShortcutEntries\(\) \{([\s\S]*?)\n\}/)?.[1] || '';

assert.doesNotMatch(shortcutFunction, /icon:\s*['"]fa-/, 'Quick Reply shortcuts should be text-only');
assert.match(source, /const props = \{\s*icon: '',/, 'Quick Reply sync should clear icons from existing shortcuts');
assert.match(
  source,
  /generate:\s*\(\)\s*=>\s*generateStatusbar\('quickReply'\)/,
  'Quick Reply generation should identify itself so an active request is not aborted',
);
assert.match(
  source,
  /conflictAction === 'notify'[\s\S]*?notifyStatus\('已在生成中', 'warning'\)/,
  'Quick Reply generation should warn when another generation is active',
);
