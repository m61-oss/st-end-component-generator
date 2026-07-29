import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderPromptTemplate, isPromptTemplateApiAvailable, MISSING_TEMPLATE_API_MESSAGE } from '../template-compat.js';

const extensionSource = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const bindPanelEvents = extensionSource.slice(
  extensionSource.indexOf('function bindPanelEvents()'),
  extensionSource.indexOf('function mountUi()'),
);
assert.match(
  bindPanelEvents,
  /\$t\('#st-esg-prompt-template-compat'\)\.prop\('checked', settings\.promptTemplateCompatEnabled\)/,
  'the first panel render should reflect the saved prompt-template compatibility setting',
);

const calls = [];
const targetWindow = {
  EjsTemplate: {
    prepareContext: async () => {
      calls.push('prepareContext');
      return { userName: 'Lin' };
    },
    evalTemplate: async (content, context) => {
      calls.push(['evalTemplate', content, context]);
      return content.replace('<%= userName %>', context.userName);
    },
  },
};

assert.equal(isPromptTemplateApiAvailable(targetWindow), true);
assert.equal(await renderPromptTemplate({ targetWindow, content: 'Hello <%= userName %>', enabled: false }), 'Hello <%= userName %>');
assert.equal(await renderPromptTemplate({ targetWindow, content: 'Hello <%= userName %>', enabled: true }), 'Hello Lin');
assert.deepEqual(calls.map((item) => Array.isArray(item) ? item[0] : item), ['prepareContext', 'evalTemplate']);

await assert.rejects(
  () => renderPromptTemplate({ targetWindow: {}, content: '<%= missing %>', enabled: true }),
  (error) => error.message === MISSING_TEMPLATE_API_MESSAGE,
);

console.log('template compatibility tests passed');
