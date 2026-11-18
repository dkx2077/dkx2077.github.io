// The two rigs everything is built from: a pelican and a bicycle.
// Ground is y = 0, forward is +x, up is -y.
import { el, G, P, C, E, R, shape, stroke, set, show, limb, ribbon, ik, f1, pt, tr, dir, add, rad, TAU, DEG, INK, OW } from './svg.js';

export const BIKE_COLORS = ['#ef4b3b', '#2f62e0', '#ffcf3a', '#19b28f', '#ff7fae', '#7a5af5', '#ff8a1f', '#1ea7d6'];

export const PAL = {
  white: { body: '#fffdf7', shade: '#f6d7d2', bill: '#ffcb52', pouch: '#ff9a2e', crease: '#e4701a', leg: '#ff8a1f', legFar: '#e06c12', patch: '#ffe1b0' },
  brown: { body: '#b8a590', shade: '#8f7b69', head: '#fff3d1', bill: '#e9c98a', pouch: '#c9774f', crease: '#9a4f30', leg: '#5d5a6e', legFar: '#44425a', patch: '#ffe9c2' },
  chick: { body: '#e7eaf2', shade: '#c6ccdb', bill: '#f6c79a', pouch: '#f3a976', crease: '#d98850', leg: '#f0a36a', legFar: '#d3854c', patch: '#f1f3f8' },
  pink: { body: '#ffe4ea', shade: '#ffbfd0', bill: '#ffd76a', pouch: '#ff8f5a', crease: '#e2643a', leg: '#ff7a59', legFar: '#dd5a3c', patch: '#fff3c9' },
  ghost: { body: '#eef2ff', shade: '#cdd7ff', bill: '#dfe6ff', pouch: '#c3cfff', crease: '#96a6ee', leg: '#aebcf7', legFar: '#8fa0e6', patch: '#ffffff' },
};

/* ------------------------------------------------------------------ wheels */

export function wheel(r, o = {}) {
  const root = G(null);
  if (o.disc) C(root, 0, 0, r - 3, { fill: o.disc, stroke: INK, 'stroke-width': 6 });
  else {
    C(root, 0, 0, r - 3, { fill: 'none', stroke: o.tire || INK, 'stroke-width': 6 });
    C(root, 0, 0, r - 7.4, { fill: 'none', stroke: o.rim || '#e7ecf6', 'stroke-width': 2 });
  }
  const spin = G(root);
  const n = o.spokes ?? Math.max(6, Math.round(r / 4.5));
  if (o.disc) {
    P(spin, `M0 0L${r - 9} 0M0 0L${-(r - 9) * 0.5} ${(r - 9) * 0.87}M0 0L${-(r - 9) * 0.5} ${-(r - 9) * 0.87}`, { stroke: INK, 'stroke-width': 1.6, opacity: 0.35, fill: 'none' });
  } else {
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      d += `M0 0L${f1(Math.cos(a) * (r - 8))} ${f1(Math.sin(a) * (r - 8))}`;
    }
    P(spin, d, { fill: 'none', stroke: INK, 'stroke-width': 1.2, opacity: 0.7 });
  }
  if (o.reflector !== false) R(spin, r * 0.42, -2.6, r * 0.2, 5.2, { rx: 2, fill: o.reflector || '#ffb11f' });
  C(root, 0, 0, Math.max(3, r * 0.1), { fill: INK });
  return { root, spin, r };
}

/* ----------------------------------------------------------------- bicycle */

// Frame tubes: ink underlay, then colour.
export function tubes(g, d, col, w = 5.4) {
  stroke(g, d, INK, w + OW * 1.5 + 0.6);
  return stroke(g, d, col, w);
}
export const saddle = (g, x, y, col = '#3b2f4f') =>
  shape(g, `M${f1(x - 15)} ${f1(y + 5)}q1 -7 10 -7l16 1q7 1 5 5q-9 4 -19 4q-10 1 -12 -3Z`, col, { 'stroke-width': 3 });

// Cranks and pedals around a bottom bracket. Returns update(angle) → pedal positions.
export function crankset(gFar, gNear, BB, cr = 19, ringParent, ringR = 10) {
  const armF = G(gFar);
  stroke(armF, `M0 0L${cr} 0`, INK, 4.5);
  const pedF = R(gFar, -8, -2.5, 16, 5, { rx: 2, fill: INK });
  if (ringParent) C(ringParent, BB[0], BB[1], ringR, { fill: '#fff8e5', stroke: INK, 'stroke-width': 2.6 });
  const armN = G(gNear);
  stroke(armN, `M0 0L${cr} 0`, INK, 4.5);
  C(armN, 0, 0, 3.4, { fill: INK });
  const pedN = R(gNear, -8, -2.5, 16, 5, { rx: 2, fill: INK });
  const out = { near: [0, 0], far: [0, 0] };
  return (ca) => {
    const cx = Math.cos(ca) * cr, cy = Math.sin(ca) * cr;
    out.near = [BB[0] + cx, BB[1] + cy];
    out.far = [BB[0] - cx, BB[1] - cy];
    set(armN, 'transform', tr(BB[0], BB[1], ca * DEG));
    set(armF, 'transform', tr(BB[0], BB[1], ca * DEG + 180));
    set(pedN, 'transform', tr(out.near[0], out.near[1]));
    set(pedF, 'transform', tr(out.far[0], out.far[1]));
    return out;
  };
}

// A diamond-frame bicycle. Options bend it into a city bike, a folding bike, a time-trial bike, a child's bike…
export function bike(o = {}) {
  const r = o.r ?? 46, rf = o.rf ?? r, wb = o.wb ?? 150, col = o.color ?? BIKE_COLORS[0];
  const cr = o.crank ?? 19;
  const Rr = [-wb / 2, -r], F = [wb / 2, -rf];
  const BB = [Rr[0] + wb * (o.bbx ?? 0.42), -Math.max(r - 7, cr + 9)];
  const sa = rad(o.seatAngle ?? 73), ha = rad(o.headAngle ?? 71);
  const fs = o.frame ?? 60;
  const S = [BB[0] - Math.cos(sa) * fs, BB[1] - Math.sin(sa) * fs];
  const forkL = o.fork ?? rf + 4;
  const H2 = [F[0] - Math.cos(ha) * forkL - (o.rake ?? 6), F[1] - Math.sin(ha) * forkL];
  const ht = o.headTube ?? 20;
  const H1 = [H2[0] - Math.cos(ha) * ht, H2[1] - Math.sin(ha) * ht];
  const post = o.post ?? 11;
  const SP = [S[0] - Math.cos(sa) * post, S[1] - Math.sin(sa) * post];
  const stem = o.stem ?? 20;
  const ST = [H1[0] - Math.cos(ha) * stem, H1[1] - Math.sin(ha) * stem];

  const gFar = G(null), gMain = G(null), gNear = G(null);

  // far crank
  const armF = G(gFar);
  stroke(armF, `M0 0L${cr} 0`, INK, 4.5);
  const pedF = R(gFar, -8, -2.5, 16, 5, { rx: 2, fill: INK });

  // wheels
  const wr = wheel(r, { disc: o.discRear, rim: o.rim, spokes: o.spokes });
  const wf = wheel(rf, { rim: o.rim, spokes: o.spokes });
  wr.root.setAttribute('transform', tr(Rr[0], Rr[1]));
  wf.root.setAttribute('transform', tr(F[0], F[1]));
  if (!o.noWheels) gMain.append(wr.root, wf.root);

  if (o.fenders) {
    const arc = (c, rad0) => `M${f1(c[0] - rad0 * 0.94)} ${f1(c[1] - rad0 * 0.34)}A${rad0} ${rad0} 0 0 1 ${f1(c[0] + rad0 * 0.8)} ${f1(c[1] - rad0 * 0.6)}`;
    stroke(gMain, arc(Rr, r + 5) + arc(F, rf + 5), INK, 6.5);
    stroke(gMain, arc(Rr, r + 5) + arc(F, rf + 5), o.fenders === true ? col : o.fenders, 3);
  }

  // chain
  stroke(gMain, `M${f1(BB[0])} ${f1(BB[1] - 9)}L${f1(Rr[0])} ${f1(Rr[1] - 4)}M${f1(BB[0])} ${f1(BB[1] + 9)}L${f1(Rr[0])} ${f1(Rr[1] + 4)}`, INK, 1.5, { opacity: 0.8 });

  // frame: ink underlay then colour, one path each
  const fork = `M${pt(H2)}Q${f1(F[0] - 3)} ${f1(F[1] - forkL * 0.45)} ${pt(F)}`;
  const tubes = `M${pt(BB)}L${pt(S)}L${pt(H1)}M${pt(BB)}L${pt(H2)}M${pt(BB)}L${pt(Rr)}L${pt(S)}M${pt(H1)}L${pt(H2)}${fork}`;
  stroke(gMain, `M${pt(S)}L${pt(SP)}M${pt(H1)}L${pt(ST)}`, INK, 4.5);
  stroke(gMain, tubes, INK, 6 + OW * 1.5);
  stroke(gMain, tubes, col, 5.4);

  // saddle
  shape(gMain, `M${f1(SP[0] - 15)} ${f1(SP[1] - 1)}q1 -7 10 -7l16 1q7 1 5 5q-9 4 -19 4q-10 1 -12 -3Z`, o.saddle || '#3b2f4f', { 'stroke-width': 3 });

  // handlebar
  let grip;
  if (o.bars === 'drop') {
    stroke(gMain, `M${pt(ST)}l12 -1q11 1 9 14q-2 8 -11 8`, INK, 4.5);
    grip = [ST[0] + 19, ST[1] + 5];
  } else if (o.bars === 'aero') {
    stroke(gMain, `M${pt(ST)}l30 -3`, INK, 5);
    stroke(gMain, `M${f1(ST[0] + 22)} ${f1(ST[1] - 2)}l9 -5`, INK, 5);
    grip = [ST[0] + 28, ST[1] - 5];
  } else {
    stroke(gMain, `M${pt(ST)}q15 0 17 -11`, INK, 4.5);
    stroke(gMain, `M${f1(ST[0] + 18)} ${f1(ST[1] - 12)}l-13 -2`, o.grip || '#3b2f4f', 7);
    grip = [ST[0] + 11, ST[1] - 13];
  }
  if (o.bell !== false) C(gMain, ST[0] + 9, ST[1] - 6, 4, { fill: '#ffd76a', stroke: INK, 'stroke-width': 2 });

  let basket = null;
  if (o.basket) {
    basket = G(gMain, { transform: tr(ST[0] + 21, ST[1] + 3) });
    if (typeof o.basket === 'function') o.basket(basket);
    shape(basket, 'M0 0L34 0L30 24L4 24Z', '#f0bd72', { 'stroke-width': 3 });
    stroke(basket, 'M3 8H31M4 16H30M11 0L12 24M23 0L22 24', INK, 1.2, { opacity: 0.55 });
  }
  if (o.lamp) {
    P(gMain, `M${f1(H1[0] + 12)} ${f1(H1[1] + 5)}l150 -34v84Z`, { class: 'beam', fill: 'url(#beamR)', opacity: 0 });
    shape(gMain, `M${f1(H1[0] + 2)} ${f1(H1[1] + 4)}l10 -3v9l-10 -2Z`, '#ffe38a', { 'stroke-width': 2.5 });
  }
  if (o.training) {
    for (const k of [-1, 1]) {
      stroke(gMain, `M${pt(Rr)}L${f1(Rr[0] + k * 13)} ${-8}`, INK, 3);
      C(gMain, Rr[0] + k * 13, -8, 6.5, { fill: '#fff', stroke: INK, 'stroke-width': 3 });
    }
  }

  // chainring + near crank
  const ring = G(gMain, { transform: tr(BB[0], BB[1]) });
  C(ring, 0, 0, o.ring ?? 10, { fill: '#fff8e5', stroke: INK, 'stroke-width': 2.6 });
  const armN = G(gNear);
  stroke(armN, `M0 0L${cr} 0`, INK, 4.5);
  C(armN, 0, 0, 3.4, { fill: INK });
  const pedN = R(gNear, -8, -2.5, 16, 5, { rx: 2, fill: INK });

  const pedals = { near: [0, 0], far: [0, 0] };
  function update(wa, ca) {
    set(wr.spin, 'transform', `rotate(${f1(wa * DEG)})`);
    set(wf.spin, 'transform', `rotate(${f1(((wa * r) / rf) * DEG)})`);
    const cx = Math.cos(ca) * cr, cy = Math.sin(ca) * cr;
    pedals.near = [BB[0] + cx, BB[1] + cy];
    pedals.far = [BB[0] - cx, BB[1] - cy];
    set(armN, 'transform', tr(BB[0], BB[1], ca * DEG));
    set(armF, 'transform', tr(BB[0], BB[1], ca * DEG + 180));
    set(pedN, 'transform', tr(pedals.near[0], pedals.near[1]));
    set(pedF, 'transform', tr(pedals.far[0], pedals.far[1]));
    return pedals;
  }
  update(0, 0.6);
  return { gFar, gMain, gNear, update, pedals, basket, wr, wf, pts: { R: Rr, F, BB, S, SP: [SP[0], SP[1] - 6], H1, H2, ST, grip, r, rf, cr, wb } };
}

/* -------------------------------------------------------------------- fish */

export function fish(parent, o = {}) {
  const g = G(parent);
  const c = o.color || '#7cc4ee';
  shape(g, 'M-11 0l-10 -7l3 7l-3 7Z', o.fin || '#4f9fd6', { 'stroke-width': 2.4 });
  shape(g, 'M-14 0Q0 -11 15 0Q0 11 -14 0Z', c, { 'stroke-width': 2.4 });
  C(g, 8, -1.5, 1.5, { fill: INK });
  return g;
}

/* --------------------------------------------------------------------- hats */

const HATS = {
  cap(g, c = '#ef4b3b') {
    shape(g, 'M13 -12l15 4q3 4 -3 4l-13 -3Z', c, { 'stroke-width': 3 });
    shape(g, 'M-14 -8Q-14 -27 3 -27Q17 -26 17 -11Z', '#fffdf7', { 'stroke-width': 3 });
    stroke(g, 'M-4 -26Q-2 -17 -1 -10', c, 4);
  },
  top(g, c = '#2a2545') {
    shape(g, 'M-12 -15l2 -26h22l2 26Z', c, { 'stroke-width': 3 });
    stroke(g, 'M-11 -20H13', '#ef4b3b', 4, { 'stroke-linecap': 'butt' });
    shape(g, 'M-20 -15h42v4h-42Z', c, { 'stroke-width': 3 });
  },
  helmet(g, c = '#2f62e0') {
    shape(g, 'M-17 -6Q-18 -30 3 -30Q22 -29 21 -9Z', c, { 'stroke-width': 3 });
    stroke(g, 'M-8 -24l10 12M2 -27l9 14M-13 -16l6 6', INK, 2, { opacity: 0.55 });
    stroke(g, 'M-6 -7l3 15', INK, 1.6);
  },
  aero(g, c = '#ffcf3a') {
    shape(g, 'M22 -8Q17 -30 -3 -29Q-30 -24 -54 -6Q-30 -5 -15 -4Z', c, { 'stroke-width': 3 });
    stroke(g, 'M-40 -10Q-18 -18 6 -17', INK, 1.8, { opacity: 0.5 });
  },
  party(g, c = '#ff7fae') {
    shape(g, 'M-10 -11L4 -44L12 -11Z', c, { 'stroke-width': 3 });
    stroke(g, 'M-5 -22l14 3M-1 -32l8 2', '#fffdf7', 3);
    C(g, 4, -46, 4, { fill: '#ffcf3a', stroke: INK, 'stroke-width': 2.4 });
  },
  crown(g, c = '#ffcf3a') {
    shape(g, 'M-12 -11l-3 -18l8 8l7 -12l7 12l8 -8l-3 18Z', c, { 'stroke-width': 3 });
  },
  beret(g, c = '#ef4b3b') {
    shape(g, 'M-18 -11Q-22 -27 0 -27Q20 -27 18 -14Q0 -8 -18 -11Z', c, { 'stroke-width': 3 });
    stroke(g, 'M0 -27l2 -6', INK, 2.4);
  },
  sweat(g, c = '#19b28f') {
    stroke(g, 'M-15 -6Q0 -13 16 -8', INK, 9);
    stroke(g, 'M-15 -6Q0 -13 16 -8', c, 5.4);
  },
};

/* ------------------------------------------------------------------ pelican */

// Body-local frame: origin where the bird sits, +x towards the chest, -y towards the back.
const NECK0 = [58, -38], SHOULDER = [42, -37], LEGROOT = [20, -5];

