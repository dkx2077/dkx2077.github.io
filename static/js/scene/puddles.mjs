import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { DISTRICT_LIGHTS } from './design.mjs';

// World-space x/z, half-width/depth, rotation. Small pools leave rough paving between them.
export const PUDDLE_LAYOUT = [
  [-0.4, -4.9, 1.05, 0.65, -0.12],
  [-2.86, -6.24, 1.85, 0.85, 1.14],
  [2.65, -6.9, 1.8, 1.9, 0.35],
  [5.55, -2.45, 1.75, 1.5, 1.15],
  [0.5, 6.2, 2.1, 1.85, -0.07],
  [-6.4, 0.2, 1.75, 1.5, 1.54],
  [-7.26, 4.77, 2.7, 1, 2.56],
  [2.86, 2.74, 1.35, 0.9, 2.35],
  [-5.8, -10.8, 1.4, 0.85, -0.35],
  [3.5, -11.6, 2.1, 0.85, 0.1],
  [6.3, 10.9, 1.3, 1.7, 0.25],
  [-3.8, 11.5, 2, 0.9, -0.2],
];

function puddleGeometry() {
  const positions = [],
    uvs = [],
    indices = [];
  PUDDLE_LAYOUT.forEach(([x, z, width, depth, angle], i) => {
    const c = Math.cos(angle),
      s = Math.sin(angle);
    for (const [u, v] of [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]) {
      const dx = (u * 2 - 1) * width,
        dz = (v * 2 - 1) * depth;
      // Reflector faces local +Z; rotate the shared plane upward in createPuddles().
      positions.push(x + dx * c - dz * s, -(z + dx * s + dz * c), 0);
      uvs.push(u, v);
    }
    const k = i * 4;
    indices.push(k, k + 2, k + 1, k, k + 3, k + 2);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

const waterShader = {
  name: 'RainPuddles',
  uniforms: {
    tDiffuse: { value: null },
    color: { value: null },
    textureMatrix: { value: null },
    time: { value: 0 },
    captured: { value: 0 },
    lightweight: { value: 0 },
    texel: { value: new THREE.Vector2(1 / 512, 1 / 512) },
    lightPositions: { value: DISTRICT_LIGHTS.map(light => new THREE.Vector3(...light.at)) },
    lightColors: { value: DISTRICT_LIGHTS.map(light => new THREE.Color(light.color)) },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vReflection;
    varying vec3 vWorld;
    varying vec2 vPool;
    void main() {
      vReflection = textureMatrix * vec4(position, 1.0);
      vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      vPool = uv * 2.0 - 1.0;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time, captured, lightweight;
    uniform vec2 texel;
    uniform vec3 lightPositions[${DISTRICT_LIGHTS.length}];
    uniform vec3 lightColors[${DISTRICT_LIGHTS.length}];
    varying vec4 vReflection;
    varying vec3 vWorld;
    varying vec2 vPool;
    #include <common>

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
        mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }
    // Local rain impacts: a moving ring and its decaying normal, not an ocean sine wave.
    vec3 impacts(vec2 p) {
      vec3 wave = vec3(0.0);
      vec2 cell = floor(p / 1.25);
      for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
          if (lightweight > 0.5 && (x != 0 || y != 0)) continue;
          vec2 id = cell + vec2(float(x), float(y));
          float seed = hash(id);
          float cycle = time * 0.95 + seed * 13.0;
          float age = fract(cycle);
          vec2 center = (id + 0.2 + 0.6 * vec2(hash(id + floor(cycle)), seed)) * 1.25;
          vec2 delta = p - center;
          float distanceToDrop = length(delta);
          float front = distanceToDrop - age * 0.58;
          float envelope = exp(-front * front * 700.0)
            * smoothstep(0.0, 0.06, age) * (1.0 - age) * (1.0 - age);
          wave.xy += delta / max(distanceToDrop, 0.01) * cos(front * 90.0) * envelope;
          wave.z += max(0.0, sin(front * 90.0)) * envelope;
        }
      }
      return wave;
    }
    void main() {
      vec2 p = vWorld.xz;
      float shore = length(vPool) + (noise(p * 1.7) - 0.5) * 0.24
        + (noise(p * 4.3) - 0.5) * 0.06;
      float mask = 1.0 - smoothstep(0.77, 0.98, shore);
      if (mask < 0.008) discard;

      vec3 wave = impacts(p);
      vec2 wind = vec2(sin(p.y * 13.0 + time * 2.0), cos(p.x * 11.0 - time * 1.5)) * 0.018;
      vec3 normal = normalize(vec3(wave.x * 0.15 + wind.x, 1.0, wave.y * 0.15 + wind.y));
      vec3 view = normalize(cameraPosition - vWorld);
      float fresnel = 0.025 + 0.975 * pow(1.0 - max(dot(normal, view), 0.0), 5.0);
      vec3 tint = vec3(0.0), streaks = vec3(0.0);
      for (int i = 0; i < ${DISTRICT_LIGHTS.length}; i++) {
        vec2 axis = normalize(lightPositions[i].xz);
        float across = abs(p.x * axis.y - p.y * axis.x);
        float along = dot(p, axis);
        float spread = exp(-across * across / (0.35 + max(along, 0.0) * 0.11));
        float reach = smoothstep(0.0, 3.0, along) * exp(-length(p - lightPositions[i].xz) * 0.085);
        tint += lightColors[i] * exp(-length(p - lightPositions[i].xz) * 0.12);
        streaks += lightColors[i] * spread * reach
          * (0.55 + 0.45 * sin(p.y * 35.0 + wave.x * 5.0 + time * 1.3));
      }
      vec3 reflected = streaks * 0.45;
      if (captured > 0.5 && vReflection.w > 0.0) {
        vec2 projected = vReflection.xy / vReflection.w;
        vec2 uv = projected + (wave.xy * 0.0025 + wind * 0.015) * mask;
        float edge = min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y));
        float valid = smoothstep(0.0, 0.04, edge);
        uv = clamp(uv, texel * 3.0, 1.0 - texel * 3.0);
        vec2 blur = texel * (0.8 + 1.4 * (1.0 - mask));
        vec3 mirror = texture2D(tDiffuse, uv).rgb * 0.4;
        mirror += texture2D(tDiffuse, uv + vec2(blur.x, 0)).rgb * 0.15;
        mirror += texture2D(tDiffuse, uv - vec2(blur.x, 0)).rgb * 0.15;
        mirror += texture2D(tDiffuse, uv + vec2(0, blur.y)).rgb * 0.15;
        mirror += texture2D(tDiffuse, uv - vec2(0, blur.y)).rgb * 0.15;
        reflected = mix(reflected, mirror, valid);
      }
      vec3 water = vec3(0.004, 0.008, 0.014) + tint * 0.007;
      water += reflected * (0.14 + fresnel * 0.86);
      water += tint * wave.z * 0.085 * mask;
      // A restrained wet meniscus, lit by the same district colors as the architecture.
      water += tint * 0.016 * smoothstep(0.70, 0.9, shore);
      gl_FragColor = vec4(water, mask * 0.9);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};

/** One reflection camera/target for every puddle. Low never captures the scene. */
export function createPuddles(scene, { low = false, clock = () => performance.now() } = {}) {
  const geometry = puddleGeometry();
  const water = new Reflector(geometry, {
    textureWidth: low ? 1 : 512,
    textureHeight: low ? 1 : 512,
    multisample: 0,
    clipBias: 0.003,
    shader: waterShader,
  });
  water.name = 'rain-puddles';
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.014;
  water.material.transparent = true;
  water.material.depthWrite = false;
  const uniforms = water.material.uniforms;
  const target = water.getRenderTarget();
  const capture = water.onBeforeRender.bind(water);
  const viewport = new THREE.Vector4();
  let lastCapture = -Infinity;
  let disposed = false;
  let failed = false;
  let checkedFormat = false;
  uniforms.lightweight.value = low ? 1 : 0;
  scene.add(water);
  water.updateMatrixWorld(true);
  const point = new THREE.Vector3();
  const bounds = PUDDLE_LAYOUT.map((_, i) => {
    const box = new THREE.Box3();
    for (let j = 0; j < 4; j++) {
      point
        .fromBufferAttribute(geometry.attributes.position, i * 4 + j)
        .applyMatrix4(water.matrixWorld);
      box.expandByPoint(point);
    }
    return box;
  });
  const frustum = new THREE.Frustum();
  const projection = new THREE.Matrix4();

  water.onBeforeRender = (renderer, renderedScene, camera) => {
    if (low || disposed || failed) return;
    const now = clock();
    // The matrix stays paired with its captured image between updates, even while turning.
    if (now - lastCapture < 50) return;
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projection);
    if (!bounds.some(box => frustum.intersectsBox(box))) return;
    if (!checkedFormat) {
      target.texture.type = renderer.extensions.has('EXT_color_buffer_float')
        ? THREE.HalfFloatType
        : THREE.UnsignedByteType;
      checkedFormat = true;
    }
    const previousTarget = renderer.getRenderTarget();
    const previousXr = renderer.xr.enabled;
    const previousShadows = renderer.shadowMap.autoUpdate;
    renderer.getCurrentViewport(viewport);
    try {
      capture(renderer, renderedScene, camera);
      uniforms.captured.value = 1;
      lastCapture = now;
    } catch (error) {
      // Reflection is optional: keep the city usable if this additional capture fails.
      failed = true;
      uniforms.captured.value = 0;
      uniforms.lightweight.value = 1;
      target.setSize(1, 1);
      console.warn('Puddle reflection unavailable; using lightweight water.', error);
    } finally {
      water.visible = true;
      renderer.xr.enabled = previousXr;
      renderer.shadowMap.autoUpdate = previousShadows;
      renderer.setRenderTarget(previousTarget);
      renderer.state.viewport(viewport);
    }
  };

  return {
    update(time) {
      uniforms.time.value = time;
    },
    invalidate() {
      lastCapture = -Infinity;
    },
    setQuality(value) {
      low = value;
      uniforms.lightweight.value = low || failed ? 1 : 0;
      uniforms.captured.value = 0;
      const size = low || failed ? 1 : 512;
      target.setSize(size, size);
      uniforms.texel.value.set(1 / size, 1 / size);
      lastCapture = -Infinity;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      water.removeFromParent();
      water.dispose();
      geometry.dispose();
    },
  };
}
