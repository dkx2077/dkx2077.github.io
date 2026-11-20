// The pelican crossing: press the button, the riders stop, a family of pelicans walks across.
import { G, P, C, R, T, E as Ell, shape, stroke, set, show, f1, clamp, lerp, wrapSigned, INK } from './svg.js';
import { pelican } from './parts.js';
import { CROSSING_X, W, depth } from './scenery.js';
import { walker, L } from './specimens.js';

// The figure in the lamps, as on any pedestrian signal: standing still for stop, striding for go. Here it is a pelican.
function figure(g, fill, walking) {
  const line = (parent, d, w) => P(parent, d, { fill: 'none', stroke: fill, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  const b = G(g, walking ? { transform: 'rotate(14 0 4)' } : null);
  P(b, 'M-7.5 1.5C-8 -5 -3 -9.5 2 -8.5C6.5 -7.5 7.5 -1 6 4C4.5 9 -1.5 10 -4.5 8C-6.5 6.5 -7.3 4.5 -7.5 1.5Z', { fill });
  P(b, 'M-6 -1L-11 -3L-8 4Z', { fill, stroke: fill, 'stroke-width': 1, 'stroke-linejoin': 'round' }); // tail
  line(b, 'M2.5 -7C6 -9 3 -12 5 -15.5', 3.4); // neck
  C(b, 5.6, -16.6, 2.9, { fill });
  P(b, 'M6 -19.4L19 -15.2C14.5 -14.8 10 -10.8 6.4 -14.4Z', { fill, stroke: fill, 'stroke-width': 0.8, 'stroke-linejoin': 'round' }); // bill and pouch
  line(g, walking ? 'M0 8L-6 14.5h-3.4M3 8L7.5 14l3.2 1.2' : 'M-1.5 8.5V15h3.6M3 8.5V15h3.6', 2.4); // legs
}

export function setupCrossing(world, hooks = {}) {
  const X = CROSSING_X, S = [X + 20, 1006], E = [X - 20, 714], DUR = 6.4, LAG = 0.6;
  let phase = 'idle', timer = 0, clock = 0;
  let lamps = null;

  const def = {
    id: 'crossing', y: 746, x: X + 165, v: 0, still: true, size: 1.5, w: 120, h: 260, noBell: true, box: [-54, -262, 108, 262], shadow: [0, 20],
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
      const redOn = G(red, { class: 'flat', transform: 'translate(-3 2) scale(.92)' });
      figure(redOn, '#ff5a4a', false);
      C(green, 0, 0, 18, { fill: '#17332f' });
      const greenOn = G(green, { class: 'flat', transform: 'translate(-3 2) scale(.92)' });
      figure(greenOn, '#5df0a0', true);
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

  // The pedestrians. They cross the whole depth of the road, so each of them is kept among the riders in order of
  // distance: a pelican that has reached the far kerb is behind everyone still on the road, not in front of them.
  const { road, farLane } = world.L;
  function seat(root, y) {
    root.dataset.y = f1(y);
    if (y < 738) {
      // off the road, on the promenade side of the verge and its signs
      if (root.parentNode !== farLane || root.nextElementSibling) farLane.appendChild(root);
      return;
    }
    let before = null;
    for (let n = road.firstElementChild; n; n = n.nextElementSibling) {
      if (n !== root && +n.dataset.y > y) {
        before = n;
        break;
      }
    }
    if (root.parentNode !== road || root.nextElementSibling !== before) road.insertBefore(root, before);
  }
  const family = [0, 1, 2, 3].map((n) => {
    const p = pelican(n ? { pal: 'chick', legs: [36, 40], neckW: 16 } : { legs: [36, 40], hat: 'beret', hatColor: '#2f62e0' });
    const root = G(world.L.fore, { display: 'none' }), inner = G(root);
    Ell(inner, -10, 3, 62, 9, { fill: '#16204a', opacity: 0.2 });
    inner.append(p.far, p.mid, p.near);
    return { p, root, inner, size: n ? 0.5 : 0.95, pose: walker(p, { stride: n ? 20 : 24, lift: 12, lean: 0.5, hipY: -60, neckAng: 1.2, neckLen: n ? 44 : 60, head: -0.12 }) };
  });

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
      const p = depth(y), k = p * m.size;
      const sx = view.vw / 2 + wrapSigned(x - cam.x, W) * p;
      seat(m.root, y);
      set(m.root, 'transform', `translate(${f1(sx)} ${f1(y)})`);
      set(m.inner, 'transform', `scale(${f1(-k * 100) / 100} ${f1(k * 100) / 100})`);
      set(m.root, 'opacity', f1(clamp((1.06 - u) * 18, 0, 1)));
      m.pose({ t: st.t + n, dt, s: (u * 1100) / m.size, v: 60 });
    });
  });

  return { def, press, get phase() { return phase; } };
}