export function pelican(o = {}) {
  const pal = { ...PAL.white, ...(typeof o.pal === 'string' ? PAL[o.pal] : o.pal || {}) };
  const L = o.legs || [34, 36];
  const neckW = o.neckW ?? 15;
  const far = G(null), mid = G(null), near = G(null);

  // far side
  const wingF = shape(far, '', pal.shade);
  const legF = limb(far, 6, pal.legFar);
  const footF = shape(far, 'M-5 -3L15 -2Q21 1 15 5L-5 5Z', pal.legFar, { 'stroke-width': 2.8 });

  // body
  const neck = limb(mid, neckW, pal.head || pal.body);
  const bodyG = G(mid);
  shape(bodyG, 'M-4 -42L-38 -40L-30 -27L-10 -14Z', pal.body);
  E(bodyG, 28, -27, 45, 30, { fill: pal.body, stroke: INK, 'stroke-width': OW });
  P(bodyG, 'M-12 -16Q22 14 68 -14Q26 -2 -12 -16Z', { fill: pal.shade, opacity: 0.9 });
  if (o.jersey) {
    P(bodyG, 'M0 -44Q28 -66 60 -44Q66 -30 62 -14Q28 2 -6 -14Q-8 -32 0 -44Z', { fill: o.jersey, opacity: 0.96 });
    E(bodyG, 28, -27, 45, 30, { fill: 'none', stroke: INK, 'stroke-width': OW });
    if (o.bib) {
      R(bodyG, 12, -40, 26, 20, { rx: 3, fill: '#fffdf7', stroke: INK, 'stroke-width': 2 });
      const t = el('text', { x: 25, y: -24, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, fill: INK, 'font-family': 'Archivo, system-ui, sans-serif' }, bodyG);
      t.textContent = o.bib;
    }
  }
  const fold = shape(bodyG, ribbon([46, -44], [14, -56], [-28, -30], 14, 3), pal.body);
  stroke(bodyG, 'M30 -40Q12 -44 -6 -34', INK, 1.6, { opacity: 0.35 });
  if (o.scarf) {
    shape(bodyG, 'M50 -50l-26 -9l7 12Z', o.scarf, { 'stroke-width': 3 });
    shape(bodyG, 'M46 -56Q58 -47 72 -52L73 -43Q58 -37 46 -46Z', o.scarf, { 'stroke-width': 3 });
  }

  // head: bill and skull under the neck cap, face on top of it
  const headA = G(mid);
  const inPouch = G(headA);
  const pouch = shape(headA, '', pal.pouch, o.pouchOpacity ? { 'fill-opacity': o.pouchOpacity } : null);
  const crease = stroke(headA, '', pal.crease, 1.6, { opacity: 0.7 });
  const upper = shape(headA, 'M8 -9L84 -1Q93 0 92 9Q88 5 82 5L8 5Z', pal.bill);
  E(headA, 0, 0, 16, 14.5, { fill: pal.head || pal.body, stroke: INK, 'stroke-width': OW });
  const neckCap = stroke(mid, '', pal.head || pal.body, neckW - 0.4, { pathLength: 1, 'stroke-dasharray': '0 0.72 0.28 0', 'stroke-linecap': 'butt' });
  const headB = G(mid);
  shape(headB, 'M-11 -9q-10 -7 -16 0q7 -1 10 5Z', pal.head || pal.body, { 'stroke-width': 3 });
  E(headB, 5, -2, 8, 7, { fill: pal.patch });
  const eye = C(headB, 5, -3, 3.4, { fill: INK });
  C(headB, 6.2, -4.2, 1.1, { fill: '#fff' });
  if (o.shades) {
    shape(headB, 'M-3 -9h17l-2 9q-7 3 -13 0Z', '#2a2545', { 'stroke-width': 2.4 });
    stroke(headB, 'M-3 -8l-12 -2', INK, 2.4);
  }
  if (o.monocle) {
    C(headB, 5, -3, 7.5, { fill: 'rgba(255,255,255,.35)', stroke: '#c79a2b', 'stroke-width': 2.4 });
    stroke(headB, 'M5 5q-3 14 -10 22', '#c79a2b', 1.4);
  }
  if (o.hat && HATS[o.hat]) {
    const hg = G(headB, o.hatScale ? { transform: `scale(${o.hatScale}) translate(-1 3)` } : null);
    HATS[o.hat](hg, o.hatColor);
  }

  // near side
  const legN = limb(near, 6, pal.leg);
  const footN = shape(near, 'M-5 -3L15 -2Q21 1 15 5L-5 5Z', pal.leg, { 'stroke-width': 2.8 });
  const wingN = shape(near, '', pal.body);
  const tipN = o.tips ? shape(near, '', INK, { 'stroke-width': 2 }) : null;

  const st = { H: [0, 0], head: 0, sag: 16, gulp: 0 };

  function wing(node, tipNode, Sh, p, k, off) {
    if (p.hand) {
      const h = p.hand, m = [(Sh[0] + h[0]) / 2, (Sh[1] + h[1]) / 2 + (p.bend ?? 12)];
      set(node, 'd', ribbon(Sh, m, h, 11 * k, 5 * k));
      show(node, true);
      if (tipNode) show(tipNode, false);
    } else if (p.flap != null) {
      const a = p.flap + off, len = (p.span ?? 96) * k;
      const tip = add(Sh, dir(a + 0.5, len)), m = add(Sh, dir(a + 0.95, len * 0.5));
      set(node, 'd', ribbon(Sh, m, tip, 21 * k, 7 * k, 8));
      show(node, true);
      if (tipNode) {
        const m2 = add(Sh, dir(a + 0.72, len * 0.76));
        set(tipNode, 'd', ribbon(m2, add(m2, dir(a + 0.45, len * 0.14)), tip, 12 * k, 6.5 * k, 4));
        show(tipNode, true);
      }
    } else {
      show(node, false);
      if (tipNode) show(tipNode, false);
    }
  }

  function leg(lm, ft, root, target) {
    if (!target) {
      lm.show(false);
      show(ft, false);
      return;
    }
    lm.show(true);
    show(ft, true);
    const a = [target[0], target[1] - 5];
    const k = ik(root, a, L[0], L[1], target[3] ?? 1);
    lm.d(`M${pt(root)}L${pt(k)}L${pt(a)}`);
    set(ft, 'transform', tr(a[0], a[1], target[2] || 0));
  }

  /**
   * hip [x,y] · lean (rad, chest up) · neckAng (rad from +x, anticlockwise) · neckLen · head (rad, bill up)
   * footN/footF [x,y,angleDeg] · handN/handF [x,y] · flap (rad) for flight · sag, open for the bill
   */
  function pose(p) {
    const lean = p.lean ?? 0.55;
    const c = Math.cos(lean), s = Math.sin(lean), hx = p.hip[0], hy = p.hip[1];
    const X = (v) => [hx + v[0] * c + v[1] * s, hy - v[0] * s + v[1] * c];
    set(bodyG, 'transform', tr(hx, hy, -lean * DEG));
    const N0 = X(NECK0), Sh = X(SHOULDER), Lr = X(LEGROOT);
    const na = p.neckAng ?? 1.3, nl = p.neckLen ?? 58;
    const H = add(N0, dir(na, nl));
    const c1 = add(N0, dir(na + 0.75, nl * 0.55)), c2 = add(H, dir(na - 0.55 + Math.PI, nl * 0.5));
    const nd = `M${pt(N0)}C${pt(c1)} ${pt(c2)} ${pt(H)}`;
    neck.d(nd);
    set(neckCap, 'd', nd);
    const head = p.head ?? -0.12;
    const ht = tr(H[0], H[1], -head * DEG);
    set(headA, 'transform', ht);
    set(headB, 'transform', ht);
    const sg = (p.sag ?? 16) + st.gulp * 16;
    set(pouch, 'd', `M4 3L84 4.5C74 ${f1(6 + sg * 0.75)} 46 ${f1(8 + sg)} 24 ${f1(8 + sg * 0.92)}C12 ${f1(8 + sg * 0.7)} 2 ${f1(12 + sg * 0.25)} -6 10Z`);
    set(crease, 'd', `M18 ${f1(7 + sg * 0.42)}Q46 ${f1(6 + sg * 0.62)} 72 ${f1(6 + sg * 0.26)}`);
    set(upper, 'transform', `rotate(${f1(-((p.open ?? 0) + st.gulp * 0.5) * DEG)} 8 0)`);
    const near2 = p.handN ? { hand: p.handN, bend: p.bend } : p.flap != null ? { flap: p.flap, span: p.span } : {};
    const far2 = p.handF ? { hand: p.handF, bend: p.bend } : p.flap != null ? { flap: p.flapF ?? p.flap, span: p.span } : {};
    wing(wingN, tipN, Sh, near2, 1, 0);
    wing(wingF, null, add(Sh, [5, -3]), far2, 0.92, p.flapF != null ? 0 : 0.22);
    show(fold, !p.handN && p.flap == null);
    leg(legN, footN, Lr, p.footN);
    leg(legF, footF, add(Lr, [5, -2]), p.footF);
    st.H = H;
    st.head = head;
    st.sag = sg;
  }

  return {
    far, mid, near, pose, inPouch, headB, bodyG, eye,
    // where a thrown fish should land: the middle of the pouch
    beak() {
      const c = Math.cos(st.head), s = Math.sin(st.head);
      return [st.H[0] + 50 * c + 14 * s, st.H[1] - 50 * s + 14 * c];
    },
    headPos: () => st.H,
    setGulp(v) {
      st.gulp = v;
    },
  };
}

// Convenience: append rigs in the right depth order for "rider on vehicle".
export function mount(parent, bird, vehicle) {
  parent.append(bird.far, vehicle.gFar, vehicle.gMain, bird.mid, vehicle.gNear, bird.near);
}
