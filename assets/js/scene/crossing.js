// The pelican crossing: press the button, the riders stop, a family of pelicans walks across.
import { G, P, C, R, T, shape, stroke, set, show, f1, clamp, lerp, wrapSigned, INK } from './svg.js';
import { pelican } from './parts.js';
import { CROSSING_X, W } from './scenery.js';
import { roadScale } from './world.js';
import { walker, L } from './specimens.js';

const GLYPH = 'M-9 8q-3 -10 5 -12q0 -8 6 -9q5 0 5 4l12 4l-12 3q-1 5 -5 6q-5 8 -16 4Z';

export function setupCrossing(world, hooks = {}) {
  const X = CROSSING_X, S = [X + 46, 1050], E = [X - 44, 708], DUR = 6.4, LAG = 0.6;
  let phase = 'idle', timer = 0, clock = 0;
  let lamps = null;

  const def = {
    id: 'crossing', y: 746, x: X + 150, v: 0, still: true, w: 120, h: 260, noBell: true, box: [-54, -262, 108, 262],
    name: L('The pelican crossing', '鹈鹕过街'),
    prompt: L('a pelican crossing', '鹈鹕过街'),
    note: L('In Britain a signal-controlled pedestrian crossing really is called a pelican crossing. Press the button and every rider has to stop for pedestrians. The pedestrians are pelicans.', '在英国，带信号灯的人行横道真的就叫 pelican crossing（鹈鹕过街）。按下按钮，所有骑手都得停车让行人。行人也是鹈鹕。'),
    checks: ['y', 'n', 'n'], why: L('Nobody is riding. Everybody is waiting.', '没有谁在骑车，大家都在等。'),
    verdict: { pass: null, short: L('INFRASTRUCTURE', '基础设施'), text: L('Not a submission. This is infrastructure.', '不参评。这属于基础设施。') },
    trick: L('Press the button', '按下过街按钮'),
    boxes: [['pelican', -24, -258, 48, 46]],
    build({ g }) {
      stroke(g, 'M0 0V-170', INK, 9);
      stroke(g, 'M0 0V-170', '#c9cfe0', 4.5);
      shape(g, 'M-24 -262h48v94h-48Z', '#2a2545');
      const red = G(g, { transform: 'translate(0 -238)' }), green = G(g, { transform: 'translate(0 -194)' });
      C(red, 0, 0, 18, { fill: '#3a1f33' });
      const redOn = P(red, GLYPH, { fill: '#ff5a4a', transform: 'translate(-3 2) scale(.8)' });
      C(green, 0, 0, 18, { fill: '#17332f' });
      const greenOn = P(green, GLYPH, { fill: '#5df0a0', transform: 'translate(-3 2) scale(.8) rotate(-8)' });
      shape(g, 'M-15 -128h30v46h-30Z', '#ffcf3a');
      const wait = R(g, -10, -123, 20, 9, { rx: 2, fill: '#6b5a1a' });
      const btn = C(g, 0, -98, 8, { fill: '#ef4b3b', stroke: INK, 'stroke-width': 2.6 });
      lamps = { redOn, greenOn, wait, btn };
      return {
        update(f) {
          const blink = Math.floor(f.t * 5) % 2 === 0;
          const walk = phase === 'walk', clear = phase === 'clear';
          set(redOn, 'opacity', walk || clear ? 0.12 : 1);
          set(greenOn, 'opacity', walk ? 1 : clear && blink ? 1 : 0.12);
          set(wait, 'fill', phase === 'wait' && blink ? '#fff2a8' : phase === 'wait' ? '#d9a514' : '#6b5a1a');
          set(btn, 'r', phase === 'wait' ? 6.5 : 8);
        },
        trick: press,
      };
    },
  };

  // the pedestrians
  const walkG = G(world.L.fore);
  const family = [0, 1, 2, 3].map((n) => {
    const p = pelican(n ? { pal: 'chick', legs: [36, 40], neckW: 16 } : { legs: [36, 40], hat: 'beret', hatColor: '#2f62e0' });
    const root = G(walkG, { display: 'none' }), inner = G(root);
    inner.append(p.far, p.mid, p.near);
    return { p, root, inner, size: n ? 0.5 : 0.95, pose: walker(p, { stride: n ? 20 : 24, lift: 12, lean: 0.5, hipY: -60, neckAng: 1.2, neckLen: n ? 44 : 60, head: -0.12 }) };
  });
  const len = Math.hypot(E[0] - S[0], E[1] - S[1]);

  function press() {
    if (phase !== 'idle') return hooks.onState?.('busy');
    phase = 'wait';
    timer = 1.8;
    world.crossing.red = true;
    hooks.onState?.('wait');
  }

  world.tick((st, dt) => {
    if (phase === 'idle') return;
    if (phase === 'wait') {
      if ((timer -= dt) <= 0) {
        phase = 'walk';
        clock = 0;
        hooks.onState?.('walk');
      }
    } else if (phase === 'walk') {
      clock += dt;
      if (clock > DUR + LAG * 3 + 0.3) {
        phase = 'clear';
        timer = 1;
        world.crossing.red = false;
      }
    } else if ((timer -= dt) <= 0) {
      phase = 'idle';
      hooks.onState?.('idle');
    }
    const { view, cam } = world;
    family.forEach((m, n) => {
      const u = (clock - n * LAG) / DUR;
      const vis = phase === 'walk' && u > 0 && u < 1.06;
      show(m.root, vis);
      if (!vis) return;
      const x = lerp(S[0], E[0], u), y = lerp(S[1], E[1], u);
      const k = roadScale(clamp(y, 740, 1000)) * m.size;
      const sx = view.vw / 2 + wrapSigned(x - cam.x, W);
      set(m.root, 'transform', `translate(${f1(sx)} ${f1(y)})`);
      set(m.inner, 'transform', `scale(${f1(-k * 100) / 100} ${f1(k * 100) / 100})`);
      set(m.root, 'opacity', f1(clamp((1.06 - u) * 18, 0, 1)));
      m.pose({ t: st.t + n, dt, s: (u * len) / k, v: 60 });
    });
  });

  return { def, press, get phase() { return phase; } };
}
