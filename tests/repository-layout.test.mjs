import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const rootFiles = [
  'index.js',
  'style.css',
  'manifest.json',
  'package.json',
  'README.md',
  'LICENSE',
];

const classifiedModules = [
  'api/api-request-parameters.js',
  'api/api-utils.js',
  'api/stream-utils.js',
  'generation/generation-entry.js',
  'generation/generation-error.js',
  'generation/prompt-builder.js',
  'generation/prompt-log.js',
  'generation/template-compat.js',
  'sources/baibai-book.js',
  'sources/component-sources.js',
  'sources/prompt-source-cache.js',
  'sources/source-selection.js',
  'sources/worldbook-scan.js',
  'ui/floating-ball-position.js',
  'ui/notification-utils.js',
  'ui/preview-sizing.js',
  'settings/scheme-utils.js',
  'injection/inject-utils.js',
  'injection/tag-rules.js',
];

for (const path of rootFiles) {
  assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), true, `${path} should remain at the repository root`);
}

for (const path of classifiedModules) {
  assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), true, `${path} should exist`);
  const legacyPath = path.slice(path.indexOf('/') + 1);
  assert.equal(existsSync(new URL(`../${legacyPath}`, import.meta.url)), false, `${legacyPath} should not remain at the repository root`);
}

console.log('repository layout tests passed');
