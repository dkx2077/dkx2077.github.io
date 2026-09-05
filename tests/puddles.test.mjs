import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { createPuddles, PUDDLE_LAYOUT } from '../static/js/scene/puddles.mjs';
import { SIGN_LAYOUT } from '../static/js/scene/design.mjs';

// CPU-only renderer boundary: exercises the real r185 Reflector camera/lifecycle,
// never pretends to compile shaders, draw pixels or measure GPU performance.
function fixture({ low = false, float = true } = {}) {
  const scene = new THREE.Scene();
  let now = 0;
  const puddles = createPuddles(scene, { low, clock: () => now });
  const water = scene.getObjectByName('rain-puddles');
  const camera = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 180);
  camera.position.set(0, 2.8, 0);
  camera.lookAt(7, 0, 9);
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const mainTarget = new THREE.WebGLRenderTarget(1440, 900);
  const viewport = new THREE.Vector4(0, 0, 1440, 900);
  let boundTarget = mainTarget;
  const captures = [];
  const renderer = {
    xr: { enabled: true },
    shadowMap: { autoUpdate: true },
    extensions: { has: () => float },
    autoClear: true,
    state: {
      buffers: { depth: { setMask() {} } },
      viewport: value => viewport.copy(value),
    },
    getCurrentViewport: value => value.copy(viewport),
    getRenderTarget: () => boundTarget,
    setRenderTarget(value) {
      boundTarget = value;
      viewport.copy(value.viewport);
    },
    render(renderedScene, mirroredCamera) {
      assert.equal(renderedScene, scene);
      assert.equal(water.visible, false, 'No recursive reflection capture');
      assert.equal(this.xr.enabled, false);
      assert.equal(this.shadowMap.autoUpdate, false);
      assert.equal(boundTarget, water.getRenderTarget());
      captures.push(mirroredCamera.clone());
    },
  };
  return {
    scene,
    puddles,
    water,
    camera,
    renderer,
    captures,
    mainTarget,
    viewport,
    tick(value) {
      now = value;
      water.onBeforeRender(renderer, scene, camera);
    },
    dispose() {
      puddles.dispose();
      mainTarget.dispose();
    },
  };
}

test('localized water patches share one upward-facing surface and one non-MSAA target', () => {
  const f = fixture();
  try {
    assert.equal(f.scene.children.length, 1);
    assert.equal(f.water.geometry.index.count, PUDDLE_LAYOUT.length * 6);
    assert.equal(f.water.getRenderTarget().samples, 0);
    assert.equal(f.water.getRenderTarget().width, 512);
    assert.equal(f.water.material.depthWrite, false);
    for (let i = 0; i < f.water.geometry.attributes.normal.count; i++) {
      const normal = new THREE.Vector3()
        .fromBufferAttribute(f.water.geometry.attributes.normal, i)
        .transformDirection(f.water.matrixWorld);
      assert.ok(normal.y > 0.999, 'Front face is visible from above, never the reverse side');
    }
    assert.ok(
      PUDDLE_LAYOUT.some(([x, z]) => x > 5 && z > 5),
      'Scholar corner has a pool'
    );
    const area = PUDDLE_LAYOUT.reduce((sum, [, , w, d]) => sum + Math.PI * w * d, 0);
    assert.ok(area < Math.PI * 14 * 14 * 0.2, 'Most courtyard paving stays rough, not mirror-like');
  } finally {
    f.dispose();
  }
});

test('real Reflector mirrors the camera, clips the water plane and throttles paired captures', () => {
  const f = fixture();
  try {
    f.tick(0);
    assert.equal(f.captures.length, 1);
    assert.ok(Math.abs(f.captures[0].position.y - (2 * f.water.position.y - 2.8)) < 1e-6);
    assert.notDeepEqual(
      f.captures[0].projectionMatrix.elements,
      f.camera.projectionMatrix.elements
    );
    assert.equal(f.water.material.uniforms.captured.value, 1);
    const matrix = f.water.material.uniforms.textureMatrix.value.clone();
    f.camera.lookAt(-7, 0, 9);
    f.camera.updateMatrixWorld(true);
    f.tick(20);
    assert.equal(f.captures.length, 1);
    assert.deepEqual(
      f.water.material.uniforms.textureMatrix.value.elements,
      matrix.elements,
      'Cached image must not be projected with an uncaptured camera matrix'
    );
    f.tick(51);
    assert.equal(f.captures.length, 2);
    assert.notDeepEqual(f.water.material.uniforms.textureMatrix.value.elements, matrix.elements);
    f.puddles.invalidate();
    f.tick(52);
    assert.equal(f.captures.length, 3, 'Resize or asynchronous skyline load refreshes immediately');
    assert.equal(f.renderer.getRenderTarget(), f.mainTarget);
    assert.equal(f.renderer.xr.enabled, true);
    assert.equal(f.renderer.shadowMap.autoUpdate, true);
    assert.deepEqual(f.viewport.toArray(), [0, 0, 1440, 900]);
  } finally {
    f.dispose();
  }
});

