/* Umami is optional: it never blocks rendering, navigation or link activation. */
(function () {
  'use strict';

  var settings = document.currentScript;
  var websiteId = settings && settings.getAttribute('data-website-id');
  var domain = settings && settings.getAttribute('data-domain');
  if (!websiteId || window.location.hostname !== domain) return;
  if (navigator.doNotTrack === '1' || navigator.msDoNotTrack === '1' || window.doNotTrack === '1')
    return;

  // Respect Umami's documented local opt-out without writing any browser storage ourselves.
  try {
    if (window.localStorage.getItem('umami.disabled')) return;
  } catch (_) {
    /* Browsers may deny access to local storage. */
  }

  var tracker = document.createElement('script');
  tracker.src = 'https://cloud.umami.is/script.js';
  tracker.async = true;
  tracker.setAttribute('data-website-id', websiteId);
  tracker.setAttribute('data-domains', domain);
  tracker.setAttribute('data-do-not-track', 'true');
  tracker.setAttribute('data-exclude-hash', 'true');
  tracker.setAttribute('data-exclude-search', 'true');
  // Umami records the pageview automatically. Native anchor navigation adds no pageviews.
  document.head.appendChild(tracker);

  function trackClick(event) {
    // A primary click covers touch and keyboard activation; auxclick covers middle-click only.
    if (event.type === 'auxclick' && event.button !== 1) return;
    if (event.type === 'click' && event.button && event.button !== 0) return;
    var link = event.target;
    while (link && link !== document && link.tagName !== 'A') link = link.parentNode;
    if (!link || !link.getAttribute || !window.umami || typeof window.umami.track !== 'function')
      return;

    var name = link.getAttribute('data-track-event');
    var data = {};
    if (name === 'publication_click') {
      data.publication_id = link.getAttribute('data-publication-id');
      data.link_type = link.getAttribute('data-link-type');
      if (!data.publication_id || !data.link_type) return;
    } else if (name === 'profile_click') {
      data.platform = link.getAttribute('data-platform');
      if (data.platform !== 'github' && data.platform !== 'google_scholar') return;
    } else if (name !== 'contact_click') {
      return;
    }

    try {
      var result = window.umami.track(name, data);
      if (result && typeof result.catch === 'function') result.catch(function () {});
    } catch (_) {
      /* Blocked statistics must never interrupt the link's default action. */
    }
  }

  // Our own attributes avoid Umami's automatic link handler and duplicate events.
  document.addEventListener('click', trackClick);
  document.addEventListener('auxclick', trackClick);
})();
