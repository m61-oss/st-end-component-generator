import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createDefaultSettings } from '../settings/default-settings.js';

const indexSource = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');

test('theater library exposes global and grouped random controls', () => {
  const defaults = createDefaultSettings();
  assert.equal(defaults.theaterRandomScope, 'global');
  assert.equal(defaults.theaterGroupedFallbackMode, 'off');
  assert.deepEqual(defaults.theaterGroupRandomOverrides, []);
  assert.match(indexSource, /st-esg-theater-random-scope/);
  assert.match(indexSource, /type="radio" name="st-esg-theater-random-scope"/);
  assert.match(indexSource, /st-esg-theater-grouped-fallback-mode/);
  assert.match(indexSource, /st-esg-theater-random-add-group-button/);
  assert.match(indexSource, /getTheaterGroupRandomDisplayName\(group\)[\s\S]*return group\?\.name/);
  assert.match(indexSource, /\$\{addGroupMarkup\}<div class="st-esg-theater-random-group-list"/);
  assert.match(indexSource, /groupOverrides: sourceSettings\.theaterGroupRandomOverrides/);
});
