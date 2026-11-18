// Seaside backdrop: sky, sea, promenade, road. Colours come from CSS variables so the clock can repaint it.
import { el, G, R, P, C, E, T, shape, stroke, set, f1, mod, lerp, clamp, rng, INK } from './svg.js';

export const W = 6400; // one lap of the road
export const HORIZON = 470;
export const CROSSING_X = 1000;

const KEYS = ['skyA', 'skyB', 'sea1', 'sea2', 'sea3', 'foam', 'sand', 'prom', 'promLine', 'rail', 'verge', 'road', 'paint', 'curb', 'apron', 'apronD', 'hill', 'cloud', 'title', 'onSky', 'sun'];
const PALETTES = {
  night: ['#0a1030', '#232d6b', '#142056', '#18276a', '#1d3078', '#6d7fd1', '#4a4f86', '#5a4f8a', '#473d73', '#aab4e6', '#1f4a5c', '#1b2142', '#8d98cf', '#666fa8', '#3b4077', '#30356a', '#101845', '#2b3675', '#f2e7c4', '#e9eeff', '#f6f1d5'],
  dawn: ['#86b5e6', '#ffd7c2', '#6d9bcf', '#5c8cc6', '#4f7fbd', '#ffffff', '#f3d7b3', '#e6a58a', '#c98a72', '#fff7ef', '#5fae8e', '#4b4a72', '#f7efe6', '#d9c7c0', '#efcfae', '#dcb48f', '#7f9fd0', '#fff1ea', '#2b2a6b', '#1b2452', '#ffb07a'],
  day: ['#8fd6f0', '#e3f6f0', '#37b3c4', '#259fba', '#188cad', '#ffffff', '#f7e3b5', '#eaa67c', '#cf8a62', '#ffffff', '#4fb886', '#3d4466', '#f7f3e8', '#d7dbe6', '#f3d9a4', '#e3c184', '#6fc0cf', '#ffffff', '#16204a', '#16204a', '#ffd84a'],
  dusk: ['#4d4599', '#ff9f6e', '#8a66a8', '#76589f', '#634b96', '#ffd9c2', '#e0a98a', '#c9796a', '#a85f55', '#ffe3d0', '#3f8a7a', '#35325c', '#e9d6d0', '#b79ba6', '#cf9a80', '#b98068', '#5b4a94', '#ffb59a', '#ffe7d0', '#fff3ea', '#ff6a4a'],
};
const EXTRA = { night: [0.3, 1, 1], dawn: [0.06, 0.3, 0], day: [0, 0, 0], dusk: [0.12, 0.75, 0.3] }; // veil, lights, stars
const STOPS = [[0, 'night'], [4.6, 'night'], [6.4, 'dawn'], [8.6, 'day'], [16.2, 'day'], [18.4, 'dusk'], [20.2, 'night'], [24, 'night']];

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
  out.phase = out.veil > 0.2 ? 'night' : 'day';
  return out;
}

const wavy = (x0, x1, y, amp, len) => {
  let d = `M${x0} ${y}`;
  for (let x = x0; x < x1; x += len) d += `q${len / 4} ${-amp} ${len / 2} 0t${len / 2} 0`;
  return d;
};

// a flat little pelican-on-a-bike road pictogram
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
  return { wrap, period, tile };
}

