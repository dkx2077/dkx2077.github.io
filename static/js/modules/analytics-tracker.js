// 行为追踪器模块 - 优化版本
export class AnalyticsTracker {
  constructor(config) {
    this.config = config;
    this.sessionId = null;
    this.isTracking = false;
    this.isPaused = false;
    
    // 时间追踪
    this.sectionTimes = new Map();
    this.currentSection = null;
    this.sectionStartTime = null;
    
    // 滚动追踪
    this.scrollDepthThresholds = config.scrollDepthThresholds || [25, 50, 75, 100];
    this.triggeredScrollDepths = new Set();
    this.maxScrollDepth = 0;
    
    // 用户交互状态
    this.userInteracted = false; // 用户是否已交互
    this.interactionStartTime = null;
    this.lastInteractionTime = 0;
    
    // 点击追踪
    this.clickBuffer = [];
    this.significantClicks = 0; // 有意义的点击数
    
    // 页面焦点状态
    this.pageActivity = {
      isActive: true,
      lastActiveTime: Date.now(),
      inactiveTime: 0
    };
    
    // 性能优化的工具函数
    this.throttledScrollHandler = this.throttle(this.handleScroll.bind(this), 500); // 增加到500ms
    this.debouncedSectionCheck = this.debounce(this.detectCurrentSection.bind(this), 300);
    
    // 减少频繁监听
    this.isScrolling = false;
    this.scrollTimer = null;
  }

  // 初始化追踪器
  async init(sessionId) {
    this.sessionId = sessionId;
    
    // 设置事件监听器
    this.setupEventListeners();
    
    // 检测当前页面部分
    this.detectCurrentSection();
    
    // 开始追踪
    this.startTracking();
    
    this.log('Tracker initialized with performance optimizations');
  }

  // 设置事件监听器（优化版本）
  setupEventListeners() {
    // 滚动事件 - 使用passive监听提高性能
    window.addEventListener('scroll', this.throttledScrollHandler, { passive: true });
    
    // 用户交互检测
    this.setupInteractionDetection();
    
    // 点击事件 - 只追踪有意义的点击
    document.addEventListener('click', this.handleSignificantClick.bind(this), { passive: true });
    
    // 链接点击事件（特殊处理）
    document.addEventListener('click', this.handleLinkClick.bind(this));
    
    // 导航菜单点击事件
    this.setupNavigationTracking();
    
    // 页面焦点事件
    this.setupFocusTracking();
    
    // 键盘事件 - 只监听特殊按键
    document.addEventListener('keydown', this.handleKeyDown.bind(this), { passive: true });
  }

  // 设置用户交互检测
  setupInteractionDetection() {
    const interactionEvents = ['click', 'keydown', 'touchstart'];
    
    const handleFirstInteraction = () => {
      if (!this.userInteracted) {
        this.userInteracted = true;
        this.interactionStartTime = Date.now();
        this.log('User interaction detected - full tracking enabled');
        
        // 用户交互后才启用更多监听
        this.enableAdvancedTracking();
      }
      this.lastInteractionTime = Date.now();
    };

    interactionEvents.forEach(eventType => {
      document.addEventListener(eventType, handleFirstInteraction, { 
        once: false, 
        passive: true 
      });
    });
  }

  // 启用高级追踪（只有用户交互后才启用）
  enableAdvancedTracking() {
    // 鼠标移动事件（延迟启用，减少初始页面加载影响）
    setTimeout(() => {
      if (this.userInteracted) {
        document.addEventListener('mousemove', 
          this.throttle(this.handleMouseMove.bind(this), 2000), // 2秒节流
          { passive: true }
        );
        this.log('Advanced mouse tracking enabled');
      }
    }, 3000); // 3秒后再启用
  }

  // 开始追踪
  startTracking() {
    if (this.isTracking) return;
    
    this.isTracking = true;
    this.isPaused = false;
    
    // 开始计时当前部分
    this.startSectionTimer(this.currentSection);
    
    this.log('Tracking started');
  }

  // 暂停追踪
  pauseTracking() {
    if (!this.isTracking || this.isPaused) return;
    
    this.isPaused = true;
    
    // 暂停当前部分计时
    this.pauseSectionTimer();
    
    this.log('Tracking paused');
  }

