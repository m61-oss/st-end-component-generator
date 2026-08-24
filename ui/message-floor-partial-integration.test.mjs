import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const indexSource = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');

test('generation errors normalize retained stream text before choosing floor actions', () => {
  const catchStart = indexSource.indexOf('catch (error) {', indexSource.indexOf('async function generateStatusbar'));
  const finallyStart = indexSource.indexOf('} finally {', catchStart);
  const catchSource = indexSource.slice(catchStart, finallyStart);

  assert.match(catchSource, /const partialStreamText = String\(error\?\.streamedText \?\? ''\)/);
  assert.ok(
    catchSource.indexOf('if (partialStreamText.trim())') < catchSource.indexOf("if (error?.name === 'AbortError')"),
    'partial stream normalization must happen before branching on the stop reason',
  );
  assert.match(catchSource, /hasInjectableFloorPanelResult\(retainedFloorResult\)/);
});

test('applying a generated result always settles the current floor generation', () => {
  const applyStart = indexSource.indexOf('function applyGeneratedResult');
  const applyEnd = indexSource.indexOf('async function buildMessages', applyStart);
  const applySource = indexSource.slice(applyStart, applyEnd);

  assert.match(applySource, /messageFloorPanelState\.status === FLOOR_PANEL_STATUS\.GENERATING[\s\S]*getEndedFloorPanelStatus\(floorResult\)/);
  assert.doesNotMatch(applySource, /messageFloorPanelState\.status === FLOOR_PANEL_STATUS\.GENERATING\s*&&\s*hasInjectableFloorPanelResult\(floorResult\)/);
});
