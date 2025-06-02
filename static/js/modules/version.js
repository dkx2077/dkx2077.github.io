// 版本检查模块
import { CONFIG } from './config.js';

// 版本号生成函数 - 基于时间戳确保每次构建都有唯一版本
function generateVersion() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

export async function checkVersion() {
  try {
    // 从package.json获取版本
    const response = await fetch(CONFIG.VERSION_URL + '?t=' + Date.now(), { 
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const packageData = await response.json();
    const version = packageData.version;
    
    if (!version) {
      console.warn('[Version] No version found in package.json');
      return false;
    }
    
    const currentVersion = sessionStorage.getItem('site_version');
    const lastVersion = localStorage.getItem('site_version');

    // 如果是新会话或版本已更新
    if (!currentVersion || currentVersion !== version) {
      console.log('[Version] Version check:', { 
        current: currentVersion, 
        new: version,
        isNewSession: !currentVersion
      });
      
      // 仅在版本真正改变时清除缓存
      if (lastVersion && lastVersion !== version) {
        console.log('[Version] New version detected, clearing cache...');
        await clearSiteCache();
        localStorage.setItem('site_version', version);
        sessionStorage.setItem('site_version', version);
        return true; // 需要重新加载
      }
      
      // 更新会话版本
      sessionStorage.setItem('site_version', version);
      if (!lastVersion) {
        localStorage.setItem('site_version', version);
      }
    }

    console.log('[Version] Current version:', version);
    return false;
  } catch (error) {
    console.error('[Version] Check failed:', error);
    // 版本检查失败不应影响网站正常运行
    return false;
  }
}

async function clearSiteCache() {
  try {
    // 清除所有缓存
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('[Version] Cleared all caches');
    }
    
    // 清除localStorage中的缓存数据（保留版本号）
    const version = localStorage.getItem('site_version');
    const keysToKeep = ['site_version'];
    
    Object.keys(localStorage).forEach(key => {
      if (!keysToKeep.includes(key)) {
        localStorage.removeItem(key);
      }
    });
    
    console.log('[Version] Cleared localStorage cache');
  } catch (error) {
    console.error('[Version] Failed to clear cache:', error);
  }
}

// 导出版本生成函数供构建工具使用
export { generateVersion }; 