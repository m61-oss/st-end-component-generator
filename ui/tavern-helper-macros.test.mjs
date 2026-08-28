import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexSource = await readFile(new URL('../index.js', import.meta.url), 'utf8');

test('runs TavernHelper variable macros after prompt templates and strips internal fields afterward', () => {
  const buildMessagesStart = indexSource.indexOf('async function buildMessages(latestMessage)');
  const buildMessagesEnd = indexSource.indexOf('\nfunction setGeneratingState', buildMessagesStart);
  const buildMessagesSource = indexSource.slice(buildMessagesStart, buildMessagesEnd);
  const templateIndex = buildMessagesSource.indexOf('if (settings.promptTemplateCompatEnabled)');
  const macroIndex = buildMessagesSource.indexOf('replaceTavernHelperMacrosInMessages(');
  const stripIndex = buildMessagesSource.indexOf('stripInternalMessageFields(messages)');

  assert.ok(templateIndex >= 0, 'prompt template pass should exist');
  assert.ok(macroIndex > templateIndex, 'TavernHelper macros should run after prompt templates');
  assert.ok(stripIndex > macroIndex, 'source message ids should be stripped only after helper macros resolve');
});

test('loads SillyTavern YAML dynamically before the final macro pass', () => {
  const buildMessagesStart = indexSource.indexOf('async function buildMessages(latestMessage)');
  const buildMessagesEnd = indexSource.indexOf('\nfunction setGeneratingState', buildMessagesStart);
  const buildMessagesSource = indexSource.slice(buildMessagesStart, buildMessagesEnd);
  const yamlLoadIndex = buildMessagesSource.indexOf('await getYamlParser()');
  const macroIndex = buildMessagesSource.indexOf('replaceTavernHelperMacrosInMessages(');

  assert.ok(yamlLoadIndex >= 0, 'the existing dynamic YAML loader should be reused');
  assert.ok(yamlLoadIndex < macroIndex, 'YAML should load before TavernHelper format macros resolve');
  assert.match(indexSource, /getVariables:\s*targetWindow\?\.TavernHelper\?\.getVariables/);
  assert.match(indexSource, /chat:\s*context\?\.chat/);
  assert.match(buildMessagesSource, /yamlLibrary:\s*tavernHelperYamlLibrary/);
  assert.match(indexSource, /lodashLike:\s*targetWindow\?_?\._/);
});
