import test from 'node:test';
import assert from 'node:assert/strict';

import { getNextMultiTaskName } from './multi-task-task-controller.js';

test('next task name fills the first available numeric slot', () => {
  assert.equal(getNextMultiTaskName([{ name: '任务 1' }, { name: '任务 3' }]), '任务 2');
});
