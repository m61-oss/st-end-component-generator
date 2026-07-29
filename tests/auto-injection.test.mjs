import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const generateStart = source.indexOf('async function generateStatusbar()');
const injectStart = source.indexOf('async function injectGeneratedStatusbar()');
const handlerStart = source.indexOf('async function handleGenerationEnded()');
const statusStart = source.indexOf('function setStatus(', handlerStart);
const generateFunction = source.slice(generateStart, injectStart);
const generationEndedFunction = source.slice(handlerStart, statusStart);

assert.match(generateFunction, /if \(settings\.autoInject && result\) await injectGeneratedStatusbar\(\);/, 'every successful plugin generation should auto-inject when enabled');
assert.doesNotMatch(generationEndedFunction, /injectGeneratedStatusbar\(/, 'the Tavern completion handler must not inject a second time');
