import assert from 'node:assert/strict';
import test from 'node:test';

import { applyComponentPositionMove } from './component-order.js';

const components = [
  { id: 'a', name: 'A', scope: '全局', groupId: 'group-a' },
  { id: 'b', name: 'B', scope: '全局', groupId: 'group-a' },
  { id: 'c', name: 'C', scope: '全局', groupId: 'group-b' },
  { id: 'd', name: 'D', scope: '全局', groupId: 'group-b' },
  { id: 'e', name: 'E', scope: '全局', groupId: '' },
  { id: 'p', name: 'P', scope: '预设', groupId: 'preset-group' },
];

const groups = [
  { id: 'group-a', scope: '全局' },
  { id: 'group-b', scope: '全局' },
  { id: 'empty-group', scope: '全局' },
  { id: 'preset-group', scope: '预设' },
];

const ids = (items) => items.map((item) => item.id);

test('moves a component after an earlier sibling without mutating the input', () => {
  const result = applyComponentPositionMove(components, groups, 'b', { kind: 'after', componentId: 'a' });

  assert.equal(result.moved, false);
  assert.equal(result.components, components);

  const moved = applyComponentPositionMove(components, groups, 'a', { kind: 'after', componentId: 'b' });
  assert.equal(moved.moved, true);
  assert.deepEqual(ids(moved.components), ['b', 'a', 'c', 'd', 'e', 'p']);
  assert.deepEqual(ids(components), ['a', 'b', 'c', 'd', 'e', 'p']);
});

test('moves a component after a later component and adopts its group', () => {
  const result = applyComponentPositionMove(components, groups, 'b', { kind: 'after', componentId: 'd' });

  assert.equal(result.moved, true);
  assert.deepEqual(ids(result.components), ['a', 'c', 'd', 'b', 'e', 'p']);
  assert.equal(result.components[3].groupId, 'group-b');
  assert.equal(components[1].groupId, 'group-a');
});

test('moves a component to the start of a named group', () => {
  const result = applyComponentPositionMove(components, groups, 'b', {
    kind: 'group-start',
    scope: '全局',
    groupId: 'group-b',
  });

  assert.equal(result.moved, true);
  assert.deepEqual(ids(result.components), ['a', 'b', 'c', 'd', 'e', 'p']);
  assert.equal(result.components[1].groupId, 'group-b');
});

test('moves a component to the start of the default group', () => {
  const result = applyComponentPositionMove(components, groups, 'd', {
    kind: 'group-start',
    scope: '全局',
    groupId: '',
  });

  assert.equal(result.moved, true);
  assert.deepEqual(ids(result.components), ['a', 'b', 'c', 'd', 'e', 'p']);
  assert.equal(result.components[3].groupId, '');
});

test('places a component in an empty valid group', () => {
  const result = applyComponentPositionMove(components, groups, 'a', {
    kind: 'group-start',
    scope: '全局',
    groupId: 'empty-group',
  });

  assert.equal(result.moved, true);
  assert.equal(result.components.at(-1).id, 'a');
  assert.equal(result.components.at(-1).groupId, 'empty-group');
});

test('rejects self, missing, invalid-group, and cross-scope targets', () => {
  const targets = [
    { sourceId: 'a', target: { kind: 'after', componentId: 'a' } },
    { sourceId: 'missing', target: { kind: 'after', componentId: 'a' } },
    { sourceId: 'a', target: { kind: 'after', componentId: 'missing' } },
    { sourceId: 'a', target: { kind: 'after', componentId: 'p' } },
    { sourceId: 'a', target: { kind: 'group-start', scope: '预设', groupId: 'preset-group' } },
    { sourceId: 'a', target: { kind: 'group-start', scope: '全局', groupId: 'missing-group' } },
    { sourceId: 'a', target: null },
  ];

  targets.forEach(({ sourceId, target }) => {
    const result = applyComponentPositionMove(components, groups, sourceId, target);
    assert.equal(result.moved, false);
    assert.equal(result.components, components);
  });
});

test('rejects a group-start target when the source already occupies that position', () => {
  const result = applyComponentPositionMove(components, groups, 'c', {
    kind: 'group-start',
    scope: '全局',
    groupId: 'group-b',
  });

  assert.equal(result.moved, false);
  assert.equal(result.components, components);
});
