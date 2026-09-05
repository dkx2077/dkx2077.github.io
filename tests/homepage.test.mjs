import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';
import { analyticsTag, build, classifyLink, renderPublications } from '../scripts/build.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
await build();
const html = await readFile(resolve(root, 'dist/index.html'), 'utf8');
const source = await readFile(resolve(root, 'static/js/analytics.js'), 'utf8');
const navigation = await readFile(resolve(root, 'static/js/navigation.js'), 'utf8');
const id = '11111111-2222-4333-8444-555555555555';

function page(options = {}) {
  const dom = new JSDOM(html, {
    url: options.url || 'https://www.dengkaixin.com/',
    runScripts: 'outside-only',
    // No resources are fetched; tests never send traffic to Umami.
    virtualConsole: new VirtualConsole(),
  });
  const { window } = dom;
  const script = window.document.createElement('script');
  script.setAttribute('data-website-id', id);
  script.setAttribute('data-domain', 'www.dengkaixin.com');
  Object.defineProperty(window.document, 'currentScript', { value: script });
  if (options.dnt) Object.defineProperty(window.navigator, 'doNotTrack', { value: '1' });
  if (options.optOut) window.localStorage.setItem('umami.disabled', '1');
  if (options.storageDenied)
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('Denied');
      },
    });
  const events = [];
  if (!options.blocked)
    window.umami = {
      track: (name, data) => events.push({ name, data: JSON.parse(JSON.stringify(data)) }),
    };
  window.eval(source);
  return { dom, window, document: window.document, events };
}

test('static HTML contains all content, stable paper identities and usable links without JavaScript', async () => {
  const { window } = new JSDOM(html);
  const doc = window.document;
  assert.match(doc.querySelector('#home-md').textContent, /HOKKAIDO UNIVERSITY/);
  assert.equal(doc.querySelectorAll('.publication').length, 11);
  assert.equal(
    doc.querySelectorAll('.publication > h3').length,
    11,
    'Each paper has a semantic title'
  );
  assert.match(
    doc.querySelector('#publication-supergpqa h3').textContent,
    /^SuperGPQA: Scaling LLM Evaluation/
  );
  assert.equal(
    doc.querySelector('#publication-iwn h3').textContent,
    'IWN: Image Watermarking Based on Idempotency'
  );
  for (const article of doc.querySelectorAll('.publication')) {
    assert.ok(article.lastElementChild.querySelector('a[data-track-event="publication_click"]'));
    assert.doesNotMatch(
      article.lastElementChild.textContent,
      /↗|\|/,
      'Links have no emoji arrows or separator text'
    );
  }
  assert.equal(doc.querySelectorAll('a[data-track-event="publication_click"]').length, 20);
  assert.equal(doc.querySelectorAll('a[data-track-event="profile_click"]').length, 3);
  assert.equal(doc.querySelectorAll('a[data-track-event="contact_click"]').length, 1);
  assert.equal(doc.querySelectorAll('h1').length, 1);
  const ids = [...doc.querySelectorAll('[id]')].map(node => node.id);
  assert.equal(new Set(ids).size, ids.length, 'IDs must be unique');
  for (const anchor of doc.querySelectorAll('a[href^="#"]')) {
    assert.ok(doc.getElementById(anchor.getAttribute('href').slice(1)), 'Anchor target exists');
  }
  for (const anchor of doc.querySelectorAll('a[target="_blank"]'))
    assert.match(anchor.rel, /noopener/);
  assert.equal(doc.querySelector('a[href^="mailto:"]').target, '');
  for (const asset of doc.querySelectorAll('script[src], link[href^="static/"]')) {
    const path = (asset.getAttribute('src') || asset.getAttribute('href')).split('?')[0];
    await access(resolve(root, 'dist', path));
  }
  assert.doesNotMatch(
    html,
    /googletagmanager|google-analytics|ipapi|bootstrap|marked\.min|ga4-integration/
  );
  assert.equal(
    doc.querySelector('script[src*="math.js"]'),
    null,
    'No math library needed by current content'
  );
  window.close();
});

test('classification distinguishes paper, code, project, profiles and unrelated links', () => {
  assert.deepEqual(classifyLink('https://github.com/dkx2077'), {
    event: 'profile_click',
    data: { platform: 'github' },
  });
  assert.equal(classifyLink('https://github.com/dkx2077/dkx2077.github.io'), null);
  assert.equal(classifyLink('https://github.com.evil.example/dkx2077'), null);
  assert.equal(
    classifyLink('https://arxiv.org/abs/2502.14739', 'supergpqa').data.link_type,
    'preprint'
  );
  assert.equal(
    classifyLink('https://github.com/SuperGPQA/SuperGPQA', 'supergpqa').data.link_type,
    'code'
  );
  assert.equal(classifyLink('https://supergpqa.github.io', 'supergpqa').data.link_type, 'project');
  assert.throws(
    () => renderPublications('<!-- publication: same -->\nx\n<!-- publication: same -->\ny'),
    /Duplicate/
  );
});

test('Scholar replaces only the small district plaque and remains a native external link', () => {
  const p = page();
  const signs = p.document.getElementById('world-signs').content;
  assert.equal(signs.querySelector('[data-sign="district"]'), null);
  assert.match(signs.querySelector('[data-sign="name"]').textContent, /KAIXIN/i);
  const scholar = signs.querySelector('[data-sign="scholar"]').cloneNode(true);
  assert.equal(scholar.tagName, 'A');
  assert.equal(scholar.href, 'https://scholar.google.com/citations?user=WsJD-ukAAAAJ');
  assert.match(scholar.textContent, /Google Scholar/);
  assert.equal(scholar.target, '_blank');
  assert.match(scholar.rel, /noopener noreferrer/);
  assert.match(scholar.getAttribute('aria-label'), /opens in a new tab/);
  // CSS3D clones this same anchor; delegation must still annotate a single profile click.
  p.document.body.append(scholar);
  const event = new p.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  scholar.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false, 'The browser owns the external navigation');
  assert.equal(p.events.length, 1);
  assert.equal(p.events[0].name, 'profile_click');
  assert.deepEqual(p.events[0].data, { platform: 'google_scholar' });
  p.dom.window.close();
});

