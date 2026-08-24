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
  assert.equal(result.components[4].id, 'a');
  assert.equal(result.components[4].groupId, 'empty-group');
  assert.equal(result.components.at(-1).id, 'p');
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

test('rejects group-start when the source is already the logical first item across interleaved groups', () => {
  const interleaved = [
    { id: 'a', scope: '', groupId: 'group-a' },
    { id: 'b', scope: '', groupId: 'group-b' },
    { id: 'c', scope: '', groupId: 'group-a' },
  ];
  const result = applyComponentPositionMove(
    interleaved,
    [{ id: 'group-a' }, { id: 'group-b' }],
    'a',
    { kind: 'group-start', scope: '', groupId: 'group-a' },
  );

  assert.equal(result.moved, false);
  assert.equal(result.components, interleaved);
});

test('ignores hidden ownership records when an after target is already the visible successor', () => {
  const interleaved = [
    { id: 'preset-a-1', scope: 'preset', groupId: '' },
    { id: 'preset-b-1', scope: 'preset', groupId: '' },
    { id: 'preset-a-2', scope: 'preset', groupId: '' },
  ];
  const result = applyComponentPositionMove(
    interleaved,
    [],
    'preset-a-2',
    { kind: 'after', componentId: 'preset-a-1' },
    { eligibleComponentIds: ['preset-a-1', 'preset-a-2'] },
  );

  assert.equal(result.moved, false);
  assert.equal(result.components, interleaved);
});

test('reorders only eligible ownership slots and leaves hidden records in place', () => {
  const interleaved = [
    { id: 'character-a-1', scope: 'character', groupId: '' },
    { id: 'character-b-1', scope: 'character', groupId: '' },
    { id: 'character-a-2', scope: 'character', groupId: '' },
  ];
  const result = applyComponentPositionMove(
    interleaved,
    [],
    'character-a-1',
    { kind: 'after', componentId: 'character-a-2' },
    { eligibleComponentIds: ['character-a-1', 'character-a-2'] },
  );

  assert.equal(result.moved, true);
  assert.deepEqual(ids(result.components), ['character-a-2', 'character-b-1', 'character-a-1']);
});

test('ignores hidden ownership records when source is already first in its visible group', () => {
  const interleaved = [
    { id: 'preset-b-1', scope: 'preset', groupId: 'shared-group' },
    { id: 'preset-a-1', scope: 'preset', groupId: 'shared-group' },
  ];
  const result = applyComponentPositionMove(
    interleaved,
    [{ id: 'shared-group', scope: 'preset' }],
    'preset-a-1',
    { kind: 'group-start', scope: 'preset', groupId: 'shared-group' },
    { eligibleComponentIds: ['preset-a-1'] },
  );

  assert.equal(result.moved, false);
  assert.equal(result.components, interleaved);
});
