import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FLOOR_PANEL_STATUS,
  getEndedFloorPanelStatus,
  hasInjectableFloorPanelResult,
} from './message-floor-panel.js';

test('stopped standard output is injectable only when it contains visible content', () => {
  assert.equal(hasInjectableFloorPanelResult({ resultMode: 'standard', output: 'partial result' }), true);
  assert.equal(hasInjectableFloorPanelResult({ resultMode: 'standard', output: '   ' }), false);
});

test('stopped anchor output is injectable when at least one valid item remains', () => {
  assert.equal(hasInjectableFloorPanelResult({
    resultMode: 'anchor',
    anchorItems: [{ position: 'end', content: 'partial component' }],
  }), true);
  assert.equal(hasInjectableFloorPanelResult({ resultMode: 'anchor', anchorItems: [] }), false);
});

test('an ended stream becomes ready only when retained output is injectable', () => {
  assert.equal(getEndedFloorPanelStatus({ resultMode: 'standard', output: 'partial' }), FLOOR_PANEL_STATUS.READY);
  assert.equal(getEndedFloorPanelStatus({ resultMode: 'standard', output: '' }), FLOOR_PANEL_STATUS.IDLE);
  assert.equal(getEndedFloorPanelStatus({ resultMode: 'standard', output: '' }, { failed: true }), FLOOR_PANEL_STATUS.ERROR);
});
