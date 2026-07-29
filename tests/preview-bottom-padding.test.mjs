import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const styleSource = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

assert.match(
  styleSource,
  /\[data-tab-panel="workspace"\] \.st-esg-generation-content #st-esg-preview \{[^}]*padding-bottom:\s*14px !important;/,
  'the mobile generation preview must preserve bottom padding for its final line',
);

assert.match(
  styleSource,
  /@media \(max-width: 640px\) \{[\s\S]*?\.st-esg-panel-footer \{ position:\s*static;/,
  'the grid footer must stay in normal flow instead of covering the scrolling generation content',
);
