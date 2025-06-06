// 数据发送器模块
export class AnalyticsSender {
  constructor(config) {
    this.config = config;
    this.sessionId = null;
    this.userInfo = null;
    this.sessionInfo = null;
    
    // 数据缓冲区
    this.eventBuffer = [];
    this.bufferSize = config.bufferSize || 10;
    this.flushInterval = config.flushInterval || 30000;
    
    // 发送状态
    this.isOnline = navigator.onLine;
    this.isSending = false;
    this.failedAttempts = 0;
    this.maxRetries = 3;
    
    // 离线存储
    this.offlineStorageKey = 'analytics_offline_data';
    this.maxOfflineEvents = 100;
    
    // 统计信息
    this.totalEvents = 0;
    this.sentEvents = 0;
    this.failedEvents = 0;
    
    // 定时器
    this.flushTimer = null;
    this.retryTimer = null;
  }

  // 初始化发送器
  init(sessionId, userInfo, sessionInfo) {
    this.sessionId = sessionId;
    this.userInfo = userInfo;
    this.sessionInfo = sessionInfo;
    
    // 设置事件监听器
    this.setupEventListener();
    
    // 启动定时刷新
    this.startPeriodicFlush();
    
    // 处理离线数据
    this.handleOfflineData();
    
    this.log('Sender initialized');
  }

  // 设置事件监听器
  setupEventListener() {
    // 监听自定义分析事件
    window.addEventListener('analytics-event', (event) => {
      this.addEvent(event.detail);
    });
  }

  // 添加事件到缓冲区
  addEvent(eventData) {
    const enrichedEvent = this.enrichEvent(eventData);
    this.eventBuffer.push(enrichedEvent);
    this.totalEvents++;
    
    this.log(`Event added to buffer: ${eventData.type}`, enrichedEvent);
    
    // 检查是否需要立即发送
    if (this.eventBuffer.length >= this.bufferSize) {
      this.flush();
    }
    
    // 对关键事件立即发送
    if (this.isCriticalEvent(eventData.type)) {
      this.flush();
    }
  }

  // 丰富事件数据
  enrichEvent(eventData) {
    return {
      ...eventData,
      sessionId: this.sessionId,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: eventData.timestamp || Date.now(),
      eventId: this.generateEventId(),
      
      // 页面信息
      pageInfo: {
        title: document.title,
        url: window.location.href,
        referrer: document.referrer,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      },
      
      // 性能信息（如果可用）
      performance: this.getPerformanceInfo()
    };
  }

  // 判断是否为关键事件
  isCriticalEvent(eventType) {
    const criticalEvents = [
      'session_end',
      'page_unload',
      'error',
      'page_load'
    ];
    return criticalEvents.includes(eventType);
  }

  // 获取性能信息
  getPerformanceInfo() {
    if (!window.performance || !window.performance.now) {
      return null;
    }
    
    try {
      return {
        timeOrigin: window.performance.timeOrigin,
        now: window.performance.now(),
        memory: window.performance.memory ? {
          usedJSHeapSize: window.performance.memory.usedJSHeapSize,
          totalJSHeapSize: window.performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit
        } : null
      };
    } catch (error) {
      return null;
    }
  }

  // 刷新缓冲区（发送数据）
  async flush() {
    if (this.eventBuffer.length === 0 || this.isSending) {
      return;
    }
    
    this.isSending = true;
    const eventsToSend = [...this.eventBuffer];
    this.eventBuffer = [];
    
    try {
      if (this.isOnline) {
        await this.sendEvents(eventsToSend);
        this.sentEvents += eventsToSend.length;
        this.failedAttempts = 0;
        this.log(`Successfully sent ${eventsToSend.length} events`);
      } else {
        this.storeOfflineData(eventsToSend);
        this.log(`Stored ${eventsToSend.length} events offline`);
      }
    } catch (error) {
      this.handleSendError(eventsToSend, error);
    } finally {
      this.isSending = false;
    }
  }

  // 发送事件数据
  async sendEvents(events) {
    const payload = {
      sessionId: this.sessionId,
      userInfo: this.userInfo,
      sessionInfo: this.sessionInfo,
      events: events,
      metadata: {
        totalEvents: this.totalEvents,
        sentEvents: this.sentEvents,
        failedEvents: this.failedEvents,
        timestamp: Date.now()
      }
    };
    
    // 在控制台输出（模拟发送到后端）
    this.logPayload(payload);
    
    // 模拟网络延迟
    await this.simulateNetworkDelay();
    
    // 模拟偶发的网络错误
    if (Math.random() < 0.1) {
      throw new Error('Simulated network error');
    }
    
    return { success: true, eventsProcessed: events.length };
  }

  // 在控制台输出载荷数据
  logPayload(payload) {
    console.group(`📊 [Analytics Data Sent] Session: ${payload.sessionId}`);
    console.log('📋 Session Info:', payload.sessionInfo);
    console.log('👤 User Info:', payload.userInfo);
    console.log('📊 Events:', payload.events);
    console.log('📈 Metadata:', payload.metadata);
    console.groupEnd();
    
    // 简化版本的表格显示
    if (payload.events.length > 0) {
      console.table(payload.events.map(event => ({
        Type: event.type,
        Section: event.section || 'N/A',
        Timestamp: new Date(event.timestamp).toLocaleTimeString(),
        Details: this.getEventSummary(event)
      })));
    }
  }

