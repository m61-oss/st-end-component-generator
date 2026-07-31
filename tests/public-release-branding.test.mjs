import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'manifest.json'), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const indexSource = fs.readFileSync(path.join(repoRoot, 'index.js'), 'utf8');
const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');

assert.equal(manifest.display_name, '外置文尾组件生成器');
assert.equal(manifest.author, 'm61-oss');
assert.equal(manifest.homePage, 'https://github.com/m61-oss/st-end-component-generator');
assert.equal(manifest.version, '0.1.1');

assert.equal(packageJson.name, 'st-end-component-generator');
assert.equal(packageJson.version, '0.1.1');

assert.match(indexSource, /const EXTENSION_ID = 'st-end-component-generator';/);
assert.match(indexSource, /const EXTENSION_VERSION = '0\.1\.1';/);
assert.match(indexSource, /const QR_SHORTCUT_SET_NAME = '外置文尾组件生成器快捷键';/);
assert.match(readme, /^# 外置文尾组件生成器/m);
assert.doesNotMatch(indexSource, /\?ver=0\.3\./, 'the public release should use one cache-busting version');

for (const staleLabel of ['外置状态栏生成器', '生成状态栏', '注入状态栏', '旧版 ST 标记']) {
  assert.doesNotMatch(indexSource, new RegExp(staleLabel), `index.js should not retain the old label: ${staleLabel}`);
}