  // 恢复追踪
  resumeTracking() {
    if (!this.isTracking || !this.isPaused) return;
    
    this.isPaused = false;
    
    // 恢复当前部分计时
    this.resumeSectionTimer();
    
    this.log('Tracking resumed');
  }

  // 检测当前页面部分（优化版本）
  detectCurrentSection() {
    const sections = ['page-top', 'publications', 'awards', 'service'];
    let currentSection = 'page-top'; // 默认首页
    
    try {
      const scrollTop = window.scrollY;
      const windowHeight = window.innerHeight;
      
      for (const sectionId of sections) {
        const element = document.getElementById(sectionId);
        if (element) {
          const rect = element.getBoundingClientRect();
          const elementTop = rect.top + scrollTop;
          
          // 如果元素顶部在视窗中间以上，则认为是当前部分
          if (elementTop <= scrollTop + windowHeight / 2) {
            currentSection = sectionId;
          }
        }
      }
      
      if (currentSection !== this.currentSection) {
        this.onSectionChange(this.currentSection, currentSection);
      }
    } catch (error) {
      this.log('Section detection error:', error.message);
    }
  }

  // 部分切换处理
  onSectionChange(fromSection, toSection) {
    this.log(`Section change: ${fromSection} -> ${toSection}`);
    
    // 结束前一个部分的计时
    if (fromSection && this.isTracking && !this.isPaused) {
      this.endSectionTimer(fromSection);
    }
    
    // 更新当前部分
    this.currentSection = toSection;
    
    // 开始新部分的计时
    if (toSection && this.isTracking && !this.isPaused) {
      this.startSectionTimer(toSection);
    }
    
    // 重置滚动深度（为新部分）
    this.resetScrollDepthForSection(toSection);
  }

  // 开始部分计时
  startSectionTimer(section) {
    if (!section) return;
    
    this.sectionStartTime = Date.now();
    this.log(`Started timer for section: ${section}`);
  }

  // 结束部分计时
  endSectionTimer(section) {
    if (!section || !this.sectionStartTime) return;
    
    const duration = Date.now() - this.sectionStartTime;
    const existingTime = this.sectionTimes.get(section) || 0;
    this.sectionTimes.set(section, existingTime + duration);
    
    this.log(`Ended timer for section: ${section}, duration: ${duration}ms`);
  }

  // 暂停部分计时
  pauseSectionTimer() {
    if (this.currentSection && this.sectionStartTime) {
      this.endSectionTimer(this.currentSection);
      this.sectionStartTime = null;
    }
  }

  // 恢复部分计时
  resumeSectionTimer() {
    if (this.currentSection) {
      this.startSectionTimer(this.currentSection);
    }
  }

