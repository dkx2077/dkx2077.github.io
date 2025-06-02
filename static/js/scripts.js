// static/js/scripts.js

// ———— 全局配置 ————
const CONTENT_DIR   = 'contents/';                // Markdown 和 config.yml 存放目录
const CONFIG_FILE   = 'config.yml';               // 配置文件名
const SECTION_NAMES = ['home', 'publications', 'awards', 'project', 'service'];
const VERSION_URL   = 'package.json'; // 从package.json获取版本
const CACHE_PREFIX  = 'site-cache-';              // 仅清除此前缀的 Cache Storage

// ———— 入口：版本检查 + 页面初始化 ————
(async function() {
  if ('caches' in window) {
    try {
      const res = await fetch(VERSION_URL, { cache: 'no-store' });
      if (res.ok) {
        const packageData = await res.json();
        const version = packageData.version;
        const old = localStorage.getItem('site_version');
        if (old !== version) {
          console.log('[Version] Detected new version:', version);

          // 删除自己站点的缓存
          const keys = await caches.keys();
          await Promise.all(
            keys.filter(key => key.startsWith(CACHE_PREFIX))
                .map(key => caches.delete(key))
          );

          localStorage.setItem('site_version', version);
          return window.location.reload();  // 强制重载
        }
        console.log('[Version] Up-to-date:', version);
      }
    } catch (err) {
      console.error('[Version] Check failed:', err);
    }
  }

  // 如果不支持 Cache API 或版本无更新，直接初始化页面
  initPage();
})();

// ———— 页面初始化：DOM 操作、数据加载、渲染 ————
function initPage() {
  // 1. ScrollSpy
  const nav = document.querySelector('#mainNav');
  if (nav) {
    new bootstrap.ScrollSpy(document.body, {
      target: '#mainNav',
      offset: 74,
    });
  }

  // 2. 响应式菜单收起
  const toggler = document.querySelector('.navbar-toggler');
  document.querySelectorAll('#navbarResponsive .nav-link').forEach(link => {
    link.addEventListener('click', () => {
      if (toggler && getComputedStyle(toggler).display !== 'none') {
        toggler.click();
      }
    });
  });

  // 3. 加载 YAML 配置
  fetch(`${CONTENT_DIR}${CONFIG_FILE}`)
    .then(r => r.text())
    .then(txt => {
      const cfg = jsyaml.load(txt);
      for (const [id, html] of Object.entries(cfg)) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
        else console.warn(`[Config] Missing element #${id}`);
      }
    })
    .catch(e => console.error('[Config] Load error:', e));

  // 4. 渲染各 Markdown 章节
  marked.use({ mangle: false, headerIds: false });
  SECTION_NAMES.forEach(name => {
    fetch(`${CONTENT_DIR}${name}.md`)
      .then(r => r.text())
      .then(md => {
        const html = marked.parse(md);
        const container = document.getElementById(`${name}-md`);
        if (container) {
          container.innerHTML = html;
          // 所有链接新窗口打开
          container.querySelectorAll('a').forEach(a => a.setAttribute('target','_blank'));
        } else {
          console.warn(`[Markdown] Missing container: ${name}-md`);
        }
      })
      .then(() => {
        if (window.MathJax?.typesetPromise) {
          MathJax.typesetPromise();
        } else if (window.MathJax?.typeset) {
          MathJax.typeset();
        }
      })
      .catch(e => console.error(`[Markdown] ${name} render error:`, e));
  });
}
