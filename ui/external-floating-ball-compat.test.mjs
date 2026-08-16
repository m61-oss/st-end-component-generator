import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('hides captured external floating balls while the plugin dialog is open', async () => {
  const [indexSource, styleSource] = await Promise.all([
    readFile(new URL('../index.js', import.meta.url), 'utf8'),
    readFile(new URL('../style.css', import.meta.url), 'utf8'),
  ]);

  assert.match(indexSource, /st-esg-external-ball-hidden/);
  assert.match(indexSource, /function setExternalFloatingBallCompatibilityHidden\s*\(/);
  assert.match(indexSource, /setExternalFloatingBallCompatibilityHidden\(shouldOpen\)/);
  assert.match(
    indexSource,
    /dialog\.addEventListener\(['"]close['"][\s\S]*setExternalFloatingBallCompatibilityHidden\(false\)/,
  );
  assert.match(
    styleSource,
    /body\.st-esg-external-ball-hidden\s+\[data-edge-ball-id\][\s\S]*display:\s*none\s*!important/,
  );
  assert.match(
    styleSource,
    /body\.st-esg-external-ball-hidden:has\(\[data-edge-ball-id\]\)\s+\.ih-floating-panel[\s\S]*display:\s*none\s*!important/,
  );
});
