// 核心统计模块 - 主控制器
import { AnalyticsCollector } from './analytics-collector.js';
import { AnalyticsTracker } from './analytics-tracker.js';
import { AnalyticsSender } from './analytics-sender.js';

export class Analytics {
  constructor(config = {}) {
    this.config = {
      enabled: true,
      debug: true,
      respectDoNotTrack: true,
      bufferSize: 10,
      flushInterval: 30000,
      ...config
    };

    this.sessionId = this.generateSessionId();
    this.sessionStartTime = Date.now();
    this.isInitialized = false;
    
    // 初始化子模块
    this.collector = new AnalyticsCollector(this.config);
    this.tracker = new AnalyticsTracker(this.config);
    this.sender = new AnalyticsSender(this.config);

    this.log('Analytics instance created', { sessionId: this.sessionId });
  }

  // 初始化统计系统
  async init() {
    if (this.isInitialized) {
      this.log('Analytics already initialized');
      return;
    }

    // 检查用户隐私设置
    if (!this.checkPrivacyConsent()) {
      this.log('Analytics disabled due to privacy settings');
      return;
    }

    try {
      // 收集初始用户信息
      const userInfo = await this.collector.collectUserInfo();
      const sessionInfo = this.collector.collectSessionInfo(this.sessionId, this.sessionStartTime);

      this.log('User Info Collected:', userInfo);
      this.log('Session Info Collected:', sessionInfo);

      // 初始化追踪器
      await this.tracker.init(this.sessionId);

      // 设置事件监听器
      this.setupEventListeners();

      // 启动数据发送器
      this.sender.init(this.sessionId, userInfo, sessionInfo);

      // 记录页面加载事件
      this.trackPageLoad();

      this.isInitialized = true;
      this.log('Analytics initialized successfully');

      // 设置定时刷新
      this.setupPeriodicFlush();

    } catch (error) {
      console.error('[Analytics] Initialization failed:', error);
    }
  }

  // 检查隐私同意
  checkPrivacyConsent() {
    if (!this.config.enabled) return false;
    
    if (this.config.respectDoNotTrack && this.isDoNotTrackEnabled()) {
      return false;
    }

    // 这里可以检查cookie同意等
    return true;
  }

  // 检查Do Not Track设置
  isDoNotTrackEnabled() {
    return navigator.doNotTrack === '1' || 
           navigator.msDoNotTrack === '1' || 
           window.doNotTrack === '1';
  }

  // 设置事件监听器
  setupEventListeners() {
    // 页面可见性变化
    document.addEventListener('visibilitychange', () => {
      this.handleVisibilityChange();
    });

    // 页面卸载前发送数据
    window.addEventListener('beforeunload', () => {
      this.handlePageUnload();
    });

    // 页面焦点变化
    window.addEventListener('focus', () => {
      this.tracker.handleFocus();
    });

    window.addEventListener('blur', () => {
      this.tracker.handleBlur();
    });

    // 网络状态变化
    window.addEventListener('online', () => {
      this.sender.handleOnline();
    });

    window.addEventListener('offline', () => {
      this.sender.handleOffline();
    });
  }

  // 处理页面可见性变化
  handleVisibilityChange() {
    if (document.hidden) {
      this.log('Page hidden - pausing tracking');
      this.tracker.pauseTracking();
      this.sender.flush(); // 立即发送缓存数据
    } else {
      this.log('Page visible - resuming tracking');
      this.tracker.resumeTracking();
    }
  }

  // 处理页面卸载
  handlePageUnload() {
    this.log('Page unloading - final data flush');
    this.tracker.finalizeSession();
    this.sender.finalFlush();
  }

  // 追踪页面加载
  trackPageLoad() {
    const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
    const event = {
      type: 'page_load',
      loadTime: loadTime,
      url: window.location.href,
      title: document.title,
      referrer: document.referrer,
      timestamp: Date.now()
    };

    this.sender.addEvent(event);
    this.log('Page load tracked:', event);
  }

  // 追踪页面部分切换
  trackSectionChange(fromSection, toSection) {
    if (!this.isInitialized) return;

    const event = {
      type: 'section_change',
      fromSection: fromSection,
      toSection: toSection,
      timestamp: Date.now()
    };

    this.sender.addEvent(event);
    this.tracker.onSectionChange(fromSection, toSection);
    this.log('Section change tracked:', event);
  }

  // 追踪链接点击
  trackLinkClick(url, text, type = 'external') {
    if (!this.isInitialized) return;

    const event = {
      type: 'link_click',
      url: url,
      linkText: text,
      linkType: type,
      currentSection: this.tracker.getCurrentSection(),
      timestamp: Date.now()
    };

    this.sender.addEvent(event);
    this.log('Link click tracked:', event);
  }

  // 追踪自定义事件
  trackCustomEvent(eventName, properties = {}) {
    if (!this.isInitialized) return;

    const event = {
      type: 'custom_event',
      eventName: eventName,
      properties: properties,
      currentSection: this.tracker.getCurrentSection(),
      timestamp: Date.now()
    };

    this.sender.addEvent(event);
    this.log('Custom event tracked:', event);
  }

  // 获取当前会话统计信息
  getSessionStats() {
    if (!this.isInitialized) return null;

    return {
      sessionId: this.sessionId,
      duration: Date.now() - this.sessionStartTime,
      sectionTimes: this.tracker.getSectionTimes(),
      totalEvents: this.sender.getTotalEvents(),
      currentSection: this.tracker.getCurrentSection()
    };
  }

  // 设置定时刷新
  setupPeriodicFlush() {
    setInterval(() => {
      this.sender.flush();
      this.log('Periodic flush completed');
    }, this.config.flushInterval);
  }

  // 生成会话ID
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // 调试日志
  log(message, data = null) {
    if (this.config.debug) {
      console.log(`[Analytics] ${message}`, data || '');
    }
  }

  // 销毁统计实例
  destroy() {
    this.log('Destroying analytics instance');
    this.handlePageUnload();
    this.isInitialized = false;
  }
} 