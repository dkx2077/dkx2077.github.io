// Run with: npm test (plain Node, no dependencies)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { SPECIMENS, remix } from '../assets/js/scene/specimens.js';
import { paletteAt, moonUp, W } from '../assets/js/scene/scenery.js';
import { ROAD_TOP, ROAD_BOTTOM, LANES, depth, HORIZON, WIND_MAX, cruise, sailOf } from '../assets/js/scene/world.js';
import { STR } from '../assets/js/i18n.js';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const both = (o) => typeof o?.en === 'string' && o.en.trim() && typeof o?.zh === 'string' && o.zh.trim();

test('every specimen is complete and bilingual', () => {
  const ids = new Set();
  for (const d of SPECIMENS) {
    assert.ok(!ids.has(d.id), `duplicate id ${d.id}`);
    ids.add(d.id);
    for (const k of ['name', 'prompt', 'note', 'trick']) assert.ok(both(d[k]), `${d.id}.${k} needs en and zh`);
    assert.ok(both(d.verdict.text), `${d.id}.verdict.text`);
    assert.ok([true, false, null].includes(d.verdict.pass), `${d.id}.verdict.pass`);
    assert.equal(d.checks.length, 3, `${d.id} is marked on three criteria`);
    for (const c of d.checks) assert.match(c, /^[ynhq]$/);
    if (d.checks.some((c) => c !== 'y') && d.verdict.pass !== true) assert.ok(both(d.why), `${d.id} should explain the failed check`);
    assert.equal(typeof d.build, 'function');
    assert.ok(d.w > 0 && d.h > 0);
    for (const b of d.boxes) assert.ok(['pelican', 'bicycle'].includes(b[0]) && b.length === 5, `${d.id} box`);
  }
  assert.ok(SPECIMENS.length >= 20);
});

test('specimens live either in a named lane or on the road', () => {
  for (const d of SPECIMENS) {
    if (d.lane) assert.ok(LANES[d.lane], `${d.id}: unknown lane ${d.lane}`);
    else if (d.still) assert.ok(d.y > 730 && d.y < ROAD_TOP, `${d.id}: parked specimens sit on the far kerb`);
    else assert.ok(d.y >= ROAD_TOP && d.y <= ROAD_BOTTOM, `${d.id}: y ${d.y} is off the road`);
    assert.ok(d.x >= 0 && d.x < W);
  }
  // nobody shares a baseline, so overtaking reads as depth rather than a collision
  const ys = SPECIMENS.filter((d) => !d.lane).map((d) => d.y);
  assert.equal(new Set(ys).size, ys.length);
});

test('one vanishing line: size and scroll speed follow the ground row', () => {
  assert.equal(depth(HORIZON), 0);
  assert.equal(depth(890), 1);
  for (let y = HORIZON + 10; y < 1100; y += 10) assert.ok(depth(y + 10) > depth(y), 'nearer is always larger');
  assert.ok(depth(ROAD_TOP) < 0.8 && depth(ROAD_BOTTOM) > 1.1, 'the far lane is clearly smaller than the near one');
  // ground lanes sit below the horizon and need no scale of their own; only the flying lanes carry one
  for (const [name, lane] of Object.entries(LANES)) {
    if (lane.air) assert.ok(lane.k > 0 && lane.k < 1, `${name} needs a scale`);
    else assert.ok(lane.y > HORIZON && lane.k === undefined, `${name} takes its scale from depth(y)`);
  }
  for (const d of SPECIMENS) if (d.size) assert.ok(d.size > 0.5 && d.size < 1.6, `${d.id}.size`);
});

test('keep-left traffic: riders heading right use the far half of the road', () => {
  for (const d of SPECIMENS.filter((d) => !d.lane && !d.still)) {
    if (d.v > 0) assert.ok(d.y < 872, `${d.id} rides right but is in the near half`);
    else assert.ok(d.y > 872, `${d.id} rides left but is in the far half`);
  }
});

test('cards that link to a section point at a real one', () => {
  for (const d of SPECIMENS.filter((d) => d.link)) {
    assert.ok(html.includes(`id="${d.link}"`), `${d.id} links to #${d.link}`);
    assert.ok(both(d.linkLabel));
  }
});

test('generated remixes are deterministic and valid', () => {
  for (const seed of [1, 42, 20261119, 4294967295]) {
    const a = remix(seed, 30), b = remix(seed, 30);
    assert.deepEqual([a.y, a.v, a.size, a.prompt.en], [b.y, b.v, b.size, b.prompt.en]);
    assert.ok(a.y >= ROAD_TOP && a.y <= ROAD_BOTTOM);
    assert.ok(both(a.name) && both(a.note));
    assert.ok((a.v > 0 && a.y < 872) || (a.v < 0 && a.y > 872));
  }
});

test('interface text exists in both languages', () => {
  assert.deepEqual(Object.keys(STR.en).sort(), Object.keys(STR.zh).sort());
  const used = [...html.matchAll(/data-i18n(?:-html|-aria|-title)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(used.length > 30);
  for (const k of used) for (const l of ['en', 'zh']) assert.ok(STR[l][k], `missing ${l}.${k}`);
});

test('the clock always yields a full palette', () => {
  for (let h = 0; h <= 24; h += 0.25) {
    const p = paletteAt(h);
    for (const k of ['skyA', 'skyB', 'sea1', 'road', 'title', 'onSky']) assert.match(p[k], /^#[0-9a-f]{6}$/, `${k} at ${h}`);
    assert.ok(p.veil >= 0 && p.veil <= 0.5);
    assert.ok(['day', 'night'].includes(p.phase));
  }
  assert.equal(paletteAt(13).phase, 'day');
  assert.equal(paletteAt(23).phase, 'night');
  assert.deepEqual(paletteAt(0).skyA, paletteAt(24).skyA);
});

test('the page references files that exist and keeps its landmarks', async () => {
  const local = [...html.matchAll(/(?:href|src)="(assets\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(local.length >= 4);
  for (const f of local) await access(new URL(f, root));
  for (const id of ['top', 'about', 'publications', 'awards', 'contact', 'appendix', 'generate', 'card', 'results']) assert.ok(html.includes(`id="${id}"`), `#${id}`);
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  assert.match(html, /<section[^>]*id="appendix"[^>]*\shidden>/, 'the appendix is kept in the markup but hidden');
  assert.ok(!/href="#appendix"/.test(html), 'nothing links to the hidden appendix');
  assert.equal((html.match(/class="pub"/g) || []).length, 11, 'eleven publications');
  assert.equal((await readFile(new URL('CNAME', root), 'utf8')).trim(), 'www.dengkaixin.com');
});

test('the moon is a switch to the painted version, and only at night', async () => {
  for (const h of [19, 21.5, 0, 3, 5.5]) assert.ok(moonUp(h), `the moon should be up at ${h}`);
  for (const h of [5.6, 8, 12, 16, 18.9]) assert.ok(!moonUp(h), `the moon should be down at ${h}`);
  // whenever the moon is drawn the sky behind it is a night sky
  for (let h = 0; h < 24; h += 0.25) if (moonUp(h)) assert.equal(paletteAt(h).phase, 'night', `at ${h} the moon is up over a day sky`);

  assert.match(html, /<button[^>]*id="moon"[^>]*hidden[^>]*aria-pressed="false"/, 'the moon button starts hidden, so it is not offered without JavaScript');
  assert.match(html, /<button[^>]*id="starry-exit"[^>]*hidden/);
  for (const k of ['moonLabel', 'moonBack', 'starryOn', 'starryExit']) assert.ok(STR.en[k] && STR.zh[k], `${k} in both languages`);

  // the painter is fetched on demand: it must load on its own, and main.js must not import it up front
  const { enterStarry } = await import('../assets/js/starry/starry.js');
  assert.equal(typeof enterStarry, 'function');
  const main = await readFile(new URL('assets/js/main.js', root), 'utf8');
  assert.match(main, /await import\('\.\/starry\/starry\.js'\)/);
  assert.doesNotMatch(main, /from '\.\/starry\//);
});

test('the painted version is the same scene, not a second one', async () => {
  const read = (f) => readFile(new URL('assets/' + f, root), 'utf8');
  const [painter, world, css] = await Promise.all([read('js/starry/starry.js'), read('js/scene/world.js'), read('css/main.css')]);
  // it is laid out in the world's own view, so nothing moves when it takes over
  assert.match(painter, /s = view\.s\b/);
  assert.match(painter, /top = view\.top\b/);
  assert.doesNotMatch(painter, /\bs = Math\.min\(/, 'the painter must not work out a scale of its own');
  // it takes the sky from the scene and the wind from the world
  for (const k of ['moonAt()', 'cloudsAt()', 'leanAt()', 'sc.stars', 'state.wind']) assert.ok(painter.includes(k), `the painter should read ${k}`);
  // the world has one way of taking a step, whoever asks for it
  assert.equal(world.split('for (const i of instances) step(i, dt);').length - 1, 1);
  assert.match(world, /headless: \(dt\) => advance\(/);
  // the drawn scene stays underneath and stays in charge: the picture lets clicks through, and no control is hidden
  assert.match(css, /\.starry-canvas \{[^}]*pointer-events: none/);
  assert.doesNotMatch(css, /is-starry \.(hud|card|conditions|moon-btn)/);
  assert.match(css, /\.scene\.is-painted \.world-svg \{\s*opacity: 0;/, 'hidden by opacity, which still takes clicks, never by visibility');
});

test('nothing on the page or in the readme credits the drawing to a model', async () => {
  const readme = await readFile(new URL('README.md', root), 'utf8');
  for (const [name, text] of [['index.html', html], ['README.md', readme]]) assert.doesNotMatch(text, /(drawn|绘制|generated|生成)[^\n]{0,40}Claude|Claude[^\n]{0,40}(绘制|drew)/i, name);
});

test('the wind has a direction: it helps the riders it follows and hinders the ones it meets', () => {
  const moving = SPECIMENS.filter((d) => d.v && !d.still), road = moving.filter((d) => !d.lane);
  // how fast a rider gets on in its own direction when the wind is at its back (+) or in its face (-)
  const headway = (d, w) => cruise(d.v, Math.sign(d.v) * w, sailOf(d)) * Math.sign(d.v);

  for (const d of moving) {
    assert.equal(cruise(d.v, 0, sailOf(d)), d.v, `${d.id}: still air changes nobody`);
    for (const w of [0.3, 1, WIND_MAX]) {
      assert.ok(headway(d, w) > Math.abs(d.v), `${d.id} should gain from a tailwind of ${w}`);
      assert.ok(headway(d, -w) < Math.abs(d.v), `${d.id} should lose to a headwind of ${w}`);
    }
  }
  // the same wind, seen from the two lanes, and the whole thing mirrored
  assert.ok(cruise(90, 1) > 90 && cruise(-90, 1) > -90);
  assert.equal(cruise(90, 1.3, 1.2), -cruise(-90, -1.3, 1.2));
  // a breeze turns nobody round; a gale blows the slow ones backwards while the fast ones still make headway
  for (const d of road) assert.ok(headway(d, -0.5) > 0, `${d.id} is turned round by a mere breeze`);
  const gale = road.map((d) => headway(d, -WIND_MAX));
  assert.ok(gale.some((v) => v < 0) && gale.some((v) => v > 0));
  // small riders and anything airborne catch more of it
  assert.ok(sailOf({ size: 0.64 }) > sailOf({}) && sailOf({}) > sailOf({ size: 1.2 }));
  assert.ok(sailOf({ lane: 'sky' }) > 1);
  assert.equal(sailOf({ sail: 0.5, size: 0.64 }), 0.5);

  // the slider is centred on still air and spans one gale each way
  assert.match(html, new RegExp(`id="c-wind"[^>]*min="-${WIND_MAX}"[^>]*max="${WIND_MAX}"[^>]*value="0"`));
  for (const l of ['en', 'zh']) assert.notEqual(STR[l].windTo('x', true), STR[l].windTo('x', false));
});

test('nothing that moves is computed as time multiplied by a changing speed', async () => {
  // Such a position leaps when the speed changes. Motion that follows the wind is accumulated frame by frame instead.
  for (const f of ['scene/scenery.js', 'scene/specimens.js', 'scene/world.js']) {
    const src = await readFile(new URL('assets/js/' + f, root), 'utf8');
    assert.doesNotMatch(src, /\bt \* [\d.]+ \* \(?(f\.)?wind/, f);
  }
});

