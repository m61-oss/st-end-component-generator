import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const generateStart = source.indexOf('async function generateStatusbar(');
const injectStart = source.indexOf('async function injectGeneratedStatusbar(');
const handlerStart = source.indexOf('function invalidatePendingAutomaticGeneration(');
const statusStart = source.indexOf('function setStatus(', handlerStart);
const generateFunction = source.slice(generateStart, injectStart);
const triggerHandlers = source.slice(handlerStart, statusStart);
const receivedHandler = source.slice(
  source.indexOf('function handleAssistantMessageReceived('),
  source.indexOf('function handleAssistantMessageRendered('),
);

assert.match(
  source,
  /captureAutomaticAssistantTarget,[\s\S]*?isAutomaticAssistantTargetAddressable,[\s\S]*?isAutomaticAssistantTargetCurrent,[\s\S]*?resolveReadyAutomaticAssistantTarget/,
  'the assistant-message resolver should be imported',
);
assert.match(source, /function logAutomaticGenerationStage\(/, 'automatic generation should expose stage logging');
assert.match(source, /function clearAutomaticGenerationLog\(/, 'a new generation should clear the visible stage log');
assert.match(source, /id=["']st-esg-generation-log["']/, 'the generation page should contain a visible stage log');
assert.match(source, /logAutomaticGenerationStage\('generation-started'/, 'generation start should be logged');
assert.match(source, /logAutomaticGenerationStage\('generation-ended'/, 'generation end should be logged');
assert.match(source, /logAutomaticGenerationStage\('api-start'/, 'automatic API start should be logged');
assert.doesNotMatch(source, /createAutoGenerationTracker|autoGenerationTracker/, 'generation session state should be removed');
assert.match(source, /function getAssistantMessageAtIndex\(chat, messageIndex\)/, 'an exact assistant-message resolver should exist');
assert.match(
  source,
  /const item = chat\?\.\[index\];[\s\S]*?item\.is_user === true[\s\S]*?item\.is_system === true[\s\S]*?return \{ index, message: item \};/,
  'the indexed resolver should reject user and system messages',
);

assert.match(
  triggerHandlers,
  /function handleAssistantMessageReceived\(messageId\) \{[\s\S]*?captureAutomaticAssistantTarget\(messageId, context\.chat\)[\s\S]*?pendingAutomaticTargets\.set[\s\S]*?\}[\s\S]*?function handleAssistantMessageRendered\(messageId\)[\s\S]*?targetWindow\.setTimeout[\s\S]*?runDeferredAutomaticGeneration/,
  'a received assistant message should be queued and released after rendering without blocking SillyTavern',
);
assert.doesNotMatch(receivedHandler, /await generateStatusbar\('automatic'/, 'the MESSAGE_RECEIVED listener must not await external generation');
assert.match(
  triggerHandlers,
  /resolveReadyAutomaticAssistantTarget\(pendingTarget, context\.chat\)[\s\S]*?generateStatusbar\('automatic', readyTarget\.messageIndex, readyTarget\)/,
  'deferred generation should lock the finalized assistant text only after its swipe is stable',
);
assert.doesNotMatch(
  triggerHandlers,
  /currentTarget\.messageText !== pendingTarget\.messageText/,
  'post-receive normalization by other extensions must not silently discard normal assistant replies',
);

assert.match(
  source,
  /if \(context\.eventTypes\.MESSAGE_RECEIVED\) context\.eventSource\.on\(context\.eventTypes\.MESSAGE_RECEIVED, handleAssistantMessageReceived\);/,
  'only the semantic assistant-received event should drive automatic generation',
);
assert.match(
  source,
  /MESSAGE_SWIPED[\s\S]*?invalidatePendingAutomaticGeneration/,
  'switching swipes should invalidate pending automatic work without starting generation',
);

assert.match(
  generateFunction,
  /async function generateStatusbar\(entryType = 'manual', targetMessageIndex = null, automaticTarget = null\)/,
  'generation should accept an exact target message index',
);
assert.match(
  generateFunction,
  /if \(automaticTarget && !isAutomaticAssistantTargetAddressable\(automaticTarget, getContext\(\)\.chat\)\)[\s\S]*?return '';/,
  'an automatic result should be discarded when its floor or swipe target changed while the API was running',
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
