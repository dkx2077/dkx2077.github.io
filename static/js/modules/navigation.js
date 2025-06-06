// 导航模块
import { SCROLL_SPY_CONFIG } from './config.js';

// 全局导航状态
let currentSection = 'page-top';
let analytics = null;
let ga4Instance = null; // 添加GA4实例引用

export function initNavigation() {
  initScrollSpy();
  initResponsiveMenu();
  initSectionTracking();
  
  // 尝试获取GA4实例
  if (window.__ga4) {
    ga4Instance = window.__ga4;
  }
  
  console.log('[Navigation] Navigation module initialized');
}

// 设置统计实例（由main.js调用）
export function setAnalyticsInstance(analyticsInstance) {
  analytics = analyticsInstance;
}

// 设置GA4实例（新增功能）
export function setGA4Instance(ga4InstanceRef) {
  ga4Instance = ga4InstanceRef;
}

function initScrollSpy() {
  const nav = document.querySelector('#mainNav');
  if (nav && window.bootstrap) {
    new bootstrap.ScrollSpy(document.body, SCROLL_SPY_CONFIG);
    console.log('[Navigation] ScrollSpy initialized');
  }
}

function initResponsiveMenu() {
  const toggler = document.querySelector('.navbar-toggler');
  const navLinks = document.querySelectorAll('#navbarResponsive .nav-link');

  // 为导航链接添加点击追踪
  navLinks.forEach(link => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');
      const text = link.textContent.trim();
      
      // 追踪导航点击（同时发送到两个系统）
      trackNavigationClick(text, href, currentSection);
      
      // 响应式菜单处理
      if (toggler && getComputedStyle(toggler).display !== 'none') {
        setTimeout(() => {
          toggler.click();
          
          // 追踪菜单折叠（同时发送到两个系统）
          const collapseData = {
            trigger: 'nav_click',
            targetSection: href,
            timestamp: Date.now()
          };
          
          if (analytics) {
            analytics.trackCustomEvent('mobile_menu_collapse', collapseData);
          }
          
          if (ga4Instance) {
            ga4Instance.trackEvent('mobile_menu_collapse', collapseData);
          }
        }, 100); // 小延迟确保导航先执行
      }
    });
  });

  // 追踪移动端菜单展开/折叠
  if (toggler) {
    toggler.addEventListener('click', () => {
      const isExpanded = toggler.getAttribute('aria-expanded') === 'true';
      
      const toggleData = {
        action: isExpanded ? 'collapse' : 'expand',
        currentSection: currentSection,
        timestamp: Date.now()
      };
      
      // 发送到自定义分析
      if (analytics) {
        analytics.trackCustomEvent('mobile_menu_toggle', toggleData);
      }
      
      // 发送到GA4
      if (ga4Instance) {
        ga4Instance.trackEvent('mobile_menu_toggle', toggleData);
      }
    });
  }

  console.log('[Navigation] Responsive menu initialized');
}

// 初始化部分追踪
function initSectionTracking() {
  // 使用Intersection Observer追踪部分可见性
  if ('IntersectionObserver' in window) {
    const sections = document.querySelectorAll('section[id]');
    
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
          const newSection = entry.target.id;
          
          if (newSection !== currentSection) {
            const previousSection = currentSection;
            currentSection = newSection;
            
            // 追踪部分变化（同时发送到两个系统）
            trackSectionChange(previousSection, newSection);
            
            // 更新活跃导航项
            updateActiveNavItem(newSection);
            
            // 同步GA4实例的当前部分
            if (ga4Instance) {
              ga4Instance.currentSection = newSection;
            }
          }
        }
      });
    }, {
      threshold: [0.3, 0.5, 0.7], // 多个阈值提高准确性
      rootMargin: '-20% 0px -20% 0px' // 上下20%边距
    });
    
    sections.forEach(section => {
      sectionObserver.observe(section);
    });
    
    console.log('[Navigation] Section tracking initialized');
  }
  
  // 备用方案：滚动事件监听
  else {
    window.addEventListener('scroll', throttle(() => {
      detectCurrentSection();
    }, 100));
    
    console.log('[Navigation] Fallback scroll tracking initialized');
  }
}

