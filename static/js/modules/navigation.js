// 导航模块
import { SCROLL_SPY_CONFIG } from './config.js';

export function initNavigation() {
  initScrollSpy();
  initResponsiveMenu();
}

function initScrollSpy() {
  const nav = document.querySelector('#mainNav');
  if (nav && window.bootstrap) {
    new bootstrap.ScrollSpy(document.body, SCROLL_SPY_CONFIG);
    console.log('[Navigation] ScrollSpy initialized');
  }
}

function initResponsiveMenu() {
  const toggler = document.querySelector('.navbar-toggler');
  const navLinks = document.querySelectorAll('#navbarResponsive .nav-link');

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (toggler && getComputedStyle(toggler).display !== 'none') {
        toggler.click();
      }
    });
  });

  console.log('[Navigation] Responsive menu initialized');
} 