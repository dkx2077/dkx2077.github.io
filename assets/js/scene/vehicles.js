// Vehicles that the standard diamond frame cannot bend into.
import { G, P, C, E, R, T, shape, stroke, set, limb, f1, pt, tr, DEG, TAU, INK, OW } from './svg.js';
import { wheel, tubes, saddle, crankset, PAL } from './parts.js';

const place = (w, c) => (w.root.setAttribute('transform', tr(c[0], c[1])), w);
const spin = (w, a) => set(w.spin, 'transform', `rotate(${f1(a * DEG)})`);

export function tandem(col = '#19b28f') {
  const r = 46, Rr = [-125, -r], F = [125, -r], B2 = [-66, -39], B1 = [34, -39];
  const S2 = [-83.5, -96.4], S1 = [16.5, -96.4], H2 = [102.7, -93.3], H1 = [96.2, -112.2], ST = [89.7, -131];
  const gFar = G(null), gMain = G(null), gNear = G(null);
  const wr = place(wheel(r), Rr), wf = place(wheel(r), F);
  gMain.append(wr.root, wf.root);
  stroke(gMain, `M${B2[0]} ${B2[1] - 9}L${Rr[0]} ${Rr[1] - 4}M${B2[0]} ${B2[1] + 9}L${Rr[0]} ${Rr[1] + 4}M${B2[0]} ${B2[1] - 9}L${B1[0]} ${B1[1] - 9}M${B2[0]} ${B2[1] + 9}L${B1[0]} ${B1[1] + 9}`, INK, 1.5, { opacity: 0.8 });
  stroke(gMain, `M${pt(S2)}l-3.2 -11M${pt(S1)}l-3.2 -11M${pt(H1)}L${pt(ST)}M${f1(S1[0] - 4)} ${f1(S1[1] - 6)}l-22 -6`, INK, 4.5);
  tubes(gMain, `M${pt(B2)}L${pt(S2)}L${pt(S1)}L${pt(H1)}M${pt(B1)}L${pt(S1)}M${pt(B2)}L${pt(B1)}L${pt(H2)}M${pt(B2)}L${pt(Rr)}L${pt(S2)}M${pt(H1)}L${pt(H2)}Q${F[0] - 3} ${F[1] - 22} ${pt(F)}`, col);
  saddle(gMain, S2[0] - 3.2, S2[1] - 17);
  saddle(gMain, S1[0] - 3.2, S1[1] - 17);
  stroke(gMain, `M${pt(ST)}q15 0 17 -11`, INK, 4.5);
  stroke(gMain, `M${ST[0] + 18} ${ST[1] - 12}l-13 -2`, '#3b2f4f', 7);
  const c2 = crankset(gFar, gNear, B2, 19, gMain), c1 = crankset(gFar, gNear, B1, 19, gMain);
  return {
    gFar, gMain, gNear,
    pts: { r, SP1: [S1[0] - 3.2, S1[1] - 17], SP2: [S2[0] - 3.2, S2[1] - 17], grip: [ST[0] + 11, ST[1] - 13], B2 },
    update(wa, ca) {
      spin(wr, wa);
      spin(wf, wa);
      return { front: c1(ca), rear: c2(ca + 1.2) };
    },
  };
}

export function penny(col = '#2a2545') {
  const r = 60, rs = 18, F = [14, -r], Rr = [-78, -rs];
  const gFar = G(null), gMain = G(null), gNear = G(null);
  const wr = place(wheel(rs, { spokes: 6, reflector: false }), Rr), wf = place(wheel(r, { spokes: 20 }), F);
  gMain.append(wr.root, wf.root);
  stroke(gMain, 'M4 -132l6 -14', INK, 4.5);
  tubes(gMain, `M4 -132C-40 -140 -70 -92 ${pt(Rr)}M4 -132L${pt(F)}`, col);
  saddle(gMain, -20, -146, '#7a4a2a');
  stroke(gMain, 'M10 -146q12 -6 18 4', INK, 4.5);
  stroke(gMain, 'M28 -142l-2 8', '#7a4a2a', 7);
  C(gMain, 14, -150, 4, { fill: '#ffd76a', stroke: INK, 'stroke-width': 2 });
  const c = crankset(gFar, gNear, F, 19, gMain, 6);
  return {
    gFar, gMain, gNear,
    pts: { r, SP: [-20, -146], grip: [27, -139] },
    update(wa) {
      spin(wf, wa);
      spin(wr, (wa * r) / rs);
      return c(wa);
    },
  };
}

export function unicycle(col = '#7a5af5') {
  const r = 40, A = [0, -r];
  const gFar = G(null), gMain = G(null), gNear = G(null);
  const w = place(wheel(r, { spokes: 12 }), A);
  gMain.append(w.root);
  tubes(gMain, 'M0 -40L0 -100', col);
  saddle(gMain, 2, -110, '#3b2f4f');
  const c = crankset(gFar, gNear, A, 17, gMain, 6);
  return { gFar, gMain, gNear, pts: { r, SP: [0, -110] }, update: (wa) => (spin(w, wa), c(wa)) };
}

export function cargo(col = '#2f62e0', label = 'PAPERS') {
  const r = 44, rf = 30, Rr = [-112, -r], F = [120, -rf], BB = [-54, -37], S = [-71, -95], H1 = [-6, -112], H2 = [4, -66], ST = [-10, -130];
  const gFar = G(null), gMain = G(null), gNear = G(null);
  const wr = place(wheel(r), Rr), wf = place(wheel(rf, { spokes: 8 }), F);
  gMain.append(wr.root, wf.root);
  stroke(gMain, `M${BB[0]} ${BB[1] - 9}L${Rr[0]} ${Rr[1] - 4}M${BB[0]} ${BB[1] + 9}L${Rr[0]} ${Rr[1] + 4}`, INK, 1.5, { opacity: 0.8 });
  stroke(gMain, `M${pt(S)}l-3.4 -11M${pt(H1)}L${pt(ST)}`, INK, 4.5);
  tubes(gMain, `M${pt(BB)}L${pt(S)}L${pt(H1)}L${pt(H2)}L${pt(BB)}L${pt(Rr)}L${pt(S)}M${pt(H2)}L10 -34H100L${pt(F)}`, col);
  saddle(gMain, S[0] - 3.4, S[1] - 17);
  stroke(gMain, `M${pt(ST)}q14 0 16 -11`, INK, 4.5);
  stroke(gMain, `M${ST[0] + 17} ${ST[1] - 12}l-13 -2`, '#3b2f4f', 7);
  // the load: a stack of journals, a rolled poster, a pennant
  const load = G(gMain);
  const books = [['#ef4b3b', 0], ['#ffcf3a', 3], ['#19b28f', -2], ['#ff7fae', 2], ['#7a5af5', -1]];
  books.forEach(([c, dx], n) => {
    shape(load, `M${22 + dx} ${-80 - n * 11}h62v-11h-62Z`, c, { 'stroke-width': 2.6 });
    P(load, `M${30 + dx} ${-80 - n * 11}v-11m4 11v-11`, { stroke: '#fffdf7', 'stroke-width': 2, fill: 'none', opacity: 0.8 });
  });
  shape(load, 'M30 -138l44 -8l2 9l-44 8Z', '#fffdf7', { 'stroke-width': 2.6 });
  stroke(load, 'M92 -80V-166', INK, 3);
  const flag = shape(load, 'M92 -166h34l-8 10l8 10h-34Z', '#ef4b3b', { 'stroke-width': 2.6 });
  shape(gMain, 'M8 -34L13 -82H99L104 -34Z', '#e9b872', { 'stroke-width': OW });
  stroke(gMain, 'M11 -58H101M35 -82L33 -34M77 -82L79 -34', INK, 1.4, { opacity: 0.4 });
  const text = T(gMain, 56, -42, label, { class: 'crate-text', 'text-anchor': 'middle' });
  const c = crankset(gFar, gNear, BB, 19, gMain);
  return {
    gFar, gMain, gNear, flag, text,
    pts: { r, SP: [S[0] - 3.4, S[1] - 17], grip: [ST[0] + 10, ST[1] - 13] },
    update(wa, ca) {
      spin(wr, wa);
      spin(wf, (wa * r) / rf);
      return c(ca);
    },
  };
}

