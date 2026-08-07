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
  taskPrompt: 'task {{ANIMA_BASE_STATUS::mood}} {{external_components}}',
  components: [{ content: 'component {{status::hp}}' }],
  theaterComponents: [],
  promptSourceItems: [{ scope: 'preset', name: 'status prompt', content: 'prompt={{status::mood}}', role: 'system' }],
  worldbookSourceControlled: true,
  substituteParams: (value) => value,
  animaStatus: { mood: 'tense', hp: 42 },
});

const prompt = messages.map((message) => message.content).join('\n');
assert.match(prompt, /prompt=tense/);
assert.match(prompt, /task tense component 42/);
assert.doesNotMatch(prompt, /ANIMA_BASE_STATUS|\{\{status/);

console.log('Anima prompt-builder tests passed');
