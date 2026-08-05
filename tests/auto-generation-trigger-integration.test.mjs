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
  /captureAutomaticAssistantTarget,[\s\S]*?isAutomaticAssistantTargetAddressable,[\s\S]*?resolveReadyAutomaticAssistantTarget/,
  'the assistant-message resolver should be imported',
);
assert.match(source, /function logAutomaticGenerationStage\(/, 'automatic generation should expose stage logging');
assert.match(source, /function clearAutomaticGenerationLog\(/, 'a new generation should clear the visible stage log');
assert.match(source, /id=["']st-esg-generation-log["']/, 'the generation page should contain a visible stage log');
assert.match(source, /const VISIBLE_GENERATION_LOG_STAGES = new Set\(/, 'the page log should have an explicit user-facing stage allowlist');
assert.match(source, /if \(!VISIBLE_GENERATION_LOG_STAGES\.has\(stage\)\) return;/, 'raw internal stages should stay out of the page log');
assert.doesNotMatch(source, /VISIBLE_GENERATION_LOG_STAGES[\s\S]{0,500}'generation-started'/, 'raw Tavern generation-start events should not be user-facing');
assert.doesNotMatch(source, /VISIBLE_GENERATION_LOG_STAGES[\s\S]{0,500}'message-rendered'/, 'assistant render internals should not be user-facing');
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
  /function handleAssistantMessageReceived\(messageId, messageType\) \{[\s\S]*?isAutomaticAssistantMessageTypeEligible\(messageType\)[\s\S]*?captureAutomaticAssistantTarget\(messageId, context\.chat\)[\s\S]*?pendingAutomaticTargets\.set[\s\S]*?\}[\s\S]*?function handleAssistantMessageRendered\(messageId\)[\s\S]*?targetWindow\.setTimeout[\s\S]*?runDeferredAutomaticGeneration/,
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
assert.doesNotMatch(triggerHandlers, /messageElementReady/, 'DOM nodes must not gate automatic generation');
assert.doesNotMatch(triggerHandlers, /#chat \.mes\[mesid=/, 'DOM selectors must not gate automatic generation');
assert.match(
  triggerHandlers,
  /if \(!baseline\) \{[\s\S]*?logAutomaticGenerationStage\('generation-skip'[\s\S]*?return;/,
  'a generation-ended event without a matching start baseline must be ignored',
);

assert.match(
  source,
  /if \(context\.eventTypes\.MESSAGE_RECEIVED\) context\.eventSource\.on\(context\.eventTypes\.MESSAGE_RECEIVED, handleAssistantMessageReceived\);/,
  'only the semantic assistant-received event should drive automatic generation',
);
assert.match(
  source,
  /if \(context\.eventTypes\.CHAT_CHANGED\)[\s\S]*?seedLastAutomaticTargetFromCurrentChat\(\);/,
  'chat changes should register the loaded latest assistant as existing content',
);
assert.doesNotMatch(source, /eventTypes\.MESSAGE_SWIPED[\s\S]{0,180}invalidatePendingAutomaticGeneration/, 'switching swipes must not cancel automatic work');
assert.doesNotMatch(receivedHandler, /invalidatePendingAutomaticGeneration\(\{ abortActive: true \}\)/, 'a newer assistant event must not abort an already running external generation');
assert.doesNotMatch(generateFunction, /if \(entryType === 'automatic'\) logAutomaticGenerationStage\('api-start'/, 'automatic API start should not be logged twice');
assert.doesNotMatch(generateFunction, /if \(entryType === 'automatic'\) logAutomaticGenerationStage\('api-returned'/, 'automatic API completion should not be logged twice');
assert.match(triggerHandlers, /logAutomaticGenerationStage\('generation-skip', `等待最新 assistant 超时/, 'a readiness timeout should expose actionable diagnostics');

assert.match(
  generateFunction,
  /async function generateStatusbar\(entryType = 'manual', targetMessageIndex = null, automaticTarget = null\)/,
  'generation should accept an exact target message index',
);
assert.ok(
  generateFunction.indexOf('applyGeneratedResult(result)') < generateFunction.indexOf('isAutomaticAssistantTargetAddressable(automaticTarget, getContext().chat)'),
  'the generated result should always be retained before deciding whether automatic injection is still safe',
);
assert.match(
  generateFunction,
  /const latest = targetMessageIndex === null[\s\S]*?\? getLatestAssistantMessage\(context\.chat\)[\s\S]*?: getAssistantMessageAtIndex\(context\.chat, targetMessageIndex\);/,
  'manual generation should retain latest-message fallback while automatic generation uses the exact target',
);
assert.match(
  generateFunction,
  /if \(settings\.autoInject && result\) \{[\s\S]*?isAutomaticAssistantTargetAddressable\(automaticTarget, getContext\(\)\.chat\)[\s\S]*?await injectGeneratedStatusbar\(latest\.index\);/,
  'only automatic injection should require the target to remain the latest assistant floor',
);
assert.match(
  source.slice(injectStart, handlerStart),
  /async function injectGeneratedStatusbar\(targetMessageIndex = null\)[\s\S]*?let latest = targetMessageIndex === null[\s\S]*?\? getLatestAssistantMessage\(context\.chat\)[\s\S]*?: getAssistantMessageAtIndex\(context\.chat, targetMessageIndex\);[\s\S]*?await restoreLatestInjection\(\{ targetMessageIndex: latest\.index \}\);[\s\S]*?latest = targetMessageIndex === null[\s\S]*?: getAssistantMessageAtIndex\(context\.chat, targetMessageIndex\);/,
  'injection should resolve an explicit target while retaining manual fallback',
);

console.log('auto-generation-trigger integration tests passed');
