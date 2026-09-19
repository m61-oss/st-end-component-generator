import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STATUS_PLACEHOLDER_TAG,
  restoreStatusPlaceholderState,
} from './inject-utils.js';

test('enabled placeholder fixing does not create a marker absent before injection', () => {
  assert.equal(
    restoreStatusPlaceholderState('正文', '正文', true),
    '正文',
  );
  assert.equal(
    restoreStatusPlaceholderState(`正文\n${STATUS_PLACEHOLDER_TAG}`, '正文', true),
    '正文',
  );
});

test('enabled placeholder fixing preserves exactly one marker when it existed before injection', () => {
  const original = `正文\n${STATUS_PLACEHOLDER_TAG}`;
  const restored = restoreStatusPlaceholderState(
    `${STATUS_PLACEHOLDER_TAG}\n正文\n${STATUS_PLACEHOLDER_TAG}`,
    original,
    true,
  );

  assert.equal(restored, original);
});

test('enabled placeholder fixing leaves marker-free undo text byte-for-byte unchanged', () => {
  assert.equal(restoreStatusPlaceholderState('\nbody\n', 'original body', true), '\nbody\n');
});

test('disabled placeholder fixing leaves the undo result untouched', () => {
  const value = `正文\n${STATUS_PLACEHOLDER_TAG}`;
  assert.equal(restoreStatusPlaceholderState(value, '正文', false), value);
});