// 检测当前部分（备用方案）
function detectCurrentSection() {
  const sections = ['page-top', 'publications', 'awards', 'service'];
  let detectedSection = 'page-top';
  
  const scrollTop = window.scrollY;
  const windowHeight = window.innerHeight;
  
  for (const sectionId of sections) {
    const element = document.getElementById(sectionId);
    if (element) {
      const rect = element.getBoundingClientRect();
      const elementTop = rect.top + scrollTop;
      
      if (elementTop <= scrollTop + windowHeight / 2) {
        detectedSection = sectionId;
      }
    }
  }
  
  if (detectedSection !== currentSection) {
    const previousSection = currentSection;
    currentSection = detectedSection;
    trackSectionChange(previousSection, detectedSection);
    updateActiveNavItem(detectedSection);
    
    // 同步GA4实例的当前部分
    if (ga4Instance) {
      ga4Instance.currentSection = detectedSection;
    }
  }
}

// 追踪导航点击（增强版本）
function trackNavigationClick(linkText, href, fromSection) {
  console.log(`[Navigation] Navigation click: ${linkText} (${href}) from ${fromSection}`);
  
  const clickData = {
    linkText: linkText,
    href: href,
    fromSection: fromSection,
    timestamp: Date.now(),
    clickType: 'navigation_menu'
  };
  
  // 发送到自定义分析
  if (analytics) {
    analytics.trackCustomEvent('navigation_click', clickData);
  }
  
  // 发送到GA4（使用学术网站特定的事件结构）
  if (ga4Instance) {
    ga4Instance.trackEvent('navigate', {
      ...clickData,
      navigation_method: 'menu_click',
      academic_section: href.replace('#', ''),
      visitor_type: 'academic_visitor'
    });
  }
}

// 追踪部分变化（增强版本）
function trackSectionChange(fromSection, toSection) {
  console.log(`[Navigation] Section change: ${fromSection} -> ${toSection}`);
  
  const changeData = {
    fromSection: fromSection,
    toSection: toSection,
    timestamp: Date.now(),
    changeMethod: 'scroll_detection'
  };
  
  // 发送到自定义分析
  if (analytics) {
    analytics.trackSectionChange(fromSection, toSection);
  }
  
  // 发送到GA4（不直接调用，因为GA4Integration自己有trackSectionChange方法）
  // GA4的部分变化跟踪将通过main.js中的事件监听器处理
  
  // 发送自定义事件供其他模块监听
  window.dispatchEvent(new CustomEvent('section-change', {
    detail: changeData
  }));
  
  // 追踪学术网站特定的部分参与度
  trackAcademicSectionEngagement(toSection);
}

// 追踪学术网站特定的部分参与度（新增功能）
function trackAcademicSectionEngagement(sectionId) {
  const academicSections = {
    'page-top': 'home_intro',
    'publications': 'research_output',
    'awards': 'achievements',
    'service': 'ongoing_work'
  };
  
  const engagementData = {
    section_type: academicSections[sectionId] || 'unknown',
    section_id: sectionId,
    visitor_context: 'academic_browsing',
    timestamp: Date.now()
  };
  
  // 发送到GA4
  if (ga4Instance) {
    ga4Instance.trackEvent('academic_section_view', engagementData);
  }
  
  // 发送到自定义分析
  if (analytics) {
    analytics.trackCustomEvent('academic_section_engagement', engagementData);
  }
}

// 更新活跃导航项
function updateActiveNavItem(sectionId) {
  const navLinks = document.querySelectorAll('#navbarResponsive .nav-link');
  
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    const isActive = href === `#${sectionId}`;
    
    link.classList.toggle('active', isActive);
    
    // 更新aria-current属性
    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
  
  // 追踪活跃导航项变化
  const activeNavData = {
    active_section: sectionId,
    navigation_state: 'updated',
    timestamp: Date.now()
  };
  
  // 发送到GA4
  if (ga4Instance) {
    ga4Instance.trackEvent('nav_state_change', activeNavData);
  }
}

// 获取当前部分
export function getCurrentSection() {
  return currentSection;
}

// 手动设置当前部分
export function setCurrentSection(sectionId) {
  const previousSection = currentSection;
  currentSection = sectionId;
  
  if (previousSection !== sectionId) {
    trackSectionChange(previousSection, sectionId);
    updateActiveNavItem(sectionId);
    
    // 同步GA4实例的当前部分
    if (ga4Instance) {
      ga4Instance.currentSection = sectionId;
    }
  }
}

// 滚动到指定部分（增强版本）
export function scrollToSection(sectionId, behavior = 'smooth') {
  const section = document.getElementById(sectionId);
  if (section) {
    // 考虑固定导航栏的高度
    const navHeight = document.querySelector('#mainNav')?.offsetHeight || 0;
    const targetPosition = section.offsetTop - navHeight;
    
    window.scrollTo({
      top: targetPosition,
      behavior: behavior
    });
    
    // 追踪程序化滚动（同时发送到两个系统）
    const scrollData = {
      targetSection: sectionId,
      fromSection: currentSection,
      behavior: behavior,
      timestamp: Date.now(),
      scrollType: 'programmatic'
    };
    
    if (analytics) {
      analytics.trackCustomEvent('programmatic_scroll', scrollData);
    }
    
    if (ga4Instance) {
      ga4Instance.trackEvent('programmatic_scroll', {
        ...scrollData,
        navigation_method: 'api_call',
        academic_section: sectionId
      });
    }
  }
}

// 追踪用户在当前部分的停留时间（新增功能）
let sectionStartTime = Date.now();
let engagementTimer = null;

function startSectionEngagementTimer(sectionId) {
  sectionStartTime = Date.now();
  
  // 清除之前的计时器
  if (engagementTimer) {
    clearTimeout(engagementTimer);
  }
  
  // 设置参与度里程碑检查
  const checkEngagementMilestones = () => {
    const timeSpent = Date.now() - sectionStartTime;
    const seconds = Math.round(timeSpent / 1000);
    
    // 10秒参与度里程碑
    if (seconds === 10) {
      trackEngagementMilestone(sectionId, '10_seconds', timeSpent);
    }
    
    // 30秒参与度里程碑
    if (seconds === 30) {
      trackEngagementMilestone(sectionId, '30_seconds', timeSpent);
    }
    
    // 60秒参与度里程碑
    if (seconds === 60) {
      trackEngagementMilestone(sectionId, '1_minute', timeSpent);
    }
    
    // 继续监控（最多5分钟）
    if (seconds < 300) {
      engagementTimer = setTimeout(checkEngagementMilestones, 1000);
    }
  };
  
  engagementTimer = setTimeout(checkEngagementMilestones, 1000);
}

function trackEngagementMilestone(sectionId, milestone, timeSpent) {
  const milestoneData = {
    section: sectionId,
    milestone: milestone,
    time_spent_ms: timeSpent,
    engagement_level: categorizeEngagement(timeSpent),
    timestamp: Date.now()
  };
  
  // 发送到自定义分析
  if (analytics) {
    analytics.trackCustomEvent('section_engagement_milestone', milestoneData);
  }
  
  // 发送到GA4
  if (ga4Instance) {
    ga4Instance.trackEngagementMilestone(milestone, {
      ...milestoneData,
      academic_section: sectionId
    });
  }
}

function categorizeEngagement(timeSpent) {
  const seconds = timeSpent / 1000;
  if (seconds < 10) return 'very_low';
  if (seconds < 30) return 'low';
  if (seconds < 60) return 'medium';
  if (seconds < 300) return 'high';
  return 'very_high';
}

// 修改trackSectionChange以启动参与度计时器
const originalTrackSectionChange = trackSectionChange;
trackSectionChange = function(fromSection, toSection) {
  // 调用原始函数
  originalTrackSectionChange(fromSection, toSection);
  
  // 启动新部分的参与度计时器
  startSectionEngagementTimer(toSection);
};

// 工具函数：节流
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// 导出供外部使用的接口（增强版本）
export const navigationAPI = {
  getCurrentSection,
  setCurrentSection,
  scrollToSection,
  setAnalyticsInstance,
  setGA4Instance, // 新增GA4实例设置
  getEngagementStats: () => ({
    currentSection,
    sectionStartTime,
    timeInCurrentSection: Date.now() - sectionStartTime
  })
}; 