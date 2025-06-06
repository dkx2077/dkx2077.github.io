// 数据收集器模块
export class AnalyticsCollector {
  constructor(config) {
    this.config = config;
    this.ipLocationCache = null; // 缓存IP位置信息
    this.ipLocationFetched = false;
  }

  // 收集用户基础信息
  async collectUserInfo() {
    const userInfo = {
      // 设备信息
      userAgent: this.maskUserAgent(navigator.userAgent),
      platform: navigator.platform,
      screenResolution: `${screen.width}x${screen.height}`,
      windowSize: `${window.innerWidth}x${window.innerHeight}`,
      deviceType: this.getDeviceType(),
      devicePixelRatio: window.devicePixelRatio || 1,
      
      // 浏览器信息
      language: navigator.language,
      languages: navigator.languages || [navigator.language],
      timezone: this.getTimezone(),
      cookieEnabled: navigator.cookieEnabled,
      
      // 网络信息
      connection: this.getConnectionInfo(),
      
      // 访问来源
      referrer: document.referrer,
      utmParams: this.getUTMParams(),
      
      // 浏览器能力（简化版本，减少检测开销）
      capabilities: this.getBasicBrowserCapabilities(),
      
      // 通过IP获取地理位置
      location: await this.getLocationByIP(),
      
      // 收集时间
      collectedAt: new Date().toISOString()
    };

    return userInfo;
  }

  // 收集会话信息
  collectSessionInfo(sessionId, startTime) {
    return {
      sessionId: sessionId,
      startTime: startTime,
      startTimeISO: new Date(startTime).toISOString(),
      url: window.location.href,
      title: document.title,
      hash: window.location.hash,
      pathname: window.location.pathname,
      search: window.location.search,
      isNewSession: this.isNewSession(),
      previousSessionId: this.getPreviousSessionId(),
      visitCount: this.getVisitCount(),
      isReturningVisitor: this.isReturningVisitor()
    };
  }

  // 判断设备类型
  getDeviceType() {
    const userAgent = navigator.userAgent.toLowerCase();
    const screenWidth = screen.width;

    if (/tablet|ipad|playbook|silk|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))/i.test(userAgent)) {
      return 'tablet';
    }
    
    if (/mobile|iphone|ipod|android.*mobile|windows.*phone|blackberry|bb10/i.test(userAgent)) {
      return 'mobile';
    }

    if (screenWidth < 768) {
      return 'mobile';
    } else if (screenWidth < 1024) {
      return 'tablet';
    }

    return 'desktop';
  }

  // 获取时区信息
  getTimezone() {
    try {
      return {
        name: Intl.DateTimeFormat().resolvedOptions().timeZone,
        offset: new Date().getTimezoneOffset(),
        offsetString: this.getTimezoneOffsetString()
      };
    } catch (error) {
      return {
        name: 'Unknown',
        offset: new Date().getTimezoneOffset(),
        offsetString: this.getTimezoneOffsetString()
      };
    }
  }

  // 获取时区偏移字符串
  getTimezoneOffsetString() {
    const offset = -new Date().getTimezoneOffset();
    const hours = Math.floor(Math.abs(offset) / 60);
    const minutes = Math.abs(offset) % 60;
    return `${offset >= 0 ? '+' : '-'}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  // 获取网络连接信息
  getConnectionInfo() {
    if (!navigator.connection) {
      return null;
    }

    return {
      effectiveType: navigator.connection.effectiveType,
      downlink: navigator.connection.downlink,
      rtt: navigator.connection.rtt,
      saveData: navigator.connection.saveData
    };
  }

  // 获取UTM参数
  getUTMParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
      source: urlParams.get('utm_source'),
      medium: urlParams.get('utm_medium'),
      campaign: urlParams.get('utm_campaign'),
      term: urlParams.get('utm_term'),
      content: urlParams.get('utm_content')
    };
  }

  // 获取基础浏览器能力（简化版本，减少性能开销）
  getBasicBrowserCapabilities() {
    return {
      // 存储能力
      localStorage: this.hasLocalStorage(),
      sessionStorage: this.hasSessionStorage(),
      
      // 输入能力
      touchSupport: this.hasTouchSupport(),
      
      // 安全能力
      isSecureContext: window.isSecureContext || false,
      
      // ES6支持
      es6Modules: typeof Symbol !== 'undefined' && typeof Promise !== 'undefined'
    };
  }

  // 获取完整浏览器能力（按需调用）
  getBrowserCapabilities() {
    return {
      // 存储能力
      localStorage: this.hasLocalStorage(),
      sessionStorage: this.hasSessionStorage(),
      indexedDB: this.hasIndexedDB(),
      
      // 媒体能力
      webGL: this.hasWebGL(),
      canvas: this.hasCanvas(),
      
      // 网络能力
      serviceWorker: 'serviceWorker' in navigator,
      webRTC: this.hasWebRTC(),
      
      // 输入能力
      touchSupport: this.hasTouchSupport(),
      
      // 安全能力
      isSecureContext: window.isSecureContext,
      
      // 其他能力
      webAssembly: typeof WebAssembly === 'object',
      es6Modules: this.hasES6Modules()
    };
  }

  // 通过IP获取地理位置
  async getLocationByIP() {
    // 如果已经获取过，直接返回缓存
    if (this.ipLocationFetched) {
      return this.ipLocationCache;
    }

    try {
      // 使用多个免费IP地理位置服务作为备选
      const services = [
        {
          name: 'ipapi.co',
          url: 'https://ipapi.co/json/',
          parser: (data) => ({
            ip: this.maskIP(data.ip),
            country: data.country_name,
            countryCode: data.country_code,
            region: data.region,
            city: data.city,
            latitude: data.latitude,
            longitude: data.longitude,
            timezone: data.timezone,
            isp: data.org,
            source: 'ipapi.co'
          })
        },
        {
          name: 'ip-api.com',
          url: 'http://ip-api.com/json/',
          parser: (data) => ({
            ip: this.maskIP(data.query),
            country: data.country,
            countryCode: data.countryCode,
            region: data.regionName,
            city: data.city,
            latitude: data.lat,
            longitude: data.lon,
            timezone: data.timezone,
            isp: data.isp,
            source: 'ip-api.com'
          })
        },
        {
          name: 'ipinfo.io',
          url: 'https://ipinfo.io/json',
          parser: (data) => {
            const [lat, lon] = (data.loc || '0,0').split(',');
            return {
              ip: this.maskIP(data.ip),
              country: data.country,
              countryCode: data.country,
              region: data.region,
              city: data.city,
              latitude: parseFloat(lat),
              longitude: parseFloat(lon),
              timezone: data.timezone,
              isp: data.org,
              source: 'ipinfo.io'
            };
          }
        }
      ];

      // 尝试各个服务
      for (const service of services) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒超时

          const response = await fetch(service.url, {
            signal: controller.signal,
            cache: 'force-cache' // 使用缓存提高性能
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            const locationInfo = service.parser(data);
            
            this.ipLocationCache = {
              ...locationInfo,
              accuracy: 'city', // IP定位精度为城市级别
              timestamp: Date.now(),
              cached: false
            };
            
            this.ipLocationFetched = true;
            
            console.log(`[Analytics] Location obtained from ${service.name}:`, this.ipLocationCache);
            return this.ipLocationCache;
          }
        } catch (error) {
          console.warn(`[Analytics] Failed to get location from ${service.name}:`, error.message);
          continue;
        }
      }

      // 所有服务都失败，使用时区作为fallback
      const fallbackLocation = this.getFallbackLocationFromTimezone();
      this.ipLocationCache = fallbackLocation;
      this.ipLocationFetched = true;
      
      return fallbackLocation;

    } catch (error) {
      console.warn('[Analytics] IP location detection failed:', error.message);
      
      const fallbackLocation = {
        error: 'IP location unavailable',
        source: 'fallback',
        timezone: this.getTimezone().name,
        timestamp: Date.now()
      };
      
      this.ipLocationCache = fallbackLocation;
      this.ipLocationFetched = true;
      
      return fallbackLocation;
    }
  }

  // 从时区推断大概位置（fallback方案）
  getFallbackLocationFromTimezone() {
    const timezone = this.getTimezone().name;
    
    // 简单的时区到地区映射
    const timezoneRegionMap = {
      'Asia/Shanghai': { country: 'China', region: 'Asia', city: 'Shanghai' },
      'Asia/Beijing': { country: 'China', region: 'Asia', city: 'Beijing' },
      'America/New_York': { country: 'United States', region: 'North America', city: 'New York' },
      'America/Los_Angeles': { country: 'United States', region: 'North America', city: 'Los Angeles' },
      'Europe/London': { country: 'United Kingdom', region: 'Europe', city: 'London' },
      'Europe/Paris': { country: 'France', region: 'Europe', city: 'Paris' },
      'Asia/Tokyo': { country: 'Japan', region: 'Asia', city: 'Tokyo' },
      'Asia/Seoul': { country: 'South Korea', region: 'Asia', city: 'Seoul' }
    };

    const regionInfo = timezoneRegionMap[timezone] || {
      country: 'Unknown',
      region: 'Unknown',
      city: 'Unknown'
    };

    return {
      ...regionInfo,
      timezone: timezone,
      source: 'timezone_fallback',
      accuracy: 'timezone',
      timestamp: Date.now()
    };
  }

  // IP地址脱敏
  maskIP(ip) {
    if (!ip || !this.config.anonymizeIP) return ip;
    
    // IPv4: 保留前三段，最后一段替换为xxx
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
      }
    }
    
    // IPv6: 保留前4段，后面替换为::xxxx
    if (ip.includes(':')) {
      const parts = ip.split(':');
      if (parts.length > 4) {
        return `${parts.slice(0, 4).join(':')}::xxxx`;
      }
    }
    
    return ip;
  }

  // 用户代理脱敏
  maskUserAgent(userAgent) {
    if (!this.config.maskUserAgent) return userAgent;
    
    // 移除版本号等敏感信息
    return userAgent
      .replace(/\d+\.\d+\.\d+/g, 'x.x.x') // 版本号
      .replace(/\b\d{4,}\b/g, 'xxxx'); // 长数字
  }

  // 检查LocalStorage支持
  hasLocalStorage() {
    try {
      const test = 'test';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  // 检查SessionStorage支持
  hasSessionStorage() {
    try {
      const test = 'test';
      sessionStorage.setItem(test, test);
      sessionStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  // 检查IndexedDB支持
  hasIndexedDB() {
    return 'indexedDB' in window;
  }

  // 检查WebGL支持
  hasWebGL() {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch (e) {
      return false;
    }
  }

  // 检查Canvas支持
  hasCanvas() {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext && canvas.getContext('2d'));
    } catch (e) {
      return false;
    }
  }

  // 检查WebRTC支持
  hasWebRTC() {
    return !!(navigator.getUserMedia || navigator.webkitGetUserMedia || 
              navigator.mozGetUserMedia || navigator.msGetUserMedia || 
              (navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
  }

  // 检查触摸支持
  hasTouchSupport() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  // 检查ES6模块支持
  hasES6Modules() {
    try {
      return typeof Symbol !== 'undefined' && typeof Promise !== 'undefined';
    } catch (e) {
      return false;
    }
  }

  // 判断是否为新会话
  isNewSession() {
    const lastActivity = localStorage.getItem('analytics_last_activity');
    if (!lastActivity) return true;

    const now = Date.now();
    const lastTime = parseInt(lastActivity);
    const sessionTimeout = this.config.sessionTimeout || 30 * 60 * 1000; // 30分钟会话超时

    return (now - lastTime) > sessionTimeout;
  }

  // 获取上一个会话ID
  getPreviousSessionId() {
    return localStorage.getItem('analytics_previous_session_id');
  }

  // 获取访问次数
  getVisitCount() {
    const count = localStorage.getItem('analytics_visit_count');
    const newCount = count ? parseInt(count) + 1 : 1;
    localStorage.setItem('analytics_visit_count', newCount.toString());
    return newCount;
  }

  // 判断是否为回访用户
  isReturningVisitor() {
    return localStorage.getItem('analytics_first_visit') !== null;
  }

  // 更新会话信息
  updateSessionInfo(sessionId) {
    localStorage.setItem('analytics_last_activity', Date.now().toString());
    localStorage.setItem('analytics_previous_session_id', sessionId);
    
    if (!localStorage.getItem('analytics_first_visit')) {
      localStorage.setItem('analytics_first_visit', new Date().toISOString());
    }
  }

  // 收集页面性能信息
  collectPerformanceInfo() {
    if (!window.performance || !window.performance.timing) {
      return null;
    }

    const timing = window.performance.timing;
    const navigation = window.performance.navigation;

    return {
      // 页面加载时间
      loadTime: timing.loadEventEnd - timing.navigationStart,
      domContentLoadedTime: timing.domContentLoadedEventEnd - timing.navigationStart,
      
      // 网络时间
      dnsTime: timing.domainLookupEnd - timing.domainLookupStart,
      connectTime: timing.connectEnd - timing.connectStart,
      requestTime: timing.responseStart - timing.requestStart,
      responseTime: timing.responseEnd - timing.responseStart,
      
      // 页面渲染时间
      domReady: timing.domComplete - timing.domLoading,
      
      // 导航类型
      navigationType: navigation.type,
      redirectCount: navigation.redirectCount,
      
      // 收集时间
      collectedAt: Date.now()
    };
  }

  // 获取页面可见性信息
  getVisibilityInfo() {
    return {
      hidden: document.hidden,
      visibilityState: document.visibilityState,
      hasFocus: document.hasFocus(),
      isActive: !document.hidden && document.hasFocus()
    };
  }
} 