import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const stateFunction = source.match(/function setGeneratingState\(isGenerating\) \{([\s\S]*?)\n\}/)?.[1] || '';

assert.doesNotMatch(
  stateFunction,
  /toggleClass\(['"]st-esg-danger-action['"]/,
  'generation state must not change the generate button colour class',
);
