import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const indexSource = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');

test('theater library exposes global and grouped random controls', () => {
  assert.match(indexSource, /theaterRandomScope: THEATER_RANDOM_SCOPE_GLOBAL/);
  assert.match(indexSource, /theaterGroupedFallbackMode: THEATER_RANDOM_MODE_OFF/);
  assert.match(indexSource, /theaterGroupRandomOverrides: \[\]/);
  assert.match(indexSource, /st-esg-theater-random-scope/);
  assert.match(indexSource, /type="radio" name="st-esg-theater-random-scope"/);
  assert.match(indexSource, /st-esg-theater-grouped-fallback-mode/);
  assert.match(indexSource, /st-esg-theater-random-add-group-button/);
  assert.match(indexSource, /getTheaterGroupRandomDisplayName\(group\)[\s\S]*return group\?\.name/);
  assert.match(indexSource, /\$\{addGroupMarkup\}<div class="st-esg-theater-random-group-list"/);
  assert.match(indexSource, /groupOverrides: settings\.theaterGroupRandomOverrides/);
});
