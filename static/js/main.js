// 主入口文件 - ES6模块化重构
import { checkVersion } from './modules/version.js';
import { initNavigation, setAnalyticsInstance } from './modules/navigation.js';
import { loadConfig, loadMarkdownSections } from './modules/content.js';
import { Analytics } from './modules/analytics.js';
import { ANALYTICS_CONFIG } from './modules/config.js';
import ga4Instance from './modules/ga4-integration.js'; // 导入GA4集成

// 全局统计实例
let analytics = null;

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

    // 发送页面初始化完成事件到GA4
    ga4Instance.trackEvent('page_initialized', {
      sections_loaded: ['home', 'publications', 'awards', 'service'],
      load_method: 'spa_init'
    });

    console.log('[App] Page initialized successfully');
  } catch (error) {
    console.error('[App] Initialization error:', error);
    
    // 同时发送错误到两个分析系统
    if (analytics) {
      analytics.trackCustomEvent('initialization_error', {
        error: error.message,
        stack: error.stack?.substring(0, 500) // 限制堆栈信息长度
      });
    }
    
    // GA4错误跟踪
    ga4Instance.trackError('initialization_error', error.message, {
      stack: error.stack?.substring(0, 200)
    });
  }
}

// 初始化统计功能
async function initAnalytics() {
  try {
    // 检查是否需要启用统计
    if (!ANALYTICS_CONFIG.enabled) {
      console.log('[App] Analytics disabled by configuration');
      return null;
    }

    // 检查采样率
    if (Math.random() > ANALYTICS_CONFIG.sampleRate) {
      console.log('[App] Analytics disabled by sampling');
      return null;
    }

    // 创建统计实例
    analytics = new Analytics(ANALYTICS_CONFIG);
    
    // 延迟初始化（减少对页面加载的影响）
    if (ANALYTICS_CONFIG.lazyInit) {
      // 等待页面交互或延迟初始化
      await waitForInteractionOrDelay();
    }
    
    // 初始化统计
    await analytics.init();
    
    // 将统计实例传递给其他模块
    setAnalyticsInstance(analytics);
    
    // 设置错误处理（总是启用）
    setupErrorTracking();
    
    // 条件性启用性能监控
    if (ANALYTICS_CONFIG.trackPerformance) {
      setupPerformanceTracking();
    }
    
    // 设置GA4与自定义Analytics的协同工作
    setupAnalyticsIntegration();
    
    // 暴露到全局变量供调试使用
    window.__analytics = analytics;
    window.__ga4 = ga4Instance; // 同时暴露GA4实例
    
    console.log('[App] Analytics initialized successfully');
    
    return analytics;
  } catch (error) {
    console.error('[App] Analytics initialization failed:', error);
    
    // 即使自定义分析失败，GA4仍可正常工作
    ga4Instance.trackError('custom_analytics_init_failed', error.message);
    
    return null;
  }
}

// 设置分析系统集成（新增功能）
function setupAnalyticsIntegration() {
  // 监听自定义Analytics的部分变化事件，同步到GA4
  window.addEventListener('section-change', (event) => {
    const { fromSection, toSection } = event.detail;
    ga4Instance.trackSectionChange(fromSection, toSection);
  });
  
  // 设置论文点击跟踪
  setupPublicationTracking();
  
  // 设置外部链接跟踪
  setupExternalLinkTracking();
  
  // 设置滚动跟踪集成
  setupScrollTrackingIntegration();
  
  console.log('[App] Analytics integration setup completed');
}

// 设置论文点击跟踪（新增功能）
function setupPublicationTracking() {
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (link && link.href) {
      const publicationSection = link.closest('#publications-md');
      if (publicationSection) {
        ga4Instance.trackPublicationClick(link, link.href);
        
        // 同时发送到自定义分析系统
        if (analytics) {
          analytics.trackLinkClick(link.href, link.textContent, 'publication');
        }
      }
    }
  });
}

// 设置外部链接跟踪（新增功能）
function setupExternalLinkTracking() {
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (link && link.href && !link.href.startsWith('#')) {
      const isExternal = !link.href.includes(window.location.hostname);
      if (isExternal) {
        ga4Instance.trackExternalLink(link.href, link.textContent, {
          section: ga4Instance.currentSection
        });
        
        // 同时发送到自定义分析系统
        if (analytics) {
          analytics.trackLinkClick(link.href, link.textContent, 'external');
        }
      }
    }
  });
}

