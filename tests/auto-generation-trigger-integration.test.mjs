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
  /function handleGenerationStarted\(type, _options, dryRun\) \{[\s\S]*?autoGenerationTracker\.start\(type, dryRun\);[\s\S]*?\}/,
  'generation start should reset and classify the cycle',
);
assert.match(
  triggerHandlers,
  /function handleCharacterMessageRendered\(messageId\) \{[\s\S]*?const context = getContext\(\);[\s\S]*?autoGenerationTracker\.recordAssistantMessage\(messageId, context\.chat\?\.\[Number\(messageId\)\]\);[\s\S]*?\}/,
  'rendered messages should be validated against the actual chat message',
);
assert.match(triggerHandlers, /function handleGenerationStopped\(\) \{[\s\S]*?autoGenerationTracker\.stop\(\);[\s\S]*?\}/, 'stopped cycles should be marked');
assert.match(
  triggerHandlers,
  /async function handleGenerationEnded\(\) \{[\s\S]*?targetWindow\.setTimeout\(resolve, 0\)[\s\S]*?const targetMessageIndex = autoGenerationTracker\.finish\(\);[\s\S]*?if \(!settings\.autoGenerate \|\| targetMessageIndex === null\) return;[\s\S]*?await generateStatusbar\('automatic', targetMessageIndex\);[\s\S]*?\}/,
  'generation end should wait for a stop event and use only the tracked assistant message',
);

assert.match(source, /context\.eventSource\.on\(context\.eventTypes\.GENERATION_STARTED, handleGenerationStarted\);/);
assert.match(source, /context\.eventSource\.on\(context\.eventTypes\.CHARACTER_MESSAGE_RENDERED, handleCharacterMessageRendered\);/);
assert.match(source, /context\.eventSource\.on\(context\.eventTypes\.GENERATION_STOPPED, handleGenerationStopped\);/);
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
