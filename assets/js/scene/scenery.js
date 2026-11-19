// Seaside backdrop: sky, sea, promenade, road. Colours come from CSS variables so the clock can repaint it.
//
// Perspective: one vanishing line (the horizon) rules everything that stands on the ground. Something whose feet are
// at screen row y is drawn at depth(y) times its real size and slides past at depth(y) times the camera speed.
// Riders and street furniture share one unit of length, so a bench is bench-sized next to a rider at any distance.
import { el, G, R, P, C, T, shape, stroke, set, f1, mod, wrapSigned, lerp, clamp, rng, INK } from './svg.js';

export const W = 6400; // one lap of the road, in real (depth 1) units
export const HORIZON = 470;
export const CROSSING_X = 1000;
export const depth = (y) => (y - HORIZON) / 420; // 1 at y = 890, about the middle of the near lanes

const KEYS = ['skyA', 'skyB', 'sea1', 'sea2', 'sea3', 'foam', 'sand', 'prom', 'promLine', 'rail', 'verge', 'road', 'paint', 'curb', 'apron', 'apronD', 'hill', 'cloud', 'title', 'onSky', 'sun'];
const PALETTES = {
  night: ['#0a1030', '#232d6b', '#142056', '#18276a', '#1d3078', '#6d7fd1', '#4a4f86', '#5a4f8a', '#473d73', '#aab4e6', '#1f4a5c', '#1b2142', '#8d98cf', '#666fa8', '#3b4077', '#30356a', '#101845', '#2b3675', '#f2e7c4', '#e9eeff', '#f6f1d5'],
  // the blue hour, before sunrise and after sunset: its own palette, so the transitions never pass through mud
  blue: ['#141f5c', '#7460a8', '#27398a', '#2c4196', '#3249a2', '#b9b6ec', '#857fb4', '#8f6da0', '#72568a', '#ded8f6', '#2c6a70', '#242a56', '#b4b7e0', '#8686ba', '#776fa6', '#645c94', '#1c2a70', '#8f7bb8', '#fbe8d8', '#f3eeff', '#ffb07a'],
  dawn: ['#86b5e6', '#ffd7c2', '#6d9bcf', '#5c8cc6', '#4f7fbd', '#ffffff', '#f3d7b3', '#e6a58a', '#c98a72', '#fff7ef', '#5fae8e', '#4b4a72', '#f7efe6', '#d9c7c0', '#efcfae', '#dcb48f', '#7f9fd0', '#fff1ea', '#2b2a6b', '#1b2452', '#ffb07a'],
  day: ['#8fd6f0', '#e3f6f0', '#37b3c4', '#259fba', '#188cad', '#ffffff', '#f7e3b5', '#eaa67c', '#cf8a62', '#ffffff', '#4fb886', '#3d4466', '#f7f3e8', '#d7dbe6', '#f3d9a4', '#e3c184', '#6fc0cf', '#ffffff', '#16204a', '#16204a', '#ffd84a'],
  dusk: ['#4d4599', '#ff9f6e', '#8a66a8', '#76589f', '#634b96', '#ffd9c2', '#e0a98a', '#c9796a', '#a85f55', '#ffe3d0', '#3f8a7a', '#35325c', '#e9d6d0', '#b79ba6', '#cf9a80', '#b98068', '#5b4a94', '#ffb59a', '#ffe7d0', '#fff3ea', '#ff6a4a'],
};
const EXTRA = { night: [0.3, 1, 1], blue: [0.16, 0.9, 0.55], dawn: [0.05, 0.25, 0], day: [0, 0, 0], dusk: [0.1, 0.7, 0.25] }; // veil, lights, stars
const STOPS = [[0, 'night'], [4.3, 'night'], [5.4, 'blue'], [6.6, 'dawn'], [8.6, 'day'], [16.2, 'day'], [18.3, 'dusk'], [19.4, 'blue'], [20.5, 'night'], [24, 'night']];

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => {
  const x = hex(a), y = hex(b);
  return '#' + x.map((v, i) => Math.round(lerp(v, y[i], t)).toString(16).padStart(2, '0')).join('');
};

