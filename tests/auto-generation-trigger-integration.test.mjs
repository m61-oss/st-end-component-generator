import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const generateStart = source.indexOf('async function generateStatusbar(');
const injectStart = source.indexOf('async function injectGeneratedStatusbar(');
const handlerStart = source.indexOf('function handleGenerationStarted(');
const statusStart = source.indexOf('function setStatus(', handlerStart);
const generateFunction = source.slice(generateStart, injectStart);
const triggerHandlers = source.slice(handlerStart, statusStart);

assert.match(
  source,
  /import \{ createAutoGenerationTracker \} from '\.\/generation\/auto-generation-trigger\.js\?ver=0\.1\.0';/,
  'the automatic generation tracker should be imported',
);
assert.match(source, /const autoGenerationTracker = createAutoGenerationTracker\(\);/, 'one tracker should be created');
assert.match(source, /function getAssistantMessageAtIndex\(chat, messageIndex\)/, 'an exact assistant-message resolver should exist');
assert.match(
  source,
  /const item = chat\?\.\[index\];[\s\S]*?item\.is_user === true[\s\S]*?item\.is_system === true[\s\S]*?return \{ index, message: item \};/,
  'the indexed resolver should reject user and system messages',
);

assert.match(
  triggerHandlers,
  /function handleGenerationStarted\(type, _options, dryRun\) \{[\s\S]*?autoGenerationTracker\.start\(type, dryRun, getContext\(\)\.chat\);[\s\S]*?\}/,
  'generation start should capture the current chat tail',
);
assert.match(
  triggerHandlers,
  /async function handleCharacterMessageRendered\(messageId\) \{[\s\S]*?const context = getContext\(\);[\s\S]*?if \(!autoGenerationTracker\.recordAssistantMessage\(messageId, context\.chat\?\.\[Number\(messageId\)\]\)\) return;[\s\S]*?const completion = autoGenerationTracker\.takeReadyCompletion\(\);[\s\S]*?if \(completion\) await completeAutomaticGeneration\(completion\);[\s\S]*?\}/,
  'a late rendered assistant message should complete an already ended generation',
);
assert.match(triggerHandlers, /function handleGenerationStopped\(\) \{[\s\S]*?autoGenerationTracker\.stop\(\);[\s\S]*?\}/, 'stopped cycles should be marked');
assert.match(
  triggerHandlers,
  /async function completeAutomaticGeneration\(completion\) \{[\s\S]*?targetWindow\.setTimeout\(resolve, 0\)[\s\S]*?const targetMessageIndex = autoGenerationTracker\.finalize\(completion, getContext\(\)\.chat\);[\s\S]*?if \(!settings\.autoGenerate \|\| targetMessageIndex === null\) return;[\s\S]*?await generateStatusbar\('automatic', targetMessageIndex\);[\s\S]*?\}[\s\S]*?async function handleGenerationEnded\(\) \{[\s\S]*?const completion = autoGenerationTracker\.end\(\);[\s\S]*?if \(completion\) await completeAutomaticGeneration\(completion\);[\s\S]*?\}/,
  'generation should complete only after both end and assistant-render signals arrive',
);

assert.match(source, /context\.eventSource\.on\(context\.eventTypes\.GENERATION_STARTED, handleGenerationStarted\);/);
assert.match(source, /context\.eventSource\.on\(context\.eventTypes\.CHARACTER_MESSAGE_RENDERED, handleCharacterMessageRendered\);/);
assert.match(
  source,
  /if \(context\.eventTypes\.GENERATION_STOPPED\) \{[\s\S]*?typeof context\.eventSource\.makeFirst === 'function'[\s\S]*?context\.eventSource\.makeFirst\(context\.eventTypes\.GENERATION_STOPPED, handleGenerationStopped\);[\s\S]*?context\.eventSource\.on\(context\.eventTypes\.GENERATION_STOPPED, handleGenerationStopped\);[\s\S]*?\}/,
  'manual stop should be registered at highest priority with a compatibility fallback',
);
assert.match(source, /context\.eventSource\.on\(context\.eventTypes\.GENERATION_ENDED, handleGenerationEnded\);/);

assert.match(
  generateFunction,
  /async function generateStatusbar\(entryType = 'manual', targetMessageIndex = null\)/,
  'generation should accept an exact target message index',
);
assert.match(
  generateFunction,
  /const latest = targetMessageIndex === null[\s\S]*?\? getLatestAssistantMessage\(context\.chat\)[\s\S]*?: getAssistantMessageAtIndex\(context\.chat, targetMessageIndex\);/,
  'manual generation should retain latest-message fallback while automatic generation uses the exact target',
);
assert.match(
  generateFunction,
  /if \(settings\.autoInject && result\) await injectGeneratedStatusbar\(latest\.index\);/,
  'automatic injection should receive the same message index',
);
assert.match(
  source.slice(injectStart, handlerStart),
  /async function injectGeneratedStatusbar\(targetMessageIndex = null\)[\s\S]*?const latest = targetMessageIndex === null[\s\S]*?\? getLatestAssistantMessage\(context\.chat\)[\s\S]*?: getAssistantMessageAtIndex\(context\.chat, targetMessageIndex\);/,
  'injection should resolve an explicit target while retaining manual fallback',
);

console.log('auto-generation-trigger integration tests passed');
