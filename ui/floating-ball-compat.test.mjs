import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isFloatingBallExternallyManaged,
  markFloatingBallCompatible,
} from './floating-ball-compat.js';

function createElementStub(attributes = []) {
  const classes = new Set();
  const attributeSet = new Set(attributes);
  const attributeValues = new Map();
  return {
    classes,
    attributeValues,
    classList: { add: (...names) => names.forEach((name) => classes.add(name)) },
    hasAttribute: (name) => attributeSet.has(name),
    setAttribute: (name, value) => {
      attributeSet.add(name);
      attributeValues.set(name, String(value));
    },
  };
}

test('marks the floating ball for generic floating-element scanners', () => {
  const ball = createElementStub();

  markFloatingBallCompatible(ball);

  assert.equal(ball.classes.has('st-esg-floating-ball'), true);
  assert.equal(ball.attributeValues.get('data-floating-ball'), 'true');
});

test('only treats a ball as externally managed when the collector marker exists', () => {
  assert.equal(isFloatingBallExternallyManaged(createElementStub()), false);
  assert.equal(isFloatingBallExternallyManaged(createElementStub(['data-edge-ball-id'])), true);
  assert.equal(isFloatingBallExternallyManaged(null), false);
});
