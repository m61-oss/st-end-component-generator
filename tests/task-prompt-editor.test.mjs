import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const styleSource = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

assert.doesNotMatch(source, /function resizeTaskPrompt\(/, 'the task prompt must not measure and expand its full scrollHeight');
assert.doesNotMatch(source, /resizeTaskPrompt\(\)/, 'typing, resetting, and loading task schemes must not trigger full-text layout measurement');
assert.match(
  source,
  /\$t\('#st-esg-task'\)\.on\('input', function \(\) \{[\s\S]*?if \(!settings\.dirtySchemeTypes\.task\) markSchemeDirty\('task'\);[\s\S]*?else saveSettings\(\);[\s\S]*?\}\);/,
  'typing should rebuild the scheme selector only once when the task first becomes dirty',
);
assert.match(
  styleSource,
  /\[data-tab-panel="task"\] #st-esg-task\s*\{[^}]*height:\s*52vh;[^}]*height:\s*clamp\(240px,\s*52dvh,\s*560px\);[^}]*max-height:\s*560px;[^}]*overflow-y:\s*auto;/s,
  'the desktop task editor should use a viewport-bounded internally scrolling area',
);
assert.match(
  styleSource,
  /@media \(max-width:\s*640px\)[\s\S]*?\[data-tab-panel="task"\] #st-esg-task\s*\{[^}]*height:\s*46vh;[^}]*height:\s*clamp\(180px,\s*46dvh,\s*440px\);[^}]*max-height:\s*440px;[^}]*overflow-y:\s*auto;/s,
  'the mobile task editor should remain large but bounded inside the panel',
);

console.log('task-prompt-editor tests passed');
