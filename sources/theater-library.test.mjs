import assert from 'node:assert/strict';
import test from 'node:test';

import {
  THEATER_DEFAULT_GROUP_ID,
  THEATER_RANDOM_SCOPE_GLOBAL,
  THEATER_RANDOM_SCOPE_GROUPED,
  selectTheaterComponents,
} from './theater-library.js';

const groups = [
  { id: 'group-a', name: 'A 组', enabled: true, order: 0 },
  { id: 'group-b', name: 'B 组', enabled: true, order: 1 },
];

const items = [
  { id: 'a-enabled', groupId: 'group-a', enabled: true },
  { id: 'a-disabled', groupId: 'group-a', enabled: false },
  { id: 'b-enabled', groupId: 'group-b', enabled: true },
  { id: 'b-disabled', groupId: 'group-b', enabled: false },
  { id: 'default-enabled', groupId: '', enabled: true },
];

const firstItemRandom = () => 0.999999;

test('keeps global theater selection behavior when global scope is selected', () => {
  const selected = selectTheaterComponents(items, {
    scope: THEATER_RANDOM_SCOPE_GLOBAL,
    mode: 'enabled',
    count: 2,
    groups,
    random: firstItemRandom,
  });

  assert.deepEqual(selected.map((item) => item.id), ['a-enabled', 'b-enabled']);
});

test('grouped scope without overrides matches the configured fallback pool', () => {
  const selected = selectTheaterComponents(items, {
    scope: THEATER_RANDOM_SCOPE_GROUPED,
    mode: 'enabled',
    count: 2,
    groupedFallbackMode: 'enabled',
    groupedFallbackCount: 2,
    groups,
    groupOverrides: [],
    random: firstItemRandom,
  });

  assert.deepEqual(selected.map((item) => item.id), ['a-enabled', 'b-enabled']);
});

test('specified groups leave the fallback pool and use their own mode and count', () => {
  const selected = selectTheaterComponents(items, {
    scope: THEATER_RANDOM_SCOPE_GROUPED,
    groupedFallbackMode: 'enabled',
    groupedFallbackCount: 1,
    groups,
    groupOverrides: [
      { groupId: 'group-a', mode: 'all', count: 1 },
    ],
    random: firstItemRandom,
  });

  assert.deepEqual(selected.map((item) => item.id), ['a-enabled', 'b-enabled']);
});

test('default group can be specified independently from named groups', () => {
  const selected = selectTheaterComponents(items, {
    scope: THEATER_RANDOM_SCOPE_GROUPED,
    groupedFallbackMode: 'enabled',
    groupedFallbackCount: 0,
    groups,
    groupOverrides: [
      { groupId: THEATER_DEFAULT_GROUP_ID, mode: 'all', count: 1 },
    ],
    random: firstItemRandom,
  });

  assert.deepEqual(selected.map((item) => item.id), ['default-enabled']);
});

test('grouped results are deduplicated and restored to library order', () => {
  const selected = selectTheaterComponents(items, {
    scope: THEATER_RANDOM_SCOPE_GROUPED,
    groupedFallbackMode: 'all',
    groupedFallbackCount: 2,
    groups,
    groupOverrides: [
      { groupId: 'group-a', mode: 'fixed-enabled', count: 2 },
    ],
    random: firstItemRandom,
  });

  assert.deepEqual(selected.map((item) => item.id), ['a-enabled', 'a-disabled', 'b-enabled', 'b-disabled']);
});
