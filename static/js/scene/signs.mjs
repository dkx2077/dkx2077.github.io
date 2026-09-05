import * as THREE from 'three';
import { CSS3DObject, CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';

const PLACEMENTS = {
  name: { at: [-1.6, 7.2, -18.5], scale: 0.012, width: 840, height: 455 },
  'local-name': { at: [-10.8, 7.5, -12.5], scale: 0.012, width: 125, height: 340 },
  about: { at: [-5.5, 2.8, -12], scale: 0.009, width: 580, height: 210 },
  research: { at: [17.2, 6, -7.6], scale: 0.011, width: 790, height: 270 },
  featured: { at: [5.8, 3.5, -15], scale: 0.01, width: 620, height: 218 },
  direction: { at: [10.4, 8.6, -14.8], scale: 0.01, width: 300, height: 130 },
  awards: { at: [1.4, 6.3, 19], scale: 0.014, width: 700, height: 300 },
  work: { at: [-18.3, 5.5, 0.6], scale: 0.012, width: 680, height: 210 },
  contact: { at: [-13.7, 2.8, 9], scale: 0.011, width: 580, height: 210 },
  district: { at: [12.5, 9.5, 12], scale: 0.01, width: 480, height: 130 },
};
export function createSigns(worldScene, container) {
  const renderer = new CSS3DRenderer();
  renderer.domElement.style.pointerEvents = 'none';
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const fragment = document.getElementById('world-signs').content.cloneNode(true);
  const objects = [];
  const backing = new THREE.MeshStandardMaterial({
    color: 0x142526,
    metalness: 0.65,
    roughness: 0.6,
  });
  const rim = new THREE.MeshBasicMaterial({ color: 0x395b59 });
  for (const element of fragment.querySelectorAll('[data-sign]')) {
    const config = PLACEMENTS[element.dataset.sign];
    const object = new CSS3DObject(element);
    object.position.set(...config.at);
    object.lookAt(0, config.at[1], 0);
    object.scale.setScalar(config.scale);
    scene.add(object);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(object.quaternion);
    // The physically thick metal mounting plate sits behind the editable DOM face.
    if (element.dataset.sign !== 'name') {
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(
          config.width * config.scale + 0.15,
          config.height * config.scale + 0.15,
          0.14
        ),
        backing
      );
      plate.position.copy(object.position).addScaledVector(normal, -0.13);
      plate.quaternion.copy(object.quaternion);
      worldScene.add(plate);
      const bracket = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, config.height * config.scale + 0.8, 0.08),
        rim
      );
      bracket.position.copy(plate.position).addScaledVector(normal, -0.1);
      worldScene.add(bracket);
    }
    objects.push({ object, normal, element });
  }
  const toward = new THREE.Vector3();
  const forward = new THREE.Vector3();
  return {
    resize(width, height) {
      renderer.setSize(width, height);
    },
    render(camera) {
      camera.getWorldDirection(forward);
      for (const { object, element, normal } of objects) {
        toward.subVectors(object.position, camera.position).normalize();
        // Avoid mirrored backs and out-of-view keyboard targets. Fixed camera keeps all
        // mounting surfaces facing inward, with architecture behind them.
        const visible = toward.dot(forward) > 0.12 && toward.dot(normal) < -0.15;
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