export function paletteAt(hour) {
  const h = mod(hour, 24);
  let n = 0;
  while (n < STOPS.length - 2 && STOPS[n + 1][0] <= h) n++;
  const [h0, a] = STOPS[n], [h1, b] = STOPS[n + 1];
  const t = clamp((h - h0) / (h1 - h0), 0, 1);
  const out = {};
  KEYS.forEach((k, i) => (out[k] = mix(PALETTES[a][i], PALETTES[b][i], t)));
  out.veil = lerp(EXTRA[a][0], EXTRA[b][0], t);
  out.lights = lerp(EXTRA[a][1], EXTRA[b][1], t);
  out.stars = lerp(EXTRA[a][2], EXTRA[b][2], t);
  out.phase = out.veil > 0.13 ? 'night' : 'day';
  return out;
}

// The moon is in the sky from 19:00 until 05:30.
export const moonUp = (hour) => {
  const night = mod(hour - 19, 24) / 10.5;
  return night >= 0 && night <= 1;
};

const wavy = (x0, x1, y, amp, len) => {
  let d = `M${x0} ${y}`;
  for (let x = x0; x < x1; x += len) d += `q${len / 4} ${-amp} ${len / 2} 0t${len / 2} 0`;
  return d;
};
const SPAN = 4600; // wider than any viewport, in view units

// a flat little pelican-on-a-bike pictogram for signs and road paint
function pictogram(g, fill) {
  const p = G(g);
  P(p, 'M-30 0a14 14 0 1 0 28 0a14 14 0 1 0 -28 0M6 0a14 14 0 1 0 28 0a14 14 0 1 0 -28 0', { fill: 'none', stroke: fill, 'stroke-width': 5 });
  P(p, 'M-16 0L-6 -22L16 -22L20 0M-6 -22L2 0', { fill: 'none', stroke: fill, 'stroke-width': 4, 'stroke-linejoin': 'round' });
  P(p, 'M-18 -30q4 -16 20 -14q6 -18 14 -22q10 -2 10 6l24 6l-24 4q-4 14 -12 18q-14 10 -32 2Z', { fill });
  return p;
}

function tiled(parent, period, build) {
  const wrap = G(parent);
  const id = 'tile-' + Math.random().toString(36).slice(2, 8);
  const tile = G(wrap, { id });
  build(tile);
  el('use', { href: '#' + id, x: -period }, wrap);
  el('use', { href: '#' + id, x: period }, wrap);
  return { wrap, period, par: 1 };
}

/* ------------------------------------------------- street furniture, real size */

