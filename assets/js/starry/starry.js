// Starry Night mode: the scene as it stands, repainted in visible brush strokes after Van Gogh's 1889 painting.
//
// This is a second renderer for the same world, not a second scene. It uses the world's own view, so nothing moves
// when it takes over; it reads the riders, the street furniture, the crossing, thrown fish and evaluation boxes
// straight from the SVG the world keeps up to date; and it takes its sky from the scene's sky: every cloud becomes
// a whirlpool, the stars and the moon stay where they were, and the paint streams the way the wind blows.
// The SVG stays underneath, unseen, and goes on receiving every click, drag and key press.
import { HORIZON, LAMP_HEAD } from '../scene/scenery.js';

const TAU = Math.PI * 2, FPS = 12, FS = 0.5;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (str) => Math.abs([...String(str)].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) | 0, 7));
const pick = (arr, v) => arr[clamp(Math.floor(v * arr.length), 0, arr.length - 1)];

const SKY = ['#0b1438', '#0e1a4c', '#122260', '#172c76', '#1c378c', '#2244a2', '#2a55b6', '#3668c6', '#4a80d2', '#6599dc', '#86b3e4', '#abcbe8', '#cfe0e6', '#ece6c6'];
const GOLD = ['#e8791a', '#f39a1f', '#f7b82a', '#fad24a', '#fde98a', '#fff6cf'];
const HALO = ['#bfd9a8', '#e3df9c', '#9cc7e6', '#f6e27a'];
const PALETTE = [...SKY, ...GOLD, ...HALO];
const G0 = SKY.length, H0 = G0 + GOLD.length;
const LIGHT = ['#fff8dc', '#fdeaa0', '#f9d65e', '#f7b82a', '#d7ecec', '#b4d5ee', '#ffffff'];
const SEA = ['#0d1a4f', '#11246a', '#162f82', '#1c3d98', '#2255a6', '#2a6eae', '#3888b6'];
const INK = '#16204a', NIGHT_INK = '#0a1130', LIT = '#f9c435';
const CRESCENT = 'M10 -44A46 46 0 1 0 44 22A38 38 0 1 1 10 -44Z'; // the moon exactly as the scene draws it

// Strokes are grouped by colour so a few thousand of them cost a few dozen draw calls.
function batcher() {
  const map = new Map();
  return {
    add(color, x0, y0, x1, y1) {
      let a = map.get(color);
      if (!a) map.set(color, (a = []));
      a.push(x0, y0, x1, y1);
    },
    flush(c, width, order) {
      c.lineCap = 'round';
      c.lineWidth = width;
      const keys = order ? order.filter((k) => map.has(k)) : [...map.keys()];
      for (const k of keys) {
        const a = map.get(k);
        c.strokeStyle = k;
        c.beginPath();
        for (let i = 0; i < a.length; i += 4) {
          c.moveTo(a[i], a[i + 1]);
          c.lineTo(a[i + 2], a[i + 3]);
        }
        c.stroke();
      }
      map.clear();
    },
  };
}

