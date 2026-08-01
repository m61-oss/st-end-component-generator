import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const callStart = source.indexOf('async function callExternalApi(');
const callEnd = source.indexOf('function injectStatusbar(', callStart);
const modelStart = source.indexOf('async function fetchApiModels()');
const modelEnd = source.indexOf('const SCHEME_CONFIG', modelStart);
const callFunction = source.slice(callStart, callEnd);
const modelFunction = source.slice(modelStart, modelEnd);

assert.match(source, /import \{ yaml \} from '\.\.\/\.\.\/\.\.\/\.\.\/lib\.js';/, 'the extension should import SillyTavern\'s YAML parser from the public root');
assert.match(source, /import \{[\s\S]*?buildApiRequestParts,[\s\S]*?parseApiAdditionalParameters,[\s\S]*?parseApiNumericSettings,[\s\S]*?\} from '\.\/api\/api-request-parameters\.js\?ver=0\.1\.2';/, 'request parameter helpers should be imported');

assert.match(callFunction, /const numeric = parseApiNumericSettings\(settings\);/, 'generation should validate user-entered numeric settings');
assert.match(callFunction, /const additional = parseApiAdditionalParameters\(settings, yaml\);/, 'generation should validate saved YAML before requesting');
assert.match(callFunction, /const \{ body, headers \} = buildApiRequestParts\(/, 'generation should merge additional body and headers centrally');
assert.match(callFunction, /max_tokens:\s*numeric\.maxTokens,\s*temperature:\s*numeric\.temperature,/, 'generation should send actual input values');
assert.match(callFunction, /maxTokens:\s*String\(numeric\.maxTokens\),\s*temperature:\s*String\(numeric\.temperature\),/, 'prompt logs should use actual input values');
assert.match(callFunction, /headers,\s*body:\s*JSON\.stringify\(body\),/, 'fetch should use merged request parts');
assert.doesNotMatch(callFunction, /createPromptLog\(\{[^}]*additionalHeaders/s, 'custom header values must not enter prompt logs');
assert.doesNotMatch(callFunction, /createPromptLog\(\{[^}]*additionalHeadersYaml/s, 'custom header YAML must not enter prompt logs');
assert.match(callFunction, /createStreamPreviewController\(/, 'streaming requests should use the lightweight preview controller');
assert.match(callFunction, /streamPreview\.push\(fullText\);/, 'stream chunks should only enter the throttled preview path');
assert.match(callFunction, /onPreview:\s*updateStreamedPreview/, 'each throttled stream preview update should resize and scroll through one lightweight callback');
assert.match(source, /const previousScrollTop = preview\.scrollTop;[\s\S]*?preview\.value = String\(text \?\? ''\);[\s\S]*?resizeGeneratedPreview\(\{ followBottom, preserveScrollTop: previousScrollTop \}\)/, 'stream updates should preserve the viewer position when they have scrolled away from the bottom');
assert.doesNotMatch(callFunction, /readOpenAiStream\([\s\S]*?applyGeneratedResult\(fullText\)/, 'stream chunks must not run final tag cleanup and rendering');
assert.doesNotMatch(callFunction, /readOpenAiStream\([\s\S]*?switchTab\('workspace'\)/, 'stream chunks must not force the workspace tab');

const generateStart = source.indexOf('async function generateStatusbar(');
const generateEnd = source.indexOf('async function injectGeneratedStatusbar(', generateStart);
const generateFunction = source.slice(generateStart, generateEnd);
assert.doesNotMatch(generateFunction, /switchTab\('workspace'\)/, 'generation completion must not force the workspace tab');
assert.match(generateFunction, /error\?\.name === 'AbortError'[\s\S]*?error\?\.streamedText[\s\S]*?applyGeneratedResult\(/, 'manual stop should retain and finalize the partial streamed text');
assert.match(generateFunction, /clearGeneratedThinking\(\);[\s\S]*?callExternalApi\(/, 'starting a new generation should clear the previous thinking panel before the API call');
assert.match(source, /function clearGeneratedThinking\(\)[\s\S]*?thinkingPanel\?\.replaceChildren\(\);[\s\S]*?thinkingPanel\?\.classList\.add\('st-esg-hidden'\);/, 'clearing thinking should directly remove the stale details element from the mounted page');
assert.match(source, /thinking\.toggleClass\('st-esg-hidden', Boolean\(error\) \|\| !lastGeneratedThinking\.length\);/, 'result-panel refreshes must keep an empty thinking container hidden');

assert.match(modelFunction, /const additional = parseApiAdditionalParameters\(settings, yaml\);/, 'model fetching should validate saved YAML');
assert.match(modelFunction, /headers:\s*\{[\s\S]*?\.\.\.additional\.additionalHeaders[\s\S]*?\}/, 'model fetching should apply custom request headers');
assert.doesNotMatch(modelFunction, /additional\.additionalBody/, 'model-list GET requests should not apply custom body parameters');

console.log('api-request-integration tests passed');
