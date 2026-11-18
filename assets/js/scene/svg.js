// Tiny SVG + math helpers. No dependencies.
export const NS = 'http://www.w3.org/2000/svg';
export const TAU = Math.PI * 2;
export const DEG = 180 / Math.PI;

export const INK = '#16204a';
export const OW = 3.6; // outline width shared by every character

export function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}
export const G = (parent, attrs) => el('g', attrs, parent);
export const P = (parent, d, attrs) => el('path', { d, ...attrs }, parent);
export const C = (parent, cx, cy, r, attrs) => el('circle', { cx, cy, r, ...attrs }, parent);
export const E = (parent, cx, cy, rx, ry, attrs) => el('ellipse', { cx, cy, rx, ry, ...attrs }, parent);
export const R = (parent, x, y, width, height, attrs) => el('rect', { x, y, width, height, ...attrs }, parent);
export function T(parent, x, y, text, attrs) {
  const n = el('text', { x, y, ...attrs }, parent);
  n.textContent = text;
  return n;
}

// Outlined flat shape: the house style.
export const shape = (parent, d, fill, extra) =>
  P(parent, d, { fill, stroke: INK, 'stroke-width': OW, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', ...extra });
export const stroke = (parent, d, color, w, extra) =>
  P(parent, d, { fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', ...extra });

// Attribute setter that skips the DOM write when nothing changed.
export function set(node, name, value) {
  const c = node._c || (node._c = {});
  if (c[name] !== value) {
    c[name] = value;
    node.setAttribute(name, value);
  }
}
export const show = (node, on) => set(node, 'display', on ? 'inline' : 'none');

export const f1 = (n) => Math.round(n * 10) / 10;
export const pt = (p) => `${f1(p[0])} ${f1(p[1])}`;
export const tr = (x, y, rot, sx, sy) =>
  `translate(${f1(x)} ${f1(y)})` + (rot ? ` rotate(${f1(rot)})` : '') + (sx != null ? ` scale(${sx}${sy != null ? ' ' + sy : ''})` : '');

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (t) => t * t * (3 - 2 * t);
export const rad = (d) => (d * Math.PI) / 180;
export const dir = (a, l = 1) => [Math.cos(a) * l, -Math.sin(a) * l]; // angle measured anticlockwise on screen
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const mod = (n, m) => ((n % m) + m) % m;
export const wrapSigned = (n, m) => mod(n + m / 2, m) - m / 2;

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Two-bone IK. Returns the middle joint. bend = +1 puts a downward leg's knee forward (+x).
export function ik(a, b, l1, l2, bend = 1) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  let d = Math.hypot(dx, dy);
  if (d >= l1 + l2 - 0.01) {
    const k = l1 / (l1 + l2);
    return [a[0] + dx * k, a[1] + dy * k];
  }
  d = Math.max(d, Math.abs(l1 - l2) + 0.01);
  const A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const ang = Math.atan2(dy, dx) - bend * A;
  return [a[0] + Math.cos(ang) * l1, a[1] + Math.sin(ang) * l1];
}

// A stroked limb with an ink outline underneath: two paths that always share one `d`.
export function limb(parent, w, color, ow = OW) {
  const a = stroke(parent, '', INK, w + ow * 2);
  const b = stroke(parent, '', color, w);
  return {
    d(v) {
      set(a, 'd', v);
      set(b, 'd', v);
    },
    show(on) {
      show(a, on);
      show(b, on);
    },
    els: [a, b],
  };
}

// Tapered ribbon along a quadratic curve: wings, sleeves, tails.
export function ribbon(p0, p1, p2, w0, w1, n = 7) {
  const Ls = [], Rs = [];
  let tx = 0, ty = 0, bx = 0, by = 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0];
    const y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
    let dx = u * (p1[0] - p0[0]) + t * (p2[0] - p1[0]);
    let dy = u * (p1[1] - p0[1]) + t * (p2[1] - p1[1]);
    const m = Math.hypot(dx, dy) || 1;
    dx /= m;
    dy /= m;
    const w = w0 + (w1 - w0) * t;
    Ls.push([x - dy * w, y + dx * w]);
    Rs.push([x + dy * w, y - dx * w]);
    if (i === 0) (bx = dx), (by = dy);
    if (i === n) (tx = dx), (ty = dy);
  }
  let d = `M${pt(Ls[0])}`;
  for (let i = 1; i <= n; i++) d += `L${pt(Ls[i])}`;
  d += `Q${pt([p2[0] + tx * w1 * 1.6, p2[1] + ty * w1 * 1.6])} ${pt(Rs[n])}`;
  for (let i = n - 1; i >= 0; i--) d += `L${pt(Rs[i])}`;
  d += `Q${pt([p0[0] - bx * w0 * 1.3, p0[1] - by * w0 * 1.3])} ${pt(Ls[0])}Z`;
  return d;
}
