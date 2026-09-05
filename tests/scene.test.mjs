import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import * as THREE from 'three';
import { createSigns } from '../static/js/scene/signs.mjs';
import { createEnvironment, RAIN_COUNTS } from '../static/js/scene/environment.mjs';
import { createLighting } from '../static/js/scene/lighting.mjs';
import { SIGN_LAYOUT } from '../static/js/scene/design.mjs';
import {
  FIXED_POSITION,
  clampPitch,
  shortestAngle,
  direction,
  viewportFov,
  createLookControls,
} from '../static/js/scene/look.mjs';

const template = await readFile(new URL('../templates/index.html', import.meta.url), 'utf8');
const source = await readFile(new URL('../static/js/experience.mjs', import.meta.url), 'utf8');

test('lighting reaches upper rear facades and Low disables the cached shadow layer', () => {
  const scene = new THREE.Scene();
  const wall = new THREE.InstancedMesh(
    new THREE.BoxGeometry(),
    new THREE.MeshStandardMaterial(),
    1
  );
  const window = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 1);
  scene.add(wall, window);
  const lighting = createLighting(scene);
  scene.updateMatrixWorld(true);
  const key = scene.getObjectByName('architectural-key');
  const keyDirection = key.position.clone().sub(key.target.position).normalize();
  assert.ok(
    keyDirection.dot(new THREE.Vector3(0, 0, -1)) > 0.3,
    'Awards facade receives direct light'
  );
  assert.ok(
    keyDirection.dot(new THREE.Vector3(1, 0, 0)) > 0.3,
    'Work facade receives direct light'
  );
  const floods = [];
  scene.traverse(object => {
    if (object.isSpotLight) floods.push(object);
  });
  for (const point of [new THREE.Vector3(4, 40, 41.5), new THREE.Vector3(-39.5, 38, -3)]) {
    assert.ok(
      floods.some(light => {
        const delta = point.clone().sub(light.position);
        const axis = light.target.position.clone().sub(light.position).normalize();
        return (
          delta.length() < light.distance && delta.normalize().dot(axis) > Math.cos(light.angle)
        );
      }),
      'Upper-storey surface falls within a real floodlight cone'
    );
  }
  assert.equal(wall.castShadow, true);
  assert.equal(wall.receiveShadow, true);
  assert.equal(window.castShadow, false, 'Window instances do not enter the shadow pass');
  lighting.setQuality(false);
  assert.equal(key.castShadow, true);
  assert.equal(key.shadow.autoUpdate, false);
  assert.equal(key.shadow.needsUpdate, true);
  assert.equal(scene.getObjectByName('ground-shadow').visible, true);
  lighting.setQuality(true);
  assert.equal(key.castShadow, false);
  assert.equal(scene.getObjectByName('ground-shadow').visible, false);
  lighting.setQuality(false);
  assert.equal(key.shadow.needsUpdate, true, 'Returning to High requests one fresh shadow capture');
  let released = false;
  key.shadow.map = new THREE.WebGLRenderTarget(16, 16);
  key.shadow.map.addEventListener('dispose', () => {
    released = true;
  });
  lighting.dispose();
  assert.equal(released, true, 'Owned shadow target is released on teardown');
});

test('tall phone viewports keep the complete name within the horizontal field', () => {
  const name = new THREE.Object3D();
  const config = SIGN_LAYOUT.name;
  name.position.set(...config.at);
  name.lookAt(0, config.at[1], 0);
  name.scale.setScalar(config.scale);
  name.updateMatrixWorld();
  for (const [width, height] of [
    [320, 844],
    [360, 915],
    [390, 844],
    [768, 1024],
    [844, 390],
    [1440, 900],
  ]) {
    const camera = new THREE.PerspectiveCamera(
      viewportFov(width, height),
      width / height,
      0.1,
      180
    );
    camera.position.set(...FIXED_POSITION);
    const forward = direction(0, 9);
    camera.lookAt(camera.position.clone().add(new THREE.Vector3(...forward)));
    camera.updateMatrixWorld();
    for (const x of [-config.width / 2, config.width / 2]) {
      for (const y of [-config.height / 2, config.height / 2]) {
        const corner = new THREE.Vector3(x, y, 0).applyMatrix4(name.matrixWorld).project(camera);
        assert.ok(
          Math.abs(corner.x) < 1,
          `Name width remains visible at ${width}×${height}: ${corner.x}`
        );
      }
    }
  }
});