export function buildScenery(L, skySvg) {
  const rnd = rng(20261119);

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
  C(moon, 0, 0, 120, { fill: 'url(#sunGlow)', opacity: 0.5 });
  P(moon, 'M10 -44A46 46 0 1 0 44 22A38 38 0 1 1 10 -44Z', { fill: '#f6f1d5' });
  const cloudShape = (g, s) => {
    P(g, `M${-60 * s} 0a${26 * s} ${26 * s} 0 0 1 ${34 * s} ${-28 * s}a${34 * s} ${34 * s} 0 0 1 ${62 * s} ${-8 * s}a${26 * s} ${26 * s} 0 0 1 ${44 * s} ${36 * s}Z`, { class: 'c-cloud' });
  };
  const clouds = tiled(skySvg, 2800, (t) => {
    [[200, 120, 1.5], [760, 30, 1], [1300, 190, 1.8], [1900, 70, 1.2], [2450, 150, 1.4], [1050, -220, 2], [2200, -330, 1.7], [300, -480, 2.2]].forEach(([x, y, s]) => cloudShape(G(t, { transform: `translate(${x} ${y})` }), s));
  });

  /* ---------------------------------------------------------- far + sea */
  R(L.far, -3000, HORIZON - 2, 12000, 800, { class: 'c-sea1' });
  const far = tiled(L.far, 3000, (t) => {
    P(t, `M300 ${HORIZON}q120 -26 260 -18q80 -20 200 -6q110 4 160 24Z`, { class: 'c-hill' });
    P(t, `M1900 ${HORIZON}q90 -24 220 -14q120 -22 240 14Z`, { class: 'c-hill' });
    // lighthouse on the first headland
    const lh = G(t, { transform: `translate(640 ${HORIZON - 22})` });
    shape(lh, 'M-9 0L-6 -62H6L9 0Z', '#fffdf7', { 'stroke-width': 2.5 });
    P(lh, 'M-7.6 -18H7.6L7 -32H-7Z M-6.6 -46H6.6L6.2 -58H-6.2Z', { fill: '#ef4b3b' });
    shape(lh, 'M-8 -62h16l-3 -12h-10Z', '#ffe38a', { 'stroke-width': 2.5 });
    shape(lh, 'M-10 -74h20l-10 -10Z', '#ef4b3b', { 'stroke-width': 2.5 });
    P(lh, 'M0 -68L-520 -100L-520 -40Z', { class: 'beam', fill: 'url(#beamL)', opacity: 0 });
    // sailboats
    [[1300, '#ef4b3b'], [2500, '#ffcf3a']].forEach(([x, c]) => {
      const b = G(t, { transform: `translate(${x} ${HORIZON + 16})` });
      shape(b, 'M0 -4L0 -46L26 -8Z', '#fffdf7', { 'stroke-width': 2.2 });
      shape(b, 'M-3 -8L-3 -36L-20 -8Z', c, { 'stroke-width': 2.2 });
      shape(b, 'M-24 -4H30L22 6H-18Z', INK, { 'stroke-width': 2.2 });
    });
  });
  const waves = [
    { y: HORIZON + 34, amp: 5, len: 120, par: 0.22, drift: 8, cls: 'c-sea2' },
    { y: HORIZON + 78, amp: 7, len: 160, par: 0.4, drift: 14, cls: 'c-sea3' },
  ].map((w) => ({ ...w, node: P(L.sea, wavy(-w.len, 5200, w.y, w.amp, w.len) + 'V1100H' + -w.len + 'Z', { class: w.cls }) }));
  const glint = stroke(L.sea, wavy(-200, 5200, HORIZON + 58, 3, 200), '#fff', 2.5, { opacity: 0.35, 'stroke-dasharray': '60 140' });
  const foam = stroke(L.land, wavy(-240, 5400, 603, 5, 240), 'var(--foam)', 7, { opacity: 0.9 });

  /* ---------------------------------------------------------------- land */
  const land = tiled(L.land, W, (t) => {
    P(t, wavy(0, W, 606, 5, 160) + `V664H0Z`, { class: 'c-sand' });
    // parasols and towels on the sand
    for (let n = 0; n < 9; n++) {
      const x = 260 + n * 700 + rnd() * 240, c = ['#ef4b3b', '#2f62e0', '#ffcf3a', '#ff7fae', '#19b28f'][n % 5];
      const u = G(t, { transform: `translate(${f1(x)} 648)` });
      stroke(u, 'M0 0V-44', INK, 2.6);
      shape(u, 'M-30 -40Q0 -72 30 -40Z', c, { 'stroke-width': 2.6 });
      P(u, 'M-10 -41Q0 -70 10 -41Z', { fill: '#fffdf7' });
    }
    // beach huts
    [520, 2140, 3360, 5080].forEach((x0, m) => {
      for (let n = 0; n < 4; n++) {
        const c = ['#ef4b3b', '#19b28f', '#2f62e0', '#ffcf3a', '#ff7fae', '#7a5af5'][(n + m * 2) % 6];
        const h = G(t, { transform: `translate(${x0 + n * 62} 654)` });
        shape(h, 'M0 0V-46H48V0Z', '#fffdf7', { 'stroke-width': 2.8 });
        P(h, 'M8 -45v45M24 -45v45M40 -45v45', { stroke: c, 'stroke-width': 8, fill: 'none', opacity: 0.9 });
        shape(h, 'M-6 -44L24 -68L54 -44Z', c, { 'stroke-width': 2.8 });
        shape(h, 'M17 0V-24h14V0Z', INK, { 'stroke-width': 0 });
      }
    });
    // boardwalk
    R(t, 0, 654, W, 64, { class: 'c-prom' });
    let pl = '';
    for (let x = 16; x < W; x += 32) pl += `M${x} 656V712`;
    P(t, pl, { class: 's-promline', 'stroke-width': 2, fill: 'none', opacity: 0.55 });
    R(t, 0, 710, W, 10, { class: 'c-promLine' });
    // railing
    let rl = '';
    for (let x = 0; x < W; x += 64) rl += `M${x} 656V626`;
    P(t, rl + `M0 628H${W}M0 641H${W}`, { class: 's-rail', 'stroke-width': 3.2, fill: 'none', 'stroke-linecap': 'round' });
    // lamp posts and bunting
    for (let x = 400; x < W; x += 800) {
      stroke(t, `M${x} 656V540q0 -18 18 -18h8`, INK, 4.5);
      shape(t, `M${x + 20} 522h20l-4 14h-12Z`, '#ffe38a', { 'stroke-width': 2.6 });
    }
    [[400, 1200], [3600, 4400], [5200, 6000]].forEach(([a, b]) => {
      stroke(t, `M${a} 548Q${(a + b) / 2} 620 ${b} 548`, INK, 1.6);
      for (let n = 1; n < 16; n++) {
        const u = n / 16, x = a + (b - a) * u, y = 548 + 72 * (1 - (2 * u - 1) ** 2) * 0.5;
        shape(t, `M${f1(x - 9)} ${f1(y)}h18l-9 20Z`, ['#ef4b3b', '#ffcf3a', '#2f62e0', '#fffdf7', '#19b28f'][n % 5], { 'stroke-width': 2 });
      }
    });
    // benches
    [1500, 4700].forEach((x) => {
      const b = G(t, { transform: `translate(${x} 690)` });
      stroke(b, 'M0 0V-18M52 0V-18M-4 -18H56M-4 -30H56M0 -18V-36M52 -18V-36', INK, 4);
    });
    // verge
    P(t, wavy(0, W, 722, 7, 80) + 'V740H0Z', { class: 'c-verge' });
    let fl = '';
    for (let n = 0; n < 90; n++) fl += `M${f1(rnd() * W)} ${f1(720 + rnd() * 10)}h.1`;
    P(t, fl, { stroke: '#fffdf7', 'stroke-width': 5, 'stroke-linecap': 'round', fill: 'none', opacity: 0.8 });
    // road
    R(t, 0, 734, W, 240, { class: 'c-road' });
    R(t, 0, 734, W, 4, { class: 'c-curb', opacity: 0.6 });
    let d1 = '', d2 = '';
    for (let x = 30; x < W; x += 160) {
      d1 += `M${x} 838h72v4h-72Z`;
      d2 += `M${x + 80} 905h80v5.5h-80Z`;
    }
    P(t, d1 + d2, { class: 'c-paint', opacity: 0.8 });
    for (let x = 2600; x < W; x += 1900) {
      const s = G(t, { transform: `translate(${x} 880) scale(1.5 0.62)`, opacity: 0.55 });
      pictogram(s, 'var(--paint)');
      P(s, 'M60 -30l22 12l-22 12M90 -30l22 12l-22 12', { fill: 'none', stroke: 'var(--paint)', 'stroke-width': 6, 'stroke-linejoin': 'round' });
    }
    // the pelican crossing
    const X = CROSSING_X;
    let zb = '';
    for (let n = 0, y = 744; n < 8; n++) {
      const h = 12 + n * 1.6;
      zb += `M${X - 62 + n * 2} ${f1(y)}h${124 - n * 4}v${f1(h)}h${-(124 - n * 4)}Z`;
      y += h + 12 + n * 1.2;
    }
    P(t, zb, { class: 'c-paint' });
    P(t, `M${X - 122} 738h7l-6 232h-7ZM${X + 115} 738h7l6 232h-7Z`, { class: 'c-paint', opacity: 0.9 });
    // signs on the verge
    const sign = (x, build) => {
      const s = G(t, { transform: `translate(${x} 736)` });
      stroke(s, 'M0 0V-96', INK, 5);
      build(s);
    };
    sign(1900, (s) => {
      shape(s, 'M0 -150L42 -108L0 -66L-42 -108Z', '#ffcf3a', { 'stroke-width': 4 });
      pictogram(G(s, { transform: 'translate(-1 -98) scale(.55)' }), INK);
    });
    sign(4380, (s) => {
      C(s, 0, -112, 38, { fill: '#2f62e0', stroke: INK, 'stroke-width': 4 });
      pictogram(G(s, { transform: 'translate(-1 -102) scale(.55)' }), '#fffdf7');
    });
    sign(X - 250, (s) => {
      R(s, -64, -150, 128, 58, { rx: 8, fill: '#fffdf7', stroke: INK, 'stroke-width': 4 });
      T(s, 0, -126, 'PELICAN', { class: 'sign-text', 'text-anchor': 'middle' });
      T(s, 0, -104, 'CROSSING', { class: 'sign-text', 'text-anchor': 'middle' });
    });
    // kerb and the sandy apron the controls sit on
    R(t, 0, 972, W, 18, { class: 'c-curb' });
    R(t, 0, 988, W, 3200, { class: 'c-apron' });
    let tracks = '', prints = '';
    for (let x = 0; x < W; x += 400) tracks += `M${x} 1060q100 -26 200 0t200 0M${x} 1150q100 22 200 0t200 0`;
    stroke(t, tracks, 'var(--apronD)', 5, { 'stroke-dasharray': '3 9', opacity: 0.8 });
    for (let n = 0; n < 60; n++) {
      const x = n * 107 + rnd() * 30, y = 1016 + (n % 2) * 12 + Math.sin(n / 4) * 14;
      prints += `M${f1(x)} ${f1(y)}l12 -5v10Z`;
    }
    P(t, prints, { class: 'c-apronD', opacity: 0.8 });
  });

  /* ---------------------------------------------------------- foreground */
  const fore = tiled(L.fore, 2600, (t) => {
    for (let n = 0; n < 7; n++) {
      const x = 160 + n * 380;
      if (n % 3 === 2) {
        // dune grass
        stroke(t, `M${x} 1030q-6 -30 -18 -38M${x + 4} 1030q0 -34 4 -46M${x + 8} 1030q8 -26 22 -30`, 'var(--verge)', 5);
      } else {
        shape(t, `M${x - 8} 1032V1000q8 -8 16 0V1032Z`, '#fffdf7', { 'stroke-width': 3.4 });
        P(t, `M${x - 6} 1008h12v7h-12Z`, { fill: '#ef4b3b' });
      }
    }
  });

  /* -------------------------------------------------------------- lights */
  const ldefs = el('defs', null, L.lights);
  const lg = el('radialGradient', { id: 'lampGlow' }, ldefs);
  el('stop', { offset: 0, 'stop-color': '#ffe9a6', 'stop-opacity': 0.9 }, lg);
  el('stop', { offset: 1, 'stop-color': '#ffe9a6', 'stop-opacity': 0 }, lg);
  const lights = tiled(L.lights, W, (t) => {
    for (let x = 400; x < W; x += 800) {
      C(t, x + 30, 540, 110, { fill: 'url(#lampGlow)' });
      P(t, `M${x + 14} 536L${x - 70} 730H${x + 130}L${x + 46} 536Z`, { fill: '#ffe9a6', opacity: 0.12 });
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

  function place(layer, x) {
    set(layer.wrap, 'transform', `translate(${f1(x)} 0)`);
  }

  function update(t, cam, view, dt, wind) {
    const half = view.vw / 2;
    place(land, half - mod(cam.x, W));
    place(lights, half - mod(cam.x, W));
    place(fore, half - mod(cam.x * 1.3, fore.period));
    place(far, half - mod(cam.x * 0.08, far.period));
    place(clouds, half - mod(cam.x * 0.04 + t * 6 * (wind || 1), clouds.period));
    for (const w of waves) set(w.node, 'transform', `translate(${f1(-mod(cam.x * w.par + t * w.drift, w.len))} ${f1(Math.sin(t * 1.1 + w.len) * 3)})`);
    set(glint, 'transform', `translate(${f1(-mod(cam.x * 0.3 - t * 10, 200))} 0)`);
    set(foam, 'transform', `translate(${f1(-mod(cam.x - half, 240))} ${f1(Math.sin(t * 0.9) * 3)})`);
    // sun and moon ride an arc across whatever sky is visible
    const skyH = HORIZON - view.top;
    const day = (hour - 5.5) / 13.5, night = mod(hour - 19, 24) / 10.5;
    set(sun, 'transform', `translate(${f1(view.vw * (0.1 + 0.8 * day))} ${f1(HORIZON + 70 - Math.sin(Math.PI * clamp(day, -0.1, 1.1)) * skyH * 0.82)})`);
    set(sun, 'display', day > -0.08 && day < 1.08 ? 'inline' : 'none');
    set(moon, 'transform', `translate(${f1(view.vw * (0.14 + 0.72 * night))} ${f1(HORIZON + 60 - Math.sin(Math.PI * clamp(night, 0, 1)) * skyH * 0.8)})`);
    set(moon, 'display', night >= 0 && night <= 1 ? 'inline' : 'none');
  }

  setTime(12);
  return { update, setTime, get hour() { return hour; }, get palette() { return pal; } };
}
