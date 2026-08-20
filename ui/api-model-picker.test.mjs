import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexSource = await readFile(new URL('../index.js', import.meta.url), 'utf8');

test('a fetched model list stays selectable when the previous model is manual for the new endpoint', () => {
  assert.match(indexSource, /picker\.val\(usingManualModel \? '__manual__' : \(currentModel \|\| options\[0\]\)\);\s*picker\.show\(\);\s*input\.toggle\(usingManualModel\);/s);
  assert.doesNotMatch(indexSource, /picker\.toggle\(!usingManualModel\)/);
});

test('manual selection keeps the model picker available and selecting a listed model refreshes the field visibility', () => {
  const handler = indexSource.match(/\$t\('#st-esg-api-model-picker'\)\.on\('change',[\s\S]*?\n\s*\}\);/)?.[0] || '';
  assert.doesNotMatch(handler, /\$\(this\)\.hide\(\)/);
  assert.match(handler, /renderModelOptions\(\)/);
});