test('live sign faces fit their physical housings and offscreen links leave keyboard navigation', () => {
  const dom = new JSDOM(template);
  const originalDocument = globalThis.document;
  globalThis.document = dom.window.document;
  const scene = new THREE.Scene();
  let signs;
  try {
    signs = createSigns(scene, document.getElementById('sign-layer'));
    signs.resize(1440, 900);
    const camera = new THREE.PerspectiveCamera(60, 1440 / 900, 0.1, 180);
    camera.position.set(...FIXED_POSITION);
    camera.lookAt(0, 4, -18);
    signs.render(camera);
    for (const [name, config] of Object.entries(SIGN_LAYOUT)) {
      const face = document.querySelector(`#sign-layer [data-sign="${name}"]`);
      assert.equal(face.style.getPropertyValue('--face-width'), `${config.width}px`);
      assert.equal(face.style.getPropertyValue('--face-height'), `${config.height}px`);
      if (name === 'name') continue;
      const housing = scene.getObjectByName(`sign:${name}`);
      assert.deepEqual(housing.position.toArray(), config.at);
      const enamel = housing.children[1];
      assert.equal(enamel.scale.x, config.width * config.scale);
      assert.equal(enamel.scale.y, config.height * config.scale);
      assert.ok(enamel.position.z + enamel.scale.z / 2 < 0, 'Letter plane sits ahead of enamel');
    }
    const about = document.querySelector('#sign-layer [data-sign="about"]');
    const awards = document.querySelector('#sign-layer [data-sign="awards"]');
    assert.equal(about.style.visibility, 'visible');
    assert.equal(about.inert, false);
    assert.equal(awards.style.visibility, 'hidden');
    assert.equal(awards.inert, true);
    camera.lookAt(1.4, 6.3, 19);
    signs.render(camera);
    assert.equal(about.inert, true);
    assert.equal(awards.style.visibility, 'visible');
    assert.equal(awards.inert, false);
  } finally {
    signs?.dispose();
    globalThis.document = originalDocument;
    dom.window.close();
  }
});

test('quality changes reduce rain drawing and updates; static facade details remain batched', () => {
  const dom = new JSDOM('');
  const originalDocument = globalThis.document;
  globalThis.document = dom.window.document;
  const scene = new THREE.Scene();
  let environment;
  try {
    environment = createEnvironment(scene, { low: false, reducedMotion: false });
    const rain = scene.children.find(object => object.isLineSegments);
    const positions = rain.geometry.attributes.position.array;
    assert.equal(rain.geometry.drawRange.count, RAIN_COUNTS.high * 2);
    const firstY = positions[1];
    const lastIndex = (RAIN_COUNTS.high - 1) * 6 + 1;
    const lastY = positions[lastIndex];
    environment.setQuality(true);
    assert.equal(rain.geometry.drawRange.count, RAIN_COUNTS.low * 2);
    environment.update(1, 1 / 60, true);
    assert.deepEqual(
      rain.geometry.attributes.position.updateRanges,
      [{ start: 0, count: RAIN_COUNTS.low * 6 }],
      'Low uploads only its active rain positions'
    );
    assert.notEqual(positions[1], firstY);
    assert.equal(positions[lastIndex], lastY, 'Inactive rain avoids CPU updates');
    environment.setQuality(false);
    assert.equal(rain.geometry.drawRange.count, RAIN_COUNTS.high * 2);
    environment.update(2, 1 / 60, true);
    assert.notEqual(positions[lastIndex], lastY);
    const colors = rain.geometry.attributes.color.array;
    for (let i = 0; i < RAIN_COUNTS.high; i++) {
      assert.ok(colors[i * 6] > colors[i * 6 + 3], 'Rain tails fade without a second draw');
      assert.ok(positions[i * 6 + 1] - positions[i * 6 + 4] >= 0.64);
    }
    environment.setMotion(false);
    assert.equal(rain.visible, false);
    const paused = positions.slice();
    environment.update(3, 1 / 60, false);
    assert.deepEqual(positions, paused);
    let boxes = 0;
    let draws = 0;
    scene.traverse(object => {
      if (object.isMesh || object.isLineSegments) draws++;
      if (object.geometry?.type !== 'BoxGeometry') return;
      assert.ok(object.isInstancedMesh, 'Repeated facade geometry uses material batches');
      boxes += object.count;
    });
    assert.ok(boxes > 1000, 'Windows and facade details remain in the scene');
    assert.ok(draws < 25, `Environment has ${draws} base draw calls`);
  } finally {
    environment?.dispose();
    globalThis.document = originalDocument;
    dom.window.close();
  }
});

