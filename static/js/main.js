// 主入口文件 - ES6模块化重构
import { checkVersion } from './modules/version.js';
import { initNavigation } from './modules/navigation.js';
import { loadConfig, loadMarkdownSections } from './modules/content.js';

// 页面初始化函数
async function initPage() {
  try {
    // 初始化导航
    initNavigation();

    // 并行加载配置和Markdown内容
    await Promise.all([
      loadConfig(),
      loadMarkdownSections()
    ]);

    console.log('[App] Page initialized successfully');
  } catch (error) {
    console.error('[App] Initialization error:', error);
  }
}

// 应用启动函数
async function startApp() {
  try {
    // 检查版本更新
    const needsReload = await checkVersion();
    
    if (needsReload) {
      // 如果检测到新版本，重新加载页面
      window.location.reload();
      return;
    }

    // 初始化页面
    await initPage();
  } catch (error) {
    console.error('[App] Startup error:', error);
    // 即使版本检查失败，也继续初始化页面
    await initPage();
  }
}

// DOM加载完成后启动应用
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
} 