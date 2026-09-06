import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getChatMultiTaskSchemeId,
  setChatMultiTaskSchemeId,
} from './chat-multi-task-binding.js';

test('stores and clears the multi-task scheme independently in chat metadata', () => {
  const metadata = { st_end_component_generator_worldbook: { version: 1, schemeId: 'worldbook-1' } };
  setChatMultiTaskSchemeId(metadata, ' multi-1 ');
  assert.equal(getChatMultiTaskSchemeId(metadata), 'multi-1');
  assert.equal(metadata.st_end_component_generator_worldbook.schemeId, 'worldbook-1');

  setChatMultiTaskSchemeId(metadata, '');
  assert.equal(getChatMultiTaskSchemeId(metadata), '');
  assert.equal(metadata.st_end_component_generator_worldbook.schemeId, 'worldbook-1');
});