test('distant windows sit within building facades that face the fixed observation point', () => {
  const dom = new JSDOM('');
  const originalDocument = globalThis.document;
  globalThis.document = dom.window.document;
  const scene = new THREE.Scene();
  let environment;
  try {
    environment = createEnvironment(scene, { low: true, reducedMotion: true });
    const bodies = scene.getObjectByName('distant-buildings');
    const windows = scene.getObjectByName('distant-windows');
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const size = new THREE.Vector3();
    const bounds = [];
    for (let i = 0; i < bodies.count; i++) {
      bodies.getMatrixAt(i, matrix);
      bounds.push(
        new THREE.Box3(
          new THREE.Vector3(-0.5, -0.5, -0.5),
          new THREE.Vector3(0.5, 0.5, 0.5)
        ).applyMatrix4(matrix)
      );
    }
    const visibleSectors = [0, 0, 0, 0];
    for (let i = 0; i < windows.count; i++) {
      windows.getMatrixAt(i, matrix);
      position.setFromMatrixPosition(matrix);
      size.setFromMatrixScale(matrix);
      const front = size.z < size.x;
      const surface = front ? 'z' : 'x';
      const lateral = front ? 'x' : 'z';
      const body = bounds.find(box => {
        const nearFace =
          box.min[surface] + box.max[surface] > 0
            ? box.min[surface] - 0.02
            : box.max[surface] + 0.02;
        return (
          Math.abs(position[surface] - nearFace) < 0.001 &&
          position[lateral] - size[lateral] / 2 > box.min[lateral] &&
          position[lateral] + size[lateral] / 2 < box.max[lateral] &&
          position.y - size.y / 2 > box.min.y &&
          position.y + size.y / 2 < box.max.y
        );
      });
      assert.ok(body, `Window ${i} lies inside an observer-facing facade`);
      visibleSectors[(position.x < 0 ? 1 : 0) + (position.z < 0 ? 2 : 0)]++;
    }
    assert.ok(
      visibleSectors.every(count => count > 100),
      'Lit windows cover every city quadrant'
    );
  } finally {
    environment?.dispose();
    globalThis.document = originalDocument;
    dom.window.close();
  }
});

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
  Object.defineProperty(shell, 'clientWidth', { value: 360 });
  let enabled = true;
  const originalWindow = globalThis.window;
  globalThis.window = w;
  const control = createLookControls(shell, {
    minPitch: -28,
    maxPitch: 48,
    reducedMotion: () => true,
    onChange: () => {},
    signal: new w.AbortController().signal,
    enabled: () => enabled,
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
  assert.equal(control.current.yaw, 75);
  click = new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  shell.querySelector('a').dispatchEvent(click);
  assert.equal(click.defaultPrevented, true);
  shell.dispatchEvent(
    new w.KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true })
  );
  control.update(1 / 60);
  assert.equal(control.current.yaw, 0);
  assert.equal(control.current.pitch, 9);
  enabled = false;
  send('pointerdown', 100, 100);
  send('pointermove', -200, 100);
  send('pointerup', -200, 100);
  shell.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  control.update(1 / 60);
  assert.equal(control.current.yaw, 0, 'Suspended readers cannot rotate the background');
  globalThis.window = originalWindow;
  w.close();
});

async function interfacePage({
  unsupported = false,
  importFailure = false,
  reduced = false,
  denied = false,
  coarse = false,
  storedMode = null,
} = {}) {
  const dom = new JSDOM(
    template.replace('{{scene-settings}}', '{"pitchMin":-28,"pitchMax":48,"quality":"auto"}'),
    { url: 'https://preview.example/', runScripts: 'outside-only', pretendToBeVisual: true }
  );
  const w = dom.window;
  const scrolls = [];
  w.scrollTo = options => scrolls.push(options);
  w.matchMedia = query => ({
    matches: query.includes('reduced-motion') ? reduced : coarse,
  });
  if (storedMode) w.localStorage.setItem('kd.mode', storedMode);
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
    : 'Promise.resolve({createWorld:()=>{window.__worldCreated=true;return window.__mockWorld;}})';
  w.console.warn = () => {};
  w.eval(source.replace("import('./scene/world.mjs')", importExpression));
  await new Promise(resolve => setImmediate(resolve));
  return { dom, w, d: w.document, calls, scrolls };
}

test('touch devices start with native reading and only initialize 3D on request or saved preference', async () => {
  const { w, d } = await interfacePage({ coarse: true });
  assert.equal(d.body.classList.contains('scene-active'), false);
  assert.equal(w.__worldCreated, undefined, 'No 3D module is initialized by default on touch');
  assert.equal(d.getElementById('scene-shell').hidden, true);
  assert.equal(d.getElementById('mode-toggle').hidden, false);
  w.history.replaceState(null, '', '#publications');
  d.getElementById('mode-toggle').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(w.__worldCreated, true);
  assert.equal(d.body.classList.contains('scene-active'), true);
  assert.equal(
    d.body.classList.contains('reader-open'),
    false,
    'Explicit 3D entry shows the city, not the old reading anchor'
  );
  assert.equal(w.localStorage.getItem('kd.mode'), 'city');
  w.close();
  const saved = await interfacePage({ coarse: true, storedMode: 'city' });
  assert.equal(saved.d.body.classList.contains('scene-active'), true);
  saved.w.close();
});

test('phone reading sheets reset the document scroller and returning from 3D restores reading position', async () => {
  const { w, d, scrolls } = await interfacePage({ coarse: true });
  w.scrollY = 720;
  d.getElementById('mode-toggle').click();
  await new Promise(resolve => setImmediate(resolve));
  const link = d.querySelector('a[href="#publications"]');
  link.focus();
  link.click();
  assert.equal(scrolls.at(-1).top, 0);
  assert.equal(scrolls.at(-1).behavior, 'instant');
  assert.equal(d.getElementById('reader-toolbar').hidden, false);
  assert.equal(
    d.getElementById('reader-context').textContent,
    d.getElementById('publications-heading').textContent
  );
  d.getElementById('close-reader').click();
  assert.equal(d.getElementById('reader-toolbar').hidden, true);
  assert.equal(d.activeElement, link);
  d.getElementById('mode-toggle').click();
  assert.equal(d.body.classList.contains('scene-active'), false);
  assert.equal(scrolls.at(-1).top, 720);
  assert.equal(scrolls.at(-1).behavior, 'instant');
  assert.equal(d.getElementById('reader').hasAttribute('aria-modal'), false);
  assert.equal(d.getElementById('scene-shell').inert, false);
  w.close();
});

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
