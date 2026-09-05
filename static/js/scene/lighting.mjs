import * as THREE from 'three';
import { DISTRICT_LIGHTS, FACADE_LIGHTS } from './design.mjs';

/** A small, one-time reflection capture supplies colored highlights without an HDR download. */
export function createReflections(renderer, scene) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x151b2c);
  const box = new THREE.BoxGeometry();
  const materials = [];
  for (const [at, size, color, intensity] of [
    [[-10, 6, 0], [0.15, 14, 12], '#67e4f0', 2.8],
    [[10, 4, -2], [0.15, 10, 8], '#ed87d6', 2.2],
    [[0, 6, 11], [12, 10, 0.15], '#ffc38a', 1.3],
    [[0, 8, -11], [14, 13, 0.15], '#8cb7f0', 2.1],
    [[0, 14, 0], [18, 0.15, 18], '#b9d7f2', 1.6],
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
    scene.environmentIntensity = 0.65;
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
  group.add(new THREE.HemisphereLight(0xa0b7da, 0x21182c, 0.65));

  // The elevated key reaches the inward-facing south and west walls as well as their roofs.
  const key = new THREE.DirectionalLight(0x9dc8eb, 3.2);
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

  const rim = new THREE.DirectionalLight(0xb487c6, 1.25);
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
    const light = new THREE.SpotLight(color, power, 78, Math.PI * 0.3, 0.85, 2);
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
