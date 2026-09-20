import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const indexSource = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');

test('generation settings expose a dedicated floor-variable page with vertical scopes', () => {
  assert.match(indexSource, /data-generation-settings-page="floorVariables">楼层变量/);
  assert.match(indexSource, /data-generation-settings-panel="floorVariables"/);
  const scopesStart = indexSource.indexOf('const floorVariableScopes');
  const scopesEnd = indexSource.indexOf('];', scopesStart);
  const scopes = indexSource.slice(scopesStart, scopesEnd);
  assert.ok(scopes.indexOf('全局规则') < scopes.indexOf('角色规则'));
  assert.ok(scopes.indexOf('角色规则') < scopes.indexOf('聊天规则'));
  assert.match(indexSource, /data-floor-variable-field="tagNames"/);
  assert.match(indexSource, /data-floor-variable-field="regexText"/);
});

test('floor variables listen for saved edits and use native depth-zero body injection', () => {
  assert.match(indexSource, /MESSAGE_EDITED.*syncLatestAssistantFloorVariable/s);
  assert.match(indexSource, /MESSAGE_UPDATED.*syncLatestAssistantFloorVariable/s);
  assert.match(indexSource, /GENERATION_STARTED.*handleGenerationStarted/s);
  assert.match(indexSource, /setFloorVariableDepthZeroPrompt/);
  assert.doesNotMatch(indexSource, /CHAT_COMPLETION_PROMPT_READY/);
  assert.doesNotMatch(indexSource, /insertBodyFloorVariableSnapshot/);
});

test('component prompts resolve the floor snapshot inside each request build', () => {
  const buildStart = indexSource.indexOf('async function buildMessages');
  const buildEnd = indexSource.indexOf('\n}', buildStart);
  const buildSource = indexSource.slice(buildStart, buildEnd + 2);
  assert.match(buildSource, /getFloorVariableSnapshotForMessage/);
  assert.match(buildSource, /floorVariableSnapshot/);
  assert.match(buildSource, /runtimeDiagnostics\.floorVariables/);
});
