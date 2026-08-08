import assert from 'node:assert/strict';
import { buildExternalStatusbarMessages } from '../generation/prompt-builder.js';

const targetWindow = {
  TavernHelper: {
    getCurrentPresetName: () => 'test',
    getPreset: () => ({ prompts: [], prompt_order: [] }),
  },
};
const context = {
  name1: 'user',
  name2: 'char',
  chat: [{ is_user: true, mes: 'hello' }],
  characters: [{ description: '', personality: '', scenario: '' }],
  characterId: 0,
};

const messages = await buildExternalStatusbarMessages({
  targetWindow,
  context,
  latestMessage: { mes: 'latest' },
  taskPrompt: 'task {{ANIMA_BASE_STATUS::mood}} {{status}} {{external_components}}',
  components: [{ content: 'component {{status::hp}}' }],
  theaterComponents: [],
  promptSourceItems: [{ scope: 'preset', name: 'status prompt', content: 'prompt={{status::mood}}', role: 'system' }],
  worldbookSourceControlled: true,
  substituteParams: (value) => value,
  animaStatus: { mood: 'tense', hp: 42 },
});

const prompt = messages.map((message) => message.content).join('\n');
assert.match(prompt, /prompt=tense/);
assert.match(prompt, /task tense[\s\S]*mood: tense[\s\S]*component 42/);
assert.match(prompt, /mood: tense/);
assert.doesNotMatch(prompt, /\"mood\"/);
assert.doesNotMatch(prompt, /ANIMA_BASE_STATUS|\{\{status/);

const anchoredMessages = await buildExternalStatusbarMessages({
  targetWindow,
  context: {
    ...context,
    chat: [
      { is_user: true, mes: 'user 47' },
      { is_user: false, mes: 'assistant 48' },
      { is_user: false, mes: 'assistant 50' },
    ],
  },
  latestMessage: { mes: 'assistant 50' },
  taskPrompt: 'task',
  components: [],
  theaterComponents: [],
  promptSourceItems: [
    { scope: 'preset', markerType: 'chatHistory', role: 'system', content: '' },
    { scope: '\u4e16\u754c\u4e66', name: '[anima_status]', sourceUid: 'anima-status', role: 'system', content: 'status={{status::mood}}' },
  ],
  worldbookSourceControlled: true,
  substituteParams: (value) => value,
  animaStatus: { mood: 'from 48' },
  animaStatusMessageIndex: 1,
});
assert.deepEqual(
  anchoredMessages.map((message) => message.content),
  ['user 47', 'assistant 48', 'status=from 48', 'assistant 50', 'task'],
  'Anima status should be inserted immediately after its source assistant floor',
);

console.log('Anima prompt-builder tests passed');