// 设置滚动跟踪集成（新增功能）
function setupScrollTrackingIntegration() {
  let lastScrollPercentage = 0;
  
  const handleScroll = () => {
    const scrollTop = window.scrollY;
    const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercentage = Math.round((scrollTop / documentHeight) * 100);
    
    // 检查是否达到新的里程碑
    const milestones = [25, 50, 75, 100];
    for (const milestone of milestones) {
      if (scrollPercentage >= milestone && lastScrollPercentage < milestone) {
        ga4Instance.trackScroll(milestone, ga4Instance.currentSection);
        break;
      }
    }
    
    lastScrollPercentage = scrollPercentage;
  };
  
  // 节流滚动事件
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    if (scrollTimeout) return;
    scrollTimeout = setTimeout(() => {
      handleScroll();
      scrollTimeout = null;
    }, 250);
  }, { passive: true });
}

// 等待用户交互或延迟
async function waitForInteractionOrDelay() {
  return new Promise((resolve) => {
    let resolved = false;
    
    // 监听用户交互
    const interactionEvents = ['click', 'keydown', 'touchstart', 'scroll'];
    const handleInteraction = () => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve();
      }
    };
    
    const cleanup = () => {
      interactionEvents.forEach(event => {
        document.removeEventListener(event, handleInteraction);
      });
    };
    
    // 添加事件监听
    interactionEvents.forEach(event => {
      document.addEventListener(event, handleInteraction, { once: true, passive: true });
    });
    
    // 最多延迟2秒
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve();
      }
    }, 2000);
  });
}

// 设置错误追踪（轻量级版本）
function setupErrorTracking() {
  if (!analytics || !ANALYTICS_CONFIG.trackErrors) return;
  
  let errorCount = 0;
  const maxErrors = 5; // 限制错误数量
  
  // 捕获JavaScript错误
  window.addEventListener('error', (event) => {
    if (errorCount >= maxErrors) return;
    errorCount++;
    
    // 发送到自定义分析
    analytics.trackCustomEvent('javascript_error', {
      message: event.message?.substring(0, 200), // 限制消息长度
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
    
    // 发送到GA4
    ga4Instance.trackError('javascript_error', event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });
  
  // 捕获Promise拒绝
  window.addEventListener('unhandledrejection', (event) => {
    if (errorCount >= maxErrors) return;
    errorCount++;
    
    const reason = event.reason?.toString()?.substring(0, 200);
    
    // 发送到自定义分析
    analytics.trackCustomEvent('promise_rejection', {
      reason: reason
    });
    
    // 发送到GA4
    ga4Instance.trackError('promise_rejection', reason);
  });
  
  // 捕获资源加载错误（简化版本）
  window.addEventListener('error', (event) => {
    if (errorCount >= maxErrors) return;
    
    if (event.target !== window) {
      errorCount++;
      
      const errorData = {
        tagName: event.target.tagName,
        source: event.target.src || event.target.href
      };
      
      // 发送到自定义分析
      analytics.trackCustomEvent('resource_error', errorData);
      
      // 发送到GA4
      ga4Instance.trackError('resource_error', 'Resource load failed', errorData);
    }
  }, true);
}

// 设置性能监控（按需启用，轻量级版本）
function setupPerformanceTracking() {
  if (!analytics || !ANALYTICS_CONFIG.trackPerformance) return;
  
  // 简化的性能监控，只在用户交互后启用
  const enablePerformanceTracking = () => {
    // 监控关键性能指标（简化版本）
    setTimeout(() => {
      trackBasicWebVitals();
    }, 3000); // 延迟启动
    
    // 只监控关键的长任务
    if ('PerformanceObserver' in window && ANALYTICS_CONFIG.autoOptimize.enabled) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            // 只记录超过阈值的长任务
            if (entry.duration > ANALYTICS_CONFIG.autoOptimize.performanceThreshold) {
              const taskData = {
                duration: entry.duration,
                name: entry.name
              };
              
              // 发送到自定义分析
              analytics.trackCustomEvent('long_task', taskData);
              
              // 发送到GA4
              ga4Instance.trackPerformance('long_task', entry.duration, taskData);
            }
          });
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
      } catch (error) {
        console.warn('[App] Performance Observer not supported:', error.message);
      }
    }
  };
  
  // 延迟启用性能监控
  document.addEventListener('click', enablePerformanceTracking, { once: true });
}

// 追踪基础Web性能指标（简化版本）
function trackBasicWebVitals() {
  if (!analytics) return;
  
  try {
    // 页面加载性能
    if (window.performance && window.performance.timing) {
      const timing = window.performance.timing;
      const loadTime = timing.loadEventEnd - timing.navigationStart;
      
      if (loadTime > 0 && loadTime < 30000) { // 合理范围内
        const performanceData = {
          loadTime: loadTime,
          domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
          timestamp: Date.now()
        };
        
        // 发送到自定义分析
        analytics.trackCustomEvent('page_performance', performanceData);
        
        // 发送到GA4
        ga4Instance.trackPerformance('page_load_time', loadTime, performanceData);
      }
    }
    
    // First Contentful Paint (如果可用)
    const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
    if (fcpEntry) {
      const fcpData = {
        metric: 'FCP',
        value: Math.round(fcpEntry.startTime),
        rating: fcpEntry.startTime < 1800 ? 'good' : fcpEntry.startTime < 3000 ? 'needs-improvement' : 'poor'
      };
      
      // 发送到自定义分析
      analytics.trackCustomEvent('core_web_vital', fcpData);
      
      // 发送到GA4
      ga4Instance.trackPerformance('first_contentful_paint', fcpEntry.startTime, fcpData);
    }
    
  } catch (error) {
    console.warn('[App] Basic Web Vitals tracking failed:', error.message);
  }
}

// 设置导航追踪增强（简化版本）
function setupNavigationTracking() {
  if (!analytics || !ANALYTICS_CONFIG.trackNavigation) return;
  
  // 监听哈希变化
  window.addEventListener('hashchange', (event) => {
    const hashData = {
      oldHash: new URL(event.oldURL).hash,
      newHash: new URL(event.newURL).hash
    };
    
    // 发送到自定义分析
    analytics.trackCustomEvent('hash_change', hashData);
    
    // 发送到GA4
    ga4Instance.trackEvent('hash_change', hashData);
  });
}

// 应用启动函数
async function startApp() {
  try {
    console.log('[App] Starting application...');
    
    // 检查版本更新（不阻塞主流程）
    checkVersion().catch(error => {
      console.warn('[App] Version check failed:', error.message);
    });
    
    // 并行初始化页面和统计
    const [analyticsInstance] = await Promise.all([
      initAnalytics(),
      initPage()
    ]);
    
    // 设置导航追踪
    setupNavigationTracking();
    
    // 追踪应用启动完成
    if (analyticsInstance) {
      analyticsInstance.trackCustomEvent('app_startup_complete', {
        loadTime: Math.round(performance.now()),
        timestamp: Date.now()
      });
    }
    
    // GA4应用启动完成
    ga4Instance.trackEvent('app_startup_complete', {
      load_time: Math.round(performance.now()),
      has_custom_analytics: !!analyticsInstance
    });
    
    console.log('[App] Application started successfully');
    
  } catch (error) {
    console.error('[App] Startup error:', error);
    
    // 即使出错也尝试初始化页面
    try {
      await initPage();
    } catch (fallbackError) {
      console.error('[App] Fallback initialization failed:', fallbackError);
    }
  }
}

// 页面卸载处理（优化版本）
window.addEventListener('beforeunload', () => {
  const sessionDuration = Date.now() - (analytics?.sessionStartTime || Date.now());
  
  if (analytics) {
    // 快速发送关键数据到自定义分析
    analytics.trackCustomEvent('page_unload', {
      sessionDuration: sessionDuration,
      timestamp: Date.now()
    });
  }
  
  // GA4页面卸载
  ga4Instance.trackEvent('page_unload', {
    session_duration: sessionDuration,
    final_section: ga4Instance.currentSection
  });
  
  // 调用GA4销毁方法
  ga4Instance.destroy();
});

// 页面可见性变化处理（简化版本）
document.addEventListener('visibilitychange', () => {
  const visibilityData = {
    hidden: document.hidden,
    timestamp: Date.now()
  };
  
  if (analytics && ANALYTICS_CONFIG.trackNavigation) {
    analytics.trackCustomEvent('visibility_change', visibilityData);
  }
  
  // GA4可见性变化
  ga4Instance.trackEvent('visibility_change', visibilityData);
});

// DOM加载完成后启动应用
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  // 如果DOM已加载，延迟一点启动避免阻塞
  setTimeout(startApp, 0);
}

// 暴露简化的调试函数到全局
window.__debug = {
  getAnalytics: () => analytics,
  getGA4: () => ga4Instance,
  getSessionStats: () => analytics?.getSessionStats(),
  getGA4Stats: () => ga4Instance?.getSessionStats(),
  trackTestEvent: (name, data) => {
    analytics?.trackCustomEvent(name, data);
    ga4Instance?.trackEvent(`test_${name}`, data);
  },
  flushAnalytics: () => {
    analytics?.sender?.flush();
    ga4Instance?.flush();
  },
  toggleLightweightMode: () => {
    if (analytics && ANALYTICS_CONFIG.lightweightMode) {
      ANALYTICS_CONFIG.lightweightMode.enabled = !ANALYTICS_CONFIG.lightweightMode.enabled;
      console.log('Lightweight mode:', ANALYTICS_CONFIG.lightweightMode.enabled ? 'enabled' : 'disabled');
    }
  },
  compareAnalytics: () => {
    console.group('📊 Analytics Comparison');
    console.log('Custom Analytics Stats:', analytics?.getSessionStats());
    console.log('GA4 Stats:', ga4Instance?.getSessionStats());
    console.groupEnd();
  }
}; 