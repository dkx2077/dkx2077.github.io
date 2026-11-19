import { createWorld, W, depth } from './scene/world.js';
import { SPECIMENS, remix } from './scene/specimens.js';
import { setupCrossing } from './scene/crossing.js';
import { mod } from './scene/svg.js';
import { STR, applyLang, detectLang } from './i18n.js';
import { sfx } from './scene/audio.js';

document.documentElement.classList.add('js');
const $ = (id) => document.getElementById(id);
const scene = $('top'), card = $('card'), hud = $('hud'), hint = $('hint'), cond = $('conditions');
const narrow = matchMedia('(max-width: 720px)');
const MARK = { y: '✓', n: '✗', h: '½', q: '?' };

let lang = new URLSearchParams(location.search).get('lang') === 'zh' ? 'zh' : new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : detectLang();
let S = applyLang(lang);
let current = null;

/* ------------------------------------------------------------------ world */

const world = createWorld(scene, {
  words: () => S,
  gulpWord: () => S.gulp,
  onSelect: showCard,
  onTrick(i) {
    if (i.def.id === 'merge') sfx.honk();
    else if (i.def.id === 'crossing') sfx.beep();
    else if (!i.def.noBell) sfx.bell(0, 0.85 + Math.random() * 0.4);
    else sfx.pop();
  },
  onFed(n) {
    sfx.gulp();
    if (S.fed[n]) toast(S.fed[n]);
  },
  onThrow() {
    sfx.toss();
    dropHint();
  },
  onPan: dropHint,
  onRing: () => sfx.bell(0, 0.8 + Math.random() * 0.5),
});
world.state.lang = lang;

const roster = [];
const enroll = (def) => {
  def.no = roster.push(def);
  return world.add(def);
};
SPECIMENS.forEach(enroll);
const crossing = setupCrossing(world, {
  onState(s) {
    if (s === 'wait') toast(S.crossWait), sfx.beep(), sfx.beep(0.18);
    else if (s === 'walk') toast(S.crossGo);
    else if (s === 'busy') toast(S.crossBusy);
  },
});
enroll(crossing.def);
let highest = roster.length;

world.cam.x = 640;

/* ------------------------------------------------------------------ clock */

let followClock = true;
const themeMeta = document.querySelector('meta[name="theme-color"]');
const clockHour = () => {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
};
function setHour(h) {
  const pal = world.scenery.setTime(h);
  document.documentElement.dataset.phase = scene.classList.contains('is-starry') ? 'night' : pal.phase;
  themeMeta?.setAttribute('content', pal.skyA);
  $('c-time').value = h;
  const hh = Math.floor(h) % 24, mm = Math.round((h % 1) * 60);
  $('c-time-out').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
const query = new URLSearchParams(location.search);
if (query.has('hour')) followClock = false;
setHour(query.has('hour') ? +query.get('hour') : clockHour());
setInterval(() => followClock && setHour(clockHour()), 60000);
$('c-time').addEventListener('input', (e) => {
  followClock = false;
  setHour(+e.target.value);
});
$('c-now').addEventListener('click', () => {
  followClock = true;
  setHour(clockHour());
});

function windWord(v) {
  return v < -0.15 ? S.windBack : v < 0.75 ? S.windHead : v <= 1.25 ? S.windCalm : v < 2.2 ? S.windTail : S.windStorm;
}
$('c-wind').addEventListener('input', (e) => {
  world.setWind(+e.target.value);
  $('c-wind-out').textContent = windWord(+e.target.value);
});

/* -------------------------------------------------------------- overlays */

let toastTimer = 0;
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-on'), 2600);
}

let hintGone = false;
function dropHint() {
  if (hintGone) return;
  hintGone = true;
  hint.classList.add('is-gone');
}
setTimeout(dropHint, 14000);

function measureHud() {
  const open = !card.hidden, w = scene.clientWidth, h = scene.clientHeight;
  const px = hud.offsetHeight + 10;
  world.setHud(px);
  const bar = scene.querySelector('.topbar').offsetHeight, tip = $('hint');
  world.setRoof(narrow.matches ? Math.max(bar, tip.offsetTop + tip.offsetHeight) : bar);
  if (!open) world.setFree(null);
  else if (narrow.matches) world.setFree({ l: 0, r: w, t: 64, b: h - card.offsetHeight - 20 });
  else world.setFree({ l: card.offsetLeft + card.offsetWidth + 10, r: w, t: 84, b: h - px });
}
new ResizeObserver(measureHud).observe(hud);
new ResizeObserver(measureHud).observe(card);
narrow.addEventListener('change', measureHud);

const li = (mark, text, why) => {
  const n = document.createElement('li');
  const m = document.createElement('span');
  m.className = 'mk mk-' + mark;
  m.textContent = MARK[mark];
  m.setAttribute('aria-hidden', 'true');
  const t = document.createElement('span');
  t.textContent = text;
  const sr = document.createElement('span');
  sr.className = 'sr';
  sr.textContent = ': ' + { y: S.pass, n: S.fail, h: '½', q: '?' }[mark];
  t.appendChild(sr);
  n.append(m, t);
  if (why) {
    const w = document.createElement('span');
    w.className = 'why';
    w.textContent = why;
    n.appendChild(w);
  }
  return n;
};

function showCard(i) {
  current = i;
  if (!i) {
    card.hidden = true;
    scene.classList.remove('has-card');
    measureHud();
    return;
  }
  const d = i.def;
  $('card-no').textContent = S.no(d.no, highest);
  $('card-name').textContent = d.name[lang];
  $('card-prompt').textContent = d.prompt[lang];
  $('card-note').textContent = d.note[lang];
  const rows = [S.rowPelican, S.rowBicycle, S.rowRiding];
  const firstOdd = d.checks.findIndex((c) => c !== 'y');
  $('card-checks').replaceChildren(...d.checks.map((c, n) => li(c, rows[n], n === firstOdd && d.why ? d.why[lang] : null)));
  const v = $('card-verdict');
  v.textContent = d.verdict.text[lang];
  v.className = 'card-verdict ' + (d.verdict.pass === true ? 'is-pass' : d.verdict.pass === false ? 'is-fail' : 'is-na');
  $('card-trick').textContent = d.trick[lang];
  const a = $('card-link');
  a.hidden = !d.link;
  if (d.link) {
    a.href = '#' + d.link;
    a.textContent = d.linkLabel[lang];
  }
  card.hidden = false;
  scene.classList.add('has-card');
  cond.hidden = true;
  $('t-cond').setAttribute('aria-expanded', 'false');
  dropHint();
  measureHud();
}
$('card-close').addEventListener('click', () => world.deselect());
$('card-trick').addEventListener('click', () => current && world.trick(current));
$('card-link').addEventListener('click', () => setTimeout(() => world.deselect(), 50));
$('card-copy').addEventListener('click', () => {
  if (!current) return;
  const d = current.def, b = d.box || [-d.w / 2, -d.h, d.w, d.h], m = 18;
  const clone = current.inner.cloneNode(true);
  clone.querySelectorAll('.hit, .shadow').forEach((n) => n.remove());
  const esc = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b[0] - m} ${b[1] - m} ${b[2] + m * 2} ${b[3] + m * 2}" width="${(b[2] + m * 2) * 2}" height="${(b[3] + m * 2) * 2}">` +
    `<title>${esc(d.prompt.en)}</title><style>text{font:800 18px Archivo,system-ui,sans-serif}</style>${clone.innerHTML}</svg>`;
  try {
    navigator.clipboard.writeText(svg).then(() => toast(S.copied), () => toast(S.copyFail));
  } catch {
    toast(S.copyFail);
  }
});

/* ------------------------------------------------------------------ tools */

function generate() {
  const n = ++highest;
  const def = remix((Math.random() * 2 ** 32) >>> 0, n);
  def.no = n;
  const x = world.cam.x + ((def.v > 0 ? -1 : 1) * (world.view.vw / 2 + 170)) / depth(def.y);
  const inst = world.add(def, { x: mod(x, W) });
  generated.push(inst);
  if (generated.length > 10) world.remove(generated.shift());
  sfx.pop();
  toast(S.generated(n));
  dropHint();
}
const generated = [];
$('generate').addEventListener('click', generate);

function ring() {
  toast(S.bells(world.ringAll()));
}
$('t-bell').addEventListener('click', ring);

function toggleEval() {
  const b = $('t-eval'), on = b.getAttribute('aria-pressed') !== 'true';
  b.setAttribute('aria-pressed', on);
  world.setEval(on);
  const tally = { true: 0, false: 0, null: 0 };
  for (const i of world.instances) tally[i.def.verdict.pass]++;
  toast(on ? S.evalOn(world.instances.length, tally.true, tally.false, tally.null) : S.evalOff);
}
$('t-eval').addEventListener('click', toggleEval);

$('t-cond').addEventListener('click', (e) => {
  const open = cond.hidden;
  cond.hidden = !open;
  e.currentTarget.setAttribute('aria-expanded', open);
  if (open) $('c-time').focus({ preventScroll: true });
});
document.addEventListener('pointerdown', (e) => {
  if (!cond.hidden && !e.target.closest('#conditions, #t-cond')) {
    cond.hidden = true;
    $('t-cond').setAttribute('aria-expanded', 'false');
  }
});
cond.addEventListener('submit', (e) => e.preventDefault());

$('t-sound').addEventListener('click', (e) => {
  const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
  e.currentTarget.setAttribute('aria-pressed', on);
  sfx.enable(on);
  if (on) sfx.bell();
  toast(on ? S.soundOn : S.soundOff);
});

function setPaused(p) {
  const b = $('t-pause');
  b.setAttribute('aria-pressed', p);
  b.setAttribute('aria-label', p ? S.tPlay : S.tPause);
  b.title = p ? S.tPlay : S.tPause;
  world.setPaused(p);
}
$('t-pause').addEventListener('click', () => setPaused(!world.state.paused));

document.addEventListener('keydown', (e) => {
  if (starry) {
    if (e.key === 'Escape') closeStarry();
    return;
  }
  if (e.key === 'Escape') {
    if (!cond.hidden) (cond.hidden = true), $('t-cond').setAttribute('aria-expanded', 'false'), $('t-cond').focus();
    else world.deselect();
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest('input, textarea, select, button, a')) return;
  if (scene.getBoundingClientRect().bottom < 120) return;
  const k = e.key.toLowerCase();
  if (k === 'b') ring();
  else if (k === 'e') toggleEval();
  else if (k === 'g') generate();
});

/* ------------------------------------------------- the moon: Starry Night */

// At night the moon is a door. The painted version is a separate module, fetched only when someone opens it.
const moonBtn = $('moon'), starryUi = $('starry-ui');
let starry = null, starryBusy = false, moonKey = '';
world.tick(() => {
  const m = world.scenery.moonAt(), show = m.up && !starry;
  if (moonBtn.hidden === show) moonBtn.hidden = !show;
  if (!show) return;
  const s = world.view.s, d = Math.max(48, m.r * 2 * s);
  const key = `translate(${Math.round(m.x * s - d / 2)}px, ${Math.round((m.y - world.view.top) * s - d / 2)}px)`;
  if (key !== moonKey) {
    moonKey = key;
    moonBtn.style.transform = key;
    moonBtn.style.width = moonBtn.style.height = Math.round(d) + 'px';
  }
});
// the moon leans in under a pointer, or under keyboard focus
for (const [ev, on] of [['pointerenter', true], ['pointerleave', false], ['focus', null], ['blur', false]])
  moonBtn.addEventListener(ev, () => scene.classList.toggle('moon-hot', on ?? moonBtn.matches(':focus-visible')));

async function openStarry() {
  if (starry || starryBusy) return;
  starryBusy = true;
  try {
    world.deselect();
    cond.hidden = true;
    $('t-cond').setAttribute('aria-expanded', 'false');
    if ($('t-eval').getAttribute('aria-pressed') === 'true') ($('t-eval').setAttribute('aria-pressed', 'false'), world.setEval(false));
    const { enterStarry } = await import('./starry/starry.js');
    starry = enterStarry({ scene, world, label: S.starryLabel, still: matchMedia('(prefers-reduced-motion: reduce)').matches, onMoon: closeStarry });
    scene.classList.remove('moon-hot');
    scene.classList.add('is-starry');
    starryUi.hidden = false;
    document.documentElement.dataset.phase = 'night';
    dropHint();
    $('starry-exit').focus({ preventScroll: true });
  } finally {
    starryBusy = false;
  }
}
function closeStarry() {
  if (!starry) return;
  const st = starry;
  starry = null;
  st.exit();
  scene.classList.remove('is-starry');
  starryUi.hidden = true;
  document.documentElement.dataset.phase = world.scenery.palette.phase;
  moonBtn.hidden = !world.scenery.moonAt().up;
  // Back where the visitor came in. Asked twice: a tap on the painted moon moves focus away again right after this.
  const back = () => !starry && !moonBtn.hidden && moonBtn.focus({ preventScroll: true });
  back();
  setTimeout(back, 0);
}
moonBtn.addEventListener('click', openStarry);
$('starry-exit').addEventListener('click', closeStarry);

/* ------------------------------------------------------------------ table */

function renderTable() {
  const body = document.querySelector('#results tbody');
  const cell = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  body.replaceChildren(
    ...roster.map((d) => {
      const tr = document.createElement('tr');
      const sub = cell('td');
      sub.append(cell('span', 'sub-name', d.name[lang]), cell('span', 'sub-prompt', d.prompt[lang]));
      const marks = d.checks.map((c) => {
        const td = cell('td');
        const m = cell('span', 'mk mk-' + c, MARK[c]);
        m.setAttribute('aria-label', { y: S.pass, n: S.fail, h: '½', q: '?' }[c]);
        m.setAttribute('role', 'img');
        td.appendChild(m);
        return td;
      });
      const act = cell('td');
      const b = cell('button', 'show', S.show);
      b.type = 'button';
      b.setAttribute('aria-label', `${S.show}: ${d.name[lang]}`);
      b.addEventListener('click', () => {
        scene.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        const i = world.find(d.id);
        if (i) world.select(i, { trick: false });
      });
      act.appendChild(b);
      tr.append(cell('td', null, String(d.no).padStart(2, '0')), sub, ...marks, cell('td', null, d.verdict.text[lang]), act);
      return tr;
    }),
  );
}
renderTable();

/* --------------------------------------------------------------- language */

function setLang(l) {
  lang = l;
  S = applyLang(l);
  world.setLang(l);
  const b = $('lang');
  b.textContent = S.langButton;
  b.setAttribute('aria-label', S.langAria);
  b.lang = l === 'zh' ? 'en' : 'zh';
  $('c-wind-out').textContent = windWord(+$('c-wind').value);
  setPaused(world.state.paused);
  renderTable();
  if (current) showCard(current);
  starry?.setLabel(S.starryLabel);
}
$('lang').addEventListener('click', () => setLang(lang === 'zh' ? 'en' : 'zh'));
setLang(lang);

/* ------------------------------------------------------------------ start */

if (matchMedia('(prefers-reduced-motion: reduce)').matches) setPaused(true);
measureHud();
world.start();
if (query.has('starry')) openStarry(); // for testing: ?starry opens the painted version straight away
window.pelicans = world; // for the curious: open the console
Object.defineProperty(world, 'starry', { get: () => starry });