  // 处理滚动事件（优化版本）
  handleScroll() {
    if (!this.isTracking || this.isPaused) return;
    
    // 滚动开始
    if (!this.isScrolling) {
      this.isScrolling = true;
    }
    
    // 清除之前的定时器
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer);
    }
    
    // 滚动结束检测
    this.scrollTimer = setTimeout(() => {
      this.isScrolling = false;
      this.onScrollEnd();
    }, 150);
    
    // 计算滚动深度（减少频率）
    this.calculateScrollDepth();
    
    // 使用防抖的部分检测
    this.debouncedSectionCheck();
  }

  // 滚动结束处理
  onScrollEnd() {
    // 只在滚动结束时进行精确的部分检测
    this.detectCurrentSection();
  }

  // 计算滚动深度（优化版本）
  calculateScrollDepth() {
    if (!this.userInteracted) return; // 用户未交互时不计算
    
    try {
      const scrollTop = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      const scrollPercent = Math.round((scrollTop / (documentHeight - windowHeight)) * 100);
      
      // 更新最大滚动深度
      if (scrollPercent > this.maxScrollDepth) {
        this.maxScrollDepth = scrollPercent;
      }
      
      // 检查是否触发新的滚动深度阈值
      this.scrollDepthThresholds.forEach(threshold => {
        if (scrollPercent >= threshold && !this.triggeredScrollDepths.has(threshold)) {
          this.triggeredScrollDepths.add(threshold);
          this.trackScrollDepth(threshold, scrollPercent);
        }
      });
    } catch (error) {
      this.log('Scroll depth calculation error:', error.message);
    }
  }

  // 追踪滚动深度
  trackScrollDepth(threshold, actualDepth) {
    const event = {
      type: 'scroll_depth',
      threshold: threshold,
      actualDepth: actualDepth,
      section: this.currentSection,
      userInteracted: this.userInteracted,
      timestamp: Date.now()
    };
    
    this.log(`Scroll depth reached: ${threshold}%`, event);
    
    window.dispatchEvent(new CustomEvent('analytics-event', { detail: event }));
  }

  // 重置滚动深度（为新部分）
  resetScrollDepthForSection(section) {
    // 为每个部分单独追踪滚动深度
    this.triggeredScrollDepths.clear();
    this.maxScrollDepth = 0;
  }

  // 处理有意义的点击事件
  handleSignificantClick(event) {
    if (!this.isTracking || this.isPaused) return;
    
    // 过滤无意义的点击
    if (this.isSignificantClick(event)) {
      this.significantClicks++;
      
      const clickData = {
        type: 'click',
        element: this.getElementInfo(event.target),
        coordinates: {
          x: event.clientX,
          y: event.clientY
        },
        section: this.currentSection,
        clickCount: this.significantClicks,
        timestamp: Date.now()
      };
      
      this.clickBuffer.push(clickData);
      this.log('Significant click tracked:', clickData);
      
      window.dispatchEvent(new CustomEvent('analytics-event', { detail: clickData }));
    }
  }

  // 判断是否为有意义的点击
  isSignificantClick(event) {
    const target = event.target;
    
    // 排除无意义的点击
    if (target.tagName.toLowerCase() === 'html' || 
        target.tagName.toLowerCase() === 'body') {
      return false;
    }
    
    // 包含的有意义元素
    const significantElements = ['a', 'button', 'input', 'select', 'textarea'];
    const tagName = target.tagName.toLowerCase();
    
    // 直接点击有意义元素
    if (significantElements.includes(tagName)) {
      return true;
    }
    
    // 检查父元素是否有意义
    const parent = target.closest('a, button, [role="button"], [onclick]');
    if (parent) {
      return true;
    }
    
    // 检查是否有交互相关的类名
    const interactiveClasses = ['btn', 'button', 'link', 'nav', 'menu', 'clickable'];
    const classList = target.className.toLowerCase();
    if (interactiveClasses.some(cls => classList.includes(cls))) {
      return true;
    }
    
    return false;
  }

  // 处理链接点击
  handleLinkClick(event) {
    if (!this.isTracking || this.isPaused) return;
    
    const target = event.target.closest('a');
    if (!target) return;
    
    const href = target.getAttribute('href');
    const text = target.textContent.trim();
    const isExternal = href && (href.startsWith('http') || href.startsWith('//'));
    
    const linkData = {
      type: 'link_click',
      url: href,
      text: text.substring(0, 100), // 限制文本长度
      isExternal: isExternal,
      target: target.getAttribute('target'),
      section: this.currentSection,
      timestamp: Date.now()
    };
    
    this.log('Link click tracked:', linkData);
    
    window.dispatchEvent(new CustomEvent('analytics-event', { detail: linkData }));
  }

  // 设置导航追踪
  setupNavigationTracking() {
    const navLinks = document.querySelectorAll('.navbar-nav .nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', (event) => {
        const href = link.getAttribute('href');
        const text = link.textContent.trim();
        
        const navData = {
          type: 'navigation_click',
          target: href,
          text: text,
          fromSection: this.currentSection,
          timestamp: Date.now()
        };
        
        this.log('Navigation click tracked:', navData);
        
        window.dispatchEvent(new CustomEvent('analytics-event', { detail: navData }));
      });
    });
  }

  // 设置焦点追踪
  setupFocusTracking() {
    // 页面可见性事件
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.handleBlur();
      } else {
        this.handleFocus();
      }
    });
    
    // 窗口焦点事件（减少频率）
    window.addEventListener('focus', this.throttle(() => {
      this.handleFocus();
    }, 1000)); // 1秒节流
    
    window.addEventListener('blur', this.throttle(() => {
      this.handleBlur();
    }, 1000)); // 1秒节流
  }

  // 处理页面获得焦点
  handleFocus() {
    const wasInactive = !this.pageActivity.isActive;
    
    this.pageActivity.isActive = true;
    this.pageActivity.lastActiveTime = Date.now();
    
    if (wasInactive) {
      this.resumeTracking();
      
      const focusData = {
        type: 'page_focus',
        inactiveTime: this.pageActivity.inactiveTime,
        timestamp: Date.now()
      };
      
      this.log('Page focus gained:', focusData);
      window.dispatchEvent(new CustomEvent('analytics-event', { detail: focusData }));
    }
  }

  // 处理页面失去焦点
  handleBlur() {
    if (!this.pageActivity.isActive) return;
    
    this.pageActivity.isActive = false;
    this.pageActivity.inactiveTime = Date.now() - this.pageActivity.lastActiveTime;
    
    this.pauseTracking();
    
    const blurData = {
      type: 'page_blur',
      activeTime: this.pageActivity.inactiveTime,
      timestamp: Date.now()
    };
    
    this.log('Page focus lost:', blurData);
    window.dispatchEvent(new CustomEvent('analytics-event', { detail: blurData }));
  }

  // 处理鼠标移动（大幅优化）
  handleMouseMove(event) {
    if (!this.isTracking || this.isPaused || !this.userInteracted) return;
    
    // 只记录基本的鼠标活动，不记录具体坐标（隐私保护）
    const now = Date.now();
    const timeSinceLastInteraction = now - this.lastInteractionTime;
    
    // 如果距离上次交互超过5分钟，认为用户重新活跃
    if (timeSinceLastInteraction > 300000) { // 5分钟
      const activeData = {
        type: 'mouse_active',
        inactiveTime: timeSinceLastInteraction,
        timestamp: now
      };
      
      this.log('Mouse activity resumed after inactivity:', activeData);
      window.dispatchEvent(new CustomEvent('analytics-event', { detail: activeData }));
    }
    
    this.lastInteractionTime = now;
  }

  // 处理键盘事件（只记录特殊按键）
  handleKeyDown(event) {
    if (!this.isTracking || this.isPaused) return;
    
    // 只记录特殊按键，避免隐私问题
    if (this.isSpecialKey(event.key)) {
      const keyData = {
        type: 'key_press',
        key: event.key,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        section: this.currentSection,
        timestamp: Date.now()
      };
      
      this.log('Special key press:', keyData);
      window.dispatchEvent(new CustomEvent('analytics-event', { detail: keyData }));
    }
  }

  // 判断是否为特殊按键
  isSpecialKey(key) {
    const specialKeys = [
      'Tab', 'Enter', 'Escape', 'Space', 'ArrowUp', 'ArrowDown', 
      'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'
    ];
    return specialKeys.includes(key);
  }

  // 获取元素信息（简化版本）
  getElementInfo(element) {
    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id || null,
      className: element.className ? element.className.substring(0, 50) : null,
      text: element.textContent ? element.textContent.trim().substring(0, 30) : null,
      href: element.href || null
    };
  }

  // 最终化会话
  finalizeSession() {
    if (this.currentSection && this.sectionStartTime) {
      this.endSectionTimer(this.currentSection);
    }
    
    const sessionSummary = {
      type: 'session_end',
      sessionId: this.sessionId,
      totalDuration: this.getTotalSessionTime(),
      sectionTimes: Object.fromEntries(this.sectionTimes),
      maxScrollDepth: this.maxScrollDepth,
      significantClicks: this.significantClicks,
      userInteracted: this.userInteracted,
      interactionDuration: this.userInteracted ? Date.now() - this.interactionStartTime : 0,
      timestamp: Date.now()
    };
    
    this.log('Session finalized:', sessionSummary);
    window.dispatchEvent(new CustomEvent('analytics-event', { detail: sessionSummary }));
  }

  // 获取当前部分
  getCurrentSection() {
    return this.currentSection;
  }

  // 获取部分时间
  getSectionTimes() {
    const times = Object.fromEntries(this.sectionTimes);
    
    // 添加当前部分的时间
    if (this.currentSection && this.sectionStartTime && !this.isPaused) {
      const currentTime = Date.now() - this.sectionStartTime;
      const existingTime = times[this.currentSection] || 0;
      times[this.currentSection] = existingTime + currentTime;
    }
    
    return times;
  }

  // 获取总会话时间
  getTotalSessionTime() {
    const sectionTimes = this.getSectionTimes();
    return Object.values(sectionTimes).reduce((total, time) => total + time, 0);
  }

  // 工具函数：节流（优化版本）
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // 工具函数：防抖（优化版本）
  debounce(func, delay) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  // 调试日志
  log(message, data = null) {
    if (this.config.debug) {
      console.log(`[Analytics Tracker] ${message}`, data || '');
    }
  }
} 