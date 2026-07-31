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
assert.match(source, /import \{[\s\S]*?buildApiRequestParts,[\s\S]*?parseApiAdditionalParameters,[\s\S]*?parseApiNumericSettings,[\s\S]*?\} from '\.\/api\/api-request-parameters\.js\?ver=0\.1\.1';/, 'request parameter helpers should be imported');

assert.match(callFunction, /const numeric = parseApiNumericSettings\(settings\);/, 'generation should validate user-entered numeric settings');
assert.match(callFunction, /const additional = parseApiAdditionalParameters\(settings, yaml\);/, 'generation should validate saved YAML before requesting');
assert.match(callFunction, /const \{ body, headers \} = buildApiRequestParts\(/, 'generation should merge additional body and headers centrally');
assert.match(callFunction, /max_tokens:\s*numeric\.maxTokens,\s*temperature:\s*numeric\.temperature,/, 'generation should send actual input values');
assert.match(callFunction, /maxTokens:\s*String\(numeric\.maxTokens\),\s*temperature:\s*String\(numeric\.temperature\),/, 'prompt logs should use actual input values');
assert.match(callFunction, /headers,\s*body:\s*JSON\.stringify\(body\),/, 'fetch should use merged request parts');
assert.doesNotMatch(callFunction, /createPromptLog\(\{[^}]*additionalHeaders/s, 'custom header values must not enter prompt logs');
assert.doesNotMatch(callFunction, /createPromptLog\(\{[^}]*additionalHeadersYaml/s, 'custom header YAML must not enter prompt logs');

assert.match(modelFunction, /const additional = parseApiAdditionalParameters\(settings, yaml\);/, 'model fetching should validate saved YAML');
assert.match(modelFunction, /headers:\s*\{[\s\S]*?\.\.\.additional\.additionalHeaders[\s\S]*?\}/, 'model fetching should apply custom request headers');
assert.doesNotMatch(modelFunction, /additional\.additionalBody/, 'model-list GET requests should not apply custom body parameters');

console.log('api-request-integration tests passed');
