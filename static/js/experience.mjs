/* HTML is the baseline. The 3D module enhances it only after a successful setup. */
const body = document.body;
const shell = document.getElementById('scene-shell');
const reader = document.getElementById('reader');
const backdrop = document.getElementById('reader-backdrop');
const closeButton = document.getElementById('close-reader');
const readerToolbar = document.getElementById('reader-toolbar');
const modeButton = document.getElementById('mode-toggle');
const status = document.getElementById('experience-status');
const toolbar = document.querySelector('.scene-toolbar');
const districtNav = document.querySelector('.district-nav');
const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
const touchDevice = window.matchMedia?.('(pointer: coarse)');
const mobileReader = window.matchMedia?.('(max-width: 760px), (pointer: coarse)');
let world = null;
let failed = false;
let wantsReading = false;
let lastFocus = null;
let savedScroll = 0;
let starting = false;
const preferences = {
  get(key) {
    try {
      return localStorage.getItem('kd.' + key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem('kd.' + key, value);
    } catch {
      /* Private browsing can deny storage. */
    }
  },
};
function setOutsideInert(value) {
  [shell, document.querySelector('.site-header'), toolbar, districtNav].forEach(element => {
    element.inert = value;
  });
}
function closeReader({ restoreFocus = true, clearHash = true } = {}) {
  if (!body.classList.contains('reader-open')) return;
  body.classList.remove('reader-open');
  reader.removeAttribute('role');
  reader.removeAttribute('aria-modal');
  reader.removeAttribute('aria-labelledby');
  backdrop.hidden = true;
  closeButton.hidden = true;
  readerToolbar.hidden = true;
  setOutsideInert(false);
  world?.suspend(!body.classList.contains('scene-active'));
  document.dispatchEvent(new Event('viewchange'));
  if (clearHash) history.replaceState(null, '', location.pathname + location.search);
  if (restoreFocus) {
    const focusTarget =
      lastFocus?.isConnected && !lastFocus.closest('[inert]')
        ? lastFocus
        : document.getElementById('world');
    focusTarget?.focus({ preventScroll: true });
  }
}
function openReader(target) {
  const section = target.closest('.content-section');
  if (!section) return;
  if (!body.classList.contains('reader-open')) lastFocus = document.activeElement;
  reader
    .querySelectorAll('.content-section')
    .forEach(node => node.classList.toggle('is-open', node === section));
  body.classList.add('reader-open');
  reader.setAttribute('role', 'dialog');
  reader.setAttribute('aria-modal', 'true');
  reader.setAttribute('aria-labelledby', section.getAttribute('aria-labelledby'));
  backdrop.hidden = false;
  closeButton.hidden = false;
  readerToolbar.hidden = false;
  document.getElementById('reader-context').textContent = document.getElementById(
    section.getAttribute('aria-labelledby')
  ).textContent;
  setOutsideInert(true);
  world?.suspend(true);
  reader.scrollTop = 0;
  // Phone readers use the document scroller, not a fixed nested overflow panel.
  if (mobileReader?.matches) window.scrollTo({ top: 0, behavior: 'instant' });
  closeButton.focus({ preventScroll: true });
  document.dispatchEvent(new Event('viewchange'));
  if (target !== section)
    requestAnimationFrame(() => target.scrollIntoView({ block: 'start', behavior: 'instant' }));
}
function targetForHash(hash) {
  try {
    return document.getElementById(decodeURIComponent(hash.replace(/^#/, '')));
  } catch {
    return null;
  }
}
function showReading(message = '') {
  const wasInCity = body.classList.contains('scene-active');
  closeReader({ restoreFocus: false, clearHash: false });
  body.classList.remove('scene-active');
  shell.hidden = true;
  toolbar.hidden = true;
  districtNav.hidden = true;
  world?.suspend(true);
  modeButton.textContent = 'Explore 3D';
  status.textContent = message;
  if (wasInCity) window.scrollTo({ top: savedScroll, behavior: 'instant' });
  document.dispatchEvent(new Event('viewchange'));
}
function showCity(openHash = true) {
  if (!world || failed) return;
  savedScroll = window.scrollY;
  shell.hidden = false;
  toolbar.hidden = false;
  districtNav.hidden = false;
  body.classList.add('scene-active');
  world.suspend(false);
  modeButton.textContent = 'Read profile';
  status.textContent = '';
  const target = targetForHash(location.hash);
  if (openHash && target?.closest('.content-section')) openReader(target);
}
function syncMotion(paused) {
  const button = document.getElementById('motion-toggle');
  button.setAttribute('aria-pressed', String(paused));
  button.setAttribute('aria-label', paused ? 'Resume ambient motion' : 'Pause ambient motion');
  button.title = paused ? 'Resume rain and animated lights' : 'Pause rain and animated lights';
  button.textContent = paused ? '▷' : 'Ⅱ';
}
function fail(message) {
  failed = true;
  showReading(
    message || 'The 3D view is unavailable on this device. You can read everything here.'
  );
  modeButton.hidden = true;
  world?.dispose();
  world = null;
  document.querySelector('#world canvas')?.remove();
  document.getElementById('sign-layer').replaceChildren();
}

modeButton.addEventListener('click', () => {
  wantsReading = body.classList.contains('scene-active');
  preferences.set('mode', wantsReading ? 'reading' : 'city');
  if (wantsReading) {
    showReading();
    document.getElementById('main-content').focus({ preventScroll: true });
  } else if (world) showCity(false);
  else start(true);
});
closeButton.addEventListener('click', () => closeReader());
backdrop.addEventListener('click', () => closeReader());
document.addEventListener('keydown', event => {
  if (!body.classList.contains('reader-open')) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeReader();
    return;
  }
  if (event.key !== 'Tab') return;
  const controls = [
    ...reader.querySelectorAll('button:not([hidden]),a[href],select,[tabindex="0"]'),
  ].filter(element => element === closeButton || element.closest('.content-section.is-open'));
  const first = controls[0],
    last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
});
document.addEventListener('click', event => {
  if (
    !body.classList.contains('scene-active') ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  const anchor = event.target.closest('a[href^="#"]');
  if (!anchor) return;
  const target = targetForHash(anchor.hash);
  if (!target) return;
  event.preventDefault();
  if (target.closest('.content-section')) {
    if (location.hash !== anchor.hash) history.pushState(null, '', anchor.hash);
    openReader(target);
  } else if (anchor.classList.contains('skip-link')) {
    wantsReading = true;
    showReading();
    target.focus();
  } else {
    closeReader();
    world?.reset();
  }
});
window.addEventListener('popstate', () => {
  if (!body.classList.contains('scene-active')) return;
  const target = targetForHash(location.hash);
  if (target?.closest('.content-section')) openReader(target);
  else closeReader({ clearHash: false });
});
window.visualViewport?.addEventListener('resize', () => {
  if (window.visualViewport.scale > 1.05 && body.classList.contains('scene-active')) {
    wantsReading = true;
    showReading('Reading mode is active while the page is magnified.');
  }
});
window.addEventListener('hashchange', () => {
  if (!body.classList.contains('scene-active')) return;
  const target = targetForHash(location.hash);
  if (target?.closest('.content-section')) openReader(target);
  else closeReader({ clearHash: false });
});
districtNav.addEventListener('click', event => {
  const button = event.target.closest('[data-look]');
  if (button) world?.lookAt(button.dataset.look);
});
document.getElementById('reset-view').addEventListener('click', () => world?.reset());
document.getElementById('motion-toggle').addEventListener('click', () => {
  if (!world) return;
  const paused = !world.paused;
  world.setPaused(paused);
  syncMotion(paused);
  preferences.set('paused', String(paused));
});
document.getElementById('quality').addEventListener('change', event => {
  world?.setQuality(event.target.value);
  preferences.set('quality', event.target.value);
});

async function start(force = false) {
  if (starting) return;
  if (!window.WebGL2RenderingContext || !window.PointerEvent || !window.matchMedia) {
    fail();
    return;
  }
  const mode = preferences.get('mode');
  wantsReading = mode === 'reading' || (!mode && (!!reduced?.matches || !!touchDevice?.matches));
  if (wantsReading && !force) {
    showReading();
    modeButton.hidden = false;
    return;
  }
  wantsReading = false;
  starting = true;
  modeButton.disabled = true;
  try {
    const settings = JSON.parse(document.getElementById('scene-settings').textContent);
    const quality = preferences.get('quality');
    if (['auto', 'low', 'high'].includes(quality)) settings.quality = quality;
    document.getElementById('quality').value = settings.quality;
    if (!wantsReading) status.textContent = 'Opening the night district…';
    // A failed/blocked import leaves the authored page intact; no endless loading overlay.
    const { createWorld } = await import('./scene/world.mjs');
    world = createWorld(settings, { onFailure: fail, onMotion: syncMotion });
    if (preferences.get('paused') === 'true') {
      world.setPaused(true);
    }
    syncMotion(world.paused);
    modeButton.hidden = false;
    if (wantsReading) showReading();
    else showCity(!force);
  } catch (error) {
    console.warn('3D enhancement unavailable:', error);
    fail();
  } finally {
    starting = false;
    modeButton.disabled = false;
  }
}
start();
