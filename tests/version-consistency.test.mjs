import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'manifest.json'), 'utf8'));
const indexSource = fs.readFileSync(path.join(repoRoot, 'index.js'), 'utf8');
const versionMatch = indexSource.match(/const EXTENSION_VERSION = '([^']+)'/);

assert.ok(versionMatch, 'index.js should define EXTENSION_VERSION');
assert.equal(versionMatch[1], manifest.version);
assert.ok(manifest.js.includes(`ver=${manifest.version}`));
