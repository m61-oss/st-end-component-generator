import assert from 'node:assert/strict';
import { extractConfiguredBlocks, stripConfiguredBlocks } from '../injection/tag-rules.js';

const source = '<thinking>private chain</thinking><content>visible body</content><details>aside</details>';

assert.equal(
  stripConfiguredBlocks(source, 'thinking\ndetails'),
  '<content>visible body</content>',
);

assert.equal(
  stripConfiguredBlocks('[START]private chain[END]<content>visible body</content>', 're:\\[START\\][\\s\\S]*?\\[END\\]'),
  '<content>visible body</content>',
);

assert.equal(
  stripConfiguredBlocks(
    '<UpdateVariable>private state</UpdateVariable><content>visible body</content>',
    're:/<(UpdateVariable)>((?:(?!<\\1>)[\\s\\S])*?)<\\/\\1>/mi',
  ),
  '<content>visible body</content>',
  'standard regex literals should use their delimiters and flags',
);

assert.equal(
  stripConfiguredBlocks(
    '<updatevariable>first</updatevariable><UpdateVariable>second</UpdateVariable>',
    're:/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>/gi',
  ),
  '',
  'a regex literal should honor global and case-insensitive flags',
);

assert.equal(
  stripConfiguredBlocks(
    '<updatevariable>keep</updatevariable><UpdateVariable>remove</UpdateVariable>',
    're:/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>/',
  ),
  '<updatevariable>keep</updatevariable>',
  'a regex literal should not receive flags that the user did not provide',
);

assert.deepEqual(
  extractConfiguredBlocks(source, 'thinking'),
  { body: '<content>visible body</content><details>aside</details>', blocks: ['private chain'] },
);

assert.deepEqual(
  extractConfiguredBlocks('[START]private chain[END]<content>visible body</content>', 're:\\[START\\]([\\s\\S]*?)\\[END\\]'),
  { body: '<content>visible body</content>', blocks: ['private chain'] },
);

assert.equal(
  stripConfiguredBlocks('<行动选项>旧选项</行动选项><content>visible body</content>', '行动选项'),
  '<content>visible body</content>',
);

assert.equal(
  stripConfiguredBlocks('<行动选项 kind="secondary">旧选项</行动选项><content>visible body</content>', '行动选项'),
  '<content>visible body</content>',
);

assert.equal(stripConfiguredBlocks('<content>visible body</content>', 're:['), '<content>visible body</content>');

console.log('tag-rules tests passed');