test('water placement catches the reflection footprints of the main district light rails', () => {
  const waterY = 0.014;
  for (const key of ['about', 'featured', 'research', 'awards', 'work', 'contact', 'scholar']) {
    const sign = SIGN_LAYOUT[key];
    for (const side of [-1, 1]) {
      const lightY = sign.at[1] + side * ((sign.height * sign.scale) / 2 + 0.055);
      // Intersect camera-to-mirrored-light with y=waterY (not the light's x/z footprint).
      const fraction = (2.8 - waterY) / (2.8 + lightY - 2 * waterY);
      const point = [sign.at[0] * fraction, sign.at[2] * fraction];
      const covered = PUDDLE_LAYOUT.some(([x, z, width, depth, angle]) => {
        const dx = point[0] - x,
          dz = point[1] - z;
        const u = (dx * Math.cos(angle) + dz * Math.sin(angle)) / width;
        const v = (-dx * Math.sin(angle) + dz * Math.cos(angle)) / depth;
        return Math.hypot(u, v) < 0.8;
      });
      assert.ok(covered, `${key} ${side < 0 ? 'lower' : 'upper'} rail reaches a pool interior`);
    }
  }
});

test('Low releases the full-size target, skips captures and High resumes; teardown is idempotent', () => {
  const f = fixture();
  const releases = { target: 0, material: 0, geometry: 0 };
  f.water.getRenderTarget().addEventListener('dispose', () => releases.target++);
  f.water.material.addEventListener('dispose', () => releases.material++);
  f.water.geometry.addEventListener('dispose', () => releases.geometry++);
  f.tick(0);
  f.puddles.setQuality(true);
  assert.equal(f.water.getRenderTarget().width, 1);
  assert.equal(releases.target, 1, 'Dropping quality releases the allocated large target');
  assert.equal(f.water.material.uniforms.captured.value, 0);
  f.tick(1000);
  assert.equal(f.captures.length, 1);
  f.puddles.update(3);
  assert.equal(f.water.material.uniforms.time.value, 3, 'Lightweight ripples still update');
  f.puddles.setQuality(false);
  assert.equal(f.water.getRenderTarget().width, 512);
  f.tick(1001);
  assert.equal(f.captures.length, 2);
  f.puddles.dispose();
  f.puddles.dispose();
  assert.equal(f.scene.children.length, 0);
  assert.equal(releases.geometry, 1);
  assert.equal(releases.material, 1);
  assert.equal(releases.target, 3, 'Two resizes and exactly one teardown');
  f.tick(2000);
  assert.equal(f.captures.length, 2);
  f.mainTarget.dispose();
});

test('looking above the street skips capture and initial Low owns no full-size target', () => {
  const f = fixture({ low: true });
  try {
    assert.equal(f.water.getRenderTarget().width, 1);
    f.tick(0);
    assert.equal(f.captures.length, 0);
    f.puddles.setQuality(false);
    f.camera.lookAt(0, 100, -10);
    f.camera.updateMatrixWorld(true);
    f.tick(100);
    assert.equal(f.captures.length, 0, 'No capture when all individual pool bounds are offscreen');
    f.camera.lookAt(7, 0, 9);
    f.camera.updateMatrixWorld(true);
    f.tick(200);
    assert.equal(f.captures.length, 1);
  } finally {
    f.dispose();
  }
});

test('unsupported float color uses byte capture; optional capture errors restore main renderer state', () => {
  const f = fixture({ float: false });
  const warn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  try {
    f.tick(0);
    assert.equal(f.water.getRenderTarget().texture.type, THREE.UnsignedByteType);
    f.renderer.render = () => {
      throw new Error('optional capture failed');
    };
    f.tick(100);
    assert.equal(warnings.length, 1);
    assert.equal(f.water.material.uniforms.captured.value, 0);
    assert.equal(f.water.getRenderTarget().width, 1);
    assert.equal(f.water.material.uniforms.lightweight.value, 1);
    assert.equal(f.water.visible, true);
    assert.equal(f.renderer.getRenderTarget(), f.mainTarget);
    assert.equal(f.renderer.xr.enabled, true);
    assert.equal(f.renderer.shadowMap.autoUpdate, true);
    assert.deepEqual(f.viewport.toArray(), [0, 0, 1440, 900]);
    f.tick(200);
    f.puddles.setQuality(false);
    f.tick(300);
    assert.equal(f.water.material.uniforms.lightweight.value, 1);
    assert.equal(warnings.length, 1, 'Do not retry a failed optional capture every frame');
  } finally {
    console.warn = warn;
    f.dispose();
  }
});