  // 获取事件摘要
  getEventSummary(event) {
    switch (event.type) {
      case 'section_change':
        return `${event.fromSection} → ${event.toSection}`;
      case 'link_click':
        return `${event.text} (${event.url})`;
      case 'navigation_click':
        return `${event.text} → ${event.target}`;
      case 'scroll_depth':
        return `${event.threshold}% (${event.actualDepth}%)`;
      case 'page_load':
        return `${event.loadTime}ms`;
      case 'session_end':
        return `Duration: ${Math.round(event.totalDuration / 1000)}s`;
      default:
        return 'N/A';
    }
  }

  // 模拟网络延迟
  async simulateNetworkDelay() {
    const delay = Math.random() * 1000 + 500; // 500-1500ms
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  // 处理发送错误
  handleSendError(events, error) {
    this.failedEvents += events.length;
    this.failedAttempts++;
    
    this.log(`Send failed (attempt ${this.failedAttempts}):`, error.message);
    
    if (this.failedAttempts < this.maxRetries) {
      // 重新加入缓冲区等待重试
      this.eventBuffer.unshift(...events);
      this.scheduleRetry();
    } else {
      // 存储到离线数据
      this.storeOfflineData(events);
      this.failedAttempts = 0;
    }
  }

  // 调度重试
  scheduleRetry() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
    
    const retryDelay = Math.pow(2, this.failedAttempts) * 1000; // 指数退避
    this.retryTimer = setTimeout(() => {
      this.log('Retrying send...');
      this.flush();
    }, retryDelay);
  }

  // 存储离线数据
  storeOfflineData(events) {
    try {
      const existingData = JSON.parse(localStorage.getItem(this.offlineStorageKey) || '[]');
      
      // 合并新数据
      const allData = [...existingData, ...events];
      
      // 限制离线数据数量
      const limitedData = allData.slice(-this.maxOfflineEvents);
      
      localStorage.setItem(this.offlineStorageKey, JSON.stringify(limitedData));
      this.log(`Stored ${events.length} events offline. Total offline: ${limitedData.length}`);
    } catch (error) {
      this.log('Failed to store offline data:', error.message);
    }
  }

  // 处理离线数据
  async handleOfflineData() {
    if (!this.isOnline) return;
    
    try {
      const offlineData = JSON.parse(localStorage.getItem(this.offlineStorageKey) || '[]');
      
      if (offlineData.length > 0) {
        this.log(`Found ${offlineData.length} offline events, sending...`);
        
        await this.sendEvents(offlineData);
        localStorage.removeItem(this.offlineStorageKey);
        
        this.log('Offline data sent successfully');
      }
    } catch (error) {
      this.log('Failed to send offline data:', error.message);
    }
  }

  // 处理网络状态变化
  handleOnline() {
    this.isOnline = true;
    this.log('Network connection restored');
    
    // 处理离线数据
    this.handleOfflineData();
    
    // 如果有缓冲的数据，立即发送
    if (this.eventBuffer.length > 0) {
      this.flush();
    }
  }

  // 处理网络断开
  handleOffline() {
    this.isOnline = false;
    this.log('Network connection lost');
    
    // 取消重试定时器
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  // 最终刷新（页面卸载时）
  finalFlush() {
    if (this.eventBuffer.length === 0) return;
    
    try {
      // 使用 navigator.sendBeacon 进行最后的数据发送
      if (navigator.sendBeacon) {
        const payload = JSON.stringify({
          sessionId: this.sessionId,
          events: this.eventBuffer,
          metadata: {
            type: 'final_flush',
            timestamp: Date.now()
          }
        });
        
        // 模拟 beacon 发送（实际环境中应该是真实的 URL）
        const sent = navigator.sendBeacon('/analytics/beacon', payload);
        
        if (sent) {
          this.log(`Final flush: sent ${this.eventBuffer.length} events via beacon`);
          this.logPayload({ events: this.eventBuffer, sessionId: this.sessionId });
        } else {
          this.storeOfflineData(this.eventBuffer);
        }
      } else {
        // 降级到离线存储
        this.storeOfflineData(this.eventBuffer);
      }
      
      this.eventBuffer = [];
    } catch (error) {
      this.log('Final flush failed:', error.message);
    }
  }

  // 启动定时刷新
  startPeriodicFlush() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    this.flushTimer = setInterval(() => {
      if (this.eventBuffer.length > 0) {
        this.log('Periodic flush triggered');
        this.flush();
      }
    }, this.flushInterval);
  }

  // 停止定时刷新
  stopPeriodicFlush() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  // 获取发送统计信息
  getStats() {
    return {
      totalEvents: this.totalEvents,
      sentEvents: this.sentEvents,
      failedEvents: this.failedEvents,
      bufferSize: this.eventBuffer.length,
      isOnline: this.isOnline,
      isSending: this.isSending,
      failedAttempts: this.failedAttempts
    };
  }

  // 获取总事件数
  getTotalEvents() {
    return this.totalEvents;
  }

  // 清空缓冲区
  clearBuffer() {
    this.eventBuffer = [];
    this.log('Buffer cleared');
  }

  // 生成事件ID
  generateEventId() {
    return 'event_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // 调试日志
  log(message, data = null) {
    if (this.config.debug) {
      console.log(`[Analytics Sender] ${message}`, data || '');
    }
  }

  // 销毁发送器
  destroy() {
    this.stopPeriodicFlush();
    
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
    
    // 最终发送
    this.finalFlush();
    
    this.log('Sender destroyed');
  }
} 