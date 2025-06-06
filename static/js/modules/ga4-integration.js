// Google Analytics 4 集成模块 - 与现有Analytics系统协同工作
export class GA4Integration {
    constructor(measurementId = 'G-KR0MCDLGWW') {
        this.measurementId = measurementId;
        this.isInitialized = false;
        this.eventQueue = [];
        this.sessionData = {};
        this.currentSection = 'page-top';
        this.sectionStartTimes = {};
        this.userInteracted = false;
        
        // 学术网站特定配置
        this.academicConfig = {
            publicationTypes: ['journal', 'conference', 'preprint', 'thesis', 'book'],
            sections: ['home', 'publications', 'awards', 'service'],
            linkTypes: {
                'arxiv.org': 'preprint',
                'doi.org': 'journal',
                'ieee.org': 'conference',
                'acm.org': 'conference',
                'github.com': 'code',
                'scholar.google': 'profile'
            }
        };
        
        this.init();
    }
    
    async init() {
        // 等待gtag加载
        let attempts = 0;
        while (typeof gtag === 'undefined' && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (typeof gtag === 'undefined') {
            console.warn('[GA4] Google Analytics not loaded after 5 seconds');
            return;
        }
        
        this.isInitialized = true;
        this.setupSessionData();
        this.setupUserInteractionDetection();
        this.processEventQueue();
        
        console.log('[GA4] Integration initialized successfully');
    }
    
    // 设置会话数据
    setupSessionData() {
        this.sessionData = {
            session_start: new Date().toISOString(),
            page_title: document.title,
            page_location: window.location.href,
            language: navigator.language,
            screen_resolution: `${screen.width}x${screen.height}`,
            viewport_size: `${window.innerWidth}x${window.innerHeight}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            user_agent_category: this.categorizeUserAgent()
        };
        
        // 发送会话开始事件
        this.trackEvent('session_start', {
            ...this.sessionData,
            site_type: 'academic_homepage'
        });
        
        // 记录初始部分开始时间
        this.sectionStartTimes[this.currentSection] = Date.now();
    }
    
    // 用户交互检测
    setupUserInteractionDetection() {
        const interactionEvents = ['click', 'keydown', 'touchstart'];
        const handleFirstInteraction = () => {
            this.userInteracted = true;
            this.trackEvent('first_user_interaction', {
                interaction_time: Date.now() - this.sessionData.session_start,
                current_section: this.currentSection
            });
            
            // 移除监听器
            interactionEvents.forEach(event => {
                document.removeEventListener(event, handleFirstInteraction);
            });
        };
        
        interactionEvents.forEach(event => {
            document.addEventListener(event, handleFirstInteraction, { once: true, passive: true });
        });
    }
    
    // 分类用户代理
    categorizeUserAgent() {
        const ua = navigator.userAgent.toLowerCase();
        if (ua.includes('mobile')) return 'mobile';
        if (ua.includes('tablet')) return 'tablet';
        if (ua.includes('bot') || ua.includes('crawl')) return 'bot';
        return 'desktop';
    }
    
    // 跟踪事件（与现有Analytics系统数据互补）
    trackEvent(eventName, eventParams = {}) {
        if (!this.isInitialized) {
            this.eventQueue.push([eventName, eventParams]);
            return;
        }
        
        // 添加学术网站公共参数
        const enrichedParams = {
            ...eventParams,
            timestamp: new Date().toISOString(),
            page_location: window.location.href,
            current_section: this.currentSection,
            user_interacted: this.userInteracted,
            session_duration: Date.now() - new Date(this.sessionData.session_start).getTime()
        };
        
        gtag('event', eventName, enrichedParams);
        
        console.log(`[GA4] Event: ${eventName}`, enrichedParams);
    }
    
    // 跟踪页面部分变化（与现有系统协同）
    trackSectionChange(fromSection, toSection) {
        // 计算在前一个部分的停留时间
        const timeSpent = this.sectionStartTimes[fromSection] 
            ? Date.now() - this.sectionStartTimes[fromSection] 
            : 0;
        
        // 发送部分离开事件
        if (fromSection && timeSpent > 0) {
            this.trackEvent('section_exit', {
                section_name: fromSection,
                time_spent_seconds: Math.round(timeSpent / 1000),
                engagement_level: this.categorizeEngagement(timeSpent)
            });
        }
        
        // 更新当前部分
        this.currentSection = toSection;
        this.sectionStartTimes[toSection] = Date.now();
        
        // 发送部分进入事件
        this.trackEvent('section_enter', {
            section_name: toSection,
            from_section: fromSection,
            navigation_method: 'internal_link'
        });
        
        // 发送导航事件
        this.trackEvent('navigate', {
            from: fromSection,
            to: toSection,
            academic_section: toSection,
            visitor_type: 'academic_visitor'
        });
    }
    
    // 跟踪论文相关点击
    trackPublicationClick(element, url) {
        const publicationType = this.identifyPublicationType(url);
        const publicationTitle = this.extractPublicationTitle(element);
        
        this.trackEvent('publication_click', {
            publication_type: publicationType,
            publication_title: publicationTitle.substring(0, 100),
            link_url: url,
            link_domain: new URL(url).hostname,
            section: 'publications',
            content_type: publicationType
        });
        
        // 发送标准GA4电商事件（将论文视为内容项）
        gtag('event', 'select_content', {
            content_type: 'academic_publication',
            content_id: this.generateContentId(publicationTitle),
            items: [{
                item_id: this.generateContentId(publicationTitle),
                item_name: publicationTitle.substring(0, 100),
                item_category: 'publication',
                item_category2: publicationType,
                item_variant: this.currentSection
            }]
        });
    }
    
    // 跟踪滚动行为（与现有系统数据互补）
    trackScroll(percentage, section) {
        // 只跟踪重要的滚动里程碑
        const milestones = [25, 50, 75, 100];
        if (milestones.includes(percentage)) {
            this.trackEvent('scroll', {
                percent_scrolled: percentage,
                section_name: section || this.currentSection,
                engagement_level: percentage >= 75 ? 'high' : percentage >= 50 ? 'medium' : 'low'
            });
        }
    }
    
    // 跟踪外部链接点击
    trackExternalLink(url, linkText, context = {}) {
        const domain = new URL(url).hostname;
        const linkCategory = this.categorizeLinkType(url);
        
        this.trackEvent('click', {
            link_domain: domain,
            link_url: url,
            link_text: linkText.substring(0, 100),
            link_category: linkCategory,
            outbound: true,
            current_section: this.currentSection,
            ...context
        });
        
        // 发送标准GA4外部链接事件
        gtag('event', 'click', {
            event_category: 'outbound_link',
            event_label: domain,
            value: 1
        });
    }
    
    // 跟踪搜索行为（如果有搜索功能）
    trackSearch(searchTerm, resultCount = 0) {
        this.trackEvent('search', {
            search_term: searchTerm.substring(0, 100),
            search_result_count: resultCount,
            section: this.currentSection
        });
        
        // 发送标准GA4搜索事件
        gtag('event', 'search', {
            search_term: searchTerm.substring(0, 100)
        });
    }
    
    // 跟踪表单交互
    trackFormInteraction(formAction, formElement) {
        const formData = {
            form_action: formAction,
            form_id: formElement.id || 'unnamed_form',
            form_fields: formElement.elements.length,
            section: this.currentSection
        };
        
        this.trackEvent('form_interaction', formData);
        
        if (formAction === 'submit') {
            gtag('event', 'form_submit', {
                form_id: formData.form_id,
                form_destination: formElement.action || 'unknown'
            });
        }
    }
    
    // 跟踪错误（与现有系统互补）
    trackError(errorType, errorMessage, errorContext = {}) {
        this.trackEvent('exception', {
            description: `${errorType}: ${errorMessage}`.substring(0, 150),
            fatal: false,
            error_type: errorType,
            section: this.currentSection,
            user_agent_category: this.sessionData.user_agent_category,
            ...errorContext
        });
    }
    
    // 跟踪性能指标
    trackPerformance(metricName, value, context = {}) {
        this.trackEvent('timing_complete', {
            name: metricName,
            value: Math.round(value),
            section: this.currentSection,
            ...context
        });
    }
    
    // 跟踪用户参与度里程碑
    trackEngagementMilestone(milestone, data = {}) {
        this.trackEvent('engagement_milestone', {
            milestone: milestone,
            session_duration: Date.now() - new Date(this.sessionData.session_start).getTime(),
            sections_visited: Object.keys(this.sectionStartTimes).length,
            ...data
        });
    }
    
    // 工具方法：识别出版物类型
    identifyPublicationType(url) {
        for (const [domain, type] of Object.entries(this.academicConfig.linkTypes)) {
            if (url.includes(domain)) {
                return type;
            }
        }
        return 'unknown';
    }
    
    // 工具方法：提取出版物标题
    extractPublicationTitle(element) {
        // 尝试多种方式提取标题
        return element.textContent || 
               element.title || 
               element.getAttribute('aria-label') || 
               'Unknown Publication';
    }
    
    // 工具方法：生成内容ID
    generateContentId(title) {
        return title.toLowerCase()
                   .replace(/[^a-z0-9\s]/g, '')
                   .replace(/\s+/g, '_')
                   .substring(0, 50);
    }
    
    // 工具方法：分类链接类型
    categorizeLinkType(url) {
        const domain = url.toLowerCase();
        if (domain.includes('github')) return 'code_repository';
        if (domain.includes('scholar.google')) return 'academic_profile';
        if (domain.includes('linkedin')) return 'professional_profile';
        if (domain.includes('arxiv')) return 'preprint';
        if (domain.includes('doi.org')) return 'journal_article';
        if (domain.includes('ieee') || domain.includes('acm')) return 'conference_paper';
        return 'general';
    }
    
    // 工具方法：分类参与度
    categorizeEngagement(timeSpent) {
        const seconds = timeSpent / 1000;
        if (seconds < 10) return 'very_low';
        if (seconds < 30) return 'low';
        if (seconds < 120) return 'medium';
        if (seconds < 300) return 'high';
        return 'very_high';
    }
    
    // 处理事件队列
    processEventQueue() {
        while (this.eventQueue.length > 0) {
            const [eventName, eventParams] = this.eventQueue.shift();
            this.trackEvent(eventName, eventParams);
        }
    }
    
    // 设置用户属性
    setUserProperty(propertyName, propertyValue) {
        gtag('set', 'user_properties', {
            [propertyName]: propertyValue
        });
    }
    
    // 发送转换事件
    trackConversion(conversionName, conversionValue = null, parameters = {}) {
        const eventData = {
            event_category: 'conversion',
            event_label: conversionName,
            section: this.currentSection,
            ...parameters
        };
        
        if (conversionValue !== null) {
            eventData.value = conversionValue;
        }
        
        this.trackEvent('conversion', eventData);
    }
    
    // 获取会话统计信息
    getSessionStats() {
        return {
            session_duration: Date.now() - new Date(this.sessionData.session_start).getTime(),
            sections_visited: Object.keys(this.sectionStartTimes),
            current_section: this.currentSection,
            user_interacted: this.userInteracted,
            measurement_id: this.measurementId
        };
    }
    
    // 手动刷新数据（立即发送到GA）
    flush() {
        // GA4会自动批量发送数据，这里主要用于调试
        this.trackEvent('manual_flush', {
            triggered_at: Date.now(),
            session_stats: this.getSessionStats()
        });
    }
    
    // 销毁实例
    destroy() {
        // 发送会话结束事件
        this.trackEvent('session_end', {
            session_duration: Date.now() - new Date(this.sessionData.session_start).getTime(),
            sections_visited: Object.keys(this.sectionStartTimes).length,
            final_section: this.currentSection
        });
        
        console.log('[GA4] Integration destroyed');
    }
}

// 创建全局实例
const ga4Instance = new GA4Integration();

// 导出供其他模块使用
export default ga4Instance; 