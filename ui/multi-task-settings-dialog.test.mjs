import test from 'node:test';
import assert from 'node:assert/strict';

import { renderMultiTaskSchemeOptions } from './multi-task-settings-dialog.js';

test('scheme options escape names and retain the selected scheme', () => {
  const html = renderMultiTaskSchemeOptions(
    [{ id: 'one', name: '<方案>' }, { id: 'two', name: '第二个' }],
    'two',
    '酒馆默认',
  );
  assert.match(html, /<option value="">酒馆默认<\/option>/);
  assert.match(html, /&lt;方案&gt;/);
  assert.match(html, /value="two" selected/);
});
