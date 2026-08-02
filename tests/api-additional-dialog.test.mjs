import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');

assert.match(source, /function showApiAdditionalParametersDialog\(\)/);
for (const id of [
  'st-esg-api-additional-dialog',
  'st-esg-api-include-body',
  'st-esg-api-exclude-body',
  'st-esg-api-include-headers',
  'st-esg-api-additional-cancel',
  'st-esg-api-additional-save',
]) {
  assert.match(source, new RegExp(id));
}

const dialogFunction = source.slice(
  source.indexOf('function showApiAdditionalParametersDialog()'),
  source.indexOf('function requestSchemeName('),
);

assert.match(dialogFunction, /includeBody\.value = textOf\(settings\.additionalBodyYaml\)/);
assert.match(dialogFunction, /excludeBody\.value = textOf\(settings\.excludedBodyYaml\)/);
assert.match(dialogFunction, /includeHeaders\.value = textOf\(settings\.additionalHeadersYaml\)/);
assert.match(dialogFunction, /const draft = \{\s*additionalBodyYaml: includeBody\.value,\s*excludedBodyYaml: excludeBody\.value,\s*additionalHeadersYaml: includeHeaders\.value,/s);
assert.match(dialogFunction, /parseApiAdditionalParameters\(draft, await getYamlParser\(\)\);\s*Object\.assign\(settings, draft\);/s);
assert.match(dialogFunction, /markSchemeDirty\('api'\)/);
assert.match(dialogFunction, /catch \(error\) \{\s*renderApiAdditionalParameterError\(dialog, error\);/s);
assert.match(dialogFunction, /dialog\.querySelector\('#st-esg-api-additional-cancel'\).*closeDialog\('cancel'\)/s);

assert.match(source, /fetchModelsButton\?\.insertAdjacentHTML\('afterend',[\s\S]*st-esg-additional-parameters/);
assert.match(source, /\$t\('#st-esg-additional-parameters'\)\.on\('click', showApiAdditionalParametersDialog\)/);

console.log('api-additional-dialog tests passed');