export function exerciseBike() {
  const gFar = G(null), gMain = G(null), gNear = G(null);
  const BB = [-2, -44];
  stroke(gMain, 'M-66 -3H66M-66 -3v-8M66 -3v-8', INK, 9);
  stroke(gMain, 'M-66 -3H66', '#c9cfe0', 4);
  const fly = place(wheel(30, { disc: '#c9cfe0', reflector: '#ef4b3b' }), [34, -40]);
  gMain.append(fly.root);
  stroke(gMain, 'M-24 -98l-3 -12M38 -124l-14 -6', INK, 4.5);
  tubes(gMain, 'M-6 -8L-24 -98M-2 -44L34 -40M30 -8L38 -124M-6 -8H30', '#55608a');
  saddle(gMain, -27, -116);
  stroke(gMain, 'M24 -130l-8 3', '#3b2f4f', 7);
  shape(gMain, 'M30 -156h44v30h-44Z', '#16204a', { 'stroke-width': 3 });
  const screen = T(gMain, 52, -136, '0.0 km', { class: 'screen-text', 'text-anchor': 'middle' });
  const c = crankset(gFar, gNear, BB, 19, gMain);
  return {
    gFar, gMain, gNear, screen,
    pts: { SP: [-27, -116], grip: [19, -128] },
    update(wa, ca) {
      spin(fly, wa);
      return c(ca);
    },
  };
}

export function waterBike(col = '#ffcf3a') {
  const gFar = G(null), gMain = G(null), gNear = G(null);
  const BB = [6, -36];
  shape(gFar, 'M-84 -22h170q22 0 22 10t-22 10h-170q-14 0 -14 -10t14 -10Z', '#e7b21c', { transform: 'translate(8 -6)' });
  const paddle = G(gMain, { transform: tr(-74, -30) });
  const blades = G(paddle);
  let d = '';
  for (let n = 0; n < 6; n++) {
    const a = (n / 6) * TAU;
    d += `M0 0L${f1(Math.cos(a) * 24)} ${f1(Math.sin(a) * 24)}`;
  }
  stroke(blades, d, INK, 7);
  stroke(blades, d, '#ef4b3b', 3.6);
  C(paddle, 0, 0, 5, { fill: INK });
  stroke(gMain, 'M-24 -74l-3 -12M36 -92l-12 -8', INK, 4.5);
  tubes(gMain, 'M-12 -14L-24 -74M6 -36L-74 -30M6 -36L42 -14M42 -14L36 -92M-12 -14L6 -36', '#fffdf7');
  saddle(gMain, -27, -92);
  stroke(gMain, 'M26 -101l-8 3', '#3b2f4f', 7);
  shape(gNear, 'M-84 -12h170q22 0 22 10t-22 10h-170q-14 0 -14 -10t14 -10Z', col);
  stroke(gNear, 'M-70 -4H80', '#fffdf7', 3, { opacity: 0.7 });
  const c = crankset(gFar, gMain, BB, 17, gMain, 8);
  return {
    gFar, gMain, gNear,
    pts: { SP: [-27, -92], grip: [21, -99] },
    update(wa, ca) {
      set(blades, 'transform', `rotate(${f1(wa * DEG)})`);
      return c(ca);
    },
  };
}

// A pelican curled up tightly enough to serve as a wheel.
export function rollBird(r, pal = PAL.white) {
  const root = G(null), sp = G(root);
  C(sp, 0, 0, r - 2, { fill: pal.body, stroke: INK, 'stroke-width': OW });
  stroke(sp, `M${f1(-r * 0.55)} ${f1(r * 0.2)}A${f1(r * 0.62)} ${f1(r * 0.62)} 0 0 1 ${f1(r * 0.25)} ${f1(-r * 0.55)}`, INK, 1.8, { opacity: 0.35 });
  shape(sp, `M${-r * 0.2} ${r - 4}l-8 12l14 -4Z`, pal.body, { 'stroke-width': 3 });
  const bill = limb(sp, 9, pal.pouch, 3);
  const a0 = -1.15, a1 = 0.55, rr = r - 9;
  bill.d(`M${f1(Math.cos(a0) * rr)} ${f1(Math.sin(a0) * rr)}A${rr} ${rr} 0 0 1 ${f1(Math.cos(a1) * rr)} ${f1(Math.sin(a1) * rr)}`);
  C(sp, Math.cos(a0 - 0.28) * (rr - 1), Math.sin(a0 - 0.28) * (rr - 1), 10.5, { fill: pal.body, stroke: INK, 'stroke-width': 3 });
  // dizzy eye
  const ex = Math.cos(a0 - 0.3) * (rr - 1), ey = Math.sin(a0 - 0.3) * (rr - 1);
  stroke(sp, `M${f1(ex)} ${f1(ey)}m0 0a2 2 0 0 1 3 1a4 4 0 0 1 -6 2a5.5 5.5 0 0 1 2 -8`, INK, 1.7);
  shape(sp, 'M-4 6l14 4l-4 6l-12 -3Z', pal.leg, { 'stroke-width': 2.4 });
  return { root, spin: sp, r };
}
