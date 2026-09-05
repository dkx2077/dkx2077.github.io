/* Navigation remains visible and usable even without JavaScript. */
(function () {
  'use strict';
  var links = document.querySelectorAll('.nav-links a');
  var sections = [];
  for (var i = 0; i < links.length; i++) {
    sections.push(document.querySelector(links[i].getAttribute('href')));
  }
  var scheduled = false;

  function update() {
    scheduled = false;
    if (document.body.classList.contains('scene-active')) {
      var openSection = document.querySelector('.content-section.is-open');
      for (var n = 0; n < links.length; n++) {
        if (
          document.body.classList.contains('reader-open') &&
          openSection &&
          links[n].getAttribute('href') === '#' + openSection.id
        )
          links[n].setAttribute('aria-current', 'location');
        else links[n].removeAttribute('aria-current');
      }
      return;
    }
    var active = 0;
    var header = document.querySelector('.site-header');
    var offset = header ? header.getBoundingClientRect().height + 24 : 24;
    // Section tops work even when a long publication section is taller than the viewport.
    for (var index = 0; index < sections.length; index++) {
      if (sections[index] && sections[index].getBoundingClientRect().top <= offset) active = index;
    }
    for (var j = 0; j < links.length; j++) {
      if (j === active) links[j].setAttribute('aria-current', 'location');
      else links[j].removeAttribute('aria-current');
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    (window.requestAnimationFrame || window.setTimeout)(update);
  }
  window.addEventListener('scroll', schedule);
  window.addEventListener('resize', schedule);
  window.addEventListener('hashchange', schedule);
  document.addEventListener('viewchange', schedule);
  update();
})();
