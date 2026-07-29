import assert from 'node:assert/strict';
import { renderPromptTemplate, isPromptTemplateApiAvailable, MISSING_TEMPLATE_API_MESSAGE } from '../template-compat.js';

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
