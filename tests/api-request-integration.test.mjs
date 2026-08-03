import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const schemeSource = readFileSync(new URL('../settings/scheme-utils.js', import.meta.url), 'utf8');
const callStart = source.indexOf('async function callExternalApi(');
const callEnd = source.indexOf('function injectStatusbar(', callStart);
const modelStart = source.indexOf('async function fetchApiModels()');
const modelEnd = source.indexOf('const SCHEME_CONFIG', modelStart);
const callFunction = source.slice(callStart, callEnd);
const modelFunction = source.slice(modelStart, modelEnd);

assert.doesNotMatch(source, /import \{ yaml \} from '\.\.\/\.\.\/\.\.\/\.\.\/lib\.js';/, 'the extension must not fail to load when a compatible frontend omits the named YAML export');
assert.match(source, /async function getYamlParser\(\)[\s\S]*?import\('\.\.\/\.\.\/\.\.\/\.\.\/lib\.js'\)[\s\S]*?yamlModule\.yaml\s*\?\?\s*yamlModule\.default\?\.yaml/, 'the extension should resolve YAML dynamically and support the default library facade used by compatible frontends');
assert.match(source, /import \{[\s\S]*?buildApiRequestParts,[\s\S]*?parseApiAdditionalParameters,[\s\S]*?parseApiNumericSettings,[\s\S]*?\} from '\.\/api\/api-request-parameters\.js\?ver=0\.1\.3';/, 'request parameter helpers should be imported');

assert.match(callFunction, /const numeric = parseApiNumericSettings\(settings\);/, 'generation should validate user-entered numeric settings');
assert.match(callFunction, /ConnectionManagerRequestService/, '酒馆预设 should use the connection manager service');
assert.match(callFunction, /const additional = parseApiAdditionalParameters\(settings, await getYamlParser\(\)\);/, 'generation should validate saved YAML before requesting');
assert.match(callFunction, /const \{ body, headers \} = buildApiRequestParts\(/, 'generation should merge additional body and headers centrally');
assert.match(callFunction, /max_tokens:\s*numeric\.maxTokens,\s*temperature:\s*numeric\.temperature,/, 'generation should send actual input values');
assert.match(callFunction, /maxTokens:\s*String\(numeric\.maxTokens\),\s*temperature:\s*String\(numeric\.temperature\),/, 'prompt logs should use actual input values');
assert.match(callFunction, /headers,\s*body:\s*JSON\.stringify\(body\),/, 'fetch should use merged request parts');
assert.doesNotMatch(callFunction, /createPromptLog\(\{[^}]*additionalHeaders/s, 'custom header values must not enter prompt logs');
assert.doesNotMatch(callFunction, /createPromptLog\(\{[^}]*additionalHeadersYaml/s, 'custom header YAML must not enter prompt logs');
assert.match(source, /data-api-mode="custom"[\s\S]*?data-api-mode="tavern"/, 'API settings should expose custom and Tavern profile tabs');
assert.doesNotMatch(source, /data-api-mode="main"/, 'the plugin should not expose the Tavern main API mode');
assert.match(schemeSource, /apiMode: settings\.apiMode/, 'API schemes should save the selected connection mode');
assert.match(source, /settings\.apiMode = mode;[\s\S]*?settings\.useMainApi = false;/, 'API mode rendering should normalize the legacy flag to the selected tab');
assert.match(source, /\$t\('#st-esg-prompt-template-compat'\)\.prop\('checked', settings\.promptTemplateCompatEnabled\);[\s\S]*?renderApiModeUi\(\);/, 'API mode UI should be synchronized during initial panel rendering');
assert.match(source, /st-esg-api-model-picker[^>]*st-esg-api-custom-fields/, 'the model picker should only be visible for custom API mode');
assert.match(source, /Object\.entries\(rawProfiles\)/, 'Tavern profile refresh should support object-shaped profile registries');
assert.match(source, /getContext\(\)\?\.extensionSettings\?\.connectionManager\?\.profiles/, 'Tavern profiles should be read from the host context store');
assert.match(source, /includePreset: true,[\s\S]*?stream: Boolean\(settings\.streamingEnabled\)/, 'profile requests should use the selected Tavern preset');
assert.match(callFunction, /Number\(settings\.maxTokens\) \|\| MAX_OUTPUT_TOKENS/, 'profile requests should use the internal default token limit without exposing the input');
assert.match(callFunction, /stream: Boolean\(settings\.streamingEnabled\)/, 'Tavern profile requests should follow the streaming toggle');
assert.match(callFunction, /typeof response === 'function'/, 'Tavern streaming responses should be consumed as generators');
assert.doesNotMatch(source, /if \(mode === 'tavern'\) refreshTavernProfiles\(\)/, 'switching API tabs must not refresh Tavern profiles');
assert.match(source, /apiUrlLabel\?\.classList\.add\('st-esg-api-custom-fields'\)/, 'the API URL field should be hidden outside custom mode');
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

assert.match(modelFunction, /const additional = parseApiAdditionalParameters\(settings, await getYamlParser\(\)\);/, 'model fetching should validate saved YAML');
assert.match(modelFunction, /headers:\s*\{[\s\S]*?\.\.\.additional\.additionalHeaders[\s\S]*?\}/, 'model fetching should apply custom request headers');
assert.doesNotMatch(modelFunction, /additional\.additionalBody/, 'model-list GET requests should not apply custom body parameters');

console.log('api-request-integration tests passed');
