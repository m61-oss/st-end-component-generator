import assert from 'node:assert/strict';
import {
  THEATER_RANDOM_MODE_ALL,
  THEATER_RANDOM_MODE_FIXED_ENABLED,
  THEATER_RANDOM_MODE_OFF,
  getTheaterLibraryItems,
  normalizeTheaterRandomCount,
  normalizeTheaterRandomMode,
  selectTheaterComponents,
} from '../sources/theater-library.js';

const groups = [
  { id: 'format', name: '格式', enabled: true, order: 0 },
  { id: 'scene', name: '场景', enabled: true, order: 1 },
  { id: 'disabled-group', name: '关闭分组', enabled: false, order: 2 },
];

const items = [
  { id: 'scene-2', name: '场景二', groupId: 'scene', enabled: false, content: 'scene-2' },
  { id: 'format', name: '格式要求', groupId: 'format', enabled: true, content: 'format' },
  { id: 'scene-1', name: '场景一', groupId: 'scene', enabled: true, content: 'scene-1' },
  { id: 'disabled-group-item', name: '关闭分组内容', groupId: 'disabled-group', enabled: true, content: 'disabled-group' },
  { id: 'ungrouped', name: '未分组', enabled: true, content: 'ungrouped' },
];

assert.equal(normalizeTheaterRandomMode('bad'), THEATER_RANDOM_MODE_OFF);
assert.equal(normalizeTheaterRandomMode('all'), THEATER_RANDOM_MODE_ALL);
assert.equal(normalizeTheaterRandomMode('fixed-enabled'), THEATER_RANDOM_MODE_FIXED_ENABLED);
assert.equal(normalizeTheaterRandomCount('2.8'), 2);
assert.equal(normalizeTheaterRandomCount('-1'), 0);

assert.deepEqual(
  getTheaterLibraryItems(items, groups).map((item) => item.id),
  ['format', 'scene-2', 'scene-1', 'disabled-group-item', 'ungrouped'],
  'theater items follow group order, then original item order',
);

assert.deepEqual(
  selectTheaterComponents(items, { mode: THEATER_RANDOM_MODE_OFF, groups }).map((item) => item.id),
  ['format', 'scene-1', 'ungrouped'],
  'off mode sends enabled items and respects disabled groups',
);

assert.deepEqual(
  selectTheaterComponents(items, { mode: THEATER_RANDOM_MODE_ALL, count: 2, groups, random: () => 0 }).map((item) => item.id),
  ['scene-2', 'scene-1'],
  'all mode samples from every item in enabled groups and restores library order',
);

assert.deepEqual(
  selectTheaterComponents(items, { mode: THEATER_RANDOM_MODE_FIXED_ENABLED, count: 1, groups, random: () => 0.99 }).map((item) => item.id),
  ['format', 'scene-2', 'scene-1', 'ungrouped'],
  'fixed mode keeps enabled items and samples disabled items',
);

assert.deepEqual(
  selectTheaterComponents(items, { mode: THEATER_RANDOM_MODE_ALL, count: 99, groups, random: () => 0.5 }).map((item) => item.id),
  ['format', 'scene-2', 'scene-1', 'ungrouped'],
  'sampling more than the pool returns the whole eligible pool',
);

console.log('theater-library tests passed');