const SW = 8; // outline for furniture, in real units (it thins with distance like everything else)
const FURNITURE = {
  hut(g, c) {
    shape(g, 'M0 0V-250H250V0Z', '#fffdf7', { 'stroke-width': SW });
    P(g, 'M36 -246V-4M95 -246V-4M155 -246V-4M214 -246V-4', { stroke: c, 'stroke-width': 30, fill: 'none' });
    shape(g, 'M-28 -244L125 -372L278 -244Z', c, { 'stroke-width': SW });
    P(g, 'M86 0V-132h78V0Z', { fill: INK });
  },
  parasol(g, c) {
    stroke(g, 'M0 0V-290', INK, SW);
    shape(g, 'M-170 -262Q0 -436 170 -262Z', c, { 'stroke-width': SW });
    P(g, 'M-56 -266Q0 -424 56 -266Z', { fill: '#fffdf7' });
  },
  lamp(g) {
    stroke(g, 'M0 0V-396q0 -60 60 -60h34', INK, 13);
    shape(g, 'M74 -460h72l-14 46h-44Z', '#ffe38a', { 'stroke-width': SW });
  },
  bench(g) {
    stroke(g, 'M0 0V-72M236 0V-72M-14 -72H250M-14 -120H250M0 -72V-142M236 -72V-142', INK, 13);
  },
  warning(g) {
    stroke(g, 'M0 0V-170', INK, 13);
    shape(g, 'M0 -362L100 -262L0 -162L-100 -262Z', '#ffcf3a', { 'stroke-width': 10 });
    pictogram(G(g, { transform: 'translate(-2 -240) scale(1.32)' }), INK);
  },
  cycleway(g) {
    stroke(g, 'M0 0V-176', INK, 13);
    C(g, 0, -266, 92, { fill: '#2f62e0', stroke: INK, 'stroke-width': 10 });
    pictogram(G(g, { transform: 'translate(-2 -244) scale(1.32)' }), '#fffdf7');
  },
  nameplate(g) {
    stroke(g, 'M0 0V-250', INK, 13);
    R(g, -112, -344, 224, 100, { rx: 14, fill: '#fffdf7', stroke: INK, 'stroke-width': 9 });
    T(g, 0, -301, 'PELICAN', { class: 'sign-text', 'text-anchor': 'middle' });
    T(g, 0, -262, 'CROSSING', { class: 'sign-text', 'text-anchor': 'middle' });
  },
  grass(g) {
    stroke(g, 'M0 0q-5 -20 -16 -27M5 0q0 -24 4 -35M10 0q8 -18 20 -22', 'var(--verge)', 5);
  },
};

