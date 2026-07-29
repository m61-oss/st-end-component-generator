import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const testScript = packageJson.scripts?.test || '';
const testFiles = readdirSync(new URL('.', import.meta.url)).filter((name) => name.endsWith('.test.mjs'));

assert.ok(testFiles.length > 1, 'fixture should include multiple test files');
for (const testFile of testFiles) {
  assert.ok(testScript.includes(testFile), `npm test should run ${testFile}`);
}
