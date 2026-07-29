import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const generateStart = source.indexOf('async function generateStatusbar(');
const injectStart = source.indexOf('async function injectGeneratedStatusbar(');
const handlerStart = source.indexOf('function handleGenerationStarted(');
const statusStart = source.indexOf('function setStatus(', handlerStart);
const generateFunction = source.slice(generateStart, injectStart);
const generationEndedFunction = source.slice(handlerStart, statusStart);
const injectFunction = source.slice(injectStart, handlerStart);

assert.match(generateFunction, /if \(settings\.autoInject && result\) await injectGeneratedStatusbar\(latest\.index\);/, 'every successful plugin generation should auto-inject into the same assistant message when enabled');
assert.doesNotMatch(generationEndedFunction, /injectGeneratedStatusbar\(/, 'the Tavern completion handler must not inject a second time');
assert.match(generationEndedFunction, /await generateStatusbar\('automatic', targetMessageIndex\);/, 'automatic generation should identify itself and pass the confirmed assistant message so an active request is ignored');
assert.match(generateFunction, /conflictAction === 'ignore'[\s\S]*?return '';/, 'an automatic trigger should be ignored while generation is active');
assert.match(injectFunction, /context\.updateMessageBlock\(latest\.index, latest\.message\);\s*const messageUpdatedEvent = context\.eventTypes\?\.MESSAGE_UPDATED;\s*if \(messageUpdatedEvent && context\.eventSource\?\.emit\) \{\s*await context\.eventSource\.emit\(messageUpdatedEvent, latest\.index\);\s*\}\s*try \{\s*const saveResult = await context\.saveChat\(\);/s, 'injection should mirror the Tavern edit lifecycle by notifying message-update listeners before saving');
assert.match(source, /mvuReprocessOnInject: true,/, 'MVU reprocessing should default to enabled for generated variable updates');
assert.match(injectFunction, /const injectedText = cleanGeneratedText\(text\);\s*injectStatusbar\(latest\.message, injectedText\);/, 'injection should retain the exact generated text for post-injection decisions');
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
