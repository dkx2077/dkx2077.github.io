// 内容加载模块
import { CONFIG } from './config.js';

export async function loadConfig() {
  try {
    const response = await fetch(`${CONFIG.CONTENT_DIR}${CONFIG.CONFIG_FILE}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const yamlText = await response.text();
    const config = jsyaml.load(yamlText);

    for (const [id, html] of Object.entries(config)) {
      const element = document.getElementById(id);
      if (element) {
        element.innerHTML = html;
      } else {
        console.warn(`[Config] Missing element #${id}`);
      }
    }

    console.log('[Config] Loaded successfully');
  } catch (error) {
    console.error('[Config] Load error:', error);
  }
}

export async function loadMarkdownSections() {
  // 配置marked选项
  marked.use({ 
    mangle: false, 
    headerIds: false,
    breaks: true,
    gfm: true
  });

  const loadPromises = CONFIG.SECTION_NAMES.map(name => loadSection(name));
  await Promise.all(loadPromises);
  
  // 触发MathJax渲染
  renderMath();
}

async function loadSection(name) {
  try {
    const response = await fetch(`${CONFIG.CONTENT_DIR}${name}.md`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const markdown = await response.text();
    const html = marked.parse(markdown);
    const container = document.getElementById(`${name}-md`);

    if (container) {
      container.innerHTML = html;
      // 所有链接在新窗口打开
      container.querySelectorAll('a').forEach(link => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      });
      console.log(`[Markdown] ${name} section loaded`);
    } else {
      console.warn(`[Markdown] Missing container: ${name}-md`);
    }
  } catch (error) {
    console.error(`[Markdown] ${name} render error:`, error);
  }
}

function renderMath() {
  if (window.MathJax?.typesetPromise) {
    MathJax.typesetPromise().catch(error => {
      console.error('[MathJax] Typeset error:', error);
    });
  } else if (window.MathJax?.typeset) {
    try {
      MathJax.typeset();
    } catch (error) {
      console.error('[MathJax] Typeset error:', error);
    }
  }
} 