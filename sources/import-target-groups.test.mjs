import test from 'node:test';
import assert from 'node:assert/strict';

import { listImportTargetGroups, resolveImportTargetGroupId } from './import-target-groups.js';

const componentGroups = [
  { id: 'global-late', name: '全局二组', scope: '全局', order: 2 },
  { id: 'preset-only', name: '预设一组', scope: '预设', order: 0 },
  { id: 'global-first', name: '全局一组', scope: '全局', order: 0 },
];

const theaterGroups = [
  { id: 'theater-late', name: '剧场二组', order: 4 },
  { id: 'theater-first', name: '剧场一组', order: 1 },
];

test('component import groups follow the selected scope and group order', () => {
  assert.deepEqual(
    listImportTargetGroups({ library: 'components', scope: '全局', componentGroups, theaterGroups }),
    [
      { id: 'global-first', name: '全局一组' },
      { id: 'global-late', name: '全局二组' },
    ],
  );
});

test('theater import groups ignore component scope and use theater order', () => {
  assert.deepEqual(
    listImportTargetGroups({ library: 'theater', scope: '角色', componentGroups, theaterGroups }),
    [
      { id: 'theater-first', name: '剧场一组' },
      { id: 'theater-late', name: '剧场二组' },
    ],
  );
});

test('an unavailable import group falls back to the default group', () => {
  assert.equal(resolveImportTargetGroupId({ library: 'components', scope: '预设', groupId: 'global-first', componentGroups, theaterGroups }), '');
  assert.equal(resolveImportTargetGroupId({ library: 'components', scope: '预设', groupId: 'preset-only', componentGroups, theaterGroups }), 'preset-only');
});