test('production requires a real-shaped Website ID; preview can remain untracked', () => {
  assert.equal(analyticsTag('', 'https://www.dengkaixin.com', 'v1'), '');
  assert.throws(
    () => analyticsTag('', 'https://www.dengkaixin.com', 'v1', true),
    /before deployment/
  );
  assert.throws(() => analyticsTag('placeholder', 'https://www.dengkaixin.com', 'v1'), /UUID/);
  assert.match(
    analyticsTag(id, 'https://www.dengkaixin.com', 'v1', true),
    /data-domain="www.dengkaixin.com"/
  );
});

test('loads one Cloud tracker with restricted domain, DNT and no hash/query collection', () => {
  const p = page();
  const trackers = p.document.querySelectorAll('script[src="https://cloud.umami.is/script.js"]');
  assert.equal(trackers.length, 1);
  for (const attr of ['data-do-not-track', 'data-exclude-hash', 'data-exclude-search'])
    assert.equal(trackers[0].getAttribute(attr), 'true');
  assert.equal(trackers[0].getAttribute('data-domains'), 'www.dengkaixin.com');
  assert.equal(p.events.length, 0, 'Only the official tracker sends automatic pageviews');
  p.dom.window.close();
});

test('each annotated link sends exactly one allowed event with only its intended data', () => {
  const p = page();
  for (const link of p.document.querySelectorAll('a[data-track-event]')) {
    const before = p.events.length;
    const event = new p.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false, 'Tracking does not hijack navigation');
    assert.equal(p.events.length, before + 1);
    const payload = p.events.at(-1);
    if (payload.name === 'publication_click') {
      assert.deepEqual(payload.data, {
        publication_id: link.dataset.publicationId,
        link_type: link.dataset.linkType,
      });
    } else if (payload.name === 'profile_click') {
      assert.deepEqual(payload.data, { platform: link.dataset.platform });
    } else {
      assert.equal(payload.name, 'contact_click');
      assert.deepEqual(payload.data, {}, 'No email address is sent');
    }
  }
  p.dom.window.close();
});

test('nested link contents, keyboard-style primary clicks and middle clicks work without double counting', () => {
  const p = page();
  const link = p.document.querySelector('a[data-track-event="publication_click"]');
  const span = p.document.createElement('span');
  span.textContent = 'Paper';
  link.appendChild(span);
  span.dispatchEvent(new p.window.MouseEvent('click', { bubbles: true, button: 0, detail: 0 }));
  span.dispatchEvent(new p.window.MouseEvent('auxclick', { bubbles: true, button: 1 }));
  span.dispatchEvent(new p.window.MouseEvent('auxclick', { bubbles: true, button: 2 }));
  p.document
    .querySelector('.nav-links a')
    .dispatchEvent(new p.window.MouseEvent('click', { bubbles: true }));
  p.document
    .querySelector('.site-footer a')
    .dispatchEvent(new p.window.MouseEvent('click', { bubbles: true }));
  assert.equal(p.events.length, 2);
  p.dom.window.close();
});

test('DNT, local opt-out and preview hosts make no analytics requests or events', () => {
  for (const options of [
    { dnt: true },
    { optOut: true },
    { url: 'http://localhost:8000/' },
    { url: 'https://preview.example/' },
  ]) {
    const p = page(options);
    assert.equal(p.document.querySelector('script[src="https://cloud.umami.is/script.js"]'), null);
    p.document
      .querySelector('a[data-track-event]')
      .dispatchEvent(new p.window.MouseEvent('click', { bubbles: true }));
    assert.equal(p.events.length, 0);
    p.dom.window.close();
  }
});

test('blocked scripts, throwing/rejected analytics and denied storage do not break navigation', async () => {
  for (const options of [{ blocked: true }, { storageDenied: true }]) {
    const p = page(options);
    const link = p.document.querySelector('a[data-track-event]');
    const event = new p.window.MouseEvent('click', { bubbles: true, cancelable: true });
    assert.doesNotThrow(() => link.dispatchEvent(event));
    assert.equal(event.defaultPrevented, false);
    p.window.umami = {
      track() {
        throw new Error('Blocked');
      },
    };
    assert.doesNotThrow(() =>
      link.dispatchEvent(new p.window.MouseEvent('click', { bubbles: true }))
    );
    p.window.umami = {
      track() {
        return Promise.reject(new Error('Offline'));
      },
    };
    link.dispatchEvent(new p.window.MouseEvent('click', { bubbles: true }));
    await new Promise(resolve => setImmediate(resolve));
    p.dom.window.close();
  }
});

test('navigation highlights a tall publication section without requiring 50% visibility', () => {
  const p = page({ blocked: true });
  const positions = { 'page-top': -1000, publications: -200, awards: 5000, service: 6000 };
  for (const [id, top] of Object.entries(positions)) {
    p.document.getElementById(id).getBoundingClientRect = () => ({ top, height: 5500 });
  }
  p.window.eval(navigation);
  assert.equal(
    p.document.querySelector('.nav-links [aria-current]').getAttribute('href'),
    '#publications'
  );
  p.dom.window.close();
});
