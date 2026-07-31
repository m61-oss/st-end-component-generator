import assert from 'node:assert/strict';
import {
  clearImportSelectionsForScope,
  collectSelectedPromptSourceItems,
  normalizePromptSourceType,
  syncPromptSelectionsFromGroups,
} from '../sources/source-selection.js';

assert.equal(normalizePromptSourceType('preset'), 'preset');
assert.equal(normalizePromptSourceType('worldbook'), 'worldbook');
assert.equal(normalizePromptSourceType({ scope: '世界书' }), 'worldbook');
assert.deepEqual(
  clearImportSelectionsForScope({
    'preset::A::预设::one': true,
    'worldbook::A::世界书::one': true,
  }, '世界书'),
  { 'preset::A::预设::one': true },
);

const oldSelections = {
  old_key: true,
  enabled_key: false,
  disabled_key: true,
};

const nextSelections = syncPromptSelectionsFromGroups([
  {
    loaded: true,
    items: [
      { key: 'enabled_key', enabled: true },
      { key: 'disabled_key', enabled: false },
      { key: 'implicit_enabled_key' },
      { key: 'locked_key', enabled: true, locked: true },
    ],
  },
  {
    loaded: false,
    items: [
      { key: 'unloaded_key', enabled: true },
    ],
  },
], oldSelections);

assert.deepEqual(nextSelections, {
  old_key: true,
  enabled_key: false,
  disabled_key: true,
  implicit_enabled_key: true,
});

const worldbookSelections = syncPromptSelectionsFromGroups([
  {
    scope: '世界书',
    category: 'global',
    loaded: true,
    items: [
      { key: 'active_world_entry', enabled: true },
    ],
  },
  {
    scope: '世界书',
    category: 'inactive',
    loaded: true,
    items: [
      { key: 'inactive_world_entry', enabled: true },
    ],
  },
], {});

assert.deepEqual(worldbookSelections, {
  active_world_entry: true,
  inactive_world_entry: false,
});

const forcedSelections = syncPromptSelectionsFromGroups([
  {
    loaded: true,
    items: [
      { key: 'enabled_key', enabled: true },
      { key: 'disabled_key', enabled: false },
    ],
  },
], oldSelections, true);

assert.deepEqual(forcedSelections, {
  old_key: true,
  enabled_key: true,
  disabled_key: false,
});

const selectedPromptItems = collectSelectedPromptSourceItems([
  {
    loaded: true,
    items: [
      { key: 'preset_system', scope: '预设', name: 'System', role: 'system', content: 'Preset system', enabled: true },
      { key: 'preset_disabled', scope: '预设', name: 'Disabled', role: 'system', content: 'Do not send', enabled: true },
      { key: 'world_enabled_by_default', scope: '世界书', name: 'Lore', content: 'Worldbook lore', enabled: true },
    ],
  },
  {
    loaded: false,
    items: [
      { key: 'unloaded_world', scope: '世界书', name: 'Unloaded', content: 'Should not send yet', enabled: true },
    ],
  },
], {
  preset_disabled: false,
});

assert.deepEqual(selectedPromptItems.map((item) => item.name), ['System', 'Lore']);
assert.equal(selectedPromptItems[0].role, 'system');

const selectedPromptItemsWithOverrides = collectSelectedPromptSourceItems([
  {
    loaded: true,
    items: [
      { key: 'editable_preset', scope: '预设', name: 'Editable Preset', role: 'system', content: 'Original preset', enabled: true },
      { key: 'editable_world', scope: '世界书', name: 'Editable World', role: 'system', content: 'Original world', enabled: true },
    ],
  },
], {}, {
  editable_preset: 'Edited preset',
  editable_world: 'Edited world',
});

assert.deepEqual(selectedPromptItemsWithOverrides.map((item) => item.content), ['Edited preset', 'Edited world']);

const selectedEmptyMarkerItems = collectSelectedPromptSourceItems([
  {
    loaded: true,
    items: [
      { key: 'char_desc_marker', scope: '棰勮', name: 'Char Description', markerType: 'charDescription', role: 'system', content: '', enabled: true },
      { key: 'empty_normal_prompt', scope: '棰勮', name: 'Empty Normal', role: 'system', content: '', enabled: true },
    ],
  },
], {});

assert.deepEqual(selectedEmptyMarkerItems.map((item) => item.name), ['Char Description']);

const selectedLockedMarkerItems = collectSelectedPromptSourceItems([
  {
    loaded: true,
    items: [
      { key: 'world_before_marker', scope: 'preset', name: 'World Info (before)', markerType: 'worldInfoBefore', role: 'system', content: '', enabled: true, locked: true },
    ],
  },
], {
  world_before_marker: false,
});

assert.deepEqual(selectedLockedMarkerItems.map((item) => item.markerType), ['worldInfoBefore']);

// A worldbook entry that Tavern disabled must still be collected when the plugin explicitly
// checked it. `enabled` is only the Tavern-side default, never a veto over an explicit selection.
const tavernDisabledButChecked = collectSelectedPromptSourceItems([
  {
    loaded: true,
    items: [
      { key: 'tavern_off_checked', scope: '???', name: 'Tavern Off', content: 'lore body', enabled: false },
      { key: 'tavern_off_unchecked', scope: '???', name: 'Still Off', content: 'other body', enabled: false },
    ],
  },
], {
  tavern_off_checked: true,
});
assert.deepEqual(
  tavernDisabledButChecked.map((item) => item.name),
  ['Tavern Off'],
  'explicit plugin selection overrides the tavern-disabled default',
);

console.log('source-selection tavern-disabled override tests passed');

// A scheme is a static snapshot. Loading a book while a scheme drives the list must not seed missing
// keys from Tavern's own entry state, otherwise opening one entry silently checks the whole book.
const schemeScopedSync = syncPromptSelectionsFromGroups([
  {
    scope: '世界书',
    category: 'global',
    followsTavernState: false,
    loaded: true,
    items: [
      { key: 'tavern_on_entry', enabled: true },
      { key: 'tavern_off_entry', enabled: false },
      { key: 'already_checked_entry', enabled: true },
    ],
  },
], { already_checked_entry: true });

assert.deepEqual(schemeScopedSync, {
  already_checked_entry: true,
  tavern_on_entry: false,
  tavern_off_entry: false,
}, 'a scheme-driven book starts unchecked instead of inheriting tavern activation');

console.log('source-selection scheme snapshot tests passed');
