import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexSource = await readFile(new URL('../index.js', import.meta.url), 'utf8');

test('fetching a new endpoint selects its first returned model', () => {
  const fetchModels = indexSource.match(/async function fetchApiModels\(\)[\s\S]*?\n\}/)?.[0] || '';
  assert.match(fetchModels, /settings\.apiModelOptions = models;\s*settings\.apiModel = models\[0\];/s);
  assert.doesNotMatch(fetchModels, /if \(!textOf\(settings\.apiModel\)\) settings\.apiModel = models\[0\]/);
});

test('the model picker and manual input occupy one slot instead of appearing together', () => {
  assert.match(indexSource, /picker\.val\(usingManualModel \? '__manual__' : \(currentModel \|\| options\[0\]\)\);\s*picker\.toggle\(!usingManualModel\);\s*input\.toggle\(usingManualModel\);/s);
  const handler = indexSource.match(/\$t\('#st-esg-api-model-picker'\)\.on\('change',[\s\S]*?\n\s*\}\);/)?.[0] || '';
  assert.match(handler, /if \(selected === '__manual__'\) \{\s*\$\(this\)\.hide\(\);\s*\$t\('#st-esg-api-model'\)\.show\(\)\.trigger\('focus'\);/s);
});
