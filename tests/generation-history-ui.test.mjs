import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const generateStart = source.indexOf('async function generateStatusbar(');
const injectStart = source.indexOf('async function injectGeneratedStatusbar(');
const generateFunction = source.slice(generateStart, injectStart);
const loadStart = source.indexOf('function loadGenerationHistoryEntry(');
const loadEnd = source.indexOf('\nfunction ', loadStart + 10);
const loadFunction = source.slice(loadStart, loadEnd);

assert.match(source, /import \{ loadGenerationHistory, recordGenerationResult \} from '\.\/generation\/generation-history\.js\?ver=0\.1\.4';/);
assert.match(source, /const GENERATION_HISTORY_STORAGE_KEY = `\$\{EXTENSION_ID\}\.recentGenerationHistory`;/);
assert.match(source, /最近生成记录/);
assert.match(source, /id="st-esg-generation-history"/);
assert.match(
  generateFunction,
  /applyGeneratedResult\(result\);[\s\S]*?recentGenerationHistory = recordGenerationResult\(getGenerationHistoryStorage\(\), GENERATION_HISTORY_STORAGE_KEY, settings\.lastGenerated\);[\s\S]*?renderGenerationHistory\(\);/,
  'only the completed result path should persist the current preview to recent history',
);
assert.ok(
  generateFunction.indexOf("if (error?.name === 'AbortError')") < generateFunction.indexOf('recordGenerationResult('),
  'abort and error returns must happen before successful history persistence',
);
assert.match(loadFunction, /settings\.lastGenerated = entry\.content;/);
assert.match(loadFunction, /settings\.lastGeneratedStatusPlaceholderPresent = containsStatusPlaceholder\(settings\.lastGenerated\);/);
assert.match(loadFunction, /clearGeneratedThinking\(\);[\s\S]*?\$t\('#st-esg-preview'\)\.val\(settings\.lastGenerated\);[\s\S]*?resizeGeneratedPreview\(\);/);
assert.doesNotMatch(loadFunction, /recordGenerationResult|setItem/, 'loading a record must never mutate browser history');

console.log('generation-history UI tests passed');
