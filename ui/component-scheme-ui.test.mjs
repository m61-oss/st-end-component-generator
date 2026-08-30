import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../index.js', import.meta.url), 'utf8');

test('component schemes are persisted and use the existing scheme manager controls', () => {
  assert.match(source, /componentSchemes:\s*\[\]/);
  assert.match(source, /selectedComponentSchemeId:\s*''/);
  assert.match(source, /component:\s*\{\s*listKey:\s*'componentSchemes'/);
  assert.match(source, /renderSchemeManager\('component'\)/);
});

test('component scheme capture and load use selection snapshots without library transfer', () => {
  assert.match(source, /captureComponentSchemeSnapshot\(settings\)/);
  assert.match(source, /applyComponentSchemeSnapshot\(settings,\s*snapshot\)/);
  assert.match(source, /renderComponentList\(\)/);
  assert.doesNotMatch(source, /createLibraryExportPackage[\s\S]{0,120}componentSchemes/);
  assert.doesNotMatch(source, /importLibraryPackage[\s\S]{0,120}componentSchemes/);
});

test('multi-task component selector reads the persisted component scheme list', () => {
  assert.match(source, /renderMultiTaskSchemeOptions\(settings\.componentSchemes,\s*item\.componentSchemeId\)/);
});
