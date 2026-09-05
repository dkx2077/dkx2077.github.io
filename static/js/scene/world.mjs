import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createEnvironment } from './environment.mjs';
import { createSigns } from './signs.mjs';
import { createLighting, createReflections } from './lighting.mjs';
import { createLookControls, direction, viewportFov, FIXED_POSITION, DISTRICTS } from './look.mjs';

export function createWorld(settings, callbacks = {}) {
  const world = document.getElementById('world');
  const shell = document.getElementById('scene-shell');
  const signLayer = document.getElementById('sign-layer');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const compact = matchMedia('(pointer: coarse)');
  const lowHardware =
    compact.matches ||
    navigator.connection?.saveData ||
    (navigator.deviceMemory && navigator.deviceMemory <= 4);
  let quality = settings.quality || 'auto';
  let low = quality === 'low' || (quality === 'auto' && lowHardware);
  let paused = reduced.matches;
  let suspended = false;
  let disposed = false;
  let dirty = true;
  let raf = 0;
  let last = 0;
  let elapsed = 0;
  let frames = 0;
  let frameTime = 0;
  const abort = new AbortController();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080b16);
  scene.fog = new THREE.FogExp2(0x111326, 0.0095);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 180);
  camera.position.set(...FIXED_POSITION);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: low ? 'low-power' : 'default',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setClearColor(0x080b16);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  world.appendChild(renderer.domElement);
  let reflections;
  try {
    reflections = createReflections(renderer, scene);
  } catch (error) {
    // Startup can fail before the caller receives dispose(); release this owned context here.
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    throw error;
  }
  const environment = createEnvironment(scene, {
    low,
    reducedMotion: paused,
    onInvalidate: requestFrame,
  });
  const signs = createSigns(scene, signLayer);
  const lighting = createLighting(scene);
  let composer = null;

  function configureEffects() {
    renderer.shadowMap.enabled = !low;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = !low;
    lighting.setQuality(low);
    if (composer) {
      for (const pass of composer.passes) pass.dispose?.();
      composer.dispose();
      composer = null;
    }
    if (!low) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      // Lower-emission saturated tubes get a compact halo without bleaching their colored core.
      const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.46, 0.3, 0.42);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
    }
  }
  function requestFrame() {
    dirty = true;
    if (!raf && !suspended && !document.hidden && !disposed) raf = requestAnimationFrame(frame);
  }
  const controls = createLookControls(shell, {
    minPitch: settings.pitchMin,
    maxPitch: settings.pitchMax,
    reducedMotion: () => reduced.matches,
    enabled: () => !suspended && !disposed,
    onChange: requestFrame,
    signal: abort.signal,
  });
  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    // A wider vertical field on portrait screens keeps the name and nearby signs in view.
    camera.fov = viewportFov(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1 : 1.5));
    renderer.setSize(width, height);
    composer?.setPixelRatio(renderer.getPixelRatio());
    composer?.setSize(width, height);
    signs.resize(width, height);
    requestFrame();
  }
  function frame(now) {
    raf = 0;
    if (suspended || document.hidden || disposed) {
      last = 0;
      return;
    }
    const dt = last ? Math.min((now - last) / 1000, 0.08) : 1 / 60;
    // Cap low quality to ~30 fps, including adaptive rendering after a slow start.
    if (low && last && now - last < 30 && !dirty) {
      raf = requestAnimationFrame(frame);
      return;
    }
    last = now;
    elapsed += paused ? 0 : dt;
    const moving = controls.update(dt);
    const vector = direction(controls.current.yaw, controls.current.pitch);
    camera.lookAt(
      camera.position.x + vector[0],
      camera.position.y + vector[1],
      camera.position.z + vector[2]
    );
    environment.update(elapsed, dt, !paused);
    if (composer) composer.render(dt);
    else renderer.render(scene, camera);
    signs.render(camera);
    const bearing = ((controls.current.yaw % 360) + 360) % 360;
    const display = `${String(Math.round(bearing) % 360).padStart(3, '0')}°`;
    const bearingElement = document.getElementById('bearing');
    if (bearingElement.textContent !== display) bearingElement.textContent = display;
    const nearest = Object.entries(DISTRICTS).reduce(
      (best, item) => {
        const distance = Math.abs(((bearing - item[1] + 540) % 360) - 180);
        return distance < best.distance ? { name: item[0], distance } : best;
      },
      { name: 'home', distance: 361 }
    ).name;
    document.querySelectorAll('[data-look]').forEach(button => {
      button.classList.toggle('active', button.dataset.look === nearest);
      button.setAttribute('aria-pressed', String(button.dataset.look === nearest));
    });
    // Desktop Auto drops expensive post-processing when the sustained frame budget is exceeded.
    if (quality === 'auto' && !low && !paused && elapsed > 2) {
      frameTime += dt;
      frames++;
      if (frames >= 120) {
        if (frameTime / frames > 0.038) {
          low = true;
          environment.setQuality(true);
          configureEffects();
          resize();
          callbacks.onQuality?.('low');
        }
        frames = 0;
        frameTime = 0;
      }
    }
    dirty = false;
    if ((!paused || moving) && !raf) raf = requestAnimationFrame(frame);
  }
  configureEffects();
  resize();
  window.addEventListener('resize', resize, { signal: abort.signal });
  document.addEventListener(
    'visibilitychange',
    () => {
      last = 0;
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else requestFrame();
    },
    { signal: abort.signal }
  );
  reduced.addEventListener(
    'change',
    event => {
      paused = event.matches;
      environment.setMotion(!paused);
      callbacks.onMotion?.(paused);
      requestFrame();
    },
    { signal: abort.signal }
  );
  renderer.domElement.addEventListener(
    'webglcontextlost',
    event => {
      event.preventDefault();
      callbacks.onFailure?.(
        'The 3D view was interrupted. All content is available in reading mode.'
      );
    },
    { signal: abort.signal }
  );
  return {
    lookAt(name) {
      controls.lookAt(DISTRICTS[name] ?? 0);
      requestFrame();
    },
    reset() {
      controls.lookAt(0);
      requestFrame();
    },
    setPaused(value) {
      paused = value;
      environment.setMotion(!paused);
      requestFrame();
    },
    get paused() {
      return paused;
    },
    setQuality(value) {
      quality = value;
      low = value === 'low' || (value === 'auto' && lowHardware);
      environment.setQuality(low);
      frames = 0;
      frameTime = 0;
      last = 0;
      configureEffects();
      resize();
    },
    suspend(value) {
      suspended = value;
      last = 0;
      if (value) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else requestFrame();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      abort.abort();
      environment.dispose();
      signs.dispose();
      lighting.dispose();
      reflections.dispose();
      const geometries = new Set(),
        materials = new Set(),
        textures = new Set();
      scene.traverse(object => {
        if (object.isInstancedMesh) object.dispose();
        if (object.geometry) geometries.add(object.geometry);
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          if (!material) continue;
          materials.add(material);
          for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
        }
      });
      geometries.forEach(x => x.dispose());
      materials.forEach(x => x.dispose());
      textures.forEach(x => x.dispose());
      composer?.passes.forEach(pass => pass.dispose?.());
      composer?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
