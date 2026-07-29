import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
assert.match(source, /dialog\.querySelector\('#st-esg-status'\)\?\.remove\(\);/, 'the panel should remove its duplicate footer status pill');