/* ------------------------------------------------------------- colour */

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixHex = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(lerp(v, hex(b)[i], t)).toString(16).padStart(2, '0')).join('');
// whatever the SVG says a colour is, as #rrggbb where that is possible
function plain(v, pal) {
  if (!v || v === 'none' || v === 'transparent') return null;
  if (v[0] === 'u') return null; // a gradient: that is light, and light is painted separately
  if (v[0] === 'v') return pal[v.slice(6, -1)] || null; // var(--name): the scene's palette for the hour
  if (v[0] === '#' && v.length === 4) return '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
  if (v[0] === 'r') {
    const m = v.match(/[\d.]+/g);
    return m ? '#' + m.slice(0, 3).map((q) => Math.round(+q).toString(16).padStart(2, '0')).join('') : v;
  }
  return v;
}
const moonlit = new Map(), LAMPS = new Set(['#ffe38a', LIT]);
// Daylight colours regraded for a night under a yellow moon. `far` sinks the street and the shore further into
// the blue than the riders, the way a painter keeps a background back; lamps and lit doors are left burning.
function grade(c, far = 0) {
  const key = far ? c + far : c;
  let v = moonlit.get(key);
  if (v) return v;
  v = c;
  if (c[0] === '#' && c.length === 7) {
    const [r, g, b] = hex(c), mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0, lum = r * 0.3 + g * 0.59 + b * 0.11;
    if (lum < 62) v = NIGHT_INK;
    else if (sat < 0.16 && lum > 190) v = mixHex(c, '#bccbea', 0.5);
    else if (sat < 0.32 && lum > 150) v = mixHex(c, '#8494cc', 0.5);
    else if (r > 200 && g > 110 && b < 130) v = c;
    else v = mixHex(c, '#1c2c78', 0.2);
    if (far && lum >= 62 && !LAMPS.has(c)) v = mixHex(v, '#1a2a7c', far);
  }
  moonlit.set(key, v);
  return v;
}
// the second tone of a contour: dark lines lift toward Prussian blue, coloured ones toward moonlight
const tones = new Map();
function tone(c) {
  let v = tones.get(c);
  if (!v) {
    if (c[0] !== '#' || c.length !== 7) v = c;
    else {
      const [r, g, b] = hex(c);
      v = r * 0.3 + g * 0.59 + b * 0.11 < 70 ? mixHex(c, '#2b46a8', 0.62) : mixHex(c, '#fff0b4', 0.42);
    }
    tones.set(c, v);
  }
  return v;
}
// One sampled colour becomes five neighbouring ones, as if the brush had been reloaded between touches:
// a shadow leaning blue, the colour itself, a lighter one, and now and then pure moonlight or a cool grey.
const shades = new Map();
function shade(r, g, b, j) {
  const key = (((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)) * 5 + j;
  let v = shades.get(key);
  if (!v) {
    const pale = r > 150 && g > 150 && b > 150, warm = r > 190 && g > 100 && b < 140;
    let R = r, G = g, B = b;
    if (j === 0) (R = r * 0.78), (G = g * 0.8), (B = b * 0.86 + 16);
    else if (j === 2) (R = r * 1.1 + 8), (G = g * 1.1 + 6), (B = b * 1.06);
    else if (j === 3) [R, G, B] = pale ? [246, 232, 170] : warm ? [250, 205, 80] : [r * 1.16 + 10, g * 1.12 + 8, b * 0.96];
    else if (j === 4) [R, G, B] = pale ? [150, 176, 226] : warm ? [226, 110, 34] : [r * 0.7, g * 0.74, b * 0.9 + 26];
    v = `rgb(${clamp(Math.round(R), 0, 255)},${clamp(Math.round(G), 0, 255)},${clamp(Math.round(B), 0, 255)})`;
    if (shades.size > 8000) shades.clear();
    shades.set(key, v);
  }
  return v;
}
const VARIANT = [0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 4, 1];

/* ------------------------------------------------- reading the SVG */

// Ground the scene fills with flat colour. Here it is painted by hand instead (see paintGround).
const GROUND = new Set(['c-sea1', 'c-sea2', 'c-sea3', 'c-sand', 'c-prom', 'c-promLine', 's-promline', 'c-verge', 'c-road', 'c-curb', 'c-apron']);
// never drawn: hit areas, light cones, the night tint, contact shadows (laid in separately)
const UNSEEN = new Set(['hit', 'beam', 'shadow', 'veil', 'lights']);
// colours that come from a class rather than an attribute, by the palette entry they use
const FILLS = { 'c-hill': 'hill', 'c-paint': 'paint', 'c-apronD': 'apronD' }, STROKES = { 's-rail': 'rail' };

// An element's transform, parsed once for as long as the attribute stays the same, applied to two canvases.
const TF = /(translate|rotate|scale)\(([^)]*)\)/g;
function applyTf(n, str, c1, c2) {
  if (n._tfs !== str) {
    const ops = [];
    TF.lastIndex = 0;
    let m;
    while ((m = TF.exec(str))) {
      const a = m[2].trim().split(/[\s,]+/).map(Number);
      if (m[1] === 'translate') ops.push(0, a[0], a[1] || 0, 0);
      else if (m[1] === 'scale') ops.push(1, a[0], a.length > 1 ? a[1] : a[0], 0);
      else ops.push(2, (a[0] * Math.PI) / 180, a[1] || 0, a[2] || 0);
    }
    n._tfs = str;
    n._tfo = ops;
  }
  const o = n._tfo;
  for (const c of [c1, c2]) {
    for (let i = 0; i < o.length; i += 4) {
      if (o[i] === 0) c.translate(o[i + 1], o[i + 2]);
      else if (o[i] === 1) c.scale(o[i + 1], o[i + 2]);
      else {
        c.translate(o[i + 2], o[i + 3]);
        c.rotate(o[i + 1]);
        c.translate(-o[i + 2], -o[i + 3]);
      }
    }
  }
}
const num = (n, k) => +n.getAttribute(k) || 0;
// the outline of a shape element; a path keeps its Path2D for as long as its `d` stays the same
function shapePath(n, tag) {
  if (tag === 'path') {
    const d = n.getAttribute('d');
    if (!d) return null;
    if (n._d !== d) (n._d = d), (n._p = new Path2D(d));
    return n._p;
  }
  const p = new Path2D();
  if (tag === 'circle') p.arc(num(n, 'cx'), num(n, 'cy'), num(n, 'r'), 0, TAU);
  else if (tag === 'ellipse') p.ellipse(num(n, 'cx'), num(n, 'cy'), num(n, 'rx'), num(n, 'ry'), 0, 0, TAU);
  else if (tag === 'rect') {
    const rx = num(n, 'rx');
    if (rx && p.roundRect) p.roundRect(num(n, 'x'), num(n, 'y'), num(n, 'width'), num(n, 'height'), rx);
    else p.rect(num(n, 'x'), num(n, 'y'), num(n, 'width'), num(n, 'height'));
  } else return null;
  return p;
}
// The rig hides the seam between neck and head with a dashed copy of the neck: the last 28% of its curve.
function neckEnd(d) {
  const q = (d.match(/-?\d*\.?\d+/g) || []).map(Number);
  if (q.length < 8) return null;
  const t = 0.72, L = (a, b) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
  const p1 = [q[2], q[3]], p2 = [q[4], q[5]], p3 = [q[6], q[7]];
  const a = L([q[0], q[1]], p1), b = L(p1, p2), e = L(p2, p3), f = L(a, b), g = L(b, e), h = L(f, g);
  const p = new Path2D();
  p.moveTo(h[0], h[1]);
  p.bezierCurveTo(g[0], g[1], e[0], e[1], p3[0], p3[1]);
  return p;
}
// how a text element is set, as the stylesheet has it; asked once per element
const WIDTHS = [[62.5, 'extra-condensed '], [75, 'condensed '], [87.5, 'semi-condensed '], [100, ''], [112.5, 'semi-expanded '], [125, 'expanded ']];
function textStyle(n) {
  if (n._ts) return n._ts;
  const cs = getComputedStyle(n), st = parseFloat(cs.fontStretch) || 100;
  const width = WIDTHS.reduce((a, b) => (Math.abs(b[0] - st) < Math.abs(a[0] - st) ? b : a))[1];
  return (n._ts = {
    font: `${cs.fontWeight} ${width}${parseFloat(cs.fontSize) || 16}px ${cs.fontFamily}`,
    fill: plain(cs.fill, {}) || INK,
    stroke: cs.stroke && cs.stroke !== 'none' ? plain(cs.stroke, {}) : null,
    sw: parseFloat(cs.strokeWidth) || 0,
    ls: parseFloat(cs.letterSpacing) || 0,
    middle: cs.textAnchor === 'middle',
  });
}

/* ------------------------------------------------------------------ mode */

