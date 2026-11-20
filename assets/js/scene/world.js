// The looping world: camera, lanes, specimens, thrown fish, evaluation overlays.
import { el, G, R, P, C, E, T, set, show, f1, clamp, lerp, mod, wrapSigned, INK } from './svg.js';
import { fish } from './parts.js';
import { buildScenery, W, HORIZON, depth } from './scenery.js';

export { W, HORIZON, depth };

// Everything on the ground is sized and scrolled by depth(y): see scenery.js.
// Named lanes away from the road; road riders carry their own baseline `y` instead.
// The two flying lanes have no ground row, so they are given a scale and scroll as if that far away.
export const LANES = {
  sky: { y: 330, k: 0.62, air: true },
  high: { y: 250, k: 0.52, air: true },
  sea: { y: 598 },
  far: { y: 702 },
};
// The wind is a velocity along the road, not a throttle on everyone at once: positive blows to the right,
// negative to the left, zero is still air. Riders heading with it gain what riders heading into it lose.
export const WIND_MAX = 2.5; // a gale
export const WIND_PUSH = 36; // road units a second that one unit of wind adds to a rider of ordinary size
// How much of the wind a rider catches: small ones are carried further, and anything in the air further still.
export const sailOf = (def) => def.sail ?? (LANES[def.lane]?.air ? 1.5 : 1 / (def.size || 1));
// The speed a rider settles at: its own effort, plus what the wind adds or takes away.
export const cruise = (v0, wind, sail = 1, kick = 1) => v0 * kick + wind * WIND_PUSH * sail;

export const ROAD_TOP = 792, ROAD_BOTTOM = 950;

export function createWorld(scene, hooks = {}) {
  const svg = scene.querySelector('.world-svg');
  const skySvg = scene.querySelector('.sky-svg');
  const monument = scene.querySelector('.monument');

  const defs = el('defs', null, svg);
  for (const [id, x1, x2] of [['beamR', 0, 1], ['beamL', 1, 0]]) {
    const lg = el('linearGradient', { id, x1, x2, y1: 0, y2: 0 }, defs);
    el('stop', { offset: 0, 'stop-color': '#ffe9a6', 'stop-opacity': 0.95 }, lg);
    el('stop', { offset: 1, 'stop-color': '#ffe9a6', 'stop-opacity': 0 }, lg);
  }
  // Document order is depth: whatever comes later is nearer and hides what came before. The wide glow and the
  // cones of the street lamps come straight after the promenade the lamps stand on, so that anything nearer than
  // a lamp (a sign on the verge, a rider on the road) stands in front of its light instead of being washed over by
  // it. Only the small bright heart of each lamp is drawn last of all, above the night tint, to keep it burning.
  const L = {
    far: G(svg), sea: G(svg), seaLane: G(svg), land: G(svg), lights: G(svg), farLane: G(svg), mid: G(svg), road: G(svg),
    fore: G(svg), skyLane: G(svg), fx: G(svg),
  };
  R(svg, -6000, -6000, 20000, 12000, { class: 'veil' });
  L.glow = G(svg);
  L.anno = G(svg, { class: 'anno-layer' });

  const scenery = buildScenery(L, skySvg);
  const view = { w: 1, h: 1, base: 1, s: 1, vw: 1000, vh: 1000, top: 0, hud: 90, roof: 0, free: null };
  const cam = { x: 0, z: 1, zt: 1, yb: 1100, vx: 0, follow: null };
  const state = { t: 0, wind: 0, windT: 0, paused: false, evalOn: false, lang: 'en', fed: 0 };
  const instances = [];
  const fx = [];
  const tickers = [];
  const crossing = { x: 1000, red: false, was: false, stale: false, q: { 1: 0, '-1': 0 } };
  let selected = null, running = false, last = 0, onScreen = true, suspended = false;

  /* ---------------------------------------------------------------- view */

  function layout() {
    const r = scene.getBoundingClientRect();
    view.w = Math.max(1, r.width);
    view.h = Math.max(1, r.height);
    let s = (view.h - view.hud) / 900;
    const minW = view.w < 720 ? 800 : 1150;
    if (view.w / s < minW) s = view.w / minW;
    view.base = s;
    // flying lanes live in the strip of sky between the top bar and the big name
    const top0 = 1000 + view.hud / s - view.h / s;
    const bar = scene.querySelector('.topbar'), mr = monument.getBoundingClientRect();
    const bandTop = top0 + (bar ? bar.offsetHeight + 8 : 80) / s;
    const bandBot = Math.max(bandTop + 150, HORIZON - (mr.height / (cam.z || 1)) * 0.9 / s);
    const k = clamp((bandBot - bandTop) / 290, 0.5, 0.8);
    LANES.sky.y = bandBot - 6;
    LANES.sky.k = k;
    LANES.high.y = bandTop + (bandBot - bandTop) * 0.42;
    LANES.high.k = k * 0.86;
    for (const i of instances) {
      if (!i.air) continue;
      i.y = i.lane.y + (i.def.dy || 0);
      i.par = i.lane.k;
      i.k = i.par * (i.def.size || 1);
      i.inner.setAttribute('transform', `scale(${f1(i.k * i.face * 100) / 100} ${f1(i.k * 100) / 100})`);
    }
  }

  function applyView(dt) {
    const s = view.base * cam.z;
    view.s = s;
    view.vw = view.w / s;
    view.vh = view.h / s;
    const hudU = view.hud / s;
    let yb = 1000 + hudU;
    if (cam.follow) {
      // keep the inspected rider centred in whatever part of the scene the card leaves free
      const i = cam.follow, fr = freeRect();
      const want = centre(i)[1] - (fr.t + fr.b) / 2 / s + view.vh;
      yb = i.air || cam.zt > 1.02 ? want : Math.max(yb, want);
    }
    cam.yb = dt ? lerp(cam.yb, yb, 1 - Math.exp(-dt * 5)) : yb;
    view.top = cam.yb - view.vh;
    const vb = `0 ${f1(view.top)} ${f1(view.vw)} ${f1(view.vh)}`;
    set(svg, 'viewBox', vb);
    set(skySvg, 'viewBox', vb);
    const hz = Math.round((HORIZON - view.top) * s);
    if (hz !== view.hz) {
      view.hz = hz;
      scene.style.setProperty('--horizon', hz + 'px');
    }
    const mz = f1(cam.z * 100) / 100;
    if (mz !== view.mz) {
      view.mz = mz;
      monument.style.transform = `translate(-50%, 0) scale(${mz})`;
      monument.style.opacity = clamp(1 - (mz - 1) * 5, 0.1, 1);
    }
  }

  const freeRect = () => view.free || { l: 0, t: 70, r: view.w, b: view.h - view.hud };
  // middle of a specimen's box in world units, relative to its anchor
  const centre = (i) => {
    const b = i.def.box || [-i.def.w / 2, -i.def.h, i.def.w, i.def.h];
    return [(b[0] + b[2] / 2) * i.k * i.face, i.y + (b[1] + b[3] / 2) * i.k];
  };
  const fitZoom = (i) => {
    const fr = freeRect();
    const z = Math.min(((fr.r - fr.l) * 0.78) / (i.def.w * i.k * view.base), ((fr.b - fr.t) * 0.8) / (i.def.h * i.k * view.base));
    return clamp(z, 1, (view.w < 720 ? 1.6 : 1.3) * clamp(0.92 / i.k, 1, 1.7));
  };

  const toUnits = (cx, cy) => {
    const r = scene.getBoundingClientRect();
    return [(cx - r.left) / view.s, view.top + (cy - r.top) / view.s];
  };

  /* ----------------------------------------------------------- specimens */

  function add(def, over = {}) {
    const lane = def.lane ? LANES[def.lane] : null;
    const y = lane ? lane.y + (def.dy || 0) : def.y;
    const par = lane?.air ? lane.k : depth(y);
    const k = par * (def.size || 1);
    const face = (over.v ?? def.v ?? 0) < 0 || def.face === -1 ? -1 : 1;
    const root = G(null, { class: 'spec', 'data-spec': def.id, tabindex: 0, role: 'button', display: 'none' });
    const inner = G(root, { transform: `scale(${f1(k * face * 100) / 100} ${f1(k * 100) / 100})` });
    const i = {
      def, lane, air: !!lane?.air, y, par, k, face, root, inner,
      x: over.x ?? def.x ?? 0, v0: over.v ?? def.v ?? 0, v: 0, s: 0, phase: (instances.length * 1.7) % 7,
      vis: false, sx: 0, gulp: 0, kick: 1, kickT: 0, road: !lane, anno: null, sail: sailOf(def),
    };
    i.v = aim(i);
    const group = def.lane === 'sky' || def.lane === 'high' ? L.skyLane : def.lane === 'sea' ? L.seaLane : def.lane === 'far' ? L.farLane : L.road;
    const b = def.box || [-def.w / 2, -def.h, def.w, def.h];
    if (!i.air && def.lane !== 'sea' && def.shadow !== false) {
      // a contact shadow pins the rider to the road
      const sh = def.shadow || [b[0] + b[2] / 2, def.w * 0.46];
      E(inner, sh[0], 3, sh[1], 9, { class: 'shadow', fill: '#16204a', opacity: 0.2 });
    }
    i.api = def.build({ g: inner, inst: i, world: api }) || {};
    // generous transparent hit area
    R(inner, b[0], b[1], b[2], b[3], { class: 'hit', fill: 'transparent', rx: 12 });
    if (group === L.road) {
      const after = [...L.road.children].find((n) => +n.dataset.y > y); // effects parked among the riders have no row and are passed over
      root.dataset.y = y;
      L.road.insertBefore(root, after || null);
    } else group.appendChild(root);
    instances.push(i);
    label(i);
    if (state.evalOn) buildAnno(i);
    return i;
  }

  function label(i) {
    const name = i.def.name[state.lang] || i.def.name.en;
    i.root.setAttribute('aria-label', name + '. ' + (i.def.prompt[state.lang] || i.def.prompt.en));
  }

  function remove(i) {
    i.root.remove();
    i.anno?.remove();
    instances.splice(instances.indexOf(i), 1);
    if (selected === i) deselect();
  }

  // where a rider is trying to go right now: its cruising speed in this wind, or nothing if it is parked
  const aim = (i) => (i.def.still || i.halt ? 0 : cruise(i.v0, state.wind, i.sail, i.kick));

  // distance from a rider's front wheel to its place in the queue at the crossing
  const gapTo = (i, d, slot) => wrapSigned(crossing.x - d * (118 + slot * 170) - i.x, W) * d - (i.def.w * (i.def.size || 1)) / 2;
  function marshal() {
    // when the light changes, hand out queue places nearest-first so nobody has to overtake
    crossing.q = { 1: 0, '-1': 0 };
    for (const i of instances) i.slot = null;
    if (!crossing.red) return;
    for (const d of [1, -1]) {
      instances
        .filter((i) => i.road && Math.sign(aim(i)) === d && gapTo(i, d, 0) > -30 && gapTo(i, d, 0) < 900)
        .sort((a, b) => gapTo(a, d, 0) - gapTo(b, d, 0))
        .forEach((i) => {
          if (gapTo(i, d, crossing.q[d]) < 320) i.slot = crossing.q[d]++;
        });
    }
  }

  function step(i, dt) {
    const k = i.k, size = i.def.size || 1;
    if (!state.paused) {
      if (i.kickT > 0 && (i.kickT -= dt) <= 0) i.kick = 1;
      let target = aim(i);
      const d = Math.sign(target);
      if (d !== i.dir) {
        // Turned round by the wind (a rider can be blown backwards). A place in the queue belongs to one
        // direction of travel, so give it up and have the queue dealt again.
        i.dir = d;
        if (i.slot != null) (i.slot = null), (crossing.stale = true);
      }
      if (crossing.red && i.road && d) {
        if (i.slot == null && gapTo(i, d, 0) > -30 && gapTo(i, d, crossing.q[d]) < 300) i.slot = crossing.q[d]++;
        if (i.slot != null) {
          const ahead = gapTo(i, d, i.slot);
          target *= clamp(ahead / 170, 0, 1);
          i.waiting = ahead < 40;
        } else i.waiting = false;
      } else {
        i.waiting = false;
        i.slot = null;
      }
      i.v += (target - i.v) * (1 - Math.exp(-dt * 2.6));
      if (target === 0 && Math.abs(i.v) < 0.6) i.v = 0;
      i.x = mod(i.x + i.v * dt, W);
      i.s += (i.v * dt * i.face) / size;
    }
    const sx = view.vw / 2 + wrapSigned(i.x - cam.x, W) * i.par;
    const half = (i.def.w * k) / 2 + 90;
    const vis = sx > -half && sx < view.vw + half;
    if (vis !== i.vis) {
      i.vis = vis;
      show(i.root, vis);
      if (i.anno) show(i.anno, vis);
    }
    if (!vis) return;
    i.sx = sx;
    // anything standing in front of the inspected rider turns to glass instead of hiding it
    const ghost = !!selected && selected !== i && selected.vis && !i.air && !selected.air && i.y > selected.y && overlaps(i, selected);
    if (ghost !== !!i.ghost) {
      i.ghost = ghost;
      i.root.classList.toggle('is-ghost', ghost);
    }
    const yy = i.y + (i.bobY || 0);
    set(i.root, 'transform', `translate(${f1(sx)} ${f1(yy)})`);
    if (i.anno) set(i.anno, 'transform', `translate(${f1(sx)} ${f1(yy)})`);
    if (!state.paused || !i.drawn) {
      if (i.gulp > 0) {
        i.gulp = Math.max(0, i.gulp - dt * 1.25);
        i.api.gulp?.(Math.sin(Math.min(1, i.gulp) * Math.PI));
      }
      // `wind` is given from the rider's own point of view: positive at its back, negative in its face
      i.api.update?.({ t: state.t + i.phase, dt, s: i.s, v: (i.v * i.face) / size, wind: state.wind * i.face, waiting: i.waiting });
      i.drawn = true;
    }
  }

  // a specimen's box in view units
  const boxOf = (i) => {
    const b = i.def.box || [-i.def.w / 2, -i.def.h, i.def.w, i.def.h];
    return [i.sx + (i.face < 0 ? -(b[0] + b[2]) : b[0]) * i.k, i.y + b[1] * i.k, b[2] * i.k, b[3] * i.k];
  };
  const overlaps = (a, b) => {
    const A = boxOf(a), B = boxOf(b);
    const ox = Math.min(A[0] + A[2], B[0] + B[2]) - Math.max(A[0], B[0]);
    const oy = Math.min(A[1] + A[3], B[1] + B[3]) - Math.max(A[1], B[1]);
    return ox > B[2] * 0.1 && oy > B[3] * 0.1;
  };

  // local (specimen) coordinates → viewBox units
  const toView = (i, p) => [i.sx + p[0] * i.k * i.face, i.y + (i.bobY || 0) + p[1] * i.k];

  /* ------------------------------------------------------------- effects */

  const NOTE = 'M0 0V-22l14 -4V-6M0 0a5 4 0 1 1 -10 0a5 4 0 1 1 10 0M14 -6a5 4 0 1 1 -10 0a5 4 0 1 1 10 0';
  // Water and dust belong to whoever threw them up: they are put at that rider's depth, so whatever hides the rider
  // hides them too. Everything a rider gives off is also as small as the rider is far. Words stay full size, and
  // words and notes float over everything: a sound is not hidden by a beach hut.
  function puff(x, y, kind = 'note', o = {}) {
    const from = o.from, k = from && kind !== 'text' ? from.k : 1;
    let node;
    if (kind === 'note') node = P(L.fx, NOTE, { fill: 'none', stroke: o.color || INK, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    else if (kind === 'text') {
      node = T(L.fx, 0, 0, o.text, { class: 'fx-text', 'text-anchor': 'middle', 'font-size': o.size || 26, fill: o.color || INK });
    } else if (kind === 'drop') node = P(L.fx, 'M0 -8Q6 2 0 5Q-6 2 0 -8Z', { fill: o.color || '#8fd6f0', stroke: INK, 'stroke-width': 2 });
    else node = C(L.fx, 0, 0, o.r || 7, { fill: o.color || '#fffdf7', stroke: INK, 'stroke-width': 2, opacity: 0.9 });
    if (from && (kind === 'drop' || kind === 'dot')) from.root.after(node);
    fx.push({ node, k, x, y, vx: (o.vx ?? (Math.random() - 0.5) * 40) * k, vy: (o.vy ?? -70) * k, g: (o.g ?? 0) * k, life: 0, ttl: o.ttl || 1.2, rot: o.rot || 0, grow: o.grow || 0 });
    if (fx.length > 90) fx.shift().node.remove();
  }

  function stepFx(dt) {
    for (let n = fx.length - 1; n >= 0; n--) {
      const f = fx[n];
      f.life += dt;
      if (f.fish) {
        const tg = f.target;
        const u = clamp(f.life / f.ttl, 0, 1);
        let end = f.end;
        if (tg && tg.vis && tg.api.beak) end = toView(tg, tg.api.beak());
        const mx = (f.from[0] + end[0]) / 2, my = Math.min(f.from[1], end[1]) - 150;
        const a = 1 - u;
        f.x = a * a * f.from[0] + 2 * a * u * mx + u * u * end[0];
        f.y = a * a * f.from[1] + 2 * a * u * my + u * u * end[1];
        set(f.node, 'transform', `translate(${f1(f.x)} ${f1(f.y)}) rotate(${f1(u * 540)}) scale(${f1((1.5 - u * 0.5) * (tg ? tg.k : 1) * 10) / 10})`);
        if (u >= 1) {
          f.node.remove();
          fx.splice(n, 1);
          if (tg && tg.vis) {
            tg.gulp = 1.25;
            state.fed++;
            puff(f.x, f.y - 20, 'text', { text: hooks.gulpWord?.() || 'gulp', vy: -60, ttl: 1 });
            hooks.onFed?.(state.fed, tg);
          } else {
            for (let j = 0; j < 4; j++) puff(f.x, f.y, 'dot', { vx: (j - 1.5) * 50, vy: -80, g: 300, ttl: 0.6, r: 5, color: '#8fd6f0' });
          }
        }
        continue;
      }
      f.vy += f.g * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      const u = f.life / f.ttl;
      if (u >= 1) {
        f.node.remove();
        fx.splice(n, 1);
        continue;
      }
      set(f.node, 'transform', `translate(${f1(f.x)} ${f1(f.y)}) rotate(${f1(f.rot * f.life)}) scale(${f1((1 + f.grow * u) * f.k * 100) / 100})`);
      set(f.node, 'opacity', f1(Math.min(1, (1 - u) * 2.5)));
    }
  }

  function throwFish(ux, uy) {
    let best = null, bd = 900;
    for (const i of instances) {
      if (!i.vis || !i.api.beak) continue;
      const b = toView(i, i.api.beak());
      const d = Math.hypot(b[0] - ux, b[1] - uy);
      if (d < bd) (bd = d), (best = i);
    }
    const node = fish(L.fx);
    const end = best ? toView(best, best.api.beak()) : [ux + 40, Math.max(uy + 200, 880)];
    fx.push({ node, fish: true, from: [ux, uy], end, target: best, x: ux, y: uy, life: 0, ttl: best ? clamp(bd / 620, 0.55, 1.1) : 0.8 });
    hooks.onThrow?.();
  }

  function ringAll() {
    let n = 0;
    for (const i of instances) {
      if (!i.vis || i.def.noBell) continue;
      const p = toView(i, [i.def.bell?.[0] ?? 40, i.def.bell?.[1] ?? -i.def.h * 0.62]);
      setTimeout(() => {
        puff(p[0], p[1], 'note', { from: i, vy: -90, vx: 20 * i.face, ttl: 1.1, color: n % 2 ? '#ef4b3b' : INK });
        hooks.onRing?.(i);
      }, n * 70);
      n++;
    }
    return n;
  }

  /* ---------------------------------------------------------- evaluation */

  function buildAnno(i) {
    i.anno?.remove();
    const d = i.def;
    if (!d.boxes) return;
    const g = (i.anno = G(L.anno, { display: i.vis ? 'inline' : 'none' }));
    const k = i.k, lang = state.lang;
    const words = hooks.words?.() || {};
    d.boxes.forEach((bx, n) => {
      const [kind, x, y, w, h] = bx;
      const x0 = (i.face < 0 ? -(x + w) : x) * k;
      const col = kind === 'pelican' ? '#2f62e0' : kind === 'bicycle' ? '#e2562a' : '#19865f';
      R(g, x0, y * k, w * k, h * k, { fill: 'none', stroke: col, 'stroke-width': 2.4, 'stroke-dasharray': '9 6', rx: 4, 'vector-effect': 'non-scaling-stroke' });
      const txt = words[kind] || kind;
      const tw = [...txt].reduce((a, ch) => a + (ch.charCodeAt(0) > 255 ? 15 : 8.4), 0) + 14;
      R(g, x0 - 1, y * k - 21, tw, 21, { fill: col, rx: 4 });
      T(g, x0 + 6, y * k - 5.5, txt, { class: 'anno-text', fill: '#fff' });
    });
    const top = Math.min(...d.boxes.map((b) => b[2])) * k - 34;
    const pass = d.verdict.pass;
    const vt = d.verdict.short?.[lang] || (pass === true ? words.pass : pass === false ? words.fail : words.na) || '';
    const tw = [...vt].reduce((a, ch) => a + (ch.charCodeAt(0) > 255 ? 16 : 9.4), 0) + 20;
    R(g, -tw / 2, top - 24, tw, 25, { fill: pass === true ? '#19865f' : pass === false ? '#d6392b' : '#55608a', rx: 12.5 });
    T(g, 0, top - 6.5, vt, { class: 'anno-text anno-verdict', fill: '#fff', 'text-anchor': 'middle' });
  }

  function setEval(on) {
    state.evalOn = on;
    svg.classList.toggle('eval', on);
    if (on) for (const i of instances) buildAnno(i);
    else for (const i of instances) i.anno?.remove(), (i.anno = null);
  }

  /* ----------------------------------------------------------- selection */

  function select(i, o = {}) {
    if (selected && selected !== i) selected.root.classList.remove('is-selected');
    selected = i;
    i.root.classList.add('is-selected');
    scenery.clearView(i.def.lane);
    cam.follow = i;
    cam.vx = 0;
    cam.zt = fitZoom(i);
    if (o.trick !== false) trick(i);
    hooks.onSelect?.(i);
  }
  function deselect() {
    if (!selected) return;
    selected.root.classList.remove('is-selected');
    scenery.clearView(null);
    selected = null;
    cam.follow = null;
    cam.zt = 1;
    hooks.onSelect?.(null);
  }
  function trick(i) {
    i.api.trick?.();
    hooks.onTrick?.(i);
  }

  /* --------------------------------------------------------------- input */

  let drag = null;
  svg.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, t: performance.now(), moved: false, v: 0, target: e.target };
  });
  svg.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.lx;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 7) {
      if (Math.abs(e.clientY - drag.y) > Math.abs(e.clientX - drag.x) * 1.4 && e.pointerType !== 'mouse') return (drag = null);
      drag.moved = true;
      try { svg.setPointerCapture(e.pointerId); } catch {}
      svg.classList.add('is-dragging');
      if (cam.follow) deselect();
      hooks.onPan?.();
    }
    if (drag.moved) {
      cam.x -= dx / view.s;
      drag.v = lerp(drag.v, -dx / view.s / 0.016, 0.35);
      drag.lx = e.clientX;
    }
  });
  const endDrag = (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const d = drag;
    drag = null;
    svg.classList.remove('is-dragging');
    if (d.moved) {
      cam.vx = clamp(d.v, -2600, 2600);
      return;
    }
    if (e.type === 'pointercancel') return;
    const hit = d.target.closest?.('.spec');
    if (hit) {
      const i = instances.find((n) => n.root === hit);
      if (i) return selected === i ? trick(i) : select(i);
    }
    const [ux, uy] = toUnits(e.clientX, e.clientY);
    if (api.onEmptyTap?.(ux, uy)) return; // someone else has a use for a tap on nothing
    throwFish(ux, uy);
  };
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
  svg.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      if (cam.follow) deselect();
      cam.x += e.deltaX / view.s;
    }
  }, { passive: false });
  svg.addEventListener('keydown', (e) => {
    const hit = e.target.closest?.('.spec');
    if (hit && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      const i = instances.find((n) => n.root === hit);
      if (i) selected === i ? trick(i) : select(i);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      if (cam.follow) deselect();
      cam.vx = (e.key === 'ArrowLeft' ? -1 : 1) * 900;
    } else if (e.key === 'Escape') deselect();
  });
  // keyboard focus brings an off-screen rider into view
  svg.addEventListener('focusin', (e) => {
    const hit = e.target.closest?.('.spec');
    if (!hit || !hit.matches(':focus-visible')) return;
    const i = instances.find((n) => n.root === hit);
    if (i && i !== selected) select(i, { trick: false });
  });

  /* ---------------------------------------------------------------- loop */

  // One whole step of the world: clock, wind, camera, scenery, riders, effects. Our own loop takes it once a
  // frame; another renderer (the painted version) can take it at its own pace through headless().
  function advance(dt) {
    if (!state.paused) state.t += dt;
    state.wind = lerp(state.wind, state.windT, 1 - Math.exp(-dt * 2.5));
    if (cam.follow) {
      const i = cam.follow;
      const fr = freeRect();
      const aim = ((fr.l + fr.r) / 2 - view.w / 2) / view.s - centre(i)[0];
      cam.x += (wrapSigned(i.x - cam.x, W) - aim / i.par) * (1 - Math.exp(-dt * 4.5));
    } else if (cam.vx) {
      cam.x += cam.vx * dt;
      cam.vx *= Math.exp(-dt * 3.2);
      if (Math.abs(cam.vx) < 2) cam.vx = 0;
    }
    cam.z = lerp(cam.z, cam.zt, 1 - Math.exp(-dt * 4.5));
    applyView(dt);
    scenery.update(state.t, cam, view, state.paused ? 0 : dt, state.wind);
    if (crossing.red !== crossing.was || crossing.stale) {
      crossing.was = crossing.red;
      crossing.stale = false;
      marshal();
    }
    for (const i of instances) step(i, dt);
    for (const fn of tickers) fn(state, state.paused ? 0 : dt);
    stepFx(dt);
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    advance(dt);
    requestAnimationFrame(frame);
  }
  function start() {
    if (running || suspended || !onScreen || document.hidden) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  const stop = () => (running = false);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  new IntersectionObserver((es) => {
    onScreen = es[0].isIntersecting;
    onScreen ? start() : stop();
  }).observe(scene);
  new ResizeObserver(() => {
    layout();
    applyView(0);
  }).observe(scene);

  const api = {
    L, view, cam, state, instances, crossing, scenery, svg, monument,
    onEmptyTap: null,
    add, remove, select, deselect, trick, throwFish, ringAll, setEval, puff, toView, toUnits,
    get selected() { return selected; },
    get fxCount() { return fx.length; },
    setHud(px) {
      if (Math.abs(px - view.hud) < 2) return;
      view.hud = px;
      layout();
    },
    // how much of the top of the scene (in px) is covered by text: the moon stays below it
    setRoof(px) { view.roof = px; },
    // the part of the scene (in px) not covered by the open card
    setFree(rect) {
      view.free = rect;
      if (selected) cam.zt = fitZoom(selected);
    },
    setWind(v) { state.windT = clamp(v, -WIND_MAX, WIND_MAX); },
    // which way a rider built from this definition would travel in the wind as it is now: 1, -1 or 0
    heading: (def) => (def.still ? 0 : Math.sign(cruise(def.v || 0, state.windT, sailOf(def)))),
    setPaused(v) {
      state.paused = v;
      scene.classList.toggle('is-paused', v);
    },
    setLang(l) {
      state.lang = l;
      for (const i of instances) {
        label(i);
        i.api.lang?.(l);
        if (state.evalOn) buildAnno(i);
      }
    },
    find: (id) => instances.find((i) => i.def.id === id),
    tick: (fn) => tickers.push(fn),
    start() {
      layout();
      applyView(0);
      start();
    },
    // Hand the clock to another renderer: our own loop stops, and the world moves only when headless() is called.
    suspend(on) {
      suspended = on;
      on ? stop() : start();
    },
    // One step of the world at somebody else's pace. Everything is kept up to date exactly as in our own loop,
    // the SVG included, so whoever is drawing can read the scene straight from it.
    headless: (dt) => advance(Math.min(dt, 0.2)),
    renderOnce() {
      layout();
      applyView(0);
      scenery.update(state.t, cam, view, 0, state.wind);
      for (const i of instances) step(i, 0);
    },
  };
  return api;
}
