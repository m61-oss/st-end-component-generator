import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyMultiTaskInjection,
  undoMultiTaskInjection,
} from './multi-task-injection.js';

test('append injection records only its inserted suffix and removes it later', () => {
  const injected = applyMultiTaskInjection('正文', {
    taskId: 'a',
    targetIndex: 3,
    resultMode: 'standard',
    output: '组件 A',
  });

  assert.equal(injected.text, '正文\n\n组件 A');
  assert.deepEqual(injected.record.operations.map((item) => item.text), ['\n\n组件 A']);
  const undone = undoMultiTaskInjection(injected.text, injected.record);
  assert.equal(undone.ok, true);
  assert.equal(undone.text, '正文');
});

test('one appended task can be undone while a later task remains', () => {
  const first = applyMultiTaskInjection('正文', {
    taskId: 'a',
    targetIndex: 3,
    resultMode: 'standard',
    output: '组件 A',
  });
  const second = applyMultiTaskInjection(first.text, {
    taskId: 'b',
    targetIndex: 3,
    resultMode: 'standard',
    output: '组件 B',
  });

  const undoneFirst = undoMultiTaskInjection(second.text, first.record);
  assert.equal(undoneFirst.ok, true);
  assert.equal(undoneFirst.text, '正文\n\n组件 B');
});

test('anchor injection records every exact inserted fragment and supports partial plan success', () => {
  const injected = applyMultiTaskInjection('A\nB\nC', {
    taskId: 'anchor',
    targetIndex: 4,
    resultMode: 'anchor',
    anchorItems: [
      { position: 'after', anchor: 'A', content: 'one' },
      { position: 'before', anchor: 'C', content: 'three' },
      { position: 'after', anchor: 'missing', content: 'skip' },
    ],
  });

  assert.equal(injected.text, 'A\none\nB\nthree\nC');
  assert.equal(injected.appliedCount, 2);
  assert.equal(injected.skippedCount, 1);
  assert.deepEqual(injected.record.operations.map((item) => item.text), ['\none', 'three\n']);
  assert.equal(undoMultiTaskInjection(injected.text, injected.record).text, 'A\nB\nC');
});

test('undo rejects a changed floor when an inserted fragment is no longer present', () => {
  const injected = applyMultiTaskInjection('正文', {
    taskId: 'a',
    targetIndex: 3,
    resultMode: 'standard',
    output: '组件 A',
  });
  const changed = undoMultiTaskInjection('正文\n用户已经删除了组件', injected.record);

  assert.equal(changed.ok, false);
  assert.equal(changed.reason, 'inserted-content-missing');
  assert.equal(changed.text, '正文\n用户已经删除了组件');
});

test('duplicate generated text removes the occurrence nearest its recorded position', () => {
  const injected = applyMultiTaskInjection('组件 A 出现在正文', {
    taskId: 'a',
    targetIndex: 3,
    resultMode: 'standard',
    output: '组件 A',
  });
  const undone = undoMultiTaskInjection(injected.text, injected.record);

  assert.equal(undone.ok, true);
  assert.equal(undone.text, '组件 A 出现在正文');
});
