// Starry Night mode: the scene repainted in visible brush strokes, after Van Gogh's 1889 painting.
// Loaded only when someone clicks the moon. The world keeps running underneath; this module steps it
// and paints what it sees onto one canvas, twelve frames a second, like hand-painted animation.
import { depth, HORIZON } from '../scene/scenery.js';

const TAU = Math.PI * 2, FPS = 12;
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
const hash = (str) => [...str].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) | 0, 7);
const pick = (arr, v) => arr[clamp(Math.floor(v * arr.length), 0, arr.length - 1)];

const SKY = ['#0b1438', '#0e1a4c', '#122260', '#172c76', '#1c378c', '#2244a2', '#2a55b6', '#3668c6', '#4a80d2', '#6599dc', '#86b3e4', '#abcbe8', '#cfe0e6', '#ece6c6'];
const GOLD = ['#e8791a', '#f39a1f', '#f7b82a', '#fad24a', '#fde98a', '#fff6cf'];
const HALO = ['#bfd9a8', '#e3df9c', '#9cc7e6', '#f6e27a'];
const PALETTE = [...SKY, ...GOLD, ...HALO];
const G0 = SKY.length, H0 = G0 + GOLD.length;
const LIGHT = ['#fff8dc', '#fdeaa0', '#f9d65e', '#f7b82a', '#d7ecec', '#b4d5ee', '#ffffff'];
const SEA = ['#0d1a4f', '#11246a', '#162f82', '#1c3d98', '#2255a6', '#2a6eae', '#3888b6'];
const INK = '#16204a', NIGHT_INK = '#0a1130';

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

/* ------------------------------------------- reading a rider's SVG tree */

const P2 = new Map();
const path2d = (d) => {
  let p = P2.get(d);
  if (!p) {
    if (P2.size > 5000) P2.clear();
    P2.set(d, (p = new Path2D(d)));
  }
  return p;
};
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixHex = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(lerp(v, hex(b)[i], t)).toString(16).padStart(2, '0')).join('');
const moonlit = new Map();
// daylight colours, regraded for a night under a yellow moon
function grade(c) {
  let v = moonlit.get(c);
  if (v) return v;
  v = c;
  if (c[0] === '#' && c.length === 7) {
    const [r, g, b] = hex(c), mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0, lum = r * 0.3 + g * 0.59 + b * 0.11;
    if (lum < 62) v = NIGHT_INK;
    else if (sat < 0.16 && lum > 190) v = mixHex(c, '#bccbea', 0.5);
    else if (sat < 0.32 && lum > 150) v = mixHex(c, '#8494cc', 0.5);
    else if (r > 200 && g > 110 && b < 130) v = c;
    else v = mixHex(c, '#1c2c78', 0.2);
  }
  moonlit.set(c, v);
  return v;
}
const TF = /(translate|rotate|scale)\(([^)]*)\)/g;
function transform(c, str) {
  TF.lastIndex = 0;
  let m;
  while ((m = TF.exec(str))) {
    const a = m[2].trim().split(/[\s,]+/).map(Number);
    if (m[1] === 'translate') c.translate(a[0], a[1] || 0);
    else if (m[1] === 'scale') c.scale(a[0], a.length > 1 ? a[1] : a[0]);
    else if (a.length > 2) {
      c.translate(a[1], a[2]);
      c.rotate((a[0] * Math.PI) / 180);
      c.translate(-a[1], -a[2]);
    } else c.rotate((a[0] * Math.PI) / 180);
  }
}
function shapePath(n, tag) {
  if (tag === 'path') {
    const d = n.getAttribute('d');
    return d ? path2d(d) : null;
  }
  const num = (k) => +n.getAttribute(k) || 0;
  if (tag === 'circle') {
    const p = new Path2D();
    p.arc(num('cx'), num('cy'), num('r'), 0, TAU);
    return p;
  }
  if (tag === 'ellipse') {
    const p = new Path2D();
    p.ellipse(num('cx'), num('cy'), num('rx'), num('ry'), 0, 0, TAU);
    return p;
  }
  if (tag === 'rect') {
    const p = new Path2D(), rx = num('rx');
    if (rx && p.roundRect) p.roundRect(num('x'), num('y'), num('width'), num('height'), rx);
    else p.rect(num('x'), num('y'), num('width'), num('height'));
    return p;
  }
  return null;
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
const FONTS = { 'crate-text': '800 17px', 'screen-text': '700 13px', 'bubble-num': '800 22px', 'bubble-unit': '600 14px', 'banner-text': '800 23px' };

/* ------------------------------------------------------------------ mode */

export function enterStarry({ scene, world, label = '', still = false, onMoon }) {
  const cv = document.createElement('canvas');
  cv.className = 'starry-canvas';
  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', label);
  scene.insertBefore(cv, scene.querySelector('.world-svg').nextSibling);
  const ctx = cv.getContext('2d');

  let quality = 1, W = 1, H = 1, dpr = 1, s = 1, top = 0, vw = 1, skyH = 1, bw = 6, narrow = false;
  const vy = (y) => (y - top) * s;

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
  // A dark contour drawn twice, slightly off, so it reads as a loaded brush rather than a ruled line.
  function contour(c, path, rnd, width = bw * 0.55, color = NIGHT_INK) {
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.strokeStyle = color;
    for (const [k, a] of [[1, 1], [0.5, 0.6]]) {
      c.save();
      c.translate((rnd() - 0.5) * bw * 0.35, (rnd() - 0.5) * bw * 0.35);
      c.globalAlpha = a;
      c.lineWidth = width * k;
      c.stroke(path);
      c.restore();
    }
  }

  /* ------------------------------------------------------------------ sky */

  let stars = [], swirls = [], moon = null, parts = null;

  function layoutSky() {
    const m = Math.min(vw, skyH * 1.5), r = rng(1889);
    const A = { x: vw * 0.47, y: top + skyH * 0.4, r: m * 0.17, ph: 0 };
    const B = { x: A.x + A.r * 1.7, y: A.y + A.r * 0.5, r: m * 0.115, ph: 2 };
    swirls = [A, B];
    // the moon hangs clear of the text at the top of the page: it is the way back, and has to be tappable
    const R = m * (narrow ? 0.062 : 0.05), bar = (scene.querySelector('.topbar')?.offsetHeight || 0) / s;
    moon = { x: vw * (narrow ? 0.8 : 0.88), y: top + Math.max(skyH * 0.17, bar + R * 2.1), R, tw: 0.5, moon: true };
    const added = stars.filter((q) => q.born);
    stars = [moon];
    for (const [fx, fy] of [[0.2, 0.2], [0.3, 0.52], [0.38, 0.08], [0.62, 0.1], [0.74, 0.36], [0.94, 0.52], [0.15, 0.66], [0.83, 0.68]]) {
      const st = { x: vw * fx, y: top + skyH * fy * 0.82 + 20, R: m * (0.014 + r() * r() * 0.026), tw: 0.5 + r() * 0.8, born: 0 };
      if (Math.hypot(st.x - A.x, st.y - A.y) > A.r * 1.1 && Math.hypot(st.x - B.x, st.y - B.y) > B.r * 1.1 && Math.hypot(st.x - moon.x, st.y - moon.y) > moon.R * 4.4) stars.push(st);
    }
    for (const q of added) if (q.x < vw && q.y > top) stars.push(q);
  }

  // Unit vector of the paint flow at a point: a slow drift to the right, bent into whirlpools.
  function flow(x, y, t, out) {
    let fx = 1, fy = 0.34 * Math.sin(x * 0.0052 + y * 0.004 + t * 0.2);
    for (const v of swirls) {
      const dx = x - v.x, dy = y - v.y, d = Math.hypot(dx, dy) + 0.01;
      const w = 5 * Math.exp(-((d / (v.r * 1.3)) ** 2));
      fx += w * (dy / d - (dx / d) * 0.16);
      fy += w * (-dx / d - (dy / d) * 0.16);
    }
    for (const v of stars) {
      const dx = x - v.x, dy = y - v.y, d = Math.hypot(dx, dy) + 0.01;
      if (d > v.R * 4) continue;
      const w = 7 * Math.exp(-((d / (v.R * 2.1)) ** 2));
      fx += (w * dy) / d;
      fy += (-w * dx) / d;
    }
    const m = Math.hypot(fx, fy) || 1;
    out[0] = fx / m;
    out[1] = fy / m;
  }

  function skyIndex(x, y, r, r2, t) {
    for (const st of stars) {
      const d = Math.hypot(x - st.x, y - st.y) / st.R;
      if (d > 3.2) continue;
      if (st.moon) {
        if (d < 1.25) return G0 + (r < 0.3 ? 3 : r < 0.7 ? 4 : 5);
        if (d < 2 && r2 < 0.85) return r < 0.5 ? H0 + 3 : G0 + 3;
      } else if (d < 0.55) return G0 + (r < 0.5 ? 5 : 4);
      else if (d < 1.1) return G0 + (r < 0.22 ? 1 : r < 0.6 ? 2 : 3);
      const ring = Math.floor(d * 2.4 - t * st.tw + r * 0.7);
      if (r2 < 1 - (d - 1) / 2.2) return ring % 2 ? H0 + (r < 0.5 ? 0 : 1) : H0 + (r < 0.6 ? 2 : 3);
    }
    let L = 0.2 + 0.09 * Math.sin((y + 60 * Math.sin(x * 0.004 + 1.3)) * 0.021 + t * 0.12);
    for (const v of swirls) {
      const d = Math.hypot(x - v.x, y - v.y);
      L += Math.exp(-((d / (v.r * 1.2)) ** 2)) * (0.3 + 0.3 * Math.cos((d / v.r) * 8.5 - t * 0.8 + v.ph));
      if (d < v.r * 0.3) L += 0.28;
    }
    const hg = (y - (HORIZON - skyH * 0.3)) / (skyH * 0.3);
    if (hg > 0) L += 0.2 * hg * hg;
    L += (r - 0.5) * 0.4;
    return clamp(Math.floor(L * SKY.length), 0, SKY.length - 1);
  }

  const cloud = (n) => ({ n, x: new Float32Array(n), y: new Float32Array(n), r: new Float32Array(n), r2: new Float32Array(n), life: new Float32Array(n) });
  function spawn(p, i, y0, y1, fresh) {
    p.x[i] = Math.random() * vw;
    p.y[i] = y0 + Math.random() * (y1 - y0);
    p.r[i] = Math.random();
    p.r2[i] = Math.random();
    p.life[i] = (fresh ? Math.random() : 1) * (3 + Math.random() * 5);
  }
  function seedSky() {
    parts = cloud(Math.min(8000, Math.ceil((W * (vy(HORIZON) + 10)) / (bw * bw * 3.4 * 0.58))));
    for (let i = 0; i < parts.n; i++) spawn(parts, i, top, HORIZON + 14, true);
  }
  // Midpoint steps: plain Euler flings paint out of every whirlpool and leaves a hole in the middle.
  const F = [0, 0], F1 = [0, 0];
  function advect(p, i, t, speed) {
    const x = p.x[i], y = p.y[i];
    flow(x, y, t, F1);
    flow(x + F1[0] * speed * 0.5, y + F1[1] * speed * 0.5, t, F);
    p.x[i] = x + F[0] * speed;
    p.y[i] = y + F[1] * speed;
  }

  const skyBatch = batcher();
  function paintSky(t, dt) {
    ctx.fillStyle = '#0f1b50';
    ctx.fillRect(0, 0, W, vy(HORIZON) + 12);
    const p = parts, half = (bw * 3.4) / s / 2, speed = 52 * dt;
    for (let i = 0; i < p.n; i++) {
      advect(p, i, t, speed);
      const x = p.x[i], y = p.y[i];
      if ((p.life[i] -= dt) < 0 || x < -30 || x > vw + 30 || y < top - 30 || y > HORIZON + 20) {
        spawn(p, i, top, HORIZON + 14, false);
        continue;
      }
      const l = half * (0.65 + p.r2[i] * 0.7);
      skyBatch.add(PALETTE[skyIndex(x, y, p.r[i], p.r2[i], t)], (x - F[0] * l) * s, vy(y - F[1] * l), (x + F[0] * l) * s, vy(y + F[1] * l));
    }
    skyBatch.flush(ctx, bw, PALETTE);
    // every star gets a thick centre, laid on last like the final touch of a loaded brush
    ctx.lineCap = 'round';
    for (const st of stars) {
      if (st.moon) continue;
      const x = st.x * s, y = vy(st.y), R = st.R * s, grow = st.born ? clamp((t - st.born) * 2.5, 0.2, 1) : 1;
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
    // the moon: a pale disc with an orange crescent cut into it
    const mx = moon.x * s, my = vy(moon.y), R = moon.R * s;
    ctx.fillStyle = '#fde98a';
    ctx.beginPath();
    ctx.arc(mx, my, R * 1.12, 0, TAU);
    ctx.fill();
    for (let k = 0; k < 16; k++) {
      const rr = R * (0.3 + (k % 4) * 0.24), a0 = k * 2.1 + Math.sin(t * 2 + k) * 0.08;
      ctx.strokeStyle = ['#fff6cf', '#fad24a', '#fde98a', '#f6e27a'][k % 4];
      ctx.lineWidth = bw;
      ctx.beginPath();
      ctx.arc(mx, my, rr, a0, a0 + 0.9);
      ctx.stroke();
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(mx - R * 0.08, my, R * 0.84, 0, TAU);
    ctx.clip();
    ctx.fillStyle = '#f08a1c';
    ctx.fillRect(mx - R * 2, my - R * 2, R * 4, R * 4);
    for (let k = 0; k < 7; k++) {
      const a0 = 1.9 + k * 0.36 + Math.sin(t * 3 + k) * 0.05;
      ctx.strokeStyle = GOLD[k % 3];
      ctx.lineWidth = bw * 0.9;
      ctx.beginPath();
      ctx.arc(mx - R * 0.08, my, R * (0.5 + (k % 2) * 0.2), a0, a0 + 0.42);
      ctx.stroke();
    }
    ctx.fillStyle = '#fde98a';
    ctx.beginPath();
    ctx.arc(mx + R * 0.34, my - R * 0.06, R * 0.74, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#fff6cf';
    ctx.lineWidth = bw * 0.8;
    ctx.beginPath();
    ctx.arc(mx + R * 0.34, my - R * 0.06, R * 0.5, 0.4 + Math.sin(t * 2) * 0.1, 2.6);
    ctx.stroke();
    ctx.restore();
  }

  /* ---------------------------------------------------------------- name */

  let title = null;
  function layoutTitle() {
    const lines = narrow ? ['KAIXIN', 'DENG'] : ['KAIXIN DENG'];
    const px = narrow ? W * 0.19 : Math.min(W * 0.104, H * 0.25);
    const font = `900 expanded ${px}px Archivo, "Arial Black", "Helvetica Neue", sans-serif`;
    const base = vy(HORIZON) + px * 0.06, y0 = base - lines.length * px * 0.8 - px * 0.1;
    // everything happens in a band just tall enough for the letters
    const oy = Math.floor(y0 - 8), bh = Math.ceil(base + px * 0.14 - oy);
    const m = document.createElement('canvas');
    m.width = cv.width;
    m.height = Math.ceil(bh * dpr);
    const c = m.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, -oy * dpr);
    c.font = font;
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    lines.forEach((ln, i) => c.fillText(ln, W / 2, base - (lines.length - 1 - i) * px * 0.8));
    const tmp = document.createElement('canvas');
    tmp.width = m.width;
    tmp.height = m.height;
    const p = cloud(Math.ceil((W * (base - y0)) / (bw * bw * 2.4 * 0.5)));
    title = { mask: m, tmp, tc: tmp.getContext('2d'), lines, font, base, px, oy, bh, y0: top + y0 / s, y1: top + base / s, p };
    for (let i = 0; i < p.n; i++) spawn(p, i, title.y0, title.y1, true);
  }
  // The name is cut out of a field of light strokes that follow the same flow as the sky.
  const litBatch = batcher();
  function paintTitle(t, dt) {
    const { tc, p, oy, bh } = title;
    tc.setTransform(dpr, 0, 0, dpr, 0, -oy * dpr);
    tc.globalCompositeOperation = 'source-over';
    tc.fillStyle = '#f3e7a8';
    tc.fillRect(0, oy, W, bh);
    const half = (bw * 2.8) / s / 2, speed = 40 * dt;
    for (let i = 0; i < p.n; i++) {
      advect(p, i, t, speed);
      const x = p.x[i], y = p.y[i];
      if ((p.life[i] -= dt) < 0 || x < -20 || x > vw + 20 || y < title.y0 - 10 || y > title.y1 + 10) {
        spawn(p, i, title.y0, title.y1, false);
        continue;
      }
      const band = Math.sin(x * 0.012 + y * 0.03 - t * 0.6) * 0.5 + 0.5;
      litBatch.add(LIGHT[Math.floor(clamp(band * 0.55 + p.r[i] * 0.6, 0, 0.999) * LIGHT.length)], (x - F[0] * half) * s, vy(y - F[1] * half), (x + F[0] * half) * s, vy(y + F[1] * half));
    }
    litBatch.flush(tc, bw * 0.82);
    tc.globalCompositeOperation = 'destination-in';
    tc.setTransform(1, 0, 0, 1, 0, 0);
    tc.drawImage(title.mask, 0, 0);
    ctx.drawImage(title.tmp, 0, oy, W, title.tmp.height / dpr);
    ctx.font = title.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = NIGHT_INK;
    for (const [k, a] of [[1, 0.95], [0.5, 0.55]]) {
      ctx.globalAlpha = a;
      ctx.lineWidth = bw * 0.6 * k;
      const jx = (Math.random() - 0.5) * bw * 0.3, jy = (Math.random() - 0.5) * bw * 0.3;
      title.lines.forEach((ln, i) => ctx.strokeText(ln, W / 2 + jx, title.base - (title.lines.length - 1 - i) * title.px * 0.8 + jy));
    }
    ctx.globalAlpha = 1;
  }

  /* ----------------------------------------------- painted, still layers */

  // Each layer is painted three times with a different hand; cycling them makes the still parts breathe.
  function layer(x, y, w, h, paint) {
    const frames = [0, 1, 2].map((k) => {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(w * dpr));
      c.height = Math.max(1, Math.ceil(h * dpr));
      const g = c.getContext('2d');
      g.scale(dpr, dpr);
      g.translate(-x, -y);
      paint(g, rng(77 + k * 131));
      return c;
    });
    return { x, y, w, h, frames };
  }
  const put = (L, k) => ctx.drawImage(L.frames[k % 3], L.x, L.y, L.w, L.h);
  const flat = (r) => (r - 0.5) * 0.16;
  let back = null, sea = null, land = null, tree = null;

  function paintBack(c, rnd) {
    const hy = vy(HORIZON);
    const hill = (x0, x1, h) => {
      const p = new Path2D();
      p.moveTo(x0, hy + 4);
      p.bezierCurveTo(lerp(x0, x1, 0.25), hy - h * 1.2, lerp(x0, x1, 0.45), hy - h * 0.3, lerp(x0, x1, 0.62), hy - h * 0.9);
      p.bezierCurveTo(lerp(x0, x1, 0.8), hy - h * 1.3, lerp(x0, x1, 0.92), hy - h * 0.2, x1, hy + 4);
      p.closePath();
      c.save();
      c.clip(p);
      c.fillStyle = '#132567';
      c.fill(p);
      dab(c, rnd, x0, hy - h * 1.4, x1, hy + 6, {
        len: bw * 3, angle: (x) => Math.sin(((x - x0) / (x1 - x0)) * 9) * 0.5,
        color: (x, y, r) => pick(['#0e1a4c', '#132567', '#1a308a', '#2244a2', '#2f5ec4', '#4a80d2'], r * 0.8 + (hy - y) / (h * 4)),
      });
      c.restore();
      contour(c, p, rnd);
    };
    hill(-W * 0.05, W * 0.3, 58 * s);
    hill(W * 0.64, W * 1.06, 70 * s);
    // the lighthouse stands where the steeple would
    const lx = W * 0.79, lb = hy - 50 * s, lh = 112 * s, lw = 15 * s;
    const tower = new Path2D();
    tower.moveTo(lx - lw, lb);
    tower.lineTo(lx - lw * 0.55, lb - lh);
    tower.lineTo(lx, lb - lh - lw * 1.6);
    tower.lineTo(lx + lw * 0.55, lb - lh);
    tower.lineTo(lx + lw, lb);
    tower.closePath();
    c.fillStyle = '#0c1640';
    c.fill(tower);
    dab(c, rnd, lx - lw, lb - lh, lx + lw, lb, { len: bw * 2, width: bw * 0.6, angle: () => 1.5, color: (x, y, r) => (Math.abs(x - lx) < lw * 0.7 ? pick(['#101c50', '#1a2c78', '#27409a'], r) : null) });
    contour(c, tower, rnd, bw * 0.5);
    c.fillStyle = '#f9c82e';
    c.fillRect(lx - lw * 0.3, lb - lh * 0.93, lw * 0.6, lw * 0.7);
  }

  // the sea, with the moon and stars laid on it as broken columns of light
  function paintSea(c, rnd) {
    const hy = vy(HORIZON), y1 = vy(610);
    c.fillStyle = '#12256a';
    c.fillRect(0, hy, W, y1 - hy);
    dab(c, rnd, 0, hy, W, y1, {
      angle: (x, y, r) => flat(r),
      color(x, y, r) {
        const d = (y - hy) / (y1 - hy);
        for (const st of stars) {
          if (st.born) continue;
          const dx = Math.abs(x - st.x * s), wide = bw * (st.moon ? 3 + d * 12 : 1.5 + d * 5);
          if (dx < wide && r < (st.moon ? 0.62 : 0.3)) return pick(['#f7b82a', '#fad24a', '#fde98a', '#fff6cf'], rnd());
        }
        return pick(SEA, d * 0.75 + r * 0.38 - 0.05);
      },
    });
    dab(c, rnd, 0, vy(600), W, vy(609), { len: bw * 3.6, width: bw * 0.7, gap: 1.6, angle: (x, y, r) => flat(r), color: (x, y, r) => pick(['#cfe0e6', '#abcbe8', '#ece6c6'], r) });
  }

  function paintLand(c, rnd) {
    const Y = vy;
    dab(c, rnd, 0, Y(607), W, Y(664), { angle: (x, y, r) => flat(r), color: (x, y, r) => pick(['#444a86', '#55558f', '#6a66a0', '#807ab0', '#8a7d68', '#a2946a'], r) });
    // beach huts as the village: dark roofs, a few windows still lit
    const hp = depth(656), hw = 250 * hp * s, wall = 250 * hp * s, roof = 122 * hp * s, hb = Y(658);
    const hut = (x, lit, k) => {
      const body = new Path2D();
      body.rect(x, hb - wall, hw, wall);
      c.save();
      c.clip(body);
      c.fillStyle = '#2f4196';
      c.fill(body);
      dab(c, rnd, x, hb - wall, x + hw, hb, { len: bw * 2.6, width: bw * 0.8, angle: (a, b, r) => 1.57 + flat(r), color: (a, b, r) => pick(k % 2 ? ['#283886', '#33479c', '#4059b2', '#5470c4'] : ['#3a3f8c', '#4a4fa0', '#5c63b4', '#7078c2'], r) });
      c.restore();
      const cap = new Path2D();
      cap.moveTo(x - hw * 0.1, hb - wall + 2);
      cap.lineTo(x + hw / 2, hb - wall - roof);
      cap.lineTo(x + hw * 1.1, hb - wall + 2);
      cap.closePath();
      c.save();
      c.clip(cap);
      c.fillStyle = '#141d4d';
      c.fill(cap);
      dab(c, rnd, x - hw * 0.1, hb - wall - roof, x + hw * 1.1, hb - wall + 2, { len: bw * 2.4, width: bw * 0.8, angle: (a) => (a < x + hw / 2 ? -0.75 : 0.75), color: (a, b, r) => pick(k % 3 === 0 ? ['#3a1f33', '#52283a', '#6a3440'] : ['#0e1642', '#141d4d', '#1e2c6e'], r) });
      c.restore();
      contour(c, body, rnd, bw * 0.5);
      contour(c, cap, rnd, bw * 0.5);
      if (lit) {
        const wx = x + hw * 0.3, wy = hb - wall * 0.72, ws = hw * 0.4;
        c.fillStyle = '#f7b82a';
        c.fillRect(wx, wy, ws, ws);
        dab(c, rnd, wx, wy, wx + ws, wy + ws, { len: bw * 1.4, width: bw * 0.55, gap: 0.6, angle: (a, b, r) => r * 3, color: (a, b, r) => pick(['#f39a1f', '#fad24a', '#fde98a', '#fff6cf'], r) });
        const fr = new Path2D();
        fr.rect(wx, wy, ws, ws);
        contour(c, fr, rnd, bw * 0.4);
      }
    };
    const step = (292 * hp * s) / W;
    [0.14, 0.14 + step, 0.56, 0.56 + step, 0.56 + step * 2, 0.56 + step * 3].forEach((fx, k) => hut(W * fx, k === 1 || k === 2 || k === 5, k));

    // boardwalk and its railing
    dab(c, rnd, 0, Y(656), W, Y(724), { angle: (x, y, r) => flat(r), color: (x, y, r) => pick(['#39366c', '#463f80', '#564b8a', '#6a5b9a', '#7767a6'], r) });
    const rp = depth(658), rail = new Path2D();
    for (const h of [165, 88]) {
      rail.moveTo(-10, Y(658) - h * rp * s);
      rail.lineTo(W + 10, Y(658) - h * rp * s);
    }
    for (let x = (W / 2) % (320 * rp * s); x < W; x += 320 * rp * s) {
      rail.moveTo(x, Y(658));
      rail.lineTo(x, Y(658) - 172 * rp * s);
    }
    contour(c, rail, rnd, bw * 0.34, '#aab4e6');

    // street lamps: small suns on poles, ringed like the stars
    const lp = depth(662);
    for (const fx of [0.36, 0.95]) {
      const x = W * fx, y1 = Y(662), y0 = y1 - 330 * lp * s, hx = x + 70 * lp * s;
      const pole = new Path2D();
      pole.moveTo(x, y1);
      pole.lineTo(x, y0 + 30 * lp * s);
      pole.quadraticCurveTo(x, y0, hx, y0);
      contour(c, pole, rnd, bw * 0.6);
      c.fillStyle = '#fff6cf';
      c.beginPath();
      c.arc(hx, y0, bw * 1.1, 0, TAU);
      c.fill();
      const b = batcher();
      for (let ring = 1; ring < 5; ring++) {
        const rr = bw * (0.9 + ring * 0.95), n = Math.round(3 + ring * 3.2);
        for (let k = 0; k < n; k++) {
          if (ring > 2 && rnd() < 0.3) continue;
          const a = (k / n) * TAU + rnd() * 0.4;
          const col = ring < 2 ? pick(['#fde98a', '#fad24a'], rnd()) : ring < 3 ? pick(['#f7b82a', '#fad24a'], rnd()) : ring < 4 ? pick(['#f39a1f', '#f6e27a'], rnd()) : pick(['#bfd9a8', '#e3df9c'], rnd());
          b.add(col, hx + Math.cos(a) * rr, y0 + Math.sin(a) * rr, hx + Math.cos(a + 0.42) * rr, y0 + Math.sin(a + 0.42) * rr);
        }
      }
      b.flush(c, bw * 0.7);
    }

    // verge, road, kerb, sand in front
    dab(c, rnd, 0, Y(722), W, Y(742), { len: bw * 2.2, angle: (x, y, r) => -1.2 + r * 0.9, color: (x, y, r) => pick(['#0c2228', '#123035', '#1a423e', '#235247', '#3a6a4a', '#8a9a4a'], r * r) });
    c.fillStyle = '#1a2150';
    c.fillRect(0, Y(738), W, Y(974) - Y(738));
    dab(c, rnd, 0, Y(738), W, Y(974), { len: bw * 4.2, angle: (x, y, r) => flat(r) * 0.7, color: (x, y, r) => pick(['#131943', '#182050', '#1f2960', '#283372', '#313e86', '#3c4b98'], r * 0.9 + (r > 0.93 ? 0.3 : 0)) });
    for (const [u, off] of [[838, 30], [905, 190]]) {
      const p = depth(u), b = batcher();
      for (let x = W / 2 + (off - 1800) * p * s; x < W + 200; x += 320 * p * s) {
        if (x < -200) continue;
        for (let k = 0; k < 3; k++) {
          const x0 = x + (k / 3) * 150 * p * s, y = Y(u) + (rnd() - 0.5) * bw * 0.5;
          b.add(pick(['#d9cc86', '#e9dc98', '#c4b876'], rnd()), x0, y, x0 + 46 * p * s, y + (rnd() - 0.5) * 2);
        }
      }
      b.flush(c, bw * 0.62);
    }
    dab(c, rnd, 0, Y(972), W, Y(990), { len: bw * 3.6, width: bw * 0.8, angle: (x, y, r) => flat(r) * 0.5, color: (x, y, r) => pick(['#5c659e', '#6f78b0', '#848dc2', '#9aa3d0'], r) });
    dab(c, rnd, 0, Y(988), W, H + 4, { angle: (x, y, r) => flat(r) * 2, color: (x, y, r) => pick(['#232857', '#2d3266', '#383c74', '#454676', '#55506a', '#6a6258'], r) });
  }

  function cypress(c, rnd, x, base, tip, wide) {
    const flame = (cx, b, t2, w, ph) => {
      const L = [], R = [];
      for (let k = 0; k <= 26; k++) {
        const u = k / 26, y = lerp(b, t2, u);
        const half = w * Math.pow(1 - u, 0.62) * (1 + 0.22 * Math.sin(u * 15 + ph)) + 1;
        const mid = cx + Math.sin(u * 8 + ph) * w * 0.22 * u;
        L.push([mid - half, y]);
        R.push([mid + half, y]);
      }
      const p = new Path2D();
      p.moveTo(L[0][0], L[0][1]);
      for (const q of L) p.lineTo(q[0], q[1]);
      for (const q of R.reverse()) p.lineTo(q[0], q[1]);
      p.closePath();
      c.save();
      c.clip(p);
      c.fillStyle = '#0b1420';
      c.fill(p);
      dab(c, rnd, cx - w * 1.5, t2, cx + w * 1.5, b, {
        len: bw * 4.4, gap: 0.42,
        angle: (px, py) => -1.57 + Math.sin((py - t2) * 0.03 + ph) * 0.5 + ((px - cx) / w) * 0.35,
        color: (px, py, r) => pick(['#070d18', '#0b1420', '#10231c', '#17301f', '#1f3f27', '#2a2a1a', '#3b3a22', '#152a5a', '#2c5a3a'], r * r * 1.15),
      });
      c.restore();
      contour(c, p, rnd, bw * 0.5, '#05080f');
    };
    flame(x + wide * 0.95, base, lerp(base, tip, 0.56), wide * 0.6, 2.1);
    flame(x, base, tip, wide, 0.4);
  }

  function buildLayers() {
    const hy = vy(HORIZON);
    back = layer(0, hy - 200 * s, W, 200 * s + 8, paintBack);
    sea = layer(0, hy - 2, W, vy(612) - hy + 4, paintSea);
    land = layer(0, vy(606) - bw * 12, W, H - vy(606) + bw * 12, paintLand);
    const tx = W * (narrow ? 0.05 : 0.04), wide = clamp(W * 0.028, 13, 46), tip = vy(top + skyH * (narrow ? 0.36 : 0.14)), base = vy(742);
    tree = layer(tx - wide * 2.4, tip - 10, wide * 5.2, base - tip + 14, (c, rnd) => cypress(c, rnd, tx, base, tip, wide));
  }

  /* --------------------------------------------------------------- riders */

  // Two canvases are filled in one walk of each rider's SVG tree:
  //   flatC  the colour areas, small, to be read back and rebuilt out of dabs
  //   lineC  the line work that is actually visible. Every area erases the lines behind it,
  //          so what is left can be laid over the finished dabs as contour.
  const FS = 0.5;
  let flatC = null, fa = null, lineC = null, lb = null, dw = 3.6, jr = Math.random;
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
  function walk(n, alpha) {
    if (n.getAttribute('display') === 'none') return;
    const cls = n.getAttribute('class');
    if (cls === 'hit' || cls === 'beam' || cls === 'shadow') return;
    const op = n.getAttribute('opacity');
    if (op === '0') return;
    const a = op ? alpha * +op : alpha, tag = n.tagName, tf = n.getAttribute('transform');
    fa.save();
    lb.save();
    if (tf) {
      transform(fa, tf);
      transform(lb, tf);
    }
    if (tag === 'g') for (let k = n.firstElementChild; k; k = k.nextElementSibling) walk(k, a);
    else if (tag === 'text') {
      lb.font = `${FONTS[cls] || '800 ' + (n.getAttribute('font-size') || 16) + 'px'} Archivo, sans-serif`;
      lb.textAlign = n.getAttribute('text-anchor') === 'middle' ? 'center' : 'left';
      lb.fillStyle = grade(n.getAttribute('fill') || INK);
      lb.globalAlpha = a;
      lb.fillText(n.textContent, +n.getAttribute('x'), +n.getAttribute('y'));
    } else {
      const p = shapePath(n, tag);
      if (p) {
        const fill = n.getAttribute('fill'), st = n.getAttribute('stroke');
        if (fill && fill !== 'none' && fill !== 'transparent' && fill[0] !== 'u') {
          if (tag === 'circle' && +n.getAttribute('r') <= 5) {
            // an eye or a hub is a single touch of the brush: keep it whole
            lb.fillStyle = grade(fill);
            lb.globalAlpha = a;
            lb.fill(p);
          } else {
            fa.fillStyle = grade(fill);
            area(p, a * (+n.getAttribute('fill-opacity') || 1), false);
          }
        }
        if (st && st !== 'none' && st !== 'transparent') {
          const sw = +n.getAttribute('stroke-width') || 1, ink = st === INK;
          for (const c of [fa, lb]) {
            c.lineJoin = n.getAttribute('stroke-linejoin') || 'miter';
            c.lineCap = n.getAttribute('stroke-linecap') || 'butt';
            c.lineWidth = sw;
          }
          if (n.hasAttribute('pathLength')) {
            const cap = neckEnd(n.getAttribute('d'));
            if (cap) {
              fa.strokeStyle = grade(st);
              area(cap, a, true);
            }
          } else if (!ink && sw >= 9) {
            // a broad coloured stroke (a neck, say) is an area in its own right
            fa.strokeStyle = grade(st);
            area(p, a, true);
          } else {
            const col = grade(st);
            lb.strokeStyle = col;
            lb.globalAlpha = a;
            if (sw <= 2.2) lb.stroke(p);
            else {
              // A contour is a run of short strokes, never one ruled line: dark ones laid end to end in an
              // uneven rhythm, then a second tone dragged loosely over them, as when a brush is reloaded.
              const u = Math.min(sw, 4.4), w = sw * 0.96, gap = w + u * 0.34;
              lb.lineCap = lb.lineJoin = 'round';
              lb.lineWidth = w;
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
        }
      }
    }
    fa.restore();
    lb.restore();
  }

  // Where the dabs of one rider go: fixed to its own box, so the paint travels with it instead of swimming.
  function sitesFor(i, kpx) {
    const key = Math.round(kpx * 200);
    if (i._dabs && i._dabs.key === key) return i._dabs;
    const b = i.def.box || [-i.def.w / 2, -i.def.h, i.def.w, i.def.h];
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

  const figBatch = batcher();
  function paintFigures(list, frame) {
    if (!list.length) return;
    fa.setTransform(1, 0, 0, 1, 0, 0);
    fa.globalAlpha = 1;
    fa.clearRect(0, 0, flatC.width, flatC.height);
    lb.setTransform(1, 0, 0, 1, 0, 0);
    lb.globalAlpha = 1;
    lb.globalCompositeOperation = 'source-over';
    lb.clearRect(0, 0, lineC.width, lineC.height);
    for (const f of list) {
      const { i, px, py, kpx } = f;
      if (!i.air) {
        const sh = i.def.shadow || [0, i.def.w * 0.46];
        ctx.fillStyle = 'rgba(6,10,36,.5)';
        ctx.beginPath();
        ctx.ellipse(px + sh[0] * kpx * i.face, py + 3 * kpx, sh[1] * kpx, 9 * kpx, 0, 0, TAU);
        ctx.fill();
      }
      jr = rng((i._seed ??= hash(i.def.id)) + (frame >> 2) * 7919);
      fa.setTransform(FS * kpx * i.face, 0, 0, FS * kpx, FS * px, FS * py);
      lb.setTransform(dpr * kpx * i.face, 0, 0, dpr * kpx, dpr * px, dpr * py);
      walk(i.inner, 1);
    }
    // underpainting, then dabs read back from it, then the contours
    ctx.drawImage(flatC, 0, 0, W, H);
    const fw = flatC.width, fh = flatC.height, img = fa.getImageData(0, 0, fw, fh).data;
    const lum = (q) => img[q] * 0.3 + img[q + 1] * 0.59 + img[q + 2] * 0.11 - img[q + 3];
    const half = (dw * 3.2) / 2, boil = frame >> 2;
    for (const f of list) {
      const { i, px, py, kpx } = f, st = sitesFor(i, kpx), p = st.pts, face = i.face;
      for (let k = 0; k < st.n; k++) {
        const lx = p[k * 4], ly = p[k * 4 + 1], r = p[k * 4 + 2], r2 = p[k * 4 + 3];
        const X = px + lx * kpx * face, Y = py + ly * kpx;
        const u = (X * FS) | 0, v = (Y * FS) | 0;
        if (u < 1 || v < 1 || u >= fw - 1 || v >= fh - 1) continue;
        const q = (v * fw + u) * 4;
        if (img[q + 3] < 110) continue;
        // strokes follow an edge where there is one, and fall into a slanting hatch where there is not
        const gx = lum(q + 4) - lum(q - 4), gy = lum(q + fw * 4) - lum(q - fw * 4);
        let ang;
        if (gx * gx + gy * gy > 1200) ang = Math.atan2(gy, gx) + Math.PI / 2;
        else {
          ang = -0.95 + 0.55 * Math.sin(lx * 0.035 + ly * 0.022) + (r2 - 0.5) * 0.5;
          if (face < 0) ang = Math.PI - ang;
        }
        const l = half * (0.7 + r2 * 0.6), cx = Math.cos(ang) * l, cy = Math.sin(ang) * l;
        figBatch.add(shade(img[q], img[q + 1], img[q + 2], VARIANT[(Math.floor(r * 12) + ((k + boil) % 3 ? 0 : 1)) % 12]), X - cx, Y - cy, X + cx, Y + cy);
      }
    }
    figBatch.flush(ctx, dw);
    ctx.drawImage(lineC, 0, 0, W, H);
  }

  /* ---------------------------------------------------------------- frame */

  function resize() {
    W = scene.clientWidth || 1;
    H = scene.clientHeight || 1;
    // a pixel budget: brush strokes are soft, and a big sharp screen need not pay for five million pixels of them
    dpr = Math.max(0.75, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(2.6e6 / (W * H))) * quality);
    cv.width = Math.ceil(W * dpr);
    cv.height = Math.ceil(H * dpr);
    narrow = W < 720;
    s = Math.min(H / 1230, W / 820);
    vw = W / s;
    top = 1010 - H / s;
    skyH = HORIZON - top;
    bw = clamp(Math.sqrt(W * H) / 170, 4.2, 8);
    layoutSky();
    seedSky();
    layoutTitle();
    buildLayers();
    buildFigures();
  }

  let t = 0, frame = 0, acc = 1, last = performance.now(), raf = 0, alive = true, onScreen = true, cost = 0, slow = 0;
  function paint(dt) {
    world.headless(dt, vw);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    paintSky(t, dt);
    put(back, frame >> 2);
    paintTitle(t, dt);
    // who is in the picture, and where
    const afloat = [], ashore = [];
    for (const i of world.instances) {
      if (!i.vis || i.def.id === 'crossing') continue;
      const lane = i.def.lane, kpx = i.k * s;
      const py = !i.air ? vy(i.y + (i.bobY || 0)) : vy(title.y0 - 26 - (lane === 'high' ? skyH * 0.2 : 0));
      (lane === 'sea' ? afloat : ashore).push({ i, px: i.sx * s, py, kpx, z: i.air ? 1e6 : i.y });
    }
    ashore.sort((a, b) => a.z - b.z);
    put(sea, frame >> 2);
    paintFigures(afloat, frame);
    put(land, frame >> 2);
    put(tree, (frame >> 2) + 1);
    paintFigures(ashore, frame);
    // the corners fall off into the dark, as varnish does
    const g = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.hypot(W, H) * 0.62);
    g.addColorStop(0, 'rgba(4,7,28,0)');
    g.addColorStop(1, 'rgba(4,7,28,.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    frame++;
  }
  function loop(now) {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    const el = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (still || !onScreen) return;
    acc += el;
    if (acc < Math.max(1 / FPS, (cost * 1.7) / 1000)) return;
    const dt = Math.min(acc, 0.2);
    acc = 0;
    t += dt;
    const t0 = performance.now();
    paint(dt);
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

  const onDown = (e) => {
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / s, y = top + (e.clientY - r.top) / s;
    if (Math.hypot(x - moon.x, y - moon.y) < Math.max(moon.R * 1.6, 30 / s)) return onMoon?.();
    if (y > title.y0 - 10) return;
    const extra = stars.filter((q) => q.born);
    if (extra.length >= 7) stars.splice(stars.indexOf(extra[0]), 1);
    stars.push({ x, y, R: Math.min(vw, skyH * 1.5) * (0.018 + Math.random() * 0.016), tw: 0.6 + Math.random(), born: t || 1 });
    if (still) paint(0);
  };
  const onVis = () => {
    cancelAnimationFrame(raf);
    if (!document.hidden && alive) (last = performance.now()), (raf = requestAnimationFrame(loop));
  };
  let rz = 0;
  const ro = new ResizeObserver(() => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      if (!alive || (scene.clientWidth === W && scene.clientHeight === H)) return;
      resize();
      acc = 1;
      if (still) paint(0);
    }, 160);
  });
  const io = new IntersectionObserver((es) => (onScreen = es[0].isIntersecting));

  // take over the clock
  const wasPaused = world.state.paused;
  world.suspend(true);
  world.state.paused = false;
  resize();
  t = 2;
  paint(1 / FPS);
  cv.addEventListener('pointerdown', onDown);
  document.addEventListener('visibilitychange', onVis);
  ro.observe(scene);
  io.observe(scene);
  requestAnimationFrame(() => cv.classList.add('is-on'));
  raf = requestAnimationFrame(loop);

  return {
    canvas: cv,
    get cost() { return cost; },
    get dpr() { return dpr; },
    get stars() { return stars; },
    get moon() { return { x: moon.x * s, y: vy(moon.y), r: moon.R * s }; },
    setLabel: (text) => cv.setAttribute('aria-label', text),
    exit() {
      if (!alive) return;
      alive = false;
      cancelAnimationFrame(raf);
      cv.removeEventListener('pointerdown', onDown);
      document.removeEventListener('visibilitychange', onVis);
      ro.disconnect();
      io.disconnect();
      for (const i of world.instances) delete i._dabs, delete i._seed;
      world.state.paused = wasPaused;
      world.suspend(false);
      cv.classList.remove('is-on');
      setTimeout(() => cv.remove(), 1200);
    },
  };
}
