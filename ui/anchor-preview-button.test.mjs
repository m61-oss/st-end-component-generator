import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [indexSource, styleSource] = await Promise.all([
  fs.readFile(new URL('../index.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../style.css', import.meta.url), 'utf8'),
]);

assert.match(
  indexSource,
  /st-esg-anchor-preview-button[^`]*aria-label="预览插入效果"[^`]*<i class="fa-solid fa-eye"[^>]*><\/i>/s,
  'the anchor preview control should be an icon-only accessible button',
);
assert.doesNotMatch(
  indexSource,
  /st-esg-anchor-preview-button[^`]*<span>预览插入效果<\/span>/s,
  'the anchor preview control should not render the text label',
);
assert.match(indexSource, /data-anchor-toggle data-injection-enabled="\$\{injectionEnabled\}"/s, 'anchor cards should expose an injection toggle');
assert.match(indexSource, /aria-label="\$\{injectionToggleLabel\}"/s, 'anchor injection toggles should be labelled');
assert.match(indexSource, /fa-solid \$\{injectionToggleIcon\}/s, 'anchor injection toggles should switch icons');
assert.match(
  styleSource,
  /\.st-esg-anchor-preview-button\s*\{(?=[^}]*background:\s*transparent)(?=[^}]*border:\s*1px solid)[^}]*\}/s,
  'the anchor preview control should use a transparent background and subtle border',
);
assert.match(
  styleSource,
  /\.st-esg-anchor-toggle\s*\{(?=[^}]*background:\s*transparent)(?=[^}]*border:\s*0)[^}]*\}/s,
  'anchor injection toggles should be icon-only controls',
);
