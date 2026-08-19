import test from 'node:test';
import assert from 'node:assert/strict';

import { renderBrandMark } from './brand-mark.js';

test('menu brand mark uses real path gaps without a background-colored cut', () => {
  const markup = renderBrandMark('menu');

  assert.match(markup, /st-esg-brand-mark-menu/);
  assert.match(markup, /st-esg-brand-mark-menu-path/);
  assert.match(markup, /8 35V13/);
  assert.doesNotMatch(markup, /st-esg-brand-mark-cut/);
});

test('floor brand mark also uses real path gaps so transparent surfaces cannot reveal a masking stroke', () => {
  const markup = renderBrandMark('floor');

  assert.match(markup, /st-esg-brand-mark-floor/);
  assert.match(markup, /st-esg-brand-mark-menu-path/);
  assert.doesNotMatch(markup, /st-esg-brand-mark-cut/);
});

test('other brand marks retain the animated full-path structure', () => {
  const markup = renderBrandMark('ball');

  assert.match(markup, /st-esg-brand-mark-flow-head/);
  assert.match(markup, /st-esg-brand-mark-cut/);
});
