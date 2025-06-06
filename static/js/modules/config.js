// 全局配置模块
export const CONFIG = {
  CONTENT_DIR: 'contents/',
  CONFIG_FILE: 'config.yml',
  SECTION_NAMES: ['home', 'publications', 'awards', 'service'],
  VERSION_URL: 'package.json',
  CACHE_PREFIX: 'site-cache-',
};

export const SCROLL_SPY_CONFIG = {
  target: '#mainNav',
  offset: 74,
  rootMargin: '0px 0px -50% 0px'
};

// 统计功能配置 - 性能优化版本
export const ANALYTICS_CONFIG = {
  enabled: true,
  debug: true, // 开发环境下开启调试
  respectDoNotTrack: true,
  
  // 数据发送配置（优化后）
  bufferSize: 8, // 适中的缓冲区大小
  flushInterval: 20000, // 20秒发送一次数据，减少频率
  
  // 重试配置
  maxRetries: 2, // 减少重试次数
  retryDelay: 3000, // 初始重试延迟3秒
  
  // 离线存储配置
  maxOfflineEvents: 50, // 减少离线存储数量
  offlineStorageKey: 'analytics_offline_data',
  
  // 会话超时配置
  sessionTimeout: 30 * 60 * 1000, // 30分钟
  
  // 滚动深度阈值（减少数量）
  scrollDepthThresholds: [25, 50, 75, 100],
  
  // 功能开关（细粒度控制）
  trackNavigation: true,
  trackExternalLinks: true,
  trackScrollDepth: true,
  trackPerformance: false, // 默认关闭性能监控（按需开启）
  trackErrors: true,
  trackMouseMovement: false, // 默认关闭鼠标移动追踪
  trackKeyboard: false, // 默认关闭键盘追踪
  
  // 隐私配置
  enableGeolocation: true, // 启用IP地理位置
  maskUserAgent: false, // 启用用户代理脱敏
  anonymizeIP: false, // 启用IP脱敏
  
  // 性能优化配置
  lazyInit: true, // 延迟初始化
  onlyTrackInteractions: true, // 只追踪用户交互
  minInteractionDelay: 1000, // 最小交互间隔1秒
  
  // 采样配置（减少数据量）
  sampleRate: 1.0, // 采样率100%（生产环境可调低）
  
  // 轻量级模式配置
  lightweightMode: {
    enabled: false, // 是否启用轻量级模式
    maxEventsPerSession: 50, // 每会话最大事件数
    basicTrackingOnly: true, // 只进行基础追踪
    disableAdvancedFeatures: true // 禁用高级功能
  },
  
  // 自动优化配置
  autoOptimize: {
    enabled: true,
    performanceThreshold: 100, // 性能阈值（毫秒）
    memoryThreshold: 50 * 1024 * 1024, // 内存阈值（50MB）
    adaptiveThrottling: true // 自适应节流
  }
}; 