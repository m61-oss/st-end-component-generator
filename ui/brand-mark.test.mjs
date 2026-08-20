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

test('title and ball brand marks use real path gaps while retaining flow layers', () => {
  for (const context of ['title', 'ball']) {
    const markup = renderBrandMark(context);

    assert.match(markup, new RegExp(`st-esg-brand-mark-${context}`));
    assert.match(markup, /st-esg-brand-mark-flow-head/);
    assert.match(markup, /M8 13 19 20\.56M29 27\.44 40 35V13L29 20\.56M19 27\.44 8 35V13/);
    assert.doesNotMatch(markup, /st-esg-brand-mark-cut/);
    assert.doesNotMatch(markup, /M8 13 40 35V13L8 35Z/);
  }
});
