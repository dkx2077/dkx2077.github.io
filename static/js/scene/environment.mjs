import * as THREE from 'three';

/** Instanced architecture, no shadow maps, and a single lightweight ground shader. */
export function createEnvironment(scene, { low, reducedMotion }) {
  let seed = 2077;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const metal = new THREE.MeshStandardMaterial({
    color: 0x15262d,
    roughness: 0.7,
    metalness: 0.55,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x111d24, roughness: 0.85, metalness: 0.3 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x3e565b, roughness: 0.5, metalness: 0.75 });
  const cyan = new THREE.MeshBasicMaterial({ color: new THREE.Color('#71f5e4').multiplyScalar(2) });
  const lime = new THREE.MeshBasicMaterial({ color: new THREE.Color('#d4ff75').multiplyScalar(2) });
  const orange = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ff7247').multiplyScalar(2),
  });
  const muted = new THREE.MeshBasicMaterial({ color: 0x203b42 });
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
    buildings.push({ x, y: height / 2 - 0.2, z, width, height, depth });
    for (let row = 2; row < height - 1; row += 1.8) {
      for (let column = -width / 2 + 0.7; column < width / 2; column += 1.5) {
        if (random() > 0.52) continue;
        windows.push({
          x: x + column,
          y: row,
          z: z + depth / 2 + 0.02,
          color: random() > 0.8 ? 0xb9ae68 : 0x4baba5,
        });
        windows.push({
          x: x - width / 2 - 0.02,
          y: row,
          z: z + column * 0.5,
          side: true,
          color: 0x387e82,
        });
      }
    }
  }
  const bodyInstances = new THREE.InstancedMesh(geometry, dark, buildings.length);
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
    }
    return group;
  }
  facade(0, 17, 13, 20, lime);
  facade(-1.15, 15, 16, 21, cyan);
  facade(Math.PI, 17, 12, 21, lime);
  facade(1.5, 15, 15, 21, orange);
  // Near side wings frame the entry view without blocking the open sky.
  const leftWing = facade(0.4, 5.8, 19, 16, cyan);
  leftWing.position.x = -13.2;
  const rightWing = facade(-0.5, 5.5, 17, 16, orange);
  rightWing.position.x = 13.5;
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
    addBox(scene, [x, 0.025, -8.1], [0.7, 0.025, 0.1], i % 2 ? muted : lime);
  }
  // Directional light bars continue around the entire square.
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const group = new THREE.Group();
    group.rotation.y = angle;
    scene.add(group);
    addBox(group, [-8, 0.02, -11], [0.045, 0.035, 9], cyan);
    addBox(group, [8, 0.02, -11], [0.045, 0.035, 9], i === 0 ? lime : orange);
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

  // Procedural wet paving with elongated neon reflections. No extra render target.
  const groundMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec3 vPosition; void main(){vPosition=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `
      varying vec3 vPosition; uniform float time;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        vec2 p=vPosition.xz;
        float n=hash(floor(p*45.));
        float ripple=sin(p.y*48.+sin(p.x*31.)*.8+time*.55)*.5+.5;
        vec3 base=vec3(.014,.027,.035)+n*.008;
        float grout=step(.972,fract(p.x*.7))+step(.978,fract(p.y*.55));
        base*=1.-min(grout,.7);
        float streak=pow(ripple,6.)*.6+.2;
        float cyan=exp(-pow((p.x+7.)/2.8,2.))*exp(-abs(p.y+7.)*.085);
        float lime=exp(-pow((p.x+1.)/3.5,2.))*exp(-abs(p.y+10.)*.09);
        float red=exp(-pow((p.x-8.)/2.2,2.))*exp(-abs(p.y+6.)*.1);
        base+=streak*(vec3(.04,.42,.37)*cyan+vec3(.25,.33,.08)*lime+vec3(.45,.09,.035)*red);
        float dist=length(p); base=mix(base,vec3(.024,.044,.057),smoothstep(20.,65.,dist));
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
    color: 0x819ca9,
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
    'static/assets/img/night-district.webp',
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
    },
    undefined,
    () => {
      /* Procedural architecture remains complete if this optional texture fails. */
    }
  );

  const rainCount = low ? 240 : 650;
  const rainPositions = new Float32Array(rainCount * 6);
  const rainGeometry = new THREE.BufferGeometry();
  for (let i = 0; i < rainCount; i++) {
    const x = (random() - 0.5) * 45,
      y = random() * 24,
      z = (random() - 0.5) * 45;
    rainPositions.set([x, y, z, x - 0.025, y - 0.45, z], i * 6);
  }
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rain = new THREE.LineSegments(
    rainGeometry,
    new THREE.LineBasicMaterial({
      color: 0x73aaaf,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    })
  );
  rain.visible = !reducedMotion;
  scene.add(rain);
  return {
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
