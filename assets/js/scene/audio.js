// A few synthesised sounds. Off until the visitor turns sound on.
let ctx = null, on = false, master = null;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

function tone(freq, dur, o = {}) {
  if (!on || !ensure()) return;
  const t = ctx.currentTime + (o.delay || 0);
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.vol || 0.6, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export const sfx = {
  get on() { return on; },
  enable(v) {
    on = v;
    if (v && ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  },
  bell(delay = 0, pitch = 1) {
    tone(1760 * pitch, 0.7, { delay, vol: 0.5 });
    tone(2640 * pitch, 0.45, { delay, vol: 0.25 });
    tone(1760 * pitch, 0.5, { delay: delay + 0.16, vol: 0.35 });
  },
  toss() { tone(520, 0.18, { to: 900, type: 'triangle', vol: 0.3 }); },
  gulp() {
    tone(420, 0.14, { to: 140, type: 'triangle', vol: 0.6 });
    tone(180, 0.12, { to: 320, type: 'sine', vol: 0.4, delay: 0.13 });
  },
  pop() { tone(300, 0.1, { to: 760, type: 'square', vol: 0.18 }); },
  honk() { tone(196, 0.32, { type: 'sawtooth', vol: 0.28 }); tone(294, 0.32, { type: 'sawtooth', vol: 0.18 }); },
  beep(delay = 0) { tone(880, 0.09, { delay, type: 'square', vol: 0.16 }); },
};
