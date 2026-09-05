import * as THREE from 'three';
import { DISTRICT_LIGHTS } from './design.mjs';

/** Instanced architecture, no shadow maps, and a single lightweight ground shader. */
export function createEnvironment(scene, { low, reducedMotion, onInvalidate = () => {} }) {
  let seed = 2077;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const metal = new THREE.MeshStandardMaterial({
    color: 0x26313d,
    roughness: 0.48,
    metalness: 0.68,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x101724,
    roughness: 0.76,
    metalness: 0.35,
  });
  const trim = new THREE.MeshStandardMaterial({ color: 0x485363, roughness: 0.34, metalness: 0.8 });
  const cyan = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#54dfed').multiplyScalar(2.4),
  });
  const violet = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#d575dd').multiplyScalar(2.4),
  });
  const amber = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#f1b46a').multiplyScalar(2.2),
  });
  const muted = new THREE.MeshBasicMaterial({ color: 0x203b42 });
  // Window interiors stay below the bloom threshold; only architectural rails glow strongly.
  const coolWindow = new THREE.MeshBasicMaterial({ color: 0x4d8f9f });
  const warmWindow = new THREE.MeshBasicMaterial({ color: 0xb78654 });
  const violetWindow = new THREE.MeshBasicMaterial({ color: 0x8b639f });
  const addBox = (parent, position, size, material = metal) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.scale.set(...size);
    parent.add(mesh);
    return mesh;
  };
  const tube = (parent, points, material = trim, radius = 0.035) => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, radius, 5, false), material);
    parent.add(mesh);
    return mesh;
  };
  const windows = [];
  const buildings = [];
  // Distant silhouettes have staggered depth and roof heights in every direction.
  for (let i = 0; i < 66; i++) {
    const angle = (i / 66) * Math.PI * 2;
    const radius = 32 + random() * 35;
    const width = 4 + random() * 7;
    const height = 10 + random() * 40;
    const depth = 4 + random() * 5;
    const x = Math.sin(angle) * radius;
    const z = -Math.cos(angle) * radius;
    // Only the two sides facing our fixed observation point need lit windows.
    const faceZ = z < 0 ? 1 : -1;
    const faceX = x < 0 ? 1 : -1;
    buildings.push({ x, y: height / 2 - 0.2, z, width, height, depth });
    for (let row = 2; row < height - 1; row += 1.8) {
      for (let column = -width / 2 + 0.7; column < width / 2 - 0.3; column += 1.5) {
        if (Math.abs(z) <= depth / 2) continue;
        if (random() > 0.52) continue;
        windows.push({
          x: x + column,
          y: row,
          z: z + faceZ * (depth / 2 + 0.02),
          color: [0x83d5e1, 0x486a91, 0xc88abd, 0xd5a66f][Math.floor(random() * 4)],
        });
      }
      for (let column = -depth / 2 + 0.7; column < depth / 2 - 0.3; column += 1.5) {
        if (Math.abs(x) <= width / 2) continue;
        if (random() > 0.52) continue;
        windows.push({
          x: x + faceX * (width / 2 + 0.02),
          y: row,
          z: z + column,
          side: true,
          color: random() > 0.6 ? 0x8b5c9d : 0x3d748c,
        });
      }
    }
  }
  const bodyInstances = new THREE.InstancedMesh(geometry, dark, buildings.length);
  bodyInstances.name = 'distant-buildings';
  const dummy = new THREE.Object3D();
  buildings.forEach((b, i) => {
    dummy.position.set(b.x, b.y, b.z);
    dummy.scale.set(b.width, b.height, b.depth);
    dummy.updateMatrix();
    bodyInstances.setMatrixAt(i, dummy.matrix);
  });
  scene.add(bodyInstances);
  const windowInstances = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
    windows.length
  );
  windowInstances.name = 'distant-windows';
  windows.forEach((w, i) => {
    dummy.position.set(w.x, w.y, w.z);
    dummy.scale.set(w.side ? 0.025 : 0.38, 0.72, w.side ? 0.38 : 0.025);
    dummy.updateMatrix();
    windowInstances.setMatrixAt(i, dummy.matrix);
    windowInstances.setColorAt(i, new THREE.Color(w.color));
  });
  scene.add(windowInstances);

  // Open courtyard: walkways and foreground facades sit behind their inward-facing signs.
  function facade(angle, width, height, distance, accent) {
    const group = new THREE.Group();
    group.rotation.y = angle;
    group.position.set(Math.sin(angle) * -distance, 0, Math.cos(angle) * -distance);
    scene.add(group);
    addBox(group, [0, height / 2, -1.8], [width, height, 3.6], metal);
    addBox(group, [0, 0.23, 1], [width + 0.8, 0.46, 3], trim);
    addBox(group, [0, 5.1, 0.8], [width + 0.4, 0.28, 2], dark);
    addBox(group, [0, 5.22, 1.7], [width, 0.055, 0.065], accent);
    addBox(group, [0, height - 0.2, 0.12], [width, 0.2, 0.35], trim);
    for (let x = -width / 2 + 0.5; x < width / 2; x += 3.1) {
      addBox(group, [x, 2.2, 0.08], [0.17, 4.4, 0.4], trim);
      addBox(group, [x + 1.1, 2.15, 0.1], [1.85, 3.25, 0.12], dark);
      for (let row = 0; row < 7; row++)
        addBox(group, [x + 1.1, 0.85 + row * 0.33, 0.22], [1.77, 0.045, 0.045], muted);
      addBox(group, [x, 7.3, 0.04], [0.08, 3.7, 0.12], trim);
    }
    for (let x = -width / 2 + 1; x < width / 2; x += 2.4) {
      addBox(group, [x, 9, 0.07], [1.3, 1.8, 0.12], dark);
      addBox(group, [x, 8.25, 0.16], [1.3, 0.05, 0.06], accent);
      for (let y = 12; y < height - 2; y += 2.1) {
        addBox(group, [x, y, 0.15], [1.2, 1.25, 0.08], random() > 0.35 ? coolWindow : muted);
        addBox(group, [x, y - 0.7, 0.2], [1.4, 0.07, 0.15], trim);
      }
    }
    // Service conduits, ventilation ribs and rooftop aerials catch the local neon.
    for (let x = -width / 2 + 0.9; x < width / 2; x += 4.7) {
      addBox(group, [x, height * 0.52, 0.25], [0.09, height * 0.88, 0.1], trim);
      addBox(group, [x + 0.16, height * 0.52, 0.23], [0.05, height * 0.88, 0.08], trim);
      addBox(group, [x + 0.75, height - 1.25, 0.32], [1.05, 1.15, 0.65], dark);
      for (let j = 0; j < 5; j++)
        addBox(group, [x + 0.75, height - 1.65 + j * 0.2, 0.68], [0.85, 0.045, 0.05], trim);
      addBox(group, [x, height + 1.25, -1.2], [0.045, 2.5, 0.045], trim);
      addBox(group, [x, height + 0.95, -1.2], [0.9, 0.035, 0.035], trim);
      addBox(group, [x, height + 2.48, -1.2], [0.065, 0.08, 0.065], accent);
    }
    // Recessed vertical lighting gives the blank metal facades a readable silhouette.
    addBox(group, [-width / 2 + 0.1, height * 0.62, 0.19], [0.045, height * 0.55, 0.055], accent);
    return group;
  }
  facade(0, 17, 13, 20, cyan);
  facade(-1.15, 15, 16, 21, cyan);
  facade(Math.PI, 17, 12, 21, amber);
  facade(1.5, 15, 15, 21, violet);
  // Near side wings frame the entry view without blocking the open sky.
  const leftWing = facade(0.4, 5.8, 19, 16, cyan);
  leftWing.position.x = -13.2;
  const rightWing = facade(-0.5, 5.5, 17, 16, violet);
  rightWing.position.x = 13.5;

  // Fill the open southwest sector between Awards and Work with an inward-facing corner block.
  const corner = facade((Math.PI * 3) / 4, 13, 24, 28, violet);
  corner.name = 'southwest-corner';

  // Two deeper streets: stepped towers and glazed bridges rise above the existing shopfronts.
  // Every new front is outside the sign ring, keeping editable lettering unobstructed.
  function rearDistrict(name, angle, accent, windowMaterial, bridgeHeight, towers) {
    const block = new THREE.Group();
    block.name = name;
    block.rotation.y = angle;
    scene.add(block);
    for (const [x, distance, width, height, depth] of towers) {
      const z = -distance;
      const front = z + depth / 2;
      addBox(block, [x, height / 2, z], [width, height, depth], metal);
      addBox(block, [x, height + 1.25, z - 0.6], [width * 0.64, 2.5, depth * 0.68], dark);
      addBox(block, [x, height + 2.65, z - 0.6], [width * 0.69, 0.24, depth * 0.72], trim);
      addBox(block, [x + width * 0.2, height + 4.4, z], [0.065, 3.6, 0.065], trim);
      addBox(block, [x + width * 0.2, height + 6.2, z], [0.1, 0.16, 0.1], accent);
      for (const side of [-1, 1]) {
        addBox(
          block,
          [x + side * (width / 2 - 0.22), height / 2, front + 0.09],
          [0.14, height, 0.18],
          trim
        );
        addBox(
          block,
          [x + side * (width / 2 - 0.38), height * 0.72, front + 0.2],
          [0.045, height * 0.38, 0.04],
          accent
        );
      }
      for (let y = 3; y < height - 1; y += 1.85) {
        for (let column = -width / 2 + 0.9; column < width / 2 - 0.6; column += 1.25) {
          const lit = random();
          addBox(
            block,
            [x + column, y, front + 0.055],
            [0.64, 1.05, 0.035],
            lit > 0.48 ? windowMaterial : lit > 0.26 ? coolWindow : muted
          );
        }
        const sideX = x + (x < 0 ? 1 : -1) * (width / 2 + 0.055);
        for (let column = -depth / 2 + 0.8; column < depth / 2 - 0.5; column += 1.4) {
          addBox(
            block,
            [sideX, y, z + column],
            [0.035, 1.05, 0.6],
            random() > 0.55 ? coolWindow : muted
          );
        }
        if (Math.round(y / 1.85) % 4 === 0)
          addBox(block, [x, y - 0.7, front + 0.12], [width + 0.2, 0.12, 0.3], trim);
      }
      // A vertical utility duct and staggered maintenance balconies break up the window grid.
      addBox(
        block,
        [x + width / 2 + 0.22, height * 0.45, z + depth / 2 - 0.35],
        [0.36, height * 0.9, 0.45],
        dark
      );
      for (let y = 9; y < height - 3; y += 7.5) {
        addBox(block, [x - width * 0.22, y, front + 0.45], [width * 0.45, 0.16, 0.95], trim);
        addBox(
          block,
          [x - width * 0.22, y + 0.65, front + 0.85],
          [width * 0.45, 0.055, 0.055],
          accent
        );
      }
    }
    const bridgeZ = -30.3;
    addBox(block, [0, bridgeHeight, bridgeZ], [25, 0.38, 2.4], trim);
    addBox(block, [0, bridgeHeight + 2.1, bridgeZ], [25, 0.25, 2.4], dark);
    addBox(block, [0, bridgeHeight - 0.16, bridgeZ + 1.22], [25, 0.055, 0.055], accent);
    for (let x = -12; x <= 12; x += 1.5) {
      addBox(block, [x, bridgeHeight + 1.05, bridgeZ + 1.14], [0.08, 1.9, 0.12], trim);
      if (x < 12)
        addBox(
          block,
          [x + 0.75, bridgeHeight + 1.05, bridgeZ + 1.07],
          [1.32, 1.65, 0.045],
          x % 3 === 0 ? windowMaterial : muted
        );
    }
    // Ground-level service gantry and a hanging cable add depth below the high bridge.
    for (const x of [-10.5, 10.5]) addBox(block, [x, 4.1, -24.5], [0.18, 8.2, 0.18], trim);
    addBox(block, [0, 8.2, -24.5], [21.2, 0.18, 0.22], dark);
    addBox(block, [0, 8.08, -24.36], [20.8, 0.035, 0.035], accent);
    tube(
      block,
      [
        [-11, 10.2, -26],
        [0, 9.1, -25],
        [11, 10.8, -26],
      ],
      dark,
      0.03
    );
  }
  rearDistrict('awards-street', Math.PI, amber, warmWindow, 15, [
    [-12, 31, 7, 28, 6],
    [11, 33, 8, 35, 6],
    [-4, 45, 7, 47, 7],
    [19, 43, 8, 38, 8],
  ]);
  rearDistrict('work-street', Math.PI / 2, violet, violetWindow, 17, [
    [-11, 32, 8, 33, 7],
    [12, 34, 7, 27, 7],
    [3, 44, 9, 44, 8],
    [-19, 46, 7, 39, 6],
  ]);
  // Steel gantry, hanging cables, utility pipes, and suspended fixtures.
  addBox(scene, [-10.7, 7.5, -11], [0.15, 15, 0.15], trim);
  addBox(scene, [-10.7, 11.8, -12.8], [0.15, 0.15, 3.8], trim);
  addBox(scene, [-10.7, 11.65, -11], [0.2, 0.07, 2.1], cyan);
  tube(
    scene,
    [
      [-16, 12, -12],
      [-7, 10.6, -15],
      [2, 10.1, -16],
      [16, 12.4, -11],
    ],
    dark,
    0.048
  );
  tube(
    scene,
    [
      [-16, 11.7, -12],
      [-7, 10, -14],
      [2, 9.8, -15],
      [16, 12.1, -11],
    ],
    trim,
    0.018
  );
  tube(
    scene,
    [
      [-12.4, 0, -14],
      [-12.4, 6, -14],
      [-12, 6.5, -14],
      [-11, 6.5, -14],
    ],
    trim,
    0.1
  );
  tube(
    scene,
    [
      [13.5, 0, -13],
      [13.5, 6.8, -13],
      [12.8, 7.2, -13],
    ],
    trim,
    0.09
  );
  for (let i = 0; i < 8; i++) {
    const x = -8 + i * 2.2;
    addBox(scene, [x, 0.025, -8.1], [0.7, 0.025, 0.1], i % 2 ? muted : amber);
  }
  // Directional light bars continue around the entire square.
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const group = new THREE.Group();
    group.rotation.y = angle;
    scene.add(group);
    addBox(group, [-8, 0.02, -11], [0.045, 0.035, 9], cyan);
    addBox(group, [8, 0.02, -11], [0.045, 0.035, 9], i % 2 ? amber : violet);
    for (let j = -1; j <= 1; j += 2) {
      addBox(group, [j * 8.8, 0.7, -8], [0.22, 1.4, 0.22], trim);
      addBox(group, [j * 8.8, 1.15, -8], [0.235, 0.09, 0.235], cyan);
      addBox(group, [j * 8.8, 1.1, -11.5], [0.07, 0.07, 6.8], trim);
    }
  }
  // Low rooftop plant and industrial fan; physical detail rather than image labels.
  addBox(scene, [9.5, 5.8, -17], [2.1, 1.1, 1.1], trim);
  const fan = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.035, 6, 24), dark);
  fan.position.set(9.5, 5.8, -16.42);
  scene.add(fan);
  for (let i = 0; i < 4; i++) {
    const blade = addBox(scene, [9.5, 5.8, -16.4], [0.65, 0.09, 0.05], dark);
    blade.rotation.z = (Math.PI * i) / 4;
  }

  // All static facade boxes share one draw call per material, including small ribs.
  scene.updateMatrixWorld(true);
  const batches = new Map();
  scene.traverse(object => {
    if (!object.isMesh || object.isInstancedMesh || object.geometry !== geometry) return;
    if (!batches.has(object.material)) batches.set(object.material, []);
    batches.get(object.material).push(object);
  });
  for (const [material, meshes] of batches) {
    const instances = new THREE.InstancedMesh(geometry, material, meshes.length);
    meshes.forEach((mesh, i) => {
      instances.setMatrixAt(i, mesh.matrixWorld);
      mesh.removeFromParent();
    });
    instances.computeBoundingSphere();
    scene.add(instances);
  }

  // Wet paving reflects each light sector toward the fixed observation point.
  // These are rough, puddle-masked light streaks, without an extra scene render.
  const groundMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      lightPositions: { value: DISTRICT_LIGHTS.map(light => new THREE.Vector3(...light.at)) },
      lightColors: { value: DISTRICT_LIGHTS.map(light => new THREE.Color(light.color)) },
    },
    vertexShader: `varying vec3 vPosition; void main(){vPosition=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `
      varying vec3 vPosition; uniform float time;
      uniform vec3 lightPositions[${DISTRICT_LIGHTS.length}];
      uniform vec3 lightColors[${DISTRICT_LIGHTS.length}];
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){
        vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);
      }
      void main(){
        vec2 p=vPosition.xz;
        float puddle=smoothstep(.3,.72,noise(p*.36)+noise(p*.91)*.2);
        float ripple=sin(p.y*15.+noise(p*1.7)*3.+time*.65)*.5+.5;
        float grain=noise(p*16.)*.006;
        vec3 base=vec3(.012,.016,.028)+grain;
        vec2 tile=abs(fract(p*vec2(.7,.55))-.5);
        vec2 aa=max(fwidth(p*vec2(.7,.55)),vec2(.002));
        vec2 edge=smoothstep(vec2(.477)-aa,vec2(.477)+aa,tile);
        base*=1.-max(edge.x,edge.y)*.48;
        float dist=length(p);
        float grazing=.2+.8*pow(1.-2.8/sqrt(dist*dist+7.84),2.);
        for(int i=0;i<${DISTRICT_LIGHTS.length};i++){
          vec2 light=lightPositions[i].xz;
          float reach=length(light);vec2 axis=light/reach;
          float along=dot(p,axis);
          float across=dot(p,vec2(-axis.y,axis.x));
          float width=.7+max(along,0.)*.085;
          float streak=exp(-pow(across/width,2.))
            *smoothstep(0.,3.,along)*(1.-smoothstep(reach*.75,reach+3.,along));
          float broken=.24+.76*pow(ripple,3.);
          base+=lightColors[i]*streak*broken*(.09+puddle*.65)*grazing;
          base+=lightColors[i]*exp(-length(p-light)*.46)*.055;
        }
        base=mix(base,vec3(.022,.023,.041),smoothstep(20.,68.,dist));
        gl_FragColor=vec4(base,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  scene.add(ground);

  // Original text-free skyline wraps the far environment; the foreground stays real geometry.
  const skylineMaterial = new THREE.MeshBasicMaterial({
    color: 0xb6bbc8,
    side: THREE.BackSide,
    fog: false,
  });
  const skyline = new THREE.Mesh(
    new THREE.CylinderGeometry(110, 110, 92, 64, 1, true),
    skylineMaterial
  );
  skyline.position.y = 38;
  skyline.rotation.y = 0.4;
  scene.add(skyline);
  let disposed = false;
  new THREE.TextureLoader().load(
    'static/assets/img/night-district-v2.webp',
    texture => {
      if (disposed) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.repeat.x = 3;
      skylineMaterial.map = texture;
      skylineMaterial.needsUpdate = true;
      onInvalidate();
    },
    undefined,
    () => {
      /* Procedural architecture remains complete if this optional texture fails. */
    }
  );

  const maxRainCount = 650;
  let rainCount = low ? 240 : maxRainCount;
  const rainPositions = new Float32Array(maxRainCount * 6);
  const rainGeometry = new THREE.BufferGeometry();
  for (let i = 0; i < maxRainCount; i++) {
    const x = (random() - 0.5) * 45,
      y = random() * 24,
      z = (random() - 0.5) * 45;
    rainPositions.set([x, y, z, x - 0.025, y - 0.45, z], i * 6);
  }
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  rainGeometry.setDrawRange(0, rainCount * 2);
  const rain = new THREE.LineSegments(
    rainGeometry,
    new THREE.LineBasicMaterial({
      color: 0x9aa8c8,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    })
  );
  rain.visible = !reducedMotion;
  scene.add(rain);
  return {
    setQuality(isLow) {
      rainCount = isLow ? 240 : maxRainCount;
      rainGeometry.setDrawRange(0, rainCount * 2);
    },
    setMotion(enabled) {
      rain.visible = enabled;
    },
    update(time, dt, animated) {
      if (!animated) return;
      groundMaterial.uniforms.time.value = time;
      for (let i = 0; i < rainCount; i++) {
        const k = i * 6;
        rainPositions[k + 1] -= dt * 10;
        rainPositions[k + 4] -= dt * 10;
        if (rainPositions[k + 1] < 0) {
          rainPositions[k + 1] = 24;
          rainPositions[k + 4] = 23.55;
        }
      }
      rainGeometry.attributes.position.needsUpdate = true;
    },
    dispose() {
      disposed = true;
    },
  };
}
