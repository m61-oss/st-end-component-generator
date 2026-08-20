import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const expectedVersion = '0.2.0';

test('keeps the extension display name and public version metadata aligned', async () => {
  const [manifestText, packageText, indexText] = await Promise.all([
    readFile(new URL('../manifest.json', import.meta.url), 'utf8'),
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
    readFile(new URL('../index.js', import.meta.url), 'utf8'),
  ]);
  const manifest = JSON.parse(manifestText);
  const packageJson = JSON.parse(packageText);

  assert.equal(manifest.display_name, '织幕·外置组件');
  assert.equal(manifest.version, expectedVersion);
  assert.equal(manifest.js, `index.js?ver=${expectedVersion}`);
  assert.equal(packageJson.version, expectedVersion);
  assert.match(indexText, new RegExp(`const EXTENSION_VERSION = '${expectedVersion.replaceAll('.', '\\.')}'`));
  assert.match(indexText, /const BRAND_NAME = '织幕'/);
  assert.match(indexText, /const BRAND_SUBTITLE = '外置组件生成器'/);
  assert.match(indexText, /const QR_SHORTCUT_SET_NAME = '织幕快捷键'/);

  const cacheVersions = [...indexText.matchAll(/\?ver=(\d+\.\d+\.\d+)/g)].map((match) => match[1]);
  assert.ok(cacheVersions.length > 0);
  assert.deepEqual([...new Set(cacheVersions)], [expectedVersion]);
});
