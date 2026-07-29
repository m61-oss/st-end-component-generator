import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const generateStart = source.indexOf('async function generateStatusbar(');
const injectStart = source.indexOf('async function injectGeneratedStatusbar(');
const handlerStart = source.indexOf('async function handleAssistantMessageReceived(');
const statusStart = source.indexOf('function setStatus(', handlerStart);
const generateFunction = source.slice(generateStart, injectStart);
const triggerHandlers = source.slice(handlerStart, statusStart);

assert.match(
  source,
  /import \{ resolveAutomaticAssistantMessageIndex \} from '\.\/generation\/auto-generation-trigger\.js\?ver=0\.1\.0';/,
  'the assistant-message resolver should be imported',
);
assert.doesNotMatch(source, /createAutoGenerationTracker|autoGenerationTracker/, 'generation session state should be removed');
assert.match(source, /function getAssistantMessageAtIndex\(chat, messageIndex\)/, 'an exact assistant-message resolver should exist');
assert.match(
  source,
  /const item = chat\?\.\[index\];[\s\S]*?item\.is_user === true[\s\S]*?item\.is_system === true[\s\S]*?return \{ index, message: item \};/,
  'the indexed resolver should reject user and system messages',
);

assert.match(
  triggerHandlers,
  /async function handleAssistantMessageReceived\(messageId\) \{[\s\S]*?const context = getContext\(\);[\s\S]*?const targetMessageIndex = resolveAutomaticAssistantMessageIndex\(messageId, context\.chat\);[\s\S]*?if \(!settings\.autoGenerate \|\| targetMessageIndex === null\) return;[\s\S]*?await generateStatusbar\('automatic', targetMessageIndex\);[\s\S]*?\}/,
  'a received assistant message should directly trigger automatic generation',
);

assert.match(
  source,
  /if \(context\.eventTypes\.MESSAGE_RECEIVED\) context\.eventSource\.on\(context\.eventTypes\.MESSAGE_RECEIVED, handleAssistantMessageReceived\);/,
  'only the semantic assistant-received event should drive automatic generation',
);
assert.doesNotMatch(
  source.slice(source.indexOf('function init()')),
  /GENERATION_STARTED|GENERATION_STOPPED|GENERATION_ENDED|CHARACTER_MESSAGE_RENDERED/,
  'automatic generation should not depend on generation lifecycle or render events',
);

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
