/* Only included by the build when Markdown contains mathematical expressions. */
window.MathJax = {
  tex: { inlineMath: [['$', '$']], displayMath: [['$$', '$$']], processEscapes: true },
};
var mathScript = document.createElement('script');
mathScript.src = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js';
mathScript.async = true;
document.head.appendChild(mathScript);