export function buildScenery(L, skySvg) {
  const rnd = rng(20261119);
  const bands = [];
  // a strip of ground at screen row y: everything in it shares one depth, so it scrolls as one piece
  const band = (parent, y, build) => {
    const p = depth(y);
    const b = tiled(parent, W * p, (t) => build(t, p, (x, kind, arg) => FURNITURE[kind](G(t, { transform: `translate(${f1(x * p)} ${y}) scale(${f1(p * 1000) / 1000})` }), arg)));
    b.par = p;
    bands.push(b);
    return b;
  };
  // a long scalloped edge that slides with its own depth
  const edges = [];
  const edge = (parent, y, amp, len, attrs, close) => {
    const node = P(parent, wavy(-len, SPAN, y, amp, len) + (close ? `V${close}H${-len}Z` : ''), attrs);
    edges.push({ node, par: depth(y), len, y });
    return node;
  };
  const slab = (parent, y, h, cls, extra) => R(parent, -200, y, SPAN, h, { class: cls, ...extra });

  /* ------------------------------------------------------------- sky svg */
  const defs = el('defs', null, skySvg);
  const glow = el('radialGradient', { id: 'sunGlow' }, defs);
  el('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0.55 }, glow);
  el('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 }, glow);
  const stars = G(skySvg, { class: 'stars' });
  let sd = '';
  for (let n = 0; n < 150; n++) {
    const x = rnd() * 3600, y = -900 + rnd() * 1330, r = 1 + rnd() * 2.2;
    sd += `M${f1(x)} ${f1(y)}m${-r} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(r * 2)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-r * 2)} 0`;
  }
  P(stars, sd, { fill: '#fff' });
  const sun = G(skySvg);
  C(sun, 0, 0, 150, { fill: 'url(#sunGlow)' });
  C(sun, 0, 0, 54, { class: 'c-sun' });
  const moon = G(skySvg, { class: 'moon' });
  const face = G(moon, { class: 'moon-face' }); // the part that answers a hover: see the Starry Night door in main.js
  C(face, 0, 0, 120, { class: 'moon-glow', fill: 'url(#sunGlow)', opacity: 0.5 });
  P(face, 'M10 -44A46 46 0 1 0 44 22A38 38 0 1 1 10 -44Z', { fill: '#f6f1d5' });
  const moonPos = { x: 0, y: 0, r: 48, up: false };
  const cloudShape = (g, s) => {
    P(g, `M${-60 * s} 0a${26 * s} ${26 * s} 0 0 1 ${34 * s} ${-28 * s}a${34 * s} ${34 * s} 0 0 1 ${62 * s} ${-8 * s}a${26 * s} ${26 * s} 0 0 1 ${44 * s} ${36 * s}Z`, { class: 'c-cloud' });
  };
  const clouds = tiled(skySvg, 2800, (t) => {
    [[200, 120, 1.5], [760, 30, 1], [1300, 190, 1.8], [1900, 70, 1.2], [2450, 150, 1.4], [1050, -220, 2], [2200, -330, 1.7], [300, -480, 2.2]].forEach(([x, y, s]) => cloudShape(G(t, { transform: `translate(${x} ${y})` }), s));
  });

  /* ------------------------------------------------- far shore and the sea */
  R(L.far, -200, HORIZON - 2, SPAN, 800, { class: 'c-sea1' });
  const far = tiled(L.far, 3000, (t) => {
    P(t, `M300 ${HORIZON}q120 -26 260 -18q80 -20 200 -6q110 4 160 24Z`, { class: 'c-hill' });
    P(t, `M1900 ${HORIZON}q90 -24 220 -14q120 -22 240 14Z`, { class: 'c-hill' });
    const lh = G(t, { transform: `translate(640 ${HORIZON - 22})` });
    shape(lh, 'M-9 0L-6 -62H6L9 0Z', '#fffdf7', { 'stroke-width': 2.5 });
    P(lh, 'M-7.6 -18H7.6L7 -32H-7Z M-6.6 -46H6.6L6.2 -58H-6.2Z', { fill: '#ef4b3b' });
    shape(lh, 'M-8 -62h16l-3 -12h-10Z', '#ffe38a', { 'stroke-width': 2.5 });
    shape(lh, 'M-10 -74h20l-10 -10Z', '#ef4b3b', { 'stroke-width': 2.5 });
    P(lh, 'M0 -68L-520 -100L-520 -40Z', { class: 'beam', fill: 'url(#beamL)', opacity: 0 });
    [[1300, '#ef4b3b'], [2500, '#ffcf3a']].forEach(([x, c]) => {
      const b = G(t, { transform: `translate(${x} ${HORIZON + 14})` });
      shape(b, 'M0 -4L0 -46L26 -8Z', '#fffdf7', { 'stroke-width': 2.2 });
      shape(b, 'M-3 -8L-3 -36L-20 -8Z', c, { 'stroke-width': 2.2 });
      shape(b, 'M-24 -4H30L22 6H-18Z', INK, { 'stroke-width': 2.2 });
    });
  });
  // swells get longer and taller as they come closer
  const waves = [
    { y: HORIZON + 30, amp: 3, len: 90, drift: 3, cls: 'c-sea2' },
    { y: HORIZON + 74, amp: 6, len: 170, drift: 7, cls: 'c-sea3' },
  ].map((w) => ({ ...w, par: depth(w.y), node: P(L.sea, wavy(-w.len, SPAN, w.y, w.amp, w.len) + 'V1100H' + -w.len + 'Z', { class: w.cls }) }));
  // short highlights on the water, smaller and closer together towards the horizon (plain segments: dashes are slow)
  const glints = [
    { y: HORIZON + 16, len: 110, run: 26, w: 1.6 },
    { y: HORIZON + 52, len: 180, run: 50, w: 2.2 },
    { y: HORIZON + 104, len: 280, run: 90, w: 3 },
  ].map((g) => {
    let d = '';
    for (let x = -g.len; x < SPAN; x += g.len) d += `M${x} ${g.y}q${g.run / 2} -3 ${g.run} 0`;
    return { ...g, par: depth(g.y), node: stroke(L.sea, d, '#fff', g.w, { opacity: 0.32 }) };
  });

  /* ---------------------------------------------- beach and the promenade */
  const foam = edge(L.land, 603, 5, 240, { fill: 'none', stroke: 'var(--foam)', 'stroke-width': 7, 'stroke-linecap': 'round', opacity: 0.9 });
  edge(L.land, 606, 5, 160, { class: 'c-sand' }, 670);
  const beach = [];
  beach[0] = band(L.land, 642, (t, p, put) => {
    const cols = ['#ef4b3b', '#2f62e0', '#ffcf3a', '#ff7fae', '#19b28f'];
    for (let n = 0; n < 7; n++) put(380 + n * 900 + rnd() * 260, 'parasol', cols[n % 5]);
  });
  beach[1] = band(L.land, 656, (t, p, put) => {
    const cols = ['#f59a8f', '#86d3bf', '#93aef0', '#ffe08a', '#ffb5cf', '#b7a6f7']; // sun-bleached, so they sit back
    [1500, 3300, 5300].forEach((x0, m) => {
      for (let n = 0; n < 4; n++) put(x0 + n * 292, 'hut', cols[(n + m * 2) % 6]);
    });
  });
  slab(L.land, 656, 68, 'c-prom');
  P(L.land, `M-200 669H${SPAN}M-200 683H${SPAN}M-200 699H${SPAN}`, { class: 's-promline', 'stroke-width': 1.6, fill: 'none', opacity: 0.5 });
  band(L.land, 658, (t, p) => {
    // waist-high railing along the back of the boardwalk
    let d = `M0 ${f1(658 - 165 * p)}H${f1(W * p)}M0 ${f1(658 - 88 * p)}H${f1(W * p)}`;
    for (let x = 0; x < W; x += 320) d += `M${f1(x * p)} 658V${f1(658 - 172 * p)}`;
    P(t, d, { class: 's-rail', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' });
  });
  const LAMPS = [400, 2000, 3600, 5200];
  band(L.land, 662, (t, p, put) => {
    for (const x of LAMPS) put(x, 'lamp');
    // bunting strung between two pairs of posts
    [[400, 2000], [3600, 5200]].forEach(([a, b]) => {
      const x0 = a * p, x1 = b * p, y0 = 662 - 440 * p, sag = 44;
      stroke(t, `M${f1(x0)} ${f1(y0)}Q${f1((x0 + x1) / 2)} ${f1(y0 + sag * 2)} ${f1(x1)} ${f1(y0)}`, INK, 1.4);
      for (let n = 1; n < 18; n++) {
        const u = n / 18, x = lerp(x0, x1, u), y = y0 + sag * 2 * 2 * u * (1 - u);
        shape(t, `M${f1(x - 8)} ${f1(y)}h16l-8 18Z`, ['#ef4b3b', '#ffcf3a', '#2f62e0', '#fffdf7', '#19b28f'][n % 5], { 'stroke-width': 1.8 });
      }
    });
  });
  band(L.land, 690, (t, p, put) => {
    put(2700, 'bench');
    put(4500, 'bench');
    put(6000, 'bench');
  });
  slab(L.land, 712, 12, 'c-promLine');
  slab(L.land, 722, 20, 'c-verge');
  edge(L.land, 723, 7, 80, { class: 'c-verge' }, 742);
  band(L.land, 729, (t, p) => {
    let fl = '';
    for (let n = 0; n < 70; n++) fl += `M${f1(rnd() * W * p)} ${f1(722 + rnd() * 10)}h.1`;
    P(t, fl, { stroke: '#fffdf7', 'stroke-width': 5, 'stroke-linecap': 'round', fill: 'none', opacity: 0.8 });
  });

  /* ------------------------------------------ verge signs, road, near kerb */
  band(L.mid, 738, (t, p, put) => {
    put(CROSSING_X - 330, 'nameplate');
    put(2300, 'warning');
    put(4380, 'cycleway');
  });
  slab(L.mid, 734, 240, 'c-road');
  slab(L.mid, 734, 4, 'c-curb', { opacity: 0.6 });
  // lane lines: each row is its own strip so the near one runs past faster
  for (const [y, h, off] of [[838, 4, 30], [905, 5.5, 190]]) {
    band(L.mid, y, (t, p) => {
      let d = '';
      for (let x = off; x < W; x += 320) d += `M${f1(x * p)} ${y}h${f1(150 * p)}v${h}h${f1(-150 * p)}Z`;
      P(t, d, { class: 'c-paint', opacity: 0.8 });
    });
  }
  band(L.mid, 880, (t, p) => {
    for (const x of [2900, 4900]) {
      const s = G(t, { transform: `translate(${f1(x * p)} 880) scale(${f1(p * 150) / 100} ${f1(p * 62) / 100})`, opacity: 0.55 });
      pictogram(s, 'var(--paint)');
      P(s, 'M60 -30l22 12l-22 12M90 -30l22 12l-22 12', { fill: 'none', stroke: 'var(--paint)', 'stroke-width': 6, 'stroke-linejoin': 'round' });
    }
  });
  // the pelican crossing is painted on the ground, so it is redrawn in perspective as the camera moves
  const zebra = P(L.mid, '', { class: 'c-paint' });
  const BARS = [];
  for (let n = 0, y = 745; n < 8; n++) {
    const h = 11 + n * 1.8;
    BARS.push([y, y + h]);
    y += h + 11 + n * 1.4;
  }
  slab(L.mid, 972, 18, 'c-curb');
  slab(L.mid, 988, 3200, 'c-apron');
  band(L.mid, 1040, (t, p) => {
    const period = W * p, n = Math.round(period / 400), seg = period / n;
    let tracks = '', prints = '';
    for (let k = 0; k < n; k++) {
      const x = k * seg, q = seg / 4;
      tracks += `M${f1(x)} 1066q${f1(q)} -26 ${f1(q * 2)} 0t${f1(q * 2)} 0M${f1(x)} 1160q${f1(q)} 22 ${f1(q * 2)} 0t${f1(q * 2)} 0`;
    }
    stroke(t, tracks, 'var(--apronD)', 6, { 'stroke-dasharray': '4 11', opacity: 0.8 });
    for (let k = 0; k < 64; k++) {
      const x = (k / 64) * period + rnd() * 30, y = 1014 + (k % 2) * 14 + Math.sin(k / 4) * 12;
      prints += `M${f1(x)} ${f1(y)}l15 -6v12Z`;
    }
    P(t, prints, { class: 'c-apronD', opacity: 0.8 });
  });

  /* ---------------------------------------------------------- foreground */
  band(L.fore, 1030, (t, p, put) => {
    for (let n = 0; n < 12; n++) put(200 + n * 520 + rnd() * 180, 'grass');
  });

  /* -------------------------------------------------------------- lights */
  const ldefs = el('defs', null, L.lights);
  const lg = el('radialGradient', { id: 'lampGlow' }, ldefs);
  el('stop', { offset: 0, 'stop-color': '#ffe9a6', 'stop-opacity': 0.9 }, lg);
  el('stop', { offset: 1, 'stop-color': '#ffe9a6', 'stop-opacity': 0 }, lg);
  band(L.lights, 662, (t, p) => {
    for (const x of LAMPS) {
      const hx = (x + 110) * p, hy = 662 - 430 * p;
      C(t, hx, hy, 105, { fill: 'url(#lampGlow)' });
      P(t, `M${f1(hx - 14)} ${f1(hy)}L${f1(hx - 150)} 742H${f1(hx + 150)}L${f1(hx + 14)} ${f1(hy)}Z`, { fill: '#ffe9a6', opacity: 0.1 });
    }
  });
  L.lights.setAttribute('class', 'lights');

  let hour = 12, pal = paletteAt(12);
  const root = skySvg.closest('.scene');

  function setTime(h) {
    hour = mod(h, 24);
    pal = paletteAt(hour);
    for (const k of KEYS) root.style.setProperty('--' + k, pal[k]);
    root.style.setProperty('--veil', pal.veil.toFixed(3));
    root.style.setProperty('--lights', pal.lights.toFixed(3));
    root.style.setProperty('--stars', pal.stars.toFixed(3));
    root.dataset.phase = pal.phase;
    return pal;
  }

  const slide = (node, x, y = 0) => set(node, 'transform', `translate(${f1(x)} ${f1(y)})`);

  function update(t, cam, view, dt, wind) {
    const half = view.vw / 2;
    for (const b of bands) slide(b.wrap, half - mod(cam.x * b.par, b.period));
    for (const e of edges) slide(e.node, -mod(cam.x * e.par - half, e.len), e.node === foam ? Math.sin(t * 0.9) * 2.5 : 0);
    slide(far.wrap, half - mod(cam.x * 0.03, far.period));
    slide(clouds.wrap, half - mod(cam.x * 0.02 + t * 6 * (wind || 1), clouds.period));
    for (const w of waves) slide(w.node, -mod(cam.x * w.par + t * w.drift - half, w.len), Math.sin(t * 1.1 + w.len) * w.amp * 0.4);
    for (const g of glints) slide(g.node, -mod(cam.x * g.par - t * g.len * 0.04 - half, g.len));
    // zebra bars and stop lines, each corner projected at its own depth
    const away = wrapSigned(CROSSING_X - cam.x, W); // measured once, so a quad can never straddle the seam of the loop
    let d = '';
    if (Math.abs(away) * depth(739) < half + 200) {
      const sx = (dx, y) => f1(half + (away + dx) * depth(y));
      const quad = (x0, x1, y0, y1) => `M${sx(x0, y0)} ${f1(y0)}L${sx(x1, y0)} ${f1(y0)}L${sx(x1, y1)} ${f1(y1)}L${sx(x0, y1)} ${f1(y1)}Z`;
      d = quad(-124, -113, 739, 970) + quad(113, 124, 739, 970);
      for (const [y0, y1] of BARS) d += quad(-64, 64, y0, y1);
    }
    set(zebra, 'd', d);
    // sun and moon ride an arc across whatever sky is visible
    const skyH = HORIZON - view.top;
    const day = (hour - 5.5) / 13.5, night = mod(hour - 19, 24) / 10.5;
    set(sun, 'transform', `translate(${f1(view.vw * (0.1 + 0.8 * day))} ${f1(HORIZON + 70 - Math.sin(Math.PI * clamp(day, -0.1, 1.1)) * skyH * 0.82)})`);
    set(sun, 'display', day > -0.08 && day < 1.08 ? 'inline' : 'none');
    moonPos.x = view.vw * (0.14 + 0.72 * night);
    // the moon is a door now (see main.js), so its arc tops out below the text at the top of the page
    const rise = Math.max(140, Math.min(skyH * 0.8, skyH + 60 - ((view.roof || 0) + 52) / (view.s || 1)));
    moonPos.y = HORIZON + 60 - Math.sin(Math.PI * clamp(night, 0, 1)) * rise;
    moonPos.up = moonUp(hour);
    set(moon, 'transform', `translate(${f1(moonPos.x)} ${f1(moonPos.y)})`);
    set(moon, 'display', moonPos.up ? 'inline' : 'none');
  }

  setTime(12);
  // whatever is inspected out at sea should not be hidden behind a beach hut
  beach.forEach((b) => b.wrap.setAttribute('class', 'beach'));
  const clearBeach = (on) => beach.forEach((b) => b.wrap.classList.toggle('is-ghost', on));

  return { update, setTime, clearBeach, moonAt: () => moonPos, get hour() { return hour; }, get palette() { return pal; } };
}
