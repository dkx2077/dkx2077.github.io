import * as THREE from 'three';
import { CSS3DObject, CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';
import { SIGN_LAYOUT } from './design.mjs';

export function createSigns(worldScene, container) {
  const renderer = new CSS3DRenderer();
  renderer.domElement.style.pointerEvents = 'none';
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const fragment = document.getElementById('world-signs').content.cloneNode(true);
  const objects = [];
  const box = new THREE.BoxGeometry(1, 1, 1);
  const metal = new THREE.MeshStandardMaterial({
    color: 0x24313e,
    metalness: 0.82,
    roughness: 0.42,
  });
  const enamel = new THREE.MeshStandardMaterial({
    color: 0x090f1a,
    metalness: 0.38,
    roughness: 0.6,
  });
  const mount = (parent, material, x, y, z, width, height, depth) => {
    const mesh = new THREE.Mesh(box, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(width, height, depth);
    parent.add(mesh);
    return mesh;
  };
  for (const element of fragment.querySelectorAll('[data-sign]')) {
    const config = SIGN_LAYOUT[element.dataset.sign];
    element.style.setProperty('--face-width', `${config.width}px`);
    element.style.setProperty('--face-height', `${config.height}px`);
    const color = new THREE.Color(config.color);
    const rgb = color.clone().convertLinearToSRGB();
    element.style.setProperty(
      '--neon-rgb',
      `${Math.round(rgb.r * 255)},${Math.round(rgb.g * 255)},${Math.round(rgb.b * 255)}`
    );
    const object = new CSS3DObject(element);
    object.position.set(...config.at);
    object.lookAt(0, config.at[1], 0);
    object.scale.setScalar(config.scale);
    scene.add(object);
    object.updateMatrixWorld(true);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(object.quaternion);
    const w = config.width * config.scale,
      h = config.height * config.scale;
    if (element.dataset.sign !== 'name') {
      const housing = new THREE.Group();
      housing.name = `sign:${element.dataset.sign}`;
      housing.position.copy(object.position);
      housing.quaternion.copy(object.quaternion);
      worldScene.add(housing);
      mount(housing, metal, 0, 0, -0.18, w + 0.2, h + 0.2, 0.3);
      mount(housing, enamel, 0, 0, -0.016, w, h, 0.024);
      // Recessed luminous rails belong to the same 3D housing as the lettering.
      const tube = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(1.6) });
      mount(housing, tube, 0, h / 2 + 0.055, 0.003, w + 0.12, 0.035, 0.035);
      mount(housing, tube, 0, -h / 2 - 0.055, 0.003, w + 0.12, 0.025, 0.035);
      for (const side of [-1, 1]) {
        mount(housing, metal, side * w * 0.35, 0, -0.32, 0.08, h + 0.62, 0.09);
        mount(housing, metal, side * w * 0.35, h / 2 + 0.26, -0.62, 0.08, 0.08, 0.68);
      }
    }
    // Static bounds include the entire letter face. Frustum checks hide truly offscreen links.
    const bounds = new THREE.Box3(
      new THREE.Vector3(-config.width / 2, -config.height / 2, -1),
      new THREE.Vector3(config.width / 2, config.height / 2, 1)
    ).applyMatrix4(object.matrixWorld);
    const atmosphericOpacity = Math.max(0.78, 1 - object.position.length() * 0.0045);
    element.style.opacity = String(atmosphericOpacity);
    objects.push({ object, normal, element, bounds });
  }
  const toward = new THREE.Vector3();
  const frustum = new THREE.Frustum();
  const projection = new THREE.Matrix4();
  return {
    resize(width, height) {
      renderer.setSize(width, height);
    },
    render(camera) {
      camera.updateMatrixWorld();
      projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projection);
      for (const { object, element, normal, bounds } of objects) {
        toward.subVectors(object.position, camera.position).normalize();
        const visible = frustum.intersectsBox(bounds) && toward.dot(normal) < -0.15;
        element.style.visibility = visible ? 'visible' : 'hidden';
        element.inert = !visible;
      }
      renderer.render(scene, camera);
    },
    dispose() {
      renderer.domElement.remove();
    },
  };
}
