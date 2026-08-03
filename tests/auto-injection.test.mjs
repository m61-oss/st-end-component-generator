import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const generateStart = source.indexOf('async function generateStatusbar(');
const injectStart = source.indexOf('async function injectGeneratedStatusbar(');
const handlerStart = source.indexOf('function invalidatePendingAutomaticGeneration(');
const statusStart = source.indexOf('function setStatus(', handlerStart);
const generateFunction = source.slice(generateStart, injectStart);
const generationEndedFunction = source.slice(handlerStart, statusStart);
const injectFunction = source.slice(injectStart, handlerStart);

assert.match(generateFunction, /if \(settings\.autoInject && result\) \{[\s\S]*?await injectGeneratedStatusbar\(latest\.index\);/, 'every successful plugin generation should auto-inject into the same assistant message when enabled');
assert.doesNotMatch(generationEndedFunction, /injectGeneratedStatusbar\(/, 'the Tavern completion handler must not inject a second time');
assert.match(generationEndedFunction, /await generateStatusbar\('automatic', readyTarget\.messageIndex, readyTarget\);/, 'automatic generation should pass the stable assistant swipe identity');
assert.match(generateFunction, /conflictAction === 'ignore'[\s\S]*?return '';/, 'an automatic trigger should be ignored while generation is active');
assert.match(injectFunction, /context\.updateMessageBlock\(latest\.index, latest\.message\);\s*const messageUpdatedEvent = context\.eventTypes\?\.MESSAGE_UPDATED;\s*if \(messageUpdatedEvent && context\.eventSource\?\.emit\) \{\s*await context\.eventSource\.emit\(messageUpdatedEvent, latest\.index\);\s*\}\s*try \{[\s\S]*?const saveResult = await context\.saveChat\(\);/, 'injection should mirror the Tavern edit lifecycle by notifying message-update listeners before saving');
assert.match(source, /mvuReprocessOnInject: true,/, 'MVU reprocessing should default to enabled for generated variable updates');
assert.match(injectFunction, /const injectedText = cleanGeneratedText\(text\);[\s\S]*?injectStatusbar\(latest\.message, injectedText, effectiveMode\);/, 'injection should retain the exact generated text for post-injection decisions');
assert.match(injectFunction, /if \(settings\.mvuReprocessOnInject && containsMvuUpdateVariable\(injectedText\)\) \{[\s\S]*?await reprocessMvuVariables\(context, latest\.index\);[\s\S]*?\}/, 'MVU reprocessing should run only when this injected content contains an UpdateVariable tag');
assert.doesNotMatch(injectFunction, /containsMvuUpdateVariable\(latest\.message\.mes\)/, 'the decision to reprocess MVU variables must not inspect pre-existing reply content');
assert.ok(
  injectFunction.indexOf('await reprocessMvuVariables(context, latest.index);') < injectFunction.indexOf('context.updateMessageBlock(latest.index, latest.message);'),
  'MVU variables should be reprocessed before the injected message is rendered',
);
assert.match(
  source,
  /\$t\('#st-esg-generate'\)\.on\('click', \(\) => generateStatusbar\(\)\);/,
  'the manual generate button should not pass its click event as an entry type',
);
assert.match(
  source,
  /\$t\('#st-esg-inject'\)\.on\('click', \(\) => injectGeneratedStatusbar\(\)\);/,
  'the manual inject button should not pass its click event as a message index',
);
assert.match(
  source,
  /import \{ createInjectionUndoSnapshot, validateInjectionUndoSnapshot \} from '\.\/injection\/injection-undo\.js\?ver=0\.1\.4';/,
  'injection undo should use the tested strict snapshot validator',
);
assert.match(source, /let latestInjectionUndoSnapshot = null;/, 'only one latest injection snapshot should be retained');
assert.match(source, /logAutomaticGenerationStage\('inject-start'/, 'injection should log its start');
assert.match(source, /logAutomaticGenerationStage\('undo-start'/, 'undo should log its start');
assert.match(source, /logAutomaticGenerationStage\('inject-finished'/, 'injection should log completion');
assert.match(
  injectFunction,
  /const originalText = String\(latest\.message\.mes \?\? ''\);[\s\S]*?injectStatusbar\(latest\.message, injectedText, effectiveMode\);[\s\S]*?createInjectionUndoSnapshot\(\{[\s\S]*?targetIndex: latest\.index,[\s\S]*?chatLength: context\.chat\.length,[\s\S]*?originalText,[\s\S]*?injectedText: latest\.message\.mes,/,
  'injection should retain the full before and after message text for exact restoration',
);
assert.match(source, /rollbackAppend[\s\S]*?rollbackReplace/, 'injection settings should expose both rollback modes');
assert.match(injectFunction, /no valid snapshot; using normal mode/, 'rollback modes should fall back to normal injection when no snapshot exists');
assert.match(
  source,
  /async function undoLatestInjection\(\)[\s\S]*?targetWindow\.confirm\('撤回本次注入？\\n\\n将把最新一条助手回复恢复到注入前的完整内容，本次注入结果会被移除。'\)[\s\S]*?message\.mes = snapshot\.originalText;[\s\S]*?message\.swipes\[snapshot\.swipeId\] = snapshot\.originalSwipeText;[\s\S]*?context\.updateMessageBlock\(snapshot\.targetIndex, message\);[\s\S]*?await context\.saveChat\(\);/,
  'undo should confirm and restore the exact message and active swipe through Tavern lifecycle APIs',
);
assert.match(
  source,
  /if \(snapshot\.mvuReprocessed\) \{[\s\S]*?await reprocessMvuVariables\(context, snapshot\.targetIndex\);/,
  'undo should rebuild MVU state only when the injection previously changed it',
);
assert.match(
  source,
  /function registerInjectionUndoInvalidation\(context\)[\s\S]*?\['MESSAGE_SENT', 'MESSAGE_RECEIVED', 'MESSAGE_EDITED', 'MESSAGE_UPDATED', 'MESSAGE_DELETED', 'MESSAGE_SWIPED', 'MESSAGE_SWIPE_DELETED'\]/,
  'new floors, edits, deletions, and swipe changes should refresh or permanently invalidate undo',
);
