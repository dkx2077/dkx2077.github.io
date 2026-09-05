import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import {
  FIXED_POSITION,
  clampPitch,
  shortestAngle,
  direction,
  createLookControls,
} from '../static/js/scene/look.mjs';

const template = await readFile(new URL('../templates/index.html', import.meta.url), 'utf8');
const source = await readFile(new URL('../static/js/experience.mjs', import.meta.url), 'utf8');

test('panorama rotation crosses 360 without a discontinuity and clamps vertical movement', () => {
  assert.deepEqual(FIXED_POSITION, [0, 2.8, 0]);
  assert.ok(Object.isFrozen(FIXED_POSITION));
  assert.equal(shortestAngle(358, 2), 362);
  assert.equal(shortestAngle(2, 358), -2);
  assert.equal(shortestAngle(1440, 0), 1440);
  assert.equal(clampPitch(100), 48);
  assert.equal(clampPitch(-100), -28);
  assert.equal(clampPitch(12), 12);
  for (const yaw of [-720, -360, 0, 360, 720]) {
    const v = direction(yaw, 0);
    assert.ok(Math.abs(v[0]) < 1e-10);
    assert.ok(Math.abs(v[2] + 1) < 1e-10);
  }
});

test('touch drag does not activate a sign; a tap and keyboard navigation still work', () => {
  const dom = new JSDOM('<div id="shell"><a href="#home">About</a></div>');
  const w = dom.window;
  const shell = w.document.getElementById('shell');
  const originalWindow = globalThis.window;
  globalThis.window = w;
  const control = createLookControls(shell, {
    minPitch: -28,
    maxPitch: 48,
    reducedMotion: () => true,
    onChange: () => {},
    signal: new w.AbortController().signal,
  });
  const send = (type, x, y) => {
    const event = new w.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, {
      clientX: x,
      clientY: y,
      pointerId: 1,
      isPrimary: true,
      pointerType: 'touch',
      button: 0,
    });
    shell.querySelector('a').dispatchEvent(event);
  };
  send('pointerdown', 0, 0);
  send('pointerup', 0, 0);
  let click = new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  shell.querySelector('a').dispatchEvent(click);
  assert.equal(click.defaultPrevented, false);
  send('pointerdown', 100, 100);
  send('pointermove', -200, 1000);
  send('pointerup', -200, 1000);
  control.update(1 / 60);
  assert.equal(control.current.pitch, 48);
  assert.equal(control.current.yaw, 48);
  click = new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  shell.querySelector('a').dispatchEvent(click);
  assert.equal(click.defaultPrevented, true);
  shell.dispatchEvent(
    new w.KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true })
  );
  control.update(1 / 60);
  assert.equal(control.current.yaw, 0);
  assert.equal(control.current.pitch, 9);
  globalThis.window = originalWindow;
  w.close();
});

async function interfacePage({
  unsupported = false,
  importFailure = false,
  reduced = false,
  denied = false,
} = {}) {
  const dom = new JSDOM(
    template.replace('{{scene-settings}}', '{"pitchMin":-28,"pitchMax":48,"quality":"auto"}'),
    { url: 'https://preview.example/', runScripts: 'outside-only', pretendToBeVisual: true }
  );
  const w = dom.window;
  w.scrollTo = () => {};
  w.matchMedia = () => ({ matches: reduced });
  if (!unsupported) {
    w.WebGL2RenderingContext = function () {};
    w.PointerEvent = function () {};
  }
  if (denied)
    Object.defineProperty(w, 'localStorage', {
      get() {
        throw new Error('Denied');
      },
    });
  const calls = [];
  w.__mockWorld = {
    paused: false,
    suspend: v => calls.push(['suspend', v]),
    reset: () => calls.push(['reset']),
    lookAt: v => calls.push(['look', v]),
    setPaused(v) {
      this.paused = v;
    },
    setQuality: v => calls.push(['quality', v]),
    dispose: () => calls.push(['dispose']),
  };
  const importExpression = importFailure
    ? 'Promise.reject(new Error("unavailable"))'
    : 'Promise.resolve({createWorld:()=>window.__mockWorld})';
  w.console.warn = () => {};
  w.eval(source.replace("import('./scene/world.mjs')", importExpression));
  await new Promise(resolve => setImmediate(resolve));
  return { dom, w, d: w.document, calls };
}

test('scene sign opens a focused reading dialog, pauses the scene, and Escape restores focus', async () => {
  const { w, d, calls } = await interfacePage();
  assert.equal(d.body.classList.contains('scene-active'), true);
  const link = d.querySelector('a[href="#publications"]');
  link.focus();
  link.click();
  const reader = d.getElementById('reader');
  assert.equal(reader.getAttribute('role'), 'dialog');
  assert.equal(reader.getAttribute('aria-modal'), 'true');
  assert.ok(d.getElementById('publications').classList.contains('is-open'));
  assert.equal(d.activeElement.id, 'close-reader');
  assert.equal(d.getElementById('scene-shell').inert, true);
  assert.deepEqual(calls.at(-1), ['suspend', true]);
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(d.body.classList.contains('reader-open'), false);
  assert.equal(d.activeElement, link);
  assert.equal(d.getElementById('scene-shell').inert, false);
  assert.deepEqual(calls.at(-1), ['suspend', false]);
  w.close();
});

test('unsupported WebGL, blocked scene imports, reduced motion, and denied storage retain content', async () => {
  for (const settings of [
    { unsupported: true },
    { importFailure: true },
    { reduced: true },
    { denied: true },
  ]) {
    const { w, d } = await interfacePage(settings);
    assert.ok(d.getElementById('home-md'));
    assert.ok(d.getElementById('publications-md'));
    assert.equal(d.body.classList.contains('scene-active'), !!settings.denied);
    if (settings.unsupported || settings.importFailure)
      assert.equal(d.getElementById('mode-toggle').hidden, true);
    w.close();
  }
});

test('reading mode can return to the city, and district/quality controls reach the renderer', async () => {
  const { w, d, calls } = await interfacePage();
  d.getElementById('mode-toggle').click();
  assert.equal(d.body.classList.contains('scene-active'), false);
  assert.equal(w.localStorage.getItem('kd.mode'), 'reading');
  d.getElementById('mode-toggle').click();
  assert.equal(d.body.classList.contains('scene-active'), true);
  d.querySelector('[data-look="awards"]').click();
  assert.deepEqual(calls.at(-1), ['look', 'awards']);
  const quality = d.getElementById('quality');
  quality.value = 'low';
  quality.dispatchEvent(new w.Event('change'));
  assert.deepEqual(calls.at(-1), ['quality', 'low']);
  w.close();
});
