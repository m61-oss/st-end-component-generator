import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const indexSource = await readFile(new URL('../index.js', import.meta.url), 'utf8');

function createDialog() {
  const listeners = new Map();
  const dialog = {
    addEventListener(type, listener) {
      const entries = listeners.get(type) || [];
      entries.push(listener);
      listeners.set(type, entries);
    },
  };
  let closeCount = 0;
  const panelSource = indexSource.match(/function renderPluginPanel\(\)[\s\S]*?\n\}/)[0];
  const binding = panelSource.split('\n').find((line) => line.includes("dialog.addEventListener('click'") || line.includes('bindDialogBackdrop('));
  const helper = indexSource.match(/function bindDialogBackdrop\([\s\S]*?\n\}/)?.[0] || '';
  vm.runInNewContext(`${helper}\n${binding}`, { dialog, togglePanel: () => { closeCount += 1; } });
  return {
    dialog,
    send(type, target = dialog, extra = {}) {
      for (const listener of listeners.get(type) || []) {
        listener({ target, pointerId: 1, button: 0, isPrimary: true, clientX: 10, clientY: 10, ...extra });
      }
    },
    get closeCount() { return closeCount; },
  };
}

test('beautified select opening does not dismiss the dialog when click targets its common ancestor', () => {
  const fixture = createDialog();
  fixture.send('pointerdown', { tagName: 'SELECT' });
  fixture.send('pointerup', { tagName: 'DIV' });
  fixture.send('click');
  assert.equal(fixture.closeCount, 0);
});

test('a complete backdrop click dismisses the dialog once', () => {
  const fixture = createDialog();
  fixture.send('pointerdown');
  fixture.send('pointerup');
  fixture.send('click');
  fixture.send('click');
  assert.equal(fixture.closeCount, 1);
});

for (const interruption of ['pointercancel', 'drag', 'child-release', 'other-pointer', 'right-button']) {
  test(`backdrop ${interruption} does not dismiss the dialog`, () => {
    const fixture = createDialog();
    fixture.send('pointerdown', fixture.dialog, interruption === 'right-button' ? { button: 2 } : {});
    if (interruption === 'pointercancel') fixture.send('pointercancel');
    if (interruption === 'drag') {
      fixture.send('pointermove', fixture.dialog, { clientX: 40 });
      fixture.send('pointermove');
    }
    fixture.send('pointerup', interruption === 'child-release' ? {} : fixture.dialog,
      interruption === 'other-pointer' ? { pointerId: 2 } : {});
    fixture.send('click');
    assert.equal(fixture.closeCount, 0);
  });
}
