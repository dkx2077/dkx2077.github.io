// Every answer to the prompt that is currently on the road.
// Each entry: bilingual label text, where it lives, and a build() that returns { update, trick, beak, gulp }.
import { G, P, C, E, R, T, shape, stroke, set, show, limb, ribbon, f1, pt, tr, add, dir, lerp, clamp, mod, rng, TAU, DEG, INK, OW } from './svg.js';
import { bike, pelican, mount, fish, wheel, crankset, tubes, saddle, BIKE_COLORS, PAL } from './parts.js';
import { tandem, penny, unicycle, cargo, exerciseBike, waterBike, rollBird } from './vehicles.js';

const pulse = () => {
  let t = 0, d = 1;
  return {
    go(n = 1) { t = d = n; },
    // 0 when idle, otherwise a 0→1→0 bump across the duration
    step(dt) {
      if (t <= 0) return 0;
      t -= dt;
      return t <= 0 ? 0 : Math.sin(Math.PI * (1 - t / d));
    },
    get on() { return t > 0; },
  };
};

// How a body answers the wind, as a change of pitch: it ducks into a headwind and sits up to catch a tailwind.
// `wind` is from the rider's own point of view, positive at its back (see world.js).
const duck = (wind = 0) => clamp(wind, -2.5, 1) * 0.045;

// A pelican on a vehicle, pedalling. Most entries start here.
export function rider(g, o = {}) {
  const v = o.vehicle || bike(o.bike);
  const p = pelican({ legs: [50, 52], ...o.bird });
  mount(g, p, v);
  const base = { lean: 0.55, neckAng: 1.3, neckLen: 58, head: -0.12, ...o.pose };
  const gear = o.gear ?? 2.2, seat = o.seat || [-6, 1], back = !!o.backwards, cx = v.pts.SP[0];
  if (back) for (const n of [p.far, p.mid, p.near]) n.setAttribute('transform', `translate(${f1(cx * 2)} 0) scale(-1 1)`);
  const mx = (q) => (back ? [cx * 2 - q[0], q[1], 0] : [q[0], q[1], 0]);
  return {
    v, p,
    update(f, extra) {
      const wa = f.s / v.pts.r, ca = o.cadence ? o.cadence(f, wa) : wa * gear;
      const got = v.update(wa, ca), ped = o.pick ? o.pick(got) : got;
      const hip = [v.pts.SP[0] + seat[0], v.pts.SP[1] + seat[1] + Math.sin(ca * 2) * 1.1];
      const hands = back || o.noHands ? null : v.pts.grip;
      p.pose({
        hip, footN: mx(ped.near), footF: mx(ped.far),
        handN: hands, handF: hands && [hands[0] + 3, hands[1] - 2],
        ...base,
        lean: base.lean + duck(f.wind),
        neckAng: base.neckAng + Math.sin(ca * 2 + 1) * 0.03,
        sag: (base.sag ?? 16) + Math.sin(f.t * 4) * 1.4,
        ...extra,
      });
      return got;
    },
    beak() {
      const b = p.beak();
      return back ? [cx * 2 - b[0], b[1]] : b;
    },
    gulp: (x) => p.setGulp(x),
  };
}

// A walking / running gait for a pelican on foot.
export function walker(p, o = {}) {
  const stride = o.stride ?? 26, lift = o.lift ?? 18, hipY = o.hipY ?? -60, x0 = o.x ?? -34;
  return (f, extra) => {
    const ph = f.s / (stride * 0.8);
    const lean = (o.lean ?? 0.45) + Math.sin(ph * 2) * 0.03 + duck(f.wind);
    const hip = [x0, hipY - Math.abs(Math.sin(ph)) * (o.bounce ?? 4)];
    const cx = hip[0] + 15 + 20 * Math.cos(lean);
    const foot = (a) => [cx + stride * Math.cos(a), -Math.max(0, -Math.sin(a)) * lift, Math.sin(a) < 0 ? 22 : 0];
    const still = Math.abs(f.v) < 3;
    p.pose({
      hip, lean, neckAng: o.neckAng ?? 1.05, neckLen: o.neckLen ?? 60, head: o.head ?? -0.15,
      footN: still ? [cx + 8, 0, 0] : foot(ph), footF: still ? [cx - 6, 0, 0] : foot(ph + Math.PI),
      sag: (o.sag ?? 16) + Math.sin(f.t * 3.4) * 1.6, ...extra,
    });
    return { hip, lean };
  };
}

export const L = (en, zh) => ({ en, zh });

export const SPECIMENS = [
  /* ------------------------------------------------------------------ 1 */
  {
    id: 'control', y: 858, x: 330, v: 96, w: 250, h: 275,
    name: L('The control', '对照组'),
    prompt: L('a pelican riding a bicycle', '一只鹈鹕骑自行车'),
    note: L('Two wheels, one bird, feet on the pedals. This is what was asked for. Everything else on this road is a deviation.', '两个轮子，一只鸟，脚踩在踏板上。题目要的就是这个。这条路上其余的一切，都算跑题。'),
    checks: ['y', 'y', 'y'], verdict: { pass: true, text: L('Pass. Suspiciously well-behaved.', '通过。规矩得有点可疑。') },
    trick: L('Pull a wheelie', '翘个前轮'),
    boxes: [['pelican', -84, -268, 196, 250], ['bicycle', -124, -152, 250, 152]],
    build({ g, inst }) {
      const tilt = G(g);
      const r = rider(tilt, {
        bike: { color: '#ef4b3b', fenders: '#fffdf7', lamp: true, basket: (b) => fish(b).setAttribute('transform', 'translate(17 -1) rotate(-72)') },
        bird: { scarf: '#ef4b3b' },
      });
      const wh = pulse();
      return {
        update(f) {
          const a = wh.step(f.dt);
          set(tilt, 'transform', a ? `rotate(${f1(-27 * a)} -75 0)` : '');
          r.update(f, a ? { head: -0.12 + a * 0.45, open: a * 0.3 } : null);
        },
        trick() {
          wh.go(1.7);
          inst.kick = 1.6;
          inst.kickT = 1.7;
        },
        beak: r.beak, gulp: r.gulp,
      };
    },
  },

  /* ------------------------------------------------------------------ 2 */
  {
    id: 'inversion', y: 934, x: 1040, v: -84, w: 250, h: 250, size: 1.12, shadow: [-4, 70],
    name: L('The inversion', '倒反天罡'),
    prompt: L('a bicycle riding a pelican', '一辆自行车骑鹈鹕'),
    note: L('All the right nouns, in the wrong order. The bicycle looks comfortable up there.', '名词全对，顺序全错。自行车在上面坐得还挺稳。'),
    checks: ['y', 'y', 'n'], why: L('The bicycle is doing the riding.', '骑的那一方是自行车。'),
    verdict: { pass: false, text: L('Fail. Word order matters.', '不通过。语序很重要。') },
    trick: L('Giddy up', '驾！'),
    boxes: [['bicycle', -62, -206, 112, 86], ['pelican', -84, -176, 250, 176]],
    build({ g, inst, world }) {
      const p = pelican({ legs: [36, 40] });
      const b = bike({ r: 21, wb: 64, frame: 28, post: 5, stem: 12, headTube: 10, crank: 9, ring: 5, color: '#2f62e0' });
      const seat = G(null);
      g.append(p.far, p.mid, seat, p.near);
      shape(p.bodyG, 'M-4 -52Q28 -66 62 -52L58 -26Q28 -18 0 -26Z', '#ffcf3a');
      stroke(p.bodyG, 'M-1 -34Q28 -26 59 -34', '#ef4b3b', 3);
      const bg = G(seat);
      bg.append(b.gFar, b.gMain, b.gNear);
      shape(bg, `M${f1(b.pts.SP[0] - 11)} ${f1(b.pts.SP[1] + 1)}q2 -13 13 -12q9 1 9 11l10 3l-1 3Z`, '#ef4b3b', { 'stroke-width': 2.6 });
      const reins = stroke(g, '', '#7a4a2a', 2.6);
      const walk = walker(p, { stride: 28, lift: 20, lean: 0.2, hipY: -62, neckAng: 0.95, neckLen: 62, head: -0.08 });
      const go = pulse();
      return {
        update(f) {
          const a = go.step(f.dt);
          const { hip, lean } = walk(f, a ? { head: -0.05 + a * 0.2, open: a * 0.25 } : null);
          const c = Math.cos(lean), s = Math.sin(lean);
          const bx = hip[0] + 28 * c - 60 * s, by = hip[1] - 28 * s - 60 * c;
          const rock = -lean * DEG + Math.sin(f.s / 11) * 4 - a * 14;
          set(seat, 'transform', tr(bx, by, rock));
          b.update(f.s / 22, f.t * (7 + a * 14));
          const rr = (rock * Math.PI) / 180, gx = b.pts.grip[0] - 2, gy = b.pts.grip[1] + 1;
          const hand = [bx + gx * Math.cos(rr) - gy * Math.sin(rr), by + gx * Math.sin(rr) + gy * Math.cos(rr)];
          const H = p.headPos();
          set(reins, 'd', `M${pt(hand)}Q${f1((hand[0] + H[0]) / 2)} ${f1(Math.max(hand[1], H[1]) + 26)} ${f1(H[0] + 14)} ${f1(H[1] + 6)}`);
          if (a > 0.3 && Math.random() < 0.3) world.puff(...world.toView(inst, [-40, -6]), 'dot', { vx: -60 * inst.face, vy: -30, ttl: 0.5, r: 6, grow: 1, color: '#e9e2d2' });
        },
        trick() {
          go.go(1.8);
          inst.kick = 2;
          inst.kickT = 1.8;
        },
        beak: () => p.beak(), gulp: (x) => p.setGulp(x),
      };
    },
  },

  /* ------------------------------------------------------------------ 3 */
  {
    id: 'recursion', y: 812, x: 6150, v: 58, w: 270, h: 380, box: [-145, -380, 270, 380], shadow: [0, 118],
    name: L('Recursion', '递归'),
    prompt: L('a pelican riding a bicycle riding a pelican riding a bicycle', '一只鹈鹕骑着一辆骑着鹈鹕的自行车，那只鹈鹕也骑着自行车'),
    note: L('Nobody set a depth limit. It stops at three only because the top pelican is afraid of heights.', '没有人设置递归深度。之所以停在第三层，纯粹是因为最上面那只恐高。'),
    checks: ['y', 'y', 'y'], verdict: { pass: true, short: L('PASS ×3', '通过 ×3'), text: L('Pass, three times over.', '通过，而且一口气通过了三次。') },
    trick: L('Shake the tower', '晃一晃'),
    boxes: [['pelican', -84, -268, 196, 250], ['bicycle', -124, -152, 250, 152], ['pelican', -122, -320, 108, 130], ['bicycle', -140, -256, 132, 82]],
    build({ g }) {
      const cols = ['#19b28f', '#ffcf3a', '#ff7fae'];
      const level = (parent, d) => {
        const r = rider(parent, { bike: { color: cols[d], bell: false }, bird: { hat: d === 2 ? 'party' : null }, gear: 2.2 + d * 0.5 });
        const upG = d < 2 ? G(parent) : null, up = upG && level(upG, d + 1);
        return {
          r,
          update(f, sway) {
            r.update(f);
            if (!up) return;
            const hip = [r.v.pts.SP[0] - 6, r.v.pts.SP[1] + 1];
            set(upG, 'transform', `translate(${f1(hip[0] - 34)} ${f1(hip[1] - 60)}) rotate(${f1(sway(d + 1))}) scale(.52)`);
            up.update(f, sway);
          },
        };
      };
      const root = level(g, 0), sh = pulse();
      let amp = 0;
      return {
        update(f) {
          amp = sh.step(f.dt);
          root.update(f, (d) => Math.sin(f.t * (1.7 + amp * 5) - d * 0.8) * (2.2 + amp * 9));
        },
        trick: () => sh.go(2.4),
        beak: root.r.beak, gulp: root.r.gulp,
      };
    },
  },

  /* ------------------------------------------------------------------ 4 */
  {
    id: 'tandem', y: 900, x: 2300, v: -104, w: 360, h: 300,
    name: L('The freeloader', '摸鱼双人车'),
    prompt: L('two pelicans riding a bicycle', '两只鹈鹕骑一辆自行车'),
    note: L('The one in front pedals. The one behind holds the fishing rod. Both describe this as teamwork.', '前面那只负责蹬，后面那只负责举鱼竿。双方都坚称这叫团队协作。'),
    checks: ['y', 'y', 'h'], why: L('Half of the pelicans are riding.', '只有一半的鹈鹕在骑。'),
    verdict: { pass: null, short: L('HALF MARKS', '给一半分'), text: L('Partial credit: one of two.', '给一半分：两只里只有一只在干活。') },
    trick: L('Dangle the fish', '晃晃鱼'),
    boxes: [['pelican', -138, -262, 150, 244], ['pelican', -34, -268, 190, 250], ['bicycle', -172, -150, 344, 150]],
    build({ g, inst }) {
      const v = tandem('#19b28f');
      const p1 = pelican({ legs: [50, 52], hat: 'cap', hatColor: '#19b28f' });
      const p2 = pelican({ legs: [50, 52], shades: true });
      g.append(p2.far, p1.far, v.gFar, v.gMain, p2.mid, p1.mid, v.gNear, p2.near, p1.near);
      const rod = stroke(g, '', '#7a4a2a', 3), line = stroke(g, '', INK, 1.3);
      const bait = fish(g, { color: '#9be0c8', fin: '#19b28f' });
      const sw = pulse();
      return {
        update(f) {
          const a = sw.step(f.dt);
          const wa = f.s / 46, ca = wa * (2.2 + a), ped = v.update(wa, ca);
          const bob = Math.sin(ca * 2) * 1.1;
          p1.pose({
            hip: [v.pts.SP1[0] - 6, v.pts.SP1[1] + 1 + bob], lean: 0.6, neckAng: 1.2, neckLen: 58, head: 0.12 + a * 0.2, open: 0.12 + a * 0.3,
            footN: [...ped.front.near, 0], footF: [...ped.front.far, 0], handN: v.pts.grip, handF: [v.pts.grip[0] + 3, v.pts.grip[1] - 2],
          });
          const hip2 = [v.pts.SP2[0] - 8, v.pts.SP2[1] + 1];
          const hand = [hip2[0] + 74, hip2[1] - 62];
          p2.pose({
            hip: hip2, lean: 0.9, neckAng: 1.75, neckLen: 54, head: 0.05,
            footN: [v.pts.B2[0] + 34, v.pts.B2[1] - 26, -30], footF: [v.pts.B2[0] + 44, v.pts.B2[1] - 18, -30],
            handN: hand, handF: [hand[0] - 6, hand[1] + 8], bend: -10,
          });
          const tip = [176, -292 + Math.sin(f.t * 2) * 3];
          set(rod, 'd', `M${f1(hand[0] - 14)} ${f1(hand[1] + 12)}L${pt(hand)}Q${f1(hand[0] + 90)} ${f1(hand[1] - 150)} ${pt(tip)}`);
          const swing = Math.sin(f.t * 2.4) * (8 + a * 34) + f.v * 0.04;
          const end = [tip[0] - Math.sin((swing * Math.PI) / 180) * 62, tip[1] + Math.cos((swing * Math.PI) / 180) * 62];
          set(line, 'd', `M${pt(tip)}L${pt(end)}`);
          set(bait, 'transform', `translate(${f1(end[0])} ${f1(end[1] + 12)}) rotate(${f1(90 - swing)})`);
        },
        trick() {
          sw.go(2);
          inst.kick = 1.7;
          inst.kickT = 2;
        },
        beak: () => p1.beak(), gulp: (x) => p1.setGulp(x),
      };
    },
  },

  /* ------------------------------------------------------------------ 5 */
  {
    id: 'legacy', y: 798, x: 2900, v: 70, w: 230, h: 300, shadow: [-12, 94],
    name: L('The legacy model', '旧版模型'),
    prompt: L('a pelican riding a bicycle, 1885 edition', '一只鹈鹕骑自行车（1885 年版）'),
    note: L('An older architecture: one very large wheel, no brakes, strong opinions about hats.', '上个时代的架构：一个巨大的轮子，没有刹车，对帽子有很强的执念。'),
    checks: ['y', 'y', 'y'], verdict: { pass: true, text: L('Pass. Deprecated, still in service.', '通过。已弃用，但仍在服役。') },
    trick: L('Doff the hat', '脱帽致意'),
    boxes: [['pelican', -76, -296, 190, 256], ['bicycle', -98, -152, 176, 152]],
    build({ g }) {
      const r = rider(g, {
        vehicle: penny(), bird: { legs: [56, 60], hat: 'top', monocle: true },
        pose: { lean: 0.75, neckAng: 1.4, neckLen: 56, head: -0.05 }, cadence: (f, wa) => wa,
      });
      const bow = pulse();
      return {
        update(f) {
          const a = bow.step(f.dt);
          r.update(f, a ? { head: -0.05 - a * 0.7, neckAng: 1.4 - a * 0.35 } : null);
        },
        trick: () => bow.go(1.4),
        beak: r.beak, gulp: r.gulp,
      };
    },
  },

  /* ------------------------------------------------------------------ 6 */
  {
    id: 'unicycle', y: 948, x: 3500, v: -36, w: 220, h: 330, bell: [0, -200], shadow: [0, 48],
    name: L('Half the parameters', '参数减半'),
    prompt: L('a pelican riding half a bicycle', '一只鹈鹕骑半辆自行车'),
    note: L('Quantised down to a single wheel. Accuracy fell. Showmanship went up.', '被量化到只剩一个轮子。准确率下降了，节目效果上去了。'),
    checks: ['y', 'h', 'y'], why: L('One wheel of the required two.', '要求两个轮子，实到一个。'),
    verdict: { pass: null, short: L('HALF MARKS', '给一半分'), text: L('Half marks for the bicycle.', '自行车这一项给一半分。') },
    trick: L('Juggle faster', '加速抛接'),
    boxes: [['pelican', -70, -262, 170, 234], ['bicycle', -44, -122, 88, 122]],
    build({ g }) {
      const sway = G(g);
      const r = rider(sway, {
        vehicle: unicycle(), bird: { legs: [46, 50], hat: 'beret' }, noHands: true, seat: [-8, 6],
        pose: { lean: 1.0, neckAng: 1.45, neckLen: 54, head: 0 }, cadence: (f, wa) => wa,
      });
      const fishes = [0, 1, 2].map((n) => fish(sway, { color: ['#7cc4ee', '#ffb9cf', '#9be0c8'][n], fin: ['#4f9fd6', '#ff7fae', '#19b28f'][n] }));
      const fast = pulse();
      let ju = 0;
      return {
        update(f) {
          const a = fast.step(f.dt);
          ju += f.dt * (0.75 + a * 1.4);
          const rock = Math.sin(f.t * 1.5) * 16;
          set(sway, 'transform', `translate(${f1(rock)} 0) rotate(${f1(Math.cos(f.t * 1.5) * 4)})`);
          r.update({ ...f, s: f.s + rock }, { flap: 0.05 + Math.sin(ju * TAU * 3) * 0.12, flapF: 1.75 - Math.sin(ju * TAU * 3) * 0.12, span: 78 });
          fishes.forEach((n, k) => {
            const u = mod(ju + k / 3, 1), up = u < 0.5, q = up ? u * 2 : (u - 0.5) * 2;
            const x = up ? lerp(-78, 74, q) : lerp(74, -78, q);
            const y = -236 - Math.sin(q * Math.PI) * (up ? 104 : 22);
            set(n, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(u * 720)})`);
          });
        },
        trick: () => fast.go(3),
        beak: r.beak, gulp: r.gulp,
      };
    },
  },

  /* ------------------------------------------------------------------ 7 */
  {
    id: 'carrier', y: 866, x: 4100, v: 42, w: 250, h: 230, size: 1.18, shadow: [-6, 66],
    name: L('The venue', '场地方'),
    prompt: L('a pelican, a bicycle, riding', '鹈鹕、自行车、骑'),
    note: L('A fish is riding a bicycle inside the pouch. The pelican is only hosting.', '一条鱼正在喉囊里骑车。鹈鹕只是提供场地。'),
    checks: ['y', 'y', 'n'], why: L('The fish is the one riding.', '在骑车的是那条鱼。'),
    verdict: { pass: false, text: L('Fail. Wrong rider.', '不通过。骑手不对。') },
    trick: L('Open wide', '张嘴看看'),
    boxes: [['pelican', -84, -196, 216, 196], ['bicycle', 46, -172, 44, 36]],
    build({ g }) {
      const p = pelican({ legs: [36, 40], pouchOpacity: 0.5 });
      g.append(p.far, p.mid, p.near);
      const mini = G(p.inPouch, { transform: 'translate(47 31) scale(.5)' });
      const w1 = wheel(13, { spokes: 5, reflector: false }), w2 = wheel(13, { spokes: 5, reflector: false });
      w1.root.setAttribute('transform', 'translate(-18 -13)');
      w2.root.setAttribute('transform', 'translate(18 -13)');
      mini.append(w1.root, w2.root);
      tubes(mini, 'M-18 -13L-6 -30L12 -30L18 -13M-6 -30L0 -13L-18 -13M12 -30L14 -38', '#ef4b3b', 3.4);
      const rf = fish(mini, { color: '#9be0c8', fin: '#19b28f' });
      const walk = walker(p, { stride: 22, lift: 12, lean: 0.5, hipY: -60, neckAng: 1.15, neckLen: 62, head: -0.2, sag: 42, bounce: 3 });
      const open = pulse();
      return {
        update(f) {
          const a = open.step(f.dt);
          walk(f, { open: a * 0.55, head: -0.2 + a * 0.12 });
          const sp = `rotate(${f1(f.t * 320)})`;
          set(w1.spin, 'transform', sp);
          set(w2.spin, 'transform', sp);
          set(rf, 'transform', `translate(-2 ${f1(-40 + Math.sin(f.t * 9) * 1.5)}) rotate(-8) scale(1.25)`);
        },
        trick: () => open.go(2.2),
        beak: () => p.beak(), gulp: (x) => p.setGulp(x * 0.4),
      };
    },
  },

  /* ------------------------------------------------------------------ 8 */
  {
    id: 'merge', y: 916, x: 4700, v: -118, w: 230, h: 230, bell: [60, -130], shadow: [2, 90],
    name: L('The merge', '融合怪'),
    prompt: L('a pelican that is a bicycle', '一只本身就是自行车的鹈鹕'),
    note: L('Pelican and bicycle were merged into one object to save tokens. A fish has taken the saddle.', '为了省 token，鹈鹕和自行车被合并成了同一个物体。车座已经被一条鱼占了。'),
    checks: ['y', 'y', 'n'], why: L('A pelican cannot ride itself.', '鹈鹕不能自己骑自己。'),
    verdict: { pass: false, text: L('Fail. Nothing is riding anything, except the fish.', '不通过。没有谁在骑谁，除了那条鱼。') },
    trick: L('Honk', '鸣笛'),
    boxes: [['pelican', -84, -196, 214, 196], ['bicycle', -84, -128, 172, 128]],
    build({ g, inst, world }) {
      const p = pelican({});
      const gFar = G(g), wheels = G(g), forks = G(g);
      const A = [-46, -34], B = [50, -34], BB = [2, -42];
      const wa = wheel(34), wb = wheel(34);
      wa.root.setAttribute('transform', tr(...A));
      wb.root.setAttribute('transform', tr(...B));
      wheels.append(wa.root, wb.root);
      stroke(wheels, `M2 -51L-46 -38M2 -33L-46 -30`, INK, 1.5, { opacity: 0.8 });
      const f1l = limb(forks, 7, PAL.white.leg), f2l = limb(forks, 7, PAL.white.leg);
      f1l.d('M-30 -70L-46 -34');
      f2l.d('M40 -72L50 -34');
      g.append(p.far, p.mid);
      const top = G(g), gNear = G(g);
      saddle(top, -10, -130, '#3b2f4f');
      const rf = fish(top, { color: '#ffb9cf', fin: '#ff7fae' });
      shape(top, 'M-20 -166q4 -12 16 -10q10 2 10 12Z', '#2f62e0', { 'stroke-width': 2.4 });
      stroke(top, 'M50 -104l8 -22q12 -4 16 4', INK, 4.5);
      stroke(top, 'M74 -122l-3 8', '#3b2f4f', 7);
      C(top, 62, -124, 4, { fill: '#ffd76a', stroke: INK, 'stroke-width': 2 });
      P(top, 'M72 -86l150 -30v80Z', { class: 'beam', fill: 'url(#beamR)', opacity: 0 });
      shape(top, 'M62 -92l10 -3v9l-10 -2Z', '#ffe38a', { 'stroke-width': 2.5 });
      const crank = crankset(gFar, gNear, BB, 15, wheels, 8);
      g.append(p.near);
      const honk = pulse();
      return {
        update(f) {
          const a = honk.step(f.dt), ang = f.s / 34;
          set(wa.spin, 'transform', `rotate(${f1(ang * DEG)})`);
          set(wb.spin, 'transform', `rotate(${f1(ang * DEG)})`);
          crank(ang * 1.8);
          p.pose({ hip: [-30, -62 + Math.sin(f.t * 6) * 0.8], lean: 0.06, neckAng: 1.25, neckLen: 56, head: -0.05 + a * 0.35, open: a * 0.5, sag: 16 + Math.sin(f.t * 4) * 1.5 });
          set(rf, 'transform', `translate(-10 ${f1(-148 - a * 16)}) rotate(${f1(-80 + Math.sin(f.t * 5) * 4)}) scale(1.15)`);
        },
        trick() {
          honk.go(1.1);
          world.puff(...world.toView(inst, [110, -190]), 'text', { text: 'HONK', vy: -50, vx: 30 * inst.face, ttl: 1.1, size: 30 });
        },
        beak: () => p.beak(), gulp: (x) => p.setGulp(x),
      };
    },
  },

  /* ------------------------------------------------------------------ 9 */
  {
    id: 'wheels', y: 836, x: 5300, v: 64, w: 260, h: 285,
    name: L('Three pelicans, no wheels', '鹈鹕牌车轮'),
    prompt: L('a pelican riding a bicycle made of pelicans', '一只鹈鹕骑一辆由鹈鹕组成的自行车'),
    note: L('Both wheels were replaced with pelicans. They report mild dizziness.', '两个轮子都被换成了鹈鹕。它们表示略微头晕。'),
    checks: ['y', 'h', 'y'], why: L('A frame is present. Wheels are not.', '车架在，车轮不在。'),
    verdict: { pass: true, text: L('Pass, under protest from the wheels.', '通过，但轮子们提出了抗议。') },
    trick: L('Spin them up', '转起来'),
    boxes: [['pelican', -84, -274, 196, 150], ['pelican', -124, -94, 96, 94], ['pelican', 28, -94, 96, 94], ['bicycle', -86, -150, 172, 110]],
    build({ g, inst }) {
      const b = bike({ color: '#7a5af5', noWheels: true, bell: true });
      const wA = rollBird(46), wB = rollBird(46);
      wA.root.setAttribute('transform', tr(...b.pts.R));
      wB.root.setAttribute('transform', tr(...b.pts.F));
      g.append(wA.root, wB.root);
      const r = rider(g, { vehicle: b, bird: { hat: 'crown' } });
      return {
        update(f) {
          r.update(f);
          const a = `rotate(${f1((f.s / 46) * DEG)})`;
          set(wA.spin, 'transform', a);
          set(wB.spin, 'transform', a);
        },
        trick() {
          inst.kick = 2.6;
          inst.kickT = 1.6;
        },
        beak: r.beak, gulp: r.gulp,
      };
    },
  },

  /* ----------------------------------------------------------------- 10 */
  {
    id: 'overfit', y: 774, x: 2520, v: 0, still: true, w: 200, h: 280, bell: [20, -150], shadow: [0, 78],
    name: L('The overfit', '过拟合'),
    prompt: L('a pelican riding a bicycle (benchmark-optimised)', '一只鹈鹕骑自行车（针对榜单优化版）'),
    note: L('Trained on this exact prompt. Record cadence. Has never left this spot.', '只针对这一道题训练过。踏频创了纪录，但从未离开过原地。'),
    checks: ['y', 'y', 'y'], verdict: { pass: true, short: L('PASS (0 km)', '通过（0 公里）'), text: L('Pass on paper. Distance travelled: 0 km.', '纸面通过。实际行驶距离：0 公里。') },
    trick: L('Sprint', '冲刺'),
    boxes: [['pelican', -80, -262, 190, 240], ['bicycle', -70, -158, 146, 158]],
    build({ g, inst, world }) {
      const v = exerciseBike();
      v.pts.r = 1;
      const r = rider(g, {
        vehicle: v, bird: { legs: [46, 50], hat: 'sweat' }, pose: { lean: 0.6, neckAng: 1.25 },
        cadence: () => ca,
      });
      let ca = 0, wa = 0, drip = 0;
      const sp = pulse();
      return {
        update(f) {
          const a = sp.step(f.dt), w = 8 + a * 14;
          ca += f.dt * w;
          wa += f.dt * w * 2.4;
          r.update({ ...f, s: wa }, { head: -0.12 - a * 0.25 });
          set(v.screen, 'fill', a > 0.2 && Math.floor(f.t * 6) % 2 ? '#ffcf3a' : '#7dffb0');
          if ((drip -= f.dt) < 0) {
            drip = 0.55 - a * 0.4;
            const h = r.p.headPos();
            world.puff(...world.toView(inst, [h[0] - 16, h[1] - 6]), 'drop', { vx: -50 - Math.random() * 40, vy: -70, g: 420, ttl: 0.7 });
          }
        },
        trick: () => sp.go(2.6),
        beak: r.beak, gulp: r.gulp,
      };
    },
  },

  /* ----------------------------------------------------------------- 11 */
  {
    id: 'thinker', y: 776, x: 5560, v: 0, still: true, w: 390, h: 350, noBell: true, box: [-176, -350, 390, 350],
    name: L('Maximum effort', '深度思考中'),
    prompt: L('a pelican riding a bicycle (reasoning: max)', '一只鹈鹕骑自行车（推理强度：最高）'),
    note: L('Has spent 128,000 tokens planning the first pedal stroke. The bicycle is still waiting.', '为了踩下第一脚，已经规划了 128,000 个 token。自行车还在等。'),
    checks: ['y', 'y', 'n'], why: L('It has not started yet.', '它还没开始骑。'),
    verdict: { pass: false, short: L('NO OUTPUT', '无输出'), text: L('No output. Thinking budget exhausted.', '无输出。思考预算已耗尽。') },
    trick: L('Interrupt it', '打断它'),
    boxes: [['bicycle', -148, -140, 216, 140], ['pelican', 20, -210, 150, 210]],
    build({ g, inst, world }) {
      const park = G(g, { transform: 'translate(-40 0) rotate(-5 60 0)' });
      const b = bike({ color: '#ff8a1f', fenders: true });
      park.append(b.gFar, b.gMain, b.gNear);
      stroke(park, 'M-22 -34L-40 -2', INK, 3.5);
      const pg = G(g, { transform: 'translate(132 0) scale(-1 1)' });
      const p = pelican({ legs: [34, 36] });
      pg.append(p.far, p.mid, p.near);
      const bub = G(g, { transform: 'translate(96 -292)' });
      C(g, 104, -212, 5, { fill: '#fffdf7', stroke: INK, 'stroke-width': 2.6 });
      C(g, 100, -228, 8, { fill: '#fffdf7', stroke: INK, 'stroke-width': 2.6 });
      shape(bub, 'M-74 8a26 26 0 0 1 6 -46a34 34 0 0 1 60 -16a32 32 0 0 1 58 10a28 28 0 0 1 14 50a24 24 0 0 1 -30 26a40 40 0 0 1 -66 2a28 28 0 0 1 -42 -26Z', '#fffdf7');
      const count = T(bub, 0, -8, '0', { class: 'bubble-num', 'text-anchor': 'middle' });
      const unit = T(bub, 0, 14, 'tokens', { class: 'bubble-unit', 'text-anchor': 'middle' });
      const dots = [0, 1, 2].map((n) => C(bub, -14 + n * 14, 30, 3.4, { fill: INK }));
      let tok = 0, stop = 0, done = 0;
      return {
        update(f) {
          if (stop > 0) stop -= f.dt;
          else tok = tok >= 128000 ? 128000 : Math.min(128000, tok + f.dt * 5200);
          if (tok >= 128000 && stop <= 0 && !done) done = f.t;
          if (done && f.t - done > 2.5) (tok = 0), (done = 0);
          const label = stop > 0 ? 'max_tokens' : Math.round(tok / 100) * 100 >= 128000 ? '128,000' : (Math.round(tok / 100) * 100).toLocaleString('en-US');
          if (count.textContent !== label) count.textContent = label;
          set(count, 'fill', tok >= 128000 || stop > 0 ? '#d6392b' : INK);
          set(unit, 'display', stop > 0 ? 'none' : 'inline');
          dots.forEach((d, n) => set(d, 'opacity', stop > 0 ? 0 : 0.25 + 0.75 * Math.max(0, Math.sin(f.t * 4 - n * 0.9))));
          const tilt = Math.sin(f.t * 0.8) * 0.06;
          const hip = [-30, -62];
          p.pose({ hip, lean: 0.62, neckAng: 1.2, neckLen: 56, head: -0.2 + tilt, footN: [4, 0, 0], footF: [-10, 0, 0], handN: [p.headPos()[0] + 24, p.headPos()[1] + 26], bend: 16, sag: 16 });
        },
        trick() {
          stop = 1.8;
          tok = 0;
          done = 0;
          world.puff(...world.toView(inst, [96, -340]), 'text', { text: '!', vy: -50, ttl: 0.9, size: 40, color: '#d6392b' });
        },
        beak() {
          const q = p.beak();
          return [132 - q[0], q[1]];
        },
        gulp: (x) => p.setGulp(x),
      };
    },
  },

  /* ----------------------------------------------------------------- 12 */
  {
    id: 'baseline', y: 826, x: 3180, v: 28, w: 240, h: 230, noBell: true,
    name: L('The 2024 baseline', '2024 年基线'),
    prompt: L('a pelican riding a bicycle (small model, 2024)', '一只鹈鹕骑自行车（2024 年的小模型）'),
    note: L('An ellipse, a triangle, two circles. They are close to each other, which at the time counted as a strong result.', '一个椭圆，一个三角形，两个圆。它们彼此离得不远，这在当时已经算相当强的结果。'),
    checks: ['q', 'q', 'n'], why: L('The shapes are not touching.', '几个形状之间没有接触。'),
    verdict: { pass: null, short: L('HISTORIC', '有历史意义'), text: L('Not graded. Kept for the record.', '不评分。留作历史记录。') },
    trick: L('Shake it', '抖一抖'),
    boxes: [['pelican', -52, -206, 176, 92], ['bicycle', -98, -104, 196, 104]],
    build({ g }) {
      const parts = [];
      const mk = (n, x, y) => (parts.push({ n, x, y, jx: 0, jy: 0 }), n);
      const w1 = mk(G(g), -56, -40), w2 = mk(G(g), 54, -32);
      C(w1, 0, 0, 40, { fill: 'none', stroke: '#111', 'stroke-width': 3 });
      const s1 = stroke(w1, 'M0 0L40 0', '#111', 2);
      C(w2, 0, 0, 32, { fill: 'none', stroke: '#111', 'stroke-width': 3 });
      const s2 = stroke(w2, 'M0 0L32 0', '#111', 2);
      const fr = mk(G(g), 0, 0);
      stroke(fr, 'M-56 -40L-6 -86L54 -32M-6 -86L-10 -40', '#d40000', 3, { 'stroke-linejoin': 'miter', 'stroke-linecap': 'butt' });
      const body = mk(G(g), -4, -150);
      E(body, 0, 0, 44, 25, { fill: '#d9d9d9' });
      stroke(body, 'M-8 22L-8 44M10 22L10 44', '#ffa500', 3, { 'stroke-linecap': 'butt' });
      const head = mk(G(g), 44, -186);
      C(head, 0, 0, 14, { fill: '#d9d9d9' });
      C(head, 4, -3, 2.5, { fill: '#000' });
      const bill = mk(G(g), 58, -186);
      P(bill, 'M0 -8L66 2L0 12Z', { fill: '#ffd400' });
      const sh = pulse();
      return {
        update(f) {
          const a = sh.step(f.dt), q = Math.floor(f.t * 6);
          const h = (n) => Math.sin(q * 12.9898 + n * 78.233) * 43758.5453 % 1;
          parts.forEach((p, n) => {
            const amp = 2.2 + a * 40;
            set(p.n, 'transform', `translate(${f1(p.x + h(n) * amp)} ${f1(p.y + h(n + 9) * amp)})`);
          });
          const ang = Math.floor((f.s / 40) * 4) * 22.5;
          set(s1, 'transform', `rotate(${ang})`);
          set(s2, 'transform', `rotate(${ang * 1.25})`);
        },
        trick: () => sh.go(0.9),
        beak: () => [100, -180],
      };
    },
  },

  /* ----------------------------------------------------------------- 13 */
  {
    id: 'papers', y: 848, x: 5900, v: 78, w: 300, h: 285, link: 'publications', shadow: [-2, 152],
    name: L('The literature review', '文献综述'),
    prompt: L('a pelican riding a bicycle, with citations', '一只鹈鹕骑自行车（附参考文献）'),
    note: L('The front box holds Kaixin’s papers. The button below opens the list, so you do not have to chase the bike.', '前面的货箱里装着楷馨的论文。点下面的按钮就能看列表，不用追着车跑。'),
    checks: ['y', 'y', 'y'], verdict: { pass: true, text: L('Pass. Well cited.', '通过。引用充分。') },
    linkLabel: L('Read the publications', '看论文列表'),
    trick: L('Wave the flag', '挥挥旗'),
    boxes: [['pelican', -150, -270, 196, 250], ['bicycle', -158, -170, 310, 170]],
    build({ g, world }) {
      const v = cargo('#2f62e0', world.state.lang === 'zh' ? '论文' : 'PAPERS');
      const r = rider(g, { vehicle: v, bird: { legs: [48, 52], hat: 'helmet', hatColor: '#ef4b3b' } });
      const wv = pulse();
      return {
        update(f) {
          const a = wv.step(f.dt);
          r.update(f);
          const k = Math.sin(f.t * (6 + a * 10)) * (5 + a * 9);
          set(v.flag, 'd', `M92 -166q17 ${f1(k)} 34 0l-8 10l8 10q-17 ${f1(-k)} -34 0Z`);
        },
        trick: () => wv.go(1.6),
        lang: (l) => (v.text.textContent = l === 'zh' ? '论文' : 'PAPERS'),
        beak: r.beak, gulp: r.gulp,
      };
    },
  },

  /* ----------------------------------------------------------------- 14 */
  {
    id: 'courier', y: 888, x: 6300, v: -134, w: 220, h: 270, link: 'contact', shadow: [0, 82],
    name: L('The corresponding author', '通讯作者'),
    prompt: L('a pelican riding a bicycle, delivering a letter', '一只鹈鹕骑自行车送信'),
    note: L('Folding bike, messenger bag, one letter in the bill. Email is usually faster than waiting for it to come round again.', '折叠车，邮差包，嘴里叼着一封信。比起等它再绕回来，发邮件通常更快。'),
    checks: ['y', 'y', 'y'], verdict: { pass: true, text: L('Pass. Delivery not guaranteed.', '通过。但不保证送达。') },
    linkLabel: L('Get in touch', '联系我'),
    trick: L('Ring the bell', '按铃'),
    boxes: [['pelican', -86, -262, 200, 244], ['bicycle', -82, -136, 164, 136]],
    build({ g, inst, world }) {
      const r = rider(g, {
        bike: { r: 26, wb: 104, frame: 40, post: 34, stem: 44, headTube: 16, crank: 16, color: '#19b28f', fenders: true, lamp: true },
        bird: { legs: [50, 54], hat: 'cap', hatColor: '#2f62e0' }, gear: 1.25,
      });
      const bd = r.p.bodyG;
      stroke(bd, 'M56 -50Q26 -34 -2 -14', INK, 6.5);
      stroke(bd, 'M56 -50Q26 -34 -2 -14', '#2f62e0', 3.2);
      shape(bd, 'M-30 -34l34 -6l6 26l-34 8Z', '#2f62e0');
      shape(bd, 'M-30 -34l34 -6l2 11l-18 9Z', '#5d86f0', { 'stroke-width': 2.6 });
      const env = G(r.p.headB, { transform: 'translate(58 -6) rotate(8)' });
      shape(env, 'M0 0h28v19h-28Z', '#fffdf7', { 'stroke-width': 2.4 });
      stroke(env, 'M0 0l14 10l14 -10', INK, 1.6);
      C(env, 14, 11, 3, { fill: '#ef4b3b' });
      return {
        update: (f) => r.update(f),
        trick() {
          for (let n = 0; n < 3; n++) setTimeout(() => world.puff(...world.toView(inst, [40, -150]), 'note', { vy: -90, vx: 30 * inst.face, color: '#ef4b3b' }), n * 140);
        },
        beak: r.beak, gulp: r.gulp,
      };
    },
  },

  /* ----------------------------------------------------------------- 15 */
  {
    id: 'podium', y: 926, x: 1900, v: -160, w: 260, h: 250, link: 'awards',
    name: L('The podium regular', '领奖台常客'),
    prompt: L('a pelican riding a bicycle, fast', '一只鹈鹕骑自行车（要快）'),
    note: L('Aero helmet, disc wheel, medals that clink on every pedal stroke. The awards are listed further down the page.', '气动头盔，封闭轮，每蹬一脚奖牌就叮当响。奖项列表在页面下方。'),
    checks: ['y', 'y', 'y'], verdict: { pass: true, text: L('Pass, with a time bonus.', '通过，另加时间奖励。') },
    linkLabel: L('See the awards', '看奖项'),
    trick: L('Attack', '进攻'),
    boxes: [['pelican', -96, -226, 240, 212], ['bicycle', -124, -146, 250, 146]],
    build({ g, inst }) {
      const r = rider(g, {
        bike: { color: '#ffcf3a', bars: 'aero', discRear: '#2a2545', frame: 62, post: 12, stem: 8, headTube: 16, bell: false, saddle: '#16204a' },
        bird: { hat: 'aero', hatColor: '#ef4b3b' }, pose: { lean: 0.3, neckAng: 0.92, neckLen: 50, head: -0.02 }, gear: 1.7,
      });
      const med = G(r.p.bodyG, { transform: 'translate(62 -26)' });
      const sw = G(med);
      stroke(sw, 'M-6 -10L-4 14M4 -12L8 16M0 -11L2 26', '#2f62e0', 3);
      C(sw, -4, 18, 7, { fill: '#ffcf3a', stroke: INK, 'stroke-width': 2.4 });
      C(sw, 9, 20, 7, { fill: '#d9dee8', stroke: INK, 'stroke-width': 2.4 });
      C(sw, 2, 31, 7, { fill: '#ffcf3a', stroke: INK, 'stroke-width': 2.4 });
      return {
        update(f) {
          r.update(f);
          set(sw, 'transform', `rotate(${f1(17 + Math.sin((f.s / 46) * 3.4) * 9)})`);
        },
        trick() {
          inst.kick = 2;
          inst.kickT = 2;
        },
        beak: r.beak, gulp: r.gulp,
      };
    },
  },

  /* ----------------------------------------------------------------- 16 */
  {
    id: 'flight', lane: 'sky', x: 700, v: 110, w: 640, h: 300, box: [-470, -280, 640, 300], link: 'about', bell: [40, -150],
    name: L('Pedal-powered flight', '脚踏飞行'),
    prompt: L('a pelican riding a bicycle, airborne', '一只鹈鹕骑自行车（空中版）'),
    note: L('It can already fly. It bolted wings onto a bicycle and pedals instead.', '它本来就会飞，却选择给自行车装上翅膀，然后用脚蹬。'),
    checks: ['y', 'y', 'y'], verdict: { pass: true, text: L('Pass. Unnecessarily.', '通过。虽然没有必要。') },
    linkLabel: L('About Kaixin', '关于楷馨'),
    trick: L('Loop the banner', '甩甩横幅'),
    boxes: [['pelican', -84, -268, 196, 250], ['bicycle', -180, -230, 310, 232]],
    build({ g, world }) {
      const wingF = shape(g, '', '#f6d7d2');
      const ban = G(g);
      const rope = stroke(g, '', INK, 1.6);
      const r = rider(g, { bike: { color: '#ff7fae', bell: false }, bird: { shades: true, scarf: '#ffcf3a' }, gear: 2.6 });
      const wingN = shape(g, '', '#fffdf7'), tip = shape(g, '', INK, { 'stroke-width': 2 });
      const prop = G(g, { transform: 'translate(124 -70)' });
      stroke(g, 'M60 -98L124 -70', INK, 4);
      const blades = E(prop, 0, 0, 5, 30, { fill: '#ffcf3a', stroke: INK, 'stroke-width': 2.6 });
      C(prop, 0, 0, 5, { fill: INK });
      const cloth = shape(ban, '', '#fffdf7');
      const txt = T(ban, 0, 0, '', { class: 'banner-text', 'text-anchor': 'middle' });
      const words = () => (world.state.lang === 'zh' ? '论文在下面，请往下滑' : 'the research is further down');
      txt.textContent = words();
      const lp = pulse();
      return {
        update(f) {
          const a = lp.step(f.dt);
          r.update(f);
          const fl = Math.sin(f.t * 5.2), root = [-58, -96];
          const mkWing = (off) => {
            const ang = 1.75 + fl * 0.5 + off, len = 150;
            const t2 = add(root, dir(ang, len)), m = add(root, dir(ang + 0.45, len * 0.5));
            return [ribbon(root, m, t2, 26, 8, 8), ribbon(add(root, dir(ang + 0.2, len * 0.72)), add(root, dir(ang + 0.12, len * 0.86)), t2, 14, 7, 4)];
          };
          const [d1, d2] = mkWing(0);
          set(wingN, 'd', d1);
          set(tip, 'd', d2);
          set(wingF, 'd', mkWing(0.3)[0]);
          set(blades, 'transform', `rotate(${f1(f.t * 900)})`);
          const by = -70 + Math.sin(f.t * 2.2) * 10, rot = Math.sin(f.t * 1.8) * 4 + a * 360;
          set(rope, 'd', `M-75 -46Q-110 ${f1(by + 20)} -150 ${f1(by)}`);
          set(ban, 'transform', `translate(-150 ${f1(by)}) rotate(${f1(rot)})`);
          const k = Math.sin(f.t * 6) * 5;
          set(cloth, 'd', `M0 -22q-76 ${f1(k)} -152 0t-152 0l16 22l-16 22q76 ${f1(-k)} 152 0t152 0Z`);
          set(txt, 'transform', `translate(-146 7)`);
        },
        trick: () => lp.go(1.2),
        lang: () => (txt.textContent = words()),
        beak: r.beak, gulp: r.gulp,
      };
    },
  },

  /* ----------------------------------------------------------------- 17 */
  {
    id: 'delivery', lane: 'high', x: 2600, v: -80, w: 300, h: 250, box: [-150, -150, 300, 250], noBell: true,
    name: L('Special delivery', '送子鹈鹕'),
    prompt: L('a pelican carrying a bicycle', '一只鹈鹕叼着一辆自行车'),
    note: L('A newborn bicycle, delivered the traditional way. Carrying is not riding.', '一辆新生的自行车，按传统方式投递。但叼着不算骑。'),
    checks: ['y', 'y', 'n'], why: L('The bicycle is luggage.', '这辆车属于行李。'),
    verdict: { pass: false, text: L('Fail. That is freight.', '不通过。这叫货运。') },
    trick: L('Rock the cradle', '摇一摇'),
    boxes: [['pelican', -120, -110, 250, 130], ['bicycle', 66, 10, 80, 70]],
    build({ g }) {
      const p = pelican({ legs: [30, 32], tips: true });
      const sling = G(g);
      g.append(p.far, p.mid, p.near);
      g.appendChild(sling);
      const strap = stroke(sling, 'M0 0L-22 44M0 0L22 44', INK, 2);
      const w1 = wheel(12, { spokes: 5, reflector: false }), w2 = wheel(12, { spokes: 5, reflector: false });
      w1.root.setAttribute('transform', 'translate(-15 66)');
      w2.root.setAttribute('transform', 'translate(15 66)');
      sling.append(w1.root, w2.root);
      tubes(sling, 'M-15 66L-5 50L11 50L15 66M-5 50L0 66L-15 66', '#ff7fae', 3.2);
      shape(sling, 'M-30 40Q0 86 30 40Q0 54 -30 40Z', '#fffdf7');
      shape(sling, 'M-6 -4l-10 -9l4 12l-8 6l12 -2l4 10l3 -12l11 -3Z', '#ff7fae', { 'stroke-width': 2.4 });
      const rk = pulse();
      return {
        update(f) {
          const a = rk.step(f.dt), fl = Math.sin(f.t * 4.4);
          const hip = [-60, -30 + fl * -5];
          p.pose({ hip, lean: 0.08, neckAng: 0.5, neckLen: 46, head: -0.28, flap: 0.75 + fl * 0.7, span: 120, footN: [hip[0] - 34, hip[1] + 10, 150], footF: [hip[0] - 30, hip[1] + 4, 150], sag: 12 });
          const H = p.headPos(), c = Math.cos(-0.28), s = Math.sin(-0.28);
          const tipx = H[0] + 88 * c + 8 * s, tipy = H[1] - 88 * s + 8 * c;
          set(sling, 'transform', `translate(${f1(tipx)} ${f1(tipy)}) rotate(${f1(Math.sin(f.t * 2.2) * (7 + a * 30))})`);
          set(w1.spin, 'transform', `rotate(${f1(f.t * 90)})`);
          set(w2.spin, 'transform', `rotate(${f1(f.t * 90)})`);
        },
        trick: () => rk.go(1.8),
        beak: () => p.beak(), gulp: (x) => p.setGulp(x * 0.5),
      };
    },
  },

  /* ----------------------------------------------------------------- 18 */
  {
    id: 'peloton', lane: 'far', x: 5500, v: 230, w: 900, h: 280, box: [-440, -280, 900, 280], bell: [300, -160], shadow: [0, 470],
    name: L('The peloton', '鹈鹕大集团'),
    prompt: L('a pelican riding a bicycle, ×5, temperature 0', '一只鹈鹕骑自行车 ×5（温度 0）'),
    note: L('Five samples at temperature zero. Nearly identical, apart from the one facing backwards.', '温度设为 0，采样五次。结果几乎一模一样，除了倒着坐的那一只。'),
    checks: ['y', 'y', 'y'], verdict: { pass: true, short: L('PASS ×5', '通过 ×5'), text: L('Pass ×5. Diversity: low.', '通过 ×5。多样性：低。') },
    trick: L('Break away', '突围'),
    boxes: [['pelican', -440, -268, 196, 250], ['pelican', -84, -268, 196, 250], ['pelican', 276, -268, 196, 250], ['bicycle', -480, -152, 960, 152]],
    build({ g, inst }) {
      const cols = ['#ef4b3b', '#2f62e0', '#ffcf3a', '#19b28f', '#ff7fae'];
      const rs = cols.map((c, n) => {
        const gg = G(g, { transform: `translate(${-356 + n * 178} 0)` });
        return rider(gg, {
          bike: { color: '#fffdf7', bars: 'drop', bell: false, saddle: '#16204a' }, backwards: n === 3,
          bird: { jersey: c, bib: '12385'[n], hat: 'helmet', hatColor: c }, pose: { lean: 0.42, neckAng: 1.12, neckLen: 54 },
        });
      });
      return {
        update(f) {
          rs.forEach((r, n) => r.update({ ...f, s: f.s + n * 31 }));
        },
        trick() {
          inst.kick = 1.8;
          inst.kickT = 2.2;
        },
        beak: rs[4].beak, gulp: rs[4].gulp,
      };
    },
  },

  /* ----------------------------------------------------------------- 19 */
  {
    id: 'ood', lane: 'sea', x: 150, v: 90, size: 1.15, w: 250, h: 240, bell: [20, -120],
    name: L('Out of distribution', '分布外样本'),
    prompt: L('a pelican riding a bicycle, but the road is the sea', '一只鹈鹕骑自行车，但路是海'),
    note: L('Nobody said the road had to be solid.', '题目并没有说路必须是固体。'),
    checks: ['y', 'q', 'y'], why: L('Unclear whether a pedalo counts.', '脚踏船算不算自行车，尚无定论。'),
    verdict: { pass: null, short: L('UNDER REVIEW', '待裁定'), text: L('Provisional pass, pending a ruling on pedalos.', '暂定通过，等待关于脚踏船的裁定。') },
    trick: L('Make a splash', '溅点水'),
    boxes: [['pelican', -84, -236, 196, 220], ['bicycle', -100, -110, 220, 120]],
    build({ g, inst, world }) {
      const bobG = G(g);
      const r = rider(bobG, { vehicle: waterBike(), bird: { legs: [36, 40], hat: 'cap', hatColor: '#2f62e0' }, gear: 2, cadence: (f) => f.s * 0.051 }); // pedals follow the distance covered, so they slow, stop and reverse with the boat
      r.v.pts.r = 24;
      stroke(bobG, 'M-110 4q10 -6 20 0t20 0M90 4q10 -6 20 0t20 0', '#fff', 3, { opacity: 0.8 });
      const sp = pulse();
      let drip = 0;
      return {
        update(f) {
          const a = sp.step(f.dt);
          set(bobG, 'transform', `translate(0 ${f1(Math.sin(f.t * 1.7) * 4)}) rotate(${f1(Math.sin(f.t * 1.3) * 2.2)})`);
          r.update(f);
          if ((drip -= f.dt) < 0) {
            drip = 0.3 - a * 0.24;
            world.puff(...world.toView(inst, [-96, -20]), 'drop', { vx: (-60 - Math.random() * 60) * inst.face, vy: -120 - a * 120, g: 500, ttl: 0.7 });
          }
        },
        trick: () => sp.go(1.6),
        beak: r.beak, gulp: r.gulp,
      };
    },
  },

  /* ----------------------------------------------------------------- 20 */
  {
    id: 'finetune', y: 942, x: 4300, v: -50, w: 250, h: 275, size: 0.64,
    name: L('Fine-tune in progress', '微调进行中'),
    prompt: L('a small pelican riding a small bicycle', '一只小鹈鹕骑一辆小自行车'),
    note: L('First ride. Training wheels still on, helmet two sizes too big.', '第一次上路。辅助轮还没拆，头盔大了两号。'),
    checks: ['y', 'y', 'y'], verdict: { pass: true, short: L('PASS (ASSISTED)', '辅助通过'), text: L('Pass, with assistance.', '在辅助下通过。') },
    trick: L('Cheer it on', '给它加油'),
    boxes: [['pelican', -84, -276, 196, 258], ['bicycle', -124, -152, 250, 152]],
    build({ g, inst, world }) {
      const tilt = G(g);
      const r = rider(tilt, {
        bike: { color: '#ff7fae', training: true, basket: true }, gear: 3,
        bird: { pal: 'chick', hat: 'helmet', hatColor: '#ffcf3a', hatScale: 1.3, neckW: 16 }, pose: { neckLen: 48, neckAng: 1.25, head: 0.02 },
      });
      return {
        update(f) {
          set(tilt, 'transform', `rotate(${f1(Math.sin(f.s / 30) * 4.5)})`);
          r.update(f);
        },
        trick() {
          inst.kick = 2.2;
          inst.kickT = 1.4;
          world.puff(...world.toView(inst, [0, -300]), 'text', { text: world.state.lang === 'zh' ? '加油！' : 'go!', vy: -50, ttl: 1, size: 28 });
        },
        beak: r.beak, gulp: r.gulp,
      };
    },
  },
];

/* ----------------------------------------------------- generated remixes */

const HATS = [null, 'cap', 'helmet', 'top', 'party', 'beret', 'crown', 'sweat'];
const PALS = ['white', 'white', 'white', 'pink', 'brown'];
const REMARKS = [
  L('Fresh from the generator. Not yet peer reviewed.', '刚从生成器里出来，尚未经过同行评审。'),
  L('Sampled at a high temperature. Results may vary; this one did.', '高温采样的结果因次而异，这一次就不太一样。'),
  L('Indistinguishable from the control, according to the control.', '据对照组本人说，它和对照组没有区别。'),
  L('Generated on request. Nobody asked for the hat.', '按要求生成。但没有人要求过这顶帽子。'),
];

export function remix(seed, n) {
  const rnd = rng(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const kind = pick(['city', 'city', 'city', 'mini', 'race', 'legacy', 'uni']);
  const color = pick(BIKE_COLORS), hat = pick(HATS), pal = pick(PALS), dirn = rnd() < 0.5 ? 1 : -1;
  const y = dirn > 0 ? 796 + rnd() * 68 : 884 + rnd() * 64;
  const speed = (60 + rnd() * 90) * dirn;
  const hex4 = (seed >>> 0).toString(16).padStart(8, '0').slice(0, 4);
  return {
    id: 'sample-' + n, y: Math.round(y), v: speed, w: 250, h: kind === 'legacy' ? 300 : 275, generated: true,
    size: 0.9 + rnd() * 0.22,
    shadow: kind === 'uni' ? [0, 48] : kind === 'mini' ? [0, 82] : kind === 'legacy' ? [-12, 94] : null,
    name: L(`Sample ${n}`, `样本 ${n}`),
    prompt: L(`a pelican riding a bicycle (seed ${hex4})`, `一只鹈鹕骑自行车（种子 ${hex4}）`),
    note: REMARKS[Math.floor(rnd() * REMARKS.length)],
    checks: ['y', 'y', 'y'], verdict: { pass: true, text: L('Pass. Filed with the others.', '通过。已与其他样本一并归档。') },
    trick: L('Ring the bell', '按铃'),
    boxes: [['pelican', -84, -268, 196, 250], ['bicycle', -124, -152, 250, 152]],
    build({ g, inst, world }) {
      const bird = { pal, hat, hatColor: pick(BIKE_COLORS), scarf: rnd() < 0.35 ? pick(BIKE_COLORS) : null, shades: rnd() < 0.2 };
      let r;
      if (kind === 'legacy') r = rider(g, { vehicle: penny(color), bird: { ...bird, legs: [56, 60] }, pose: { lean: 0.75, neckAng: 1.4, neckLen: 56, head: -0.05 }, cadence: (f, wa) => wa });
      else if (kind === 'uni') r = rider(g, { vehicle: unicycle(color), bird: { ...bird, legs: [46, 50] }, noHands: true, seat: [-8, 6], pose: { lean: 1, neckAng: 1.45, neckLen: 54, head: 0 }, cadence: (f, wa) => wa });
      else if (kind === 'mini') r = rider(g, { bike: { r: 26, wb: 104, frame: 40, post: 34, stem: 44, headTube: 16, crank: 16, color, fenders: rnd() < 0.5 }, bird: { ...bird, legs: [50, 54] }, gear: 1.25 });
      else if (kind === 'race') r = rider(g, { bike: { color, bars: 'drop', bell: false }, bird, pose: { lean: 0.42, neckAng: 1.12, neckLen: 54 } });
      else r = rider(g, { bike: { color, fenders: rnd() < 0.4, basket: rnd() < 0.4, lamp: rnd() < 0.5 }, bird });
      return {
        update: (f) => r.update(f, kind === 'uni' ? { flap: 0.2 + Math.sin(f.t * 3) * 0.2, flapF: 1.7, span: 70 } : null),
        trick() {
          world.puff(...world.toView(inst, [40, -170]), 'note', { vy: -90, vx: 30 * inst.face, color: '#ef4b3b' });
          inst.kick = 1.5;
          inst.kickT = 1;
        },
        beak: r.beak, gulp: r.gulp,
      };
    },
  };
}
