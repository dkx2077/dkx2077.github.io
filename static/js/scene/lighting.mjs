import * as THREE from 'three';
import { DISTRICT_LIGHTS, FACADE_LIGHTS } from './design.mjs';

/** A small, one-time reflection capture supplies colored highlights without an HDR download. */
export function createReflections(renderer, scene) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x070a16);
  const box = new THREE.BoxGeometry();
  const materials = [];
  for (const [at, size, color, intensity] of [
    // Narrow colored sources create reflections on metal edges instead of washing whole walls.
    [[-10, 6, 0], [0.15, 10, 1.5], '#08dfef', 2.4],
    [[10, 4, -2], [0.15, 8, 1.2], '#ed24b7', 2.5],
    [[0, 6, 11], [1.8, 5, 0.15], '#ff8d32', 1.25],
    [[0, 8, -11], [2, 9, 0.15], '#146fd9', 1.35],
    [[0, 14, 0], [9, 0.15, 7], '#333966', 0.3],
  ]) {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity),
    });
    materials.push(material);
    const panel = new THREE.Mesh(box, material);
    panel.position.set(...at);
    panel.scale.set(...size);
    studio.add(panel);
  }
  const generator = new THREE.PMREMGenerator(renderer);
  let target;
  try {
    target = generator.fromScene(studio, 0.04, 0.1, 40, { size: 128 });
    scene.environment = target.texture;
    scene.environmentIntensity = 0.28;
  } finally {
    generator.dispose();
    box.dispose();
    materials.forEach(material => material.dispose());
  }
  return {
    dispose() {
      scene.environment = null;
      target.dispose();
    },
  };
}

/** Real facade illumination; one reusable shadow map in High, no shadow passes in Low. */
export function createLighting(scene) {
  const group = new THREE.Group();
  group.name = 'district-lighting';
  scene.add(group);
  group.add(new THREE.HemisphereLight(0x3c476d, 0x0d0818, 0.24));

  // The elevated key reaches the inward-facing south and west walls as well as their roofs.
  const key = new THREE.DirectionalLight(0x6884bf, 0.9);
  key.name = 'architectural-key';
  key.position.set(30, 54, -32);
  key.target.position.set(0, 12, 0);
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, {
    left: -62,
    right: 62,
    top: 62,
    bottom: -62,
    near: 1,
    far: 160,
  });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.04;
  key.shadow.autoUpdate = false;
  group.add(key, key.target);

  const rim = new THREE.DirectionalLight(0x823d90, 0.38);
  rim.name = 'opposite-rooftop-fill';
  rim.position.set(-34, 26, 40);
  rim.target.position.set(0, 14, 0);
  group.add(rim, rim.target);
  for (const { color, power, reach, at } of DISTRICT_LIGHTS) {
    const light = new THREE.PointLight(color, power, reach, 2);
    light.position.set(...at);
    group.add(light);
  }
  for (const { color, power, at, target } of FACADE_LIGHTS) {
    const light = new THREE.SpotLight(color, power, 68, Math.PI * 0.225, 0.9, 2);
    light.position.set(...at);
    light.target.position.set(...target);
    group.add(light, light.target);
  }

  // The procedural wet-ground shader stays simple; this layer receives the key's shadows.
  const groundShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 180),
    new THREE.ShadowMaterial({ color: 0x020510, opacity: 0.32, depthWrite: false })
  );
  groundShadow.name = 'ground-shadow';
  groundShadow.rotation.x = -Math.PI / 2;
  groundShadow.position.y = 0.002;
  groundShadow.receiveShadow = true;
  scene.add(groundShadow);

  const surfaces = new Set();
  scene.traverse(object => {
    if (!object.isMesh || !object.material?.isMeshStandardMaterial) return;
    object.castShadow = true;
    object.receiveShadow = true;
    surfaces.add(object.material);
  });
  return {
    setQuality(low) {
      key.castShadow = !low;
      key.shadow.needsUpdate = !low;
      groundShadow.visible = !low;
      surfaces.forEach(material => {
        material.needsUpdate = true;
      });
    },
    dispose() {
      key.shadow.dispose();
      // Geometry and material disposal remains in the world's shared-resource cleanup.
    },
  };
}