export function enterStarry({ scene, world, origin = [0, 0] }) {
  const { view, cam, state, svg } = world, L = world.L, sc = world.scenery;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = document.createElement('canvas');
  cv.className = 'starry-canvas';
  cv.setAttribute('aria-hidden', 'true'); // the scene underneath is still the one that is read out and operated
  scene.insertBefore(cv, svg.nextSibling);
  const ctx = cv.getContext('2d');

  // The picture is laid out in the world's own view: `s` pixels to a unit, `top` the unit at the upper edge.
  let quality = 1, W = 1, H = 1, dpr = 1, s = 1, top = 0, vw = 1, bw = 6, dw = 3.6;
  const Y = (u) => (u - top) * s;

  // Fill a box with short strokes. angle(x, y, r) and color(x, y, r) decide each one.
  function dab(c, rnd, x0, y0, x1, y1, o) {
    const len = o.len ?? bw * 3.4, wid = o.width ?? bw;
    const n = Math.ceil(((x1 - x0) * (y1 - y0)) / (len * wid * (o.gap ?? 0.5)));
    const b = batcher();
    for (let i = 0; i < n; i++) {
      const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0), r = rnd();
      const a = o.angle(x, y, r), l = len * (0.6 + rnd() * 0.7) * 0.5;
      const col = o.color(x, y, r);
      if (col) b.add(col, x - Math.cos(a) * l, y - Math.sin(a) * l, x + Math.cos(a) * l, y + Math.sin(a) * l);
    }
    b.flush(c, wid);
  }

  /* ------------------------------------------------------------------ sky */

  // What is in the sky comes from the scene: its clouds turn into whirlpools, its brightest stars and its moon
  // each into a small vortex. Where they are, and how fast the paint streams, is read again every frame.
  let swirls = [], vort = [], drift = -9, gust = 0, bright = [], faint = [];
  const moon = { x: 0, y: 0, R: 46, moon: true, tw: 0.5 }, added = [];
  function chooseStars() {
    const span = W / view.base + 200, all = sc.stars.filter(([x]) => x < span).sort((a, b) => b[2] - a[2]);
    bright = [];
    faint = [];
    for (const [x, y, r] of all) {
      // a star that sits behind the text at the top of the page stays a small one, so the text stays readable
      const clear = (y - view.top) * view.s > (view.roof || 0) + 14;
      const apart = bright.every((q) => Math.hypot(q.x - x, q.y - y) > 170);
      if (bright.length < 14 && r > 1.9 && apart && clear) bright.push({ x, y, R: clamp(8 + r * 5, 12, 24) / view.base, tw: 0.5 + (r % 1) * 0.8, born: 0 });
      else faint.push([x, y, r]);
    }
  }
  function features() {
    const m = sc.moonAt(), w = state.wind;
    moon.x = m.x;
    moon.y = m.y;
    gust = Math.min(Math.abs(w), 2.5);
    // the paint drifts with the clouds: slowly to the left in still air, and with the wind when there is one
    drift = (w * 30 - 6 * Math.max(0, 1 - gust * 4)) * 1.5;
    swirls = sc.cloudsAt().filter((c) => c.x > -c.r * 1.7 && c.x < vw + c.r * 1.7 && c.y > top - c.r && c.y < HORIZON + c.r * 0.2);
    vort = [moon];
    for (const q of bright) if (q.x < vw + 80 && q.y > top - 80 && q.y < HORIZON) vort.push(q);
    for (const q of added) vort.push(q);
  }

  // Which way the paint is moving at a point (a unit vector in `out`) and how fast, in units a second.
  function flow(x, y, t, out) {
    let fx = drift, fy = (Math.abs(drift) * 0.3 + 2.5) * Math.sin(x * 0.0052 + y * 0.004 + t * 0.2);
    const turn = 60 + gust * 30;
    for (const v of swirls) {
      const dx = x - v.x, dy = y - v.y, d = Math.hypot(dx, dy) + 0.01;
      const w = turn * Math.exp(-((d / (v.r * 1.3)) ** 2));
      fx += w * (dy / d - (dx / d) * 0.16);
      fy += w * (-dx / d - (dy / d) * 0.16);
    }
    for (const v of vort) {
      const dx = x - v.x, dy = y - v.y, d = Math.hypot(dx, dy) + 0.01;
      if (d > v.R * 4) continue;
      const w = 84 * Math.exp(-((d / (v.R * 2.1)) ** 2));
      fx += (w * dy) / d;
      fy += (-w * dx) / d;
    }
    const m = Math.hypot(fx, fy);
    if (m < 0.01) return (out[0] = -1), (out[1] = 0), 12;
    out[0] = fx / m;
    out[1] = fy / m;
    return Math.max(m, 12);
  }

  function skyIndex(x, y, r, r2, t) {
    for (const st of vort) {
      const d = Math.hypot(x - st.x, y - st.y) / st.R;
      if (d > 3.2) continue;
      if (st.moon) {
        if (d < 1.3) return G0 + (r < 0.3 ? 3 : r < 0.7 ? 4 : 5);
        if (d < 2.1 && r2 < 0.85) return r < 0.5 ? H0 + 3 : G0 + 3;
      } else if (d < 0.55) return G0 + (r < 0.5 ? 5 : 4);
      else if (d < 1.1) return G0 + (r < 0.22 ? 1 : r < 0.6 ? 2 : 3);
      const ring = Math.floor(d * 2.4 - t * st.tw + r * 0.7);
      if (r2 < 1 - (d - 1) / 2.2) return ring % 2 ? H0 + (r < 0.5 ? 0 : 1) : H0 + (r < 0.6 ? 2 : 3);
    }
    const skyH = HORIZON - top;
    let lum = 0.2 + 0.09 * Math.sin((y + 60 * Math.sin(x * 0.004 + 1.3)) * 0.021 + t * 0.12);
    for (const v of swirls) {
      const d = Math.hypot(x - v.x, y - v.y);
      lum += Math.exp(-((d / (v.r * 1.2)) ** 2)) * (0.3 + 0.3 * Math.cos((d / v.r) * 8.5 - t * 0.8 + v.id * 1.3));
      if (d < v.r * 0.3) lum += 0.28;
    }
    const hg = (y - (HORIZON - skyH * 0.3)) / (skyH * 0.3);
    if (hg > 0) lum += 0.2 * hg * hg;
    lum += (r - 0.5) * 0.4;
    return clamp(Math.floor(lum * SKY.length), 0, SKY.length - 1);
  }

  const cloud = (n) => ({ n, x: new Float32Array(n), y: new Float32Array(n), r: new Float32Array(n), r2: new Float32Array(n), life: new Float32Array(n) });
  function spawn(p, i, y0, y1, fresh) {
    p.x[i] = Math.random() * vw;
    p.y[i] = y0 + Math.random() * (y1 - y0);
    p.r[i] = Math.random();
    p.r2[i] = Math.random();
    p.life[i] = (fresh ? Math.random() : 1) * (3 + Math.random() * 5);
  }
  let parts = null;
  function seedSky() {
    parts = cloud(clamp(Math.ceil((W * (Y(HORIZON) + 10)) / (bw * bw * 3.4 * 0.58)), 600, 8000));
    for (let i = 0; i < parts.n; i++) spawn(parts, i, top, HORIZON + 14, true);
  }
  // Midpoint steps: plain Euler flings paint out of every whirlpool and leaves a hole in the middle.
  const F = [0, 0], F1 = [0, 0];
  function advect(p, i, t, dt) {
    const x = p.x[i], y = p.y[i], v1 = flow(x, y, t, F1);
    const v = flow(x + F1[0] * v1 * dt * 0.5, y + F1[1] * v1 * dt * 0.5, t, F);
    p.x[i] = x + F[0] * v * dt;
    p.y[i] = y + F[1] * v * dt;
  }

  const skyBatch = batcher(), fine = batcher(), moonShape = new Path2D(CRESCENT);
  function paintSky(t, dt) {
    const hy = Y(HORIZON);
    if (hy < -12) return;
    ctx.fillStyle = '#0f1b50';
    ctx.fillRect(0, 0, W, hy + 12);
    const p = parts, half = (bw * 3.4) / s / 2;
    for (let i = 0; i < p.n; i++) {
      advect(p, i, t, dt);
      const x = p.x[i], y = p.y[i];
      if ((p.life[i] -= dt) < 0 || x < -30 || x > vw + 30 || y < top - 30 || y > HORIZON + 20) {
        spawn(p, i, top, HORIZON + 14, false);
        continue;
      }
      const l = half * (0.65 + p.r2[i] * 0.7);
      skyBatch.add(PALETTE[skyIndex(x, y, p.r[i], p.r2[i], t)], (x - F[0] * l) * s, Y(y - F[1] * l), (x + F[0] * l) * s, Y(y + F[1] * l));
    }
    skyBatch.flush(ctx, bw, PALETTE);
    // the scene's lesser stars stay where they were, each a single touch of pale paint
    for (const [x, y, r] of faint) {
      if (x > vw || y < top || y > HORIZON - 12) continue;
      const l = (1.2 + r) * 0.9;
      fine.add(r > 2.4 ? '#fff6cf' : '#cfe0e6', x * s - l, Y(y), x * s + l, Y(y));
    }
    fine.flush(ctx, clamp(bw * 0.4, 2, 3.2));
    // every star gets a thick centre, laid on last like the final touch of a loaded brush
    ctx.lineCap = 'round';
    for (const st of vort) {
      if (st.moon) continue;
      const x = st.x * s, y = Y(st.y), R = st.R * s, grow = st.born ? clamp((t - st.born) * 2.5, 0.2, 1) : 1;
      ctx.fillStyle = '#fff6cf';
      ctx.beginPath();
      ctx.arc(x, y, R * 0.5 * grow, 0, TAU);
      ctx.fill();
      for (let k = 0; k < 5; k++) {
        const a0 = k * 1.26 + t * st.tw * 1.5 + Math.random() * 0.2;
        ctx.strokeStyle = GOLD[k % 2 ? 3 : 4];
        ctx.lineWidth = bw * 0.8;
        ctx.beginPath();
        ctx.arc(x, y, R * 0.36 * grow, a0, a0 + 0.8);
        ctx.stroke();
      }
    }
    // The moon: the same crescent, in the same place, inside a pale halo. It leans the way the drawn one does
    // under a pointer, because it is still the way back.
    const mx = moon.x * s, my = Y(moon.y), R = moon.R * s, hot = scene.classList.contains('moon-hot'), k = s * (hot ? 1.16 : 1);
    ctx.fillStyle = '#fde98a';
    ctx.beginPath();
    ctx.arc(mx, my, R * 1.28, 0, TAU);
    ctx.fill();
    for (let n = 0; n < 16; n++) {
      const rr = R * (0.36 + (n % 4) * 0.27), a0 = n * 2.1 + Math.sin(t * 2 + n) * 0.08;
      ctx.strokeStyle = ['#fff6cf', '#fad24a', '#fde98a', '#f6e27a'][n % 4];
      ctx.lineWidth = bw;
      ctx.beginPath();
      ctx.arc(mx, my, rr, a0, a0 + 0.9);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(mx, my);
    if (hot) ctx.rotate(-0.17);
    ctx.scale(k, k);
    ctx.fillStyle = '#f08a1c';
    ctx.fill(moonShape);
    ctx.clip(moonShape);
    for (let n = 0; n < 9; n++) {
      const a0 = 1.2 + n * 0.42 + Math.sin(t * 3 + n) * 0.05;
      ctx.strokeStyle = GOLD[n % 3];
      ctx.lineWidth = (bw * 0.9) / k;
      ctx.beginPath();
      ctx.arc(0, 0, 30 + (n % 3) * 9, a0, a0 + 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------------------------------------------------------------- name */

  // The name is read off the page, letter by letter, so it is painted exactly where it stood.
  const monument = world.monument;
  let title = null, titleKey = '';
  function readTitle() {
    const base = scene.getBoundingClientRect(), cs = getComputedStyle(monument), range = document.createRange(), glyphs = [];
    let fs = parseFloat(cs.fontSize) || 100;
    for (const sp of monument.querySelectorAll('span')) {
      const node = sp.firstChild, box = sp.getBoundingClientRect();
      if (!node || node.nodeType !== 3) continue;
      // the world zooms the name by transform, which the font size does not know about
      fs = (parseFloat(cs.fontSize) || 100) * (sp.offsetWidth ? box.width / sp.offsetWidth : 1);
      for (let n = 0; n < node.data.length; n++) {
        range.setStart(node, n);
        range.setEnd(node, n + 1);
        glyphs.push({ ch: node.data[n].toUpperCase(), x: range.getBoundingClientRect().left - base.left, top: box.top - base.top, h: box.height });
      }
    }
    if (!glyphs.length) return null;
    const font = `${cs.fontWeight} expanded ${fs}px ${cs.fontFamily}`;
    ctx.font = font;
    const m = ctx.measureText('K'), asc = m.fontBoundingBoxAscent || fs * 0.88, desc = m.fontBoundingBoxDescent || fs * 0.21, cap = m.actualBoundingBoxAscent || fs * 0.7;
    let y0 = 1e9, y1 = -1e9;
    for (const g of glyphs) {
      g.y = g.top + (g.h - asc - desc) / 2 + asc; // its baseline
      y0 = Math.min(y0, g.y - cap);
      y1 = Math.max(y1, g.y);
    }
    const oy = Math.floor(y0 - 8), bh = Math.ceil(y1 + fs * 0.05 + 8 - oy);
    const mask = document.createElement('canvas');
    mask.width = cv.width;
    mask.height = Math.max(1, Math.ceil(bh * dpr));
    const c = mask.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, -oy * dpr);
    c.font = font;
    c.textBaseline = 'alphabetic';
    for (const g of glyphs) c.fillText(g.ch, g.x, g.y);
    const tmp = document.createElement('canvas');
    tmp.width = mask.width;
    tmp.height = mask.height;
    const p = cloud(clamp(Math.ceil((W * (y1 - y0)) / (bw * bw * 2.4 * 0.5)), 200, 4000));
    const made = { mask, tmp, tc: tmp.getContext('2d'), glyphs, font, oy, bh, u0: top + (y0 - 4) / s, u1: top + (y1 + 4) / s, p };
    for (let i = 0; i < p.n; i++) spawn(p, i, made.u0, made.u1, true);
    return made;
  }
  // The name is cut out of a field of light strokes that follow the same flow as the sky.
  const litBatch = batcher();
  function paintTitle(t, dt) {
    const box = monument.firstElementChild?.getBoundingClientRect();
    const key = box ? `${box.left.toFixed(1)}|${box.top.toFixed(1)}|${box.width.toFixed(1)}|${cv.width}|${cv.height}` : '';
    if (key !== titleKey) (titleKey = key), (title = key ? readTitle() : null);
    if (!title) return;
    const { tc, p, oy, bh } = title, alpha = parseFloat(monument.style.opacity || 1);
    if (alpha < 0.02 || oy > H || oy + bh < 0) return;
    tc.setTransform(dpr, 0, 0, dpr, 0, -oy * dpr);
    tc.globalCompositeOperation = 'source-over';
    tc.fillStyle = '#f3e7a8';
    tc.fillRect(0, oy, W, bh);
    const half = (bw * 2.8) / s / 2;
    for (let i = 0; i < p.n; i++) {
      advect(p, i, t, dt * 0.8);
      const x = p.x[i], y = p.y[i];
      if ((p.life[i] -= dt) < 0 || x < -20 || x > vw + 20 || y < title.u0 - 10 || y > title.u1 + 10) {
        spawn(p, i, title.u0, title.u1, false);
        continue;
      }
      const band = Math.sin(x * 0.012 + y * 0.03 - t * 0.6) * 0.5 + 0.5;
      litBatch.add(LIGHT[Math.floor(clamp(band * 0.55 + p.r[i] * 0.6, 0, 0.999) * LIGHT.length)], (x - F[0] * half) * s, Y(y - F[1] * half), (x + F[0] * half) * s, Y(y + F[1] * half));
    }
    litBatch.flush(tc, bw * 0.82);
    tc.globalCompositeOperation = 'destination-in';
    tc.setTransform(1, 0, 0, 1, 0, 0);
    tc.drawImage(title.mask, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.drawImage(title.tmp, 0, oy, W, title.tmp.height / dpr);
    ctx.font = title.font;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = NIGHT_INK;
    for (const [k, a] of [[1, 0.95], [0.5, 0.55]]) {
      ctx.globalAlpha = a * alpha;
      ctx.lineWidth = bw * 0.6 * k;
      const jx = (Math.random() - 0.5) * bw * 0.3, jy = (Math.random() - 0.5) * bw * 0.3;
      for (const g of title.glyphs) ctx.strokeText(g.ch, g.x + jx, g.y + jy);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------- the ground, by hand */

  // Sea, sand, boardwalk, verge, road and the near sand are flat colour in the scene. They are painted here in
  // the same rows, three times over with a different hand; showing the three in turn makes still ground breathe.
  // What is painted depends only on the view, so it is kept until the view changes.
  const level = (r) => (r - 0.5) * 0.16;
  function paintGround(c, rnd) {
    const hy = Y(HORIZON), mx = moon.x * s, sea1 = Y(612);
    const strip = (u0, u1, base, o) => {
      const a = Math.max(Y(u0), -8), b = Math.min(Y(u1), H + 8);
      if (b <= a) return;
      if (base) (c.fillStyle = base), c.fillRect(0, a, W, b - a);
      dab(c, rnd, 0, a, W, b, o);
    };
    // the sea, with the moon laid on it as a broken column of light
    strip(HORIZON, 612, '#12256a', {
      angle: (x, y, r) => level(r),
      color(x, y, r) {
        const d = clamp((y - hy) / (sea1 - hy), 0, 1);
        if (Math.abs(x - mx) < bw * (3 + d * 12) && r < 0.62) return pick(['#f7b82a', '#fad24a', '#fde98a', '#fff6cf'], rnd());
        for (const q of bright) if (Math.abs(x - q.x * s) < bw * (1.2 + d * 4) && r < 0.2) return pick(['#fad24a', '#fde98a'], rnd());
        return pick(SEA, d * 0.75 + r * 0.38 - 0.05);
      },
    });
    strip(600, 609, null, { len: bw * 3.6, width: bw * 0.7, gap: 1.6, angle: (x, y, r) => level(r), color: (x, y, r) => pick(['#cfe0e6', '#abcbe8', '#ece6c6'], r) });
    strip(607, 660, '#55558f', { angle: (x, y, r) => level(r), color: (x, y, r) => pick(['#444a86', '#55558f', '#6a66a0', '#807ab0', '#8a7d68', '#a2946a'], r) });
    strip(656, 714, '#463f80', { angle: (x, y, r) => level(r), color: (x, y, r) => pick(['#39366c', '#463f80', '#564b8a', '#6a5b9a', '#7767a6'], r) });
    strip(711, 724, '#342f62', { len: bw * 3, width: bw * 0.8, angle: (x, y, r) => level(r) * 0.5, color: (x, y, r) => pick(['#2a2754', '#342f62', '#3f3972', '#4b4482'], r) });
    strip(722, 742, '#123035', { len: bw * 2.2, angle: (x, y, r) => -1.2 + r * 0.9, color: (x, y, r) => pick(['#0c2228', '#123035', '#1a423e', '#235247', '#3a6a4a', '#8a9a4a'], r * r) });
    strip(738, 974, '#1a2150', { len: bw * 4.2, angle: (x, y, r) => level(r) * 0.7, color: (x, y, r) => pick(['#131943', '#182050', '#1f2960', '#283372', '#313e86', '#3c4b98'], r * 0.9 + (r > 0.93 ? 0.3 : 0)) });
    strip(972, 990, '#6f78b0', { len: bw * 3.6, width: bw * 0.8, angle: (x, y, r) => level(r) * 0.5, color: (x, y, r) => pick(['#5c659e', '#6f78b0', '#848dc2', '#9aa3d0'], r) });
    strip(988, top + H / s + 20, '#383c74', { angle: (x, y, r) => level(r) * 2, color: (x, y, r) => pick(['#232857', '#2d3266', '#383c74', '#454676', '#55506a', '#6a6258'], r) });
  }
  let ground = { key: '', y0: 0, frames: [] };
  function groundFor() {
    const key = `${cv.width}|${cv.height}|${s.toFixed(4)}|${top.toFixed(1)}|${Math.round((moon.x * s) / 24)}`;
    if (key !== ground.key) ground = { key, y0: clamp(Math.floor(Y(HORIZON)) - 2, 0, H - 1), frames: [] };
    // one new hand a frame, so a change of view costs one painting of the ground at a time
    if (ground.frames.length < 3) {
      const c = document.createElement('canvas');
      c.width = cv.width;
      c.height = Math.max(1, Math.ceil((H - ground.y0) * dpr));
      const g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, -ground.y0 * dpr);
      paintGround(g, rng(77 + ground.frames.length * 131));
      ground.frames.push(c);
    }
    return ground;
  }

  /* --------------------------------------- everything else, from the SVG */

  // The world keeps its SVG up to date whether or not anyone can see it. One walk over that tree fills two
  // canvases at once:
  //   flatC  the colour areas, small, to be read back and rebuilt out of dabs
  //   lineC  the line work that is actually visible. Every area erases the lines behind it, so what is left can
  //          be laid over the finished dabs as contour.
  // Whatever the scene shows is therefore in the painting, in the same place, with nothing listed here by name.
  let flatC = null, fa = null, lineC = null, lb = null, grid = null, own = null, cw = 1, jr = Math.random;
  let pal = {}, lean = { a: 0, b: 0 }, far = 0, crisp = false, focused = null;
  const halos = [];
  function buildFigures() {
    flatC = document.createElement('canvas');
    flatC.width = Math.ceil(W * FS);
    flatC.height = Math.ceil(H * FS);
    fa = flatC.getContext('2d', { willReadFrequently: true });
    lineC = document.createElement('canvas');
    lineC.width = cv.width;
    lineC.height = cv.height;
    lb = lineC.getContext('2d');
    dw = clamp(bw * 0.64, 3, 4.8);
    // where dabs may fall on anything that is not a rider: a jittered grid over the whole picture
    const g = dw * 1.15, cols = Math.ceil(W / g), rows = Math.ceil(H / g), r = rng(4711);
    grid = new Float32Array(cols * rows * 4);
    for (let j = 0, k = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++, k += 4) {
        grid[k] = (i + r()) * g;
        grid[k + 1] = (j + r()) * g;
        grid[k + 2] = r();
        grid[k + 3] = r();
      }
    }
    cw = Math.ceil(W / 16) + 1;
    own = new Uint8Array(cw * (Math.ceil(H / 16) + 1));
  }
  function area(p, a, stroke) {
    fa.globalAlpha = a;
    lb.globalAlpha = Math.min(1, a * 1.6);
    lb.globalCompositeOperation = 'destination-out';
    if (stroke) {
      fa.stroke(p);
      lb.stroke(p);
    } else {
      fa.fill(p);
      lb.fill(p);
    }
    lb.globalCompositeOperation = 'source-over';
  }

  // A strip of scenery is one tile and two copies of it. Only what is on screen is walked.
  const firstX = /translate\(([-\d.]+)/, firstM = /M([-\d.]+)[ ,]([-\d.]+)/;
  function walkTiles(wrap, tile, a) {
    const x0 = +(firstX.exec(wrap.getAttribute('transform') || '')?.[1] || 0);
    const period = Math.abs(+wrap.lastElementChild.getAttribute('x')) || 1e9;
    for (const k of [-1, 0, 1]) {
      const ox = x0 + k * period;
      if (ox > vw + 700 || ox + period < -700) continue;
      fa.save();
      lb.save();
      fa.translate(k * period, 0);
      lb.translate(k * period, 0);
      for (let n = tile.firstElementChild; n; n = n.nextElementSibling) {
        // a piece of furniture says where it stands; a pennant is told apart by where its path starts
        if (n._at === undefined) {
          const tf = n.getAttribute('data-f') && n.getAttribute('transform');
          n._at = tf ? +firstX.exec(tf)[1] : n.getAttribute('class')?.startsWith('pennant') ? +firstM.exec(n.getAttribute('d'))[1] : null;
        }
        if (n._at !== null && (ox + n._at < -640 || ox + n._at > vw + 640)) continue;
        walk(n, a);
      }
      fa.restore();
      lb.restore();
    }
  }

  function walk(n, alpha) {
    const tag = n.tagName;
    if (tag === 'defs' || tag === 'use' || n.getAttribute('display') === 'none') return;
    const cls = n.getAttribute('class');
    let a = alpha, skew = 0, pivot = 0, hit = false;
    if (cls) {
      if (GROUND.has(cls)) return;
      if (UNSEEN.has(cls)) {
        // the one hit area that shows is the keyboard focus ring
        if (cls !== 'hit' || !focused || n.parentNode.parentNode !== focused) return;
        hit = true;
      } else if (cls.includes('is-ghost')) a *= 0.16;
      else if (cls === 'tuft') skew = Math.tan(lean.b * -0.45 * 0.01745);
      else if (cls.startsWith('pennant')) {
        skew = Math.tan((cls.length > 7 ? lean.b : lean.a) * 0.01745);
        pivot = n._my ??= +firstM.exec(n.getAttribute('d'))[2];
      }
    }
    const op = n.getAttribute('opacity');
    if (op === '0') return;
    if (op) a *= +op;
    const tf = n.getAttribute('transform');
    fa.save();
    lb.save();
    if (tf) applyTf(n, tf, fa, lb);
    if (skew) {
      // cloth and grass lean with the wind, exactly as the stylesheet leans them
      fa.transform(1, 0, skew, 1, -skew * pivot, 0);
      lb.transform(1, 0, skew, 1, -skew * pivot, 0);
    }
    if (tag === 'g') {
      const first = n.firstElementChild;
      if (first && first.id.startsWith('tile-')) {
        const was = far;
        far = 0.36; // street and shore sit further back in the blue than the riders
        walkTiles(n, first, a);
        far = was;
      } else {
        if (n.getAttribute('data-f') === 'lamp') {
          const m = lb.getTransform();
          halos.push([(m.a * LAMP_HEAD[0] + m.c * LAMP_HEAD[1] + m.e) / dpr, (m.b * LAMP_HEAD[0] + m.d * LAMP_HEAD[1] + m.f) / dpr, Math.abs(m.d) / dpr]);
        }
        for (let k = first; k; k = k.nextElementSibling) walk(k, a);
      }
    } else if (tag === 'text') {
      const st = textStyle(n), x = num(n, 'x'), y = num(n, 'y');
      lb.font = st.font;
      if ('letterSpacing' in lb) lb.letterSpacing = st.ls + 'px';
      lb.textAlign = st.middle ? 'center' : 'left';
      lb.globalAlpha = a;
      if (st.stroke && st.sw) {
        lb.lineJoin = 'round';
        lb.lineWidth = st.sw;
        lb.strokeStyle = st.stroke;
        lb.strokeText(n.textContent, x, y);
      }
      lb.fillStyle = crisp ? st.fill : grade(st.fill, far);
      lb.fillText(n.textContent, x, y);
    } else {
      const p = shapePath(n, tag);
      if (p) shape(n, tag, p, cls, a, hit);
    }
    fa.restore();
    lb.restore();
  }

  function shape(n, tag, p, cls, a, hit) {
    if (hit) {
      lb.globalAlpha = 1;
      lb.strokeStyle = '#ffcf3a';
      lb.lineWidth = (4 * dpr) / Math.abs(lb.getTransform().d);
      lb.stroke(p);
      return;
    }
    let fill = n.getAttribute('fill'), st = n.getAttribute('stroke');
    if (cls) {
      if (FILLS[cls]) fill = pal[FILLS[cls]];
      else if (STROKES[cls]) st = pal[STROKES[cls]];
      else if (cls === 'door') fill = (n._lit ??= hash(n.parentNode.getAttribute('transform')) % 5 < 2) ? LIT : INK; // some of the huts are still up
    }
    fill = plain(fill, pal);
    st = plain(st, pal);
    const sw = +n.getAttribute('stroke-width') || 1, dash = n.getAttribute('stroke-dasharray');
    if (crisp) {
      // marks laid over the picture (the evaluation boxes) are kept as sharp as they are drawn
      const k = n.hasAttribute('vector-effect') ? 1 / s : 1;
      lb.globalAlpha = a;
      if (fill) (lb.fillStyle = fill), lb.fill(p);
      if (st) {
        lb.strokeStyle = st;
        lb.lineWidth = sw * k;
        if (dash) lb.setLineDash(dash.split(/[\s,]+/).map((q) => +q * k));
        lb.stroke(p);
        lb.setLineDash([]);
      }
      return;
    }
    if (fill) {
      if (tag === 'circle' && num(n, 'r') <= 5) {
        // an eye or a hub is a single touch of the brush: keep it whole
        lb.fillStyle = grade(fill, far);
        lb.globalAlpha = a;
        lb.fill(p);
      } else {
        fa.fillStyle = grade(fill, far);
        area(p, a * (+n.getAttribute('fill-opacity') || 1), false);
      }
    }
    if (!st) return;
    const ink = st === INK, col = grade(st, far);
    fa.lineJoin = lb.lineJoin = n.getAttribute('stroke-linejoin') || 'miter';
    fa.lineCap = lb.lineCap = n.getAttribute('stroke-linecap') || 'butt';
    fa.lineWidth = lb.lineWidth = sw;
    if (n.hasAttribute('pathLength')) {
      const cap = neckEnd(n.getAttribute('d'));
      if (cap) (fa.strokeStyle = col), area(cap, a, true);
    } else if (!ink && sw >= 9) {
      // a broad coloured stroke (a neck, say) is an area in its own right
      fa.strokeStyle = col;
      area(p, a, true);
    } else {
      lb.strokeStyle = col;
      lb.globalAlpha = a;
      if (sw <= 2.2 || dash) {
        if (dash) lb.setLineDash(dash.split(/[\s,]+/).map(Number));
        lb.stroke(p);
        lb.setLineDash([]);
        return;
      }
      // A contour is a run of short strokes, never one ruled line: dark ones laid end to end in an
      // uneven rhythm, then a second tone dragged loosely over them, as when a brush is reloaded.
      // The background gets the plain version: at its size the rhythm would only read as a dotted line.
      const u = Math.min(sw, 4.4), w = sw * 0.96, gap = w + u * 0.34;
      lb.lineCap = lb.lineJoin = 'round';
      lb.lineWidth = w;
      if (far) {
        lb.translate((jr() - 0.5) * 1.5, (jr() - 0.5) * 1.5);
        lb.stroke(p);
        return;
      }
      if (ink) {
        lb.setLineDash([u * 2.3, gap, u * 4.6, gap, u * 3.2, gap, u * 6.1, gap, u * 2.8, gap]);
        lb.lineDashOffset = jr() * u * 40;
      }
      lb.save();
      lb.translate((jr() - 0.5) * 1.5, (jr() - 0.5) * 1.5);
      lb.stroke(p);
      lb.restore();
      lb.strokeStyle = tone(col);
      lb.globalAlpha = a * (ink ? 0.9 : 0.8);
      lb.lineWidth = Math.min(sw * (ink ? 0.5 : 0.36), 3.2);
      lb.setLineDash([u * 2.2, u * 3.1, u * 3.4, u * 4.2]);
      lb.lineDashOffset = jr() * u * 13;
      lb.translate((jr() - 0.5) * (sw * 0.3 + 1), (jr() - 0.5) * (sw * 0.3 + 1));
      lb.stroke(p);
      lb.setLineDash([]);
    }
  }

  // Where the dabs of one rider go: fixed to its own box, so the paint travels with it instead of swimming.
  const boxOf = (d) => d.box || [-d.w / 2, -d.h, d.w, d.h];
  function sitesFor(i, kpx) {
    const key = Math.round(kpx * 200);
    if (i._dabs && i._dabs.key === key) return i._dabs;
    const b = boxOf(i.def);
    const n = Math.min(2600, Math.ceil((b[2] * kpx * b[3] * kpx) / (dw * dw * 3.2 * 0.4)));
    const r = rng(hash(i.def.id)), pts = new Float32Array(n * 4);
    for (let k = 0; k < n; k++) {
      pts[k * 4] = b[0] + r() * b[2];
      pts[k * 4 + 1] = b[1] + r() * b[3];
      pts[k * 4 + 2] = r();
      pts[k * 4 + 3] = r();
    }
    return (i._dabs = { key, n, pts });
  }

  const figBatch = batcher();
  function paintScene(boil) {
    const fw = flatC.width, fh = flatC.height, riders = [];
    for (const c of [fa, lb]) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      c.clearRect(0, 0, c.canvas.width, c.canvas.height);
    }
    own.fill(0);
    const rows = own.length / cw;
    for (const i of world.instances) {
      if (!i.vis) continue;
      const d = i.def, b = boxOf(d), px = i.sx * s, py = Y(i.y + (i.bobY || 0)), kpx = i.k * s;
      riders.push({ i, px, py, kpx });
      // contact shadows go straight onto the ground, under everything
      if (!i.air && d.lane !== 'sea' && d.shadow !== false) {
        const sh = d.shadow || [b[0] + b[2] / 2, d.w * 0.46];
        ctx.fillStyle = `rgba(6,10,36,${i.ghost ? 0.08 : 0.5})`;
        ctx.beginPath();
        ctx.ellipse(px + sh[0] * kpx * i.face, py + 3 * kpx, sh[1] * kpx, 9 * kpx, 0, 0, TAU);
        ctx.fill();
      }
      // the cells of the picture that lie wholly inside a rider's box are that rider's to paint
      const x0 = px + (i.face < 0 ? -(b[0] + b[2]) : b[0]) * kpx, y0 = py + b[1] * kpx;
      const c0 = Math.max(0, Math.ceil(x0 / 16)), c1 = Math.min(cw - 1, Math.floor((x0 + b[2] * kpx) / 16) - 1);
      const r0 = Math.max(0, Math.ceil(y0 / 16)), r1 = Math.min(rows - 1, Math.floor((y0 + b[3] * kpx) / 16) - 1);
      if (c1 >= c0) for (let r = r0; r <= r1; r++) own.fill(1, r * cw + c0, r * cw + c1 + 1);
    }
    // the scene, as the SVG has it at this moment
    fa.setTransform(s * FS, 0, 0, s * FS, 0, -top * s * FS);
    lb.setTransform(s * dpr, 0, 0, s * dpr, 0, -top * s * dpr);
    pal = sc.palette;
    lean = sc.leanAt();
    halos.length = 0;
    const el = document.activeElement;
    focused = el && el.classList?.contains('spec') && el.matches(':focus-visible') ? el : null;
    jr = rng(9176 + boil * 7919);
    for (let n = svg.firstElementChild; n; n = n.nextElementSibling) {
      if (n === L.lights) continue;
      crisp = n === L.anno;
      if (n === L.far || n === L.sea || n === L.land || n === L.mid) {
        // loose paths in a layer of scenery (the surf, the zebra crossing) belong to the background too
        for (let k = n.firstElementChild; k; k = k.nextElementSibling) (far = k.tagName === 'g' ? 0 : 0.36), walk(k, 1);
        far = 0;
      } else walk(n, 1);
    }
    crisp = false;

    // underpainting, then dabs read back from it, then the contours
    ctx.drawImage(flatC, 0, 0, W, H);
    const img = fa.getImageData(0, 0, fw, fh).data;
    const lum = (q) => img[q] * 0.3 + img[q + 1] * 0.59 + img[q + 2] * 0.11 - img[q + 3];
    const half = (dw * 3.2) / 2;
    const touch = (X, Y2, r, r2, k, hatch) => {
      const u = (X * FS) | 0, v = (Y2 * FS) | 0;
      if (u < 1 || v < 1 || u >= fw - 1 || v >= fh - 1) return;
      const q = (v * fw + u) * 4;
      if (img[q + 3] < 110) return;
      // strokes follow an edge where there is one, and fall into a slanting hatch where there is not
      const gx = lum(q + 4) - lum(q - 4), gy = lum(q + fw * 4) - lum(q - fw * 4);
      const ang = gx * gx + gy * gy > 1200 ? Math.atan2(gy, gx) + Math.PI / 2 : hatch;
      const l = half * (0.7 + r2 * 0.6), cx = Math.cos(ang) * l, cy = Math.sin(ang) * l;
      figBatch.add(shade(img[q], img[q + 1], img[q + 2], VARIANT[(Math.floor(r * 12) + ((k + boil) % 3 ? 0 : 1)) % 12]), X - cx, Y2 - cy, X + cx, Y2 + cy);
    };
    for (const { i, px, py, kpx } of riders) {
      const st = sitesFor(i, kpx), p = st.pts, face = i.face;
      for (let k = 0; k < st.n; k++) {
        const lx = p[k * 4], ly = p[k * 4 + 1], r2 = p[k * 4 + 3];
        const h = -0.95 + 0.55 * Math.sin(lx * 0.035 + ly * 0.022) + (r2 - 0.5) * 0.5;
        touch(px + lx * kpx * face, py + ly * kpx, p[k * 4 + 2], r2, k, face < 0 ? Math.PI - h : h);
      }
    }
    // everything that is not a rider: the same touch, on sites that stay put on the canvas
    const g = grid, ox = (boil * 37) % 5, oy = (boil * 53) % 5;
    for (let k = 0, n = 0; k < g.length; k += 4, n++) {
      const X = g[k] + ox, Y2 = g[k + 1] + oy;
      if (own[((Y2 / 16) | 0) * cw + ((X / 16) | 0)]) continue;
      touch(X, Y2, g[k + 2], g[k + 3], n, -1.25 + (g[k + 3] - 0.5) * 0.7);
    }
    figBatch.flush(ctx, dw);
    ctx.drawImage(lineC, 0, 0, W, H);

    // street lamps: small suns on poles, ringed like the stars
    const r = rng(311 + boil);
    for (const [hx, hy, k] of halos) {
      if (hx < -80 || hx > W + 80) continue;
      const u = clamp(k * 14, bw * 0.55, bw * 1.1), b = batcher();
      ctx.fillStyle = '#fff6cf';
      ctx.beginPath();
      ctx.arc(hx, hy, u * 1.1, 0, TAU);
      ctx.fill();
      for (let ring = 1; ring < 5; ring++) {
        const rr = u * (0.9 + ring * 0.95), n = Math.round(3 + ring * 3.2);
        for (let j = 0; j < n; j++) {
          if (ring > 2 && r() < 0.3) continue;
          const a = (j / n) * TAU + r() * 0.4;
          const col = ring < 2 ? pick(['#fde98a', '#fad24a'], r()) : ring < 3 ? pick(['#f7b82a', '#fad24a'], r()) : ring < 4 ? pick(['#f39a1f', '#f6e27a'], r()) : pick(['#bfd9a8', '#e3df9c'], r());
          b.add(col, hx + Math.cos(a) * rr, hy + Math.sin(a) * rr, hx + Math.cos(a + 0.42) * rr, hy + Math.sin(a + 0.42) * rr);
        }
      }
      b.flush(ctx, u * 0.64);
    }
  }

  /* ---------------------------------------------------------------- frame */

  const sync = () => ((s = view.s), (top = view.top), (vw = view.vw));
  function resize() {
    W = scene.clientWidth || 1;
    H = scene.clientHeight || 1;
    // a pixel budget: brush strokes are soft, and a big sharp screen need not pay for five million pixels of them
    dpr = Math.max(0.75, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(2.6e6 / (W * H))) * quality);
    cv.width = Math.ceil(W * dpr);
    cv.height = Math.ceil(H * dpr);
    bw = clamp(Math.sqrt(W * H) / 170, 4.2, 8);
    sync();
    chooseStars();
    seedSky();
    buildFigures();
    titleKey = ground.key = '';
  }

  let t = 2, acc = 1, last = performance.now(), raf = 0, alive = true, onScreen = true, cost = 0, slow = 0, mode = 'reveal', seen = '';
  function paint(dt) {
    if (scene.clientWidth !== W || scene.clientHeight !== H) resize();
    sync();
    features();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    const boil = Math.floor(t * 3); // still paint is redone three times a second, like hand-painted animation
    paintSky(t, dt);
    paintTitle(t, dt);
    const g = groundFor();
    ctx.drawImage(g.frames[boil % g.frames.length], 0, g.y0, W, H - g.y0);
    paintScene(boil);
    // the corners fall off into the dark, as varnish does
    const v = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.hypot(W, H) * 0.62);
    v.addColorStop(0, 'rgba(4,7,28,0)');
    v.addColorStop(1, 'rgba(4,7,28,.4)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }
  // everything a still picture depends on: if none of it has changed while the scene is paused, nothing is repainted
  const stillKey = () =>
    [cam.x.toFixed(1), view.s.toFixed(3), view.top.toFixed(1), scene.clientWidth, scene.clientHeight, world.instances.length, world.selected?.def.id, state.evalOn, state.lang, state.wind.toFixed(2),
      L.fx.childElementCount, L.anno.childElementCount, added.length, ground.frames.length, document.activeElement?.dataset?.spec, scene.classList.contains('moon-hot'), sc.moonAt().x.toFixed(0)].join('|');
  function loop(now) {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    const el = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (!onScreen) return;
    acc += el;
    // twelve frames a second, more while the view is moving under a hand, fewer on a machine that cannot keep up
    const moving = cam.vx || cam.follow || svg.classList.contains('is-dragging') || Math.abs(cam.z - cam.zt) > 0.004;
    if (acc < Math.max(moving ? 1 / 20 : 1 / FPS, (cost * (moving ? 1.2 : 1.7)) / 1000)) return;
    const dt = Math.min(acc, 0.2);
    acc = 0;
    if (mode === 'on') world.headless(dt); // while the painting is up, this is the world's clock
    if (state.paused) {
      const key = stillKey();
      if (key === seen) return;
      seen = key;
    } else t += dt;
    const t0 = performance.now();
    paint(state.paused ? 0 : dt);
    cost = cost * 0.8 + (performance.now() - t0) * 0.2;
    // A machine that cannot keep up first gets fewer pixels to paint, and after that fewer frames.
    slow = cost > 88 ? slow + 1 : 0;
    if (slow > 10 && quality > 0.55 && dpr > 0.75) {
      quality *= 0.78;
      slow = 0;
      cost *= 0.62;
      resize();
    }
  }

  // A tap on the sky adds a star; anywhere else it is the scene's to deal with.
  function tapSky(ux, uy) {
    if (uy > Math.min(HORIZON - 30, title ? title.u0 : HORIZON)) return false;
    if (added.length >= 7) added.shift();
    added.push({ x: ux, y: uy, R: (16 + Math.random() * 12) / view.base, tw: 0.6 + Math.random(), born: t });
    return true;
  }
  const onVis = () => {
    cancelAnimationFrame(raf);
    if (!document.hidden && alive) (last = performance.now()), (raf = requestAnimationFrame(loop));
  };
  const io = new IntersectionObserver((es) => (onScreen = es[0].isIntersecting));

  // The painting opens out of the moon and closes back into it.
  const reach = (o) => Math.ceil(Math.max(...[[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => Math.hypot(x - o[0], y - o[1])))) + 4;
  const circle = (o, r) => `circle(${r}px at ${Math.round(o[0])}px ${Math.round(o[1])}px)`;
  const SPREAD = still ? 0 : 1100;
  let timer = 0;

  resize();
  paint(0);
  world.onEmptyTap = tapSky;
  document.addEventListener('visibilitychange', onVis);
  io.observe(scene);
  cv.style.clipPath = circle(origin, 0);
  requestAnimationFrame(() => requestAnimationFrame(() => alive && mode === 'reveal' && (cv.style.clipPath = circle(origin, reach(origin)))));
  timer = setTimeout(() => {
    if (!alive || mode !== 'reveal') return;
    // the picture covers everything now: the world stops drawing itself and runs at the painter's pace
    mode = 'on';
    cv.style.clipPath = 'none';
    world.suspend(true);
    scene.classList.add('is-painted');
  }, SPREAD + 80);
  raf = requestAnimationFrame(loop);

  return {
    canvas: cv,
    get cost() { return cost; },
    get dpr() { return dpr; },
    get mode() { return mode; },
    get stars() { return added; },
    // close the picture back into a point (the moon, wherever it is by now) and hand the world its clock back
    exit(to = origin) {
      if (!alive || mode === 'leaving') return;
      clearTimeout(timer);
      mode = 'leaving';
      world.onEmptyTap = null;
      scene.classList.remove('is-painted');
      world.suspend(false);
      cv.style.transition = 'none';
      cv.style.clipPath = circle(to, reach(to));
      void cv.offsetWidth;
      cv.style.transition = '';
      cv.style.clipPath = circle(to, 0);
      timer = setTimeout(() => {
        alive = false;
        cancelAnimationFrame(raf);
        document.removeEventListener('visibilitychange', onVis);
        io.disconnect();
        for (const i of world.instances) delete i._dabs;
        cv.remove();
      }, SPREAD + 80);
    },
  };
}
