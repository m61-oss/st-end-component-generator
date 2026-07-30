import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const stateFunction = source.match(/function setGeneratingState\(isGenerating\) \{([\s\S]*?)\n\}/)?.[1] || '';

assert.doesNotMatch(
  stateFunction,
  /toggleClass\(['"]st-esg-danger-action['"]/,
  'generation state must not change the generate button colour class',
);

const generateStart = source.indexOf('async function generateStatusbar(');
const generateEnd = source.indexOf('async function injectGeneratedStatusbar(', generateStart);
const generateFunction = source.slice(generateStart, generateEnd);
const beginPromptLogIndex = generateFunction.indexOf('beginPromptLogBuild();');
const callApiIndex = generateFunction.indexOf('await callExternalApi(');

assert.ok(beginPromptLogIndex >= 0, 'accepted generation should immediately begin a new prompt log');
assert.ok(
  beginPromptLogIndex < callApiIndex,
  'the old prompt log should be replaced before asynchronous prompt assembly starts',
);
assert.match(
  source,
  /if \(promptLogBuilding\) \{[\s\S]*?正在组装本次提示词/,
  'the prompt viewer should show that the current prompt is being assembled',
);
