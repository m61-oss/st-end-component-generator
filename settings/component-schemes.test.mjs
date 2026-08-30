import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyComponentSchemeSnapshot,
  captureComponentSchemeSnapshot,
} from './component-schemes.js';
import { THEATER_DEFAULT_GROUP_ID } from '../sources/theater-library.js';

const liveSettings = () => ({
  components: [
    { id: 'component-a', name: 'A', content: 'old A', enabled: true },
    { id: 'component-b', name: 'B', content: 'old B', enabled: false },
  ],
  componentGroups: [
    { id: 'component-group', name: 'Group', enabled: false },
  ],
  defaultGroupEnabled: { global: true, preset: false, character: true },
  theaterComponents: [
    { id: 'theater-a', name: 'Scene A', content: 'old scene', enabled: false, groupId: 'theater-group' },
  ],
  theaterGroups: [
    { id: 'theater-group', name: 'Scenes', enabled: true },
  ],
  theaterDefaultGroupEnabled: false,
  theaterRandomScope: 'grouped',
  theaterRandomMode: 'enabled',
  theaterRandomCount: 3,
  theaterGroupedFallbackMode: 'fixed-enabled',
  theaterGroupedFallbackCount: 2,
  theaterGroupRandomOverrides: [
    { groupId: 'theater-group', mode: 'all', count: 1 },
    { groupId: THEATER_DEFAULT_GROUP_ID, mode: 'enabled', count: 4 },
  ],
});

test('component scheme captures only selection and theater random state', () => {
  const snapshot = captureComponentSchemeSnapshot(liveSettings());

  assert.deepEqual(snapshot.componentEnabled, { 'component-a': true, 'component-b': false });
  assert.deepEqual(snapshot.componentGroupEnabled, { 'component-group': false });
  assert.deepEqual(snapshot.defaultGroupEnabled, { global: true, preset: false, character: true });
  assert.deepEqual(snapshot.theaterEnabled, { 'theater-a': false });
  assert.deepEqual(snapshot.theaterGroupEnabled, { 'theater-group': true });
  assert.equal(snapshot.theaterDefaultGroupEnabled, false);
  assert.equal(snapshot.theaterRandomScope, 'grouped');
  assert.equal(snapshot.theaterGroupedFallbackMode, 'fixed-enabled');
  assert.deepEqual(snapshot.theaterGroupRandomOverrides, [
    { groupId: 'theater-group', mode: 'all', count: 1 },
    { groupId: THEATER_DEFAULT_GROUP_ID, mode: 'enabled', count: 4 },
  ]);
  assert.equal(JSON.stringify(snapshot).includes('content'), false);
  assert.equal(JSON.stringify(snapshot).includes('name'), false);
});

test('loading a component scheme ignores deleted ids and preserves ids added later', () => {
  const snapshot = captureComponentSchemeSnapshot(liveSettings());
  const current = liveSettings();
  current.components = [
    { id: 'component-a', name: 'Renamed A', content: 'new A', enabled: false },
    { id: 'component-new', name: 'Imported later', content: 'new', enabled: true },
  ];
  current.componentGroups.push({ id: 'new-group', name: 'New', enabled: true });
  current.theaterComponents.push({ id: 'theater-new', name: 'New scene', content: 'new', enabled: true });

  const applied = applyComponentSchemeSnapshot(current, snapshot);

  assert.equal(applied.components[0].enabled, true);
  assert.equal(applied.components[0].name, 'Renamed A');
  assert.equal(applied.components[0].content, 'new A');
  assert.equal(applied.components[1].enabled, true);
  assert.equal(applied.componentGroups[1].enabled, true);
  assert.equal(applied.theaterComponents[1].enabled, true);
  assert.deepEqual(applied.theaterGroupRandomOverrides, snapshot.theaterGroupRandomOverrides);
});

test('loading malformed random settings falls back without altering library content', () => {
  const current = liveSettings();
  const applied = applyComponentSchemeSnapshot(current, {
    componentEnabled: { 'component-a': false },
    theaterRandomScope: 'invalid',
    theaterRandomMode: 'invalid',
    theaterRandomCount: -10,
    theaterGroupedFallbackMode: 'invalid',
    theaterGroupedFallbackCount: 'bad',
    theaterGroupRandomOverrides: [
      { groupId: 'missing', mode: 'all', count: 2 },
      { groupId: 'theater-group', mode: 'invalid', count: -1 },
    ],
  });

  assert.equal(applied.components[0].enabled, false);
  assert.equal(applied.theaterRandomScope, 'global');
  assert.equal(applied.theaterRandomMode, 'off');
  assert.equal(applied.theaterRandomCount, 0);
  assert.equal(applied.theaterGroupedFallbackMode, 'off');
  assert.equal(applied.theaterGroupedFallbackCount, 2);
  assert.deepEqual(applied.theaterGroupRandomOverrides, [
    { groupId: 'theater-group', mode: 'off', count: 0 },
  ]);
});
