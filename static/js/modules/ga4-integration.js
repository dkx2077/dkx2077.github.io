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
        this.errorCount = 0;
        this.maxErrors = 10; // 限制错误发送数量
        
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
                'scholar.google': 'profile',
                'researchgate.net': 'profile',
                'orcid.org': 'profile'
            }
        };
        
        // 数据质量控制
        this.dataValidator = {
            maxStringLength: 500,
            maxParameterCount: 25,
            reservedNames: ['page_title', 'page_location', 'language']
        };
        
        this.init();
    }
    
    async init() {
        try {
            // 等待gtag加载，增加错误处理
            let attempts = 0;
            while (typeof gtag === 'undefined' && attempts < 100) {
                await new Promise(resolve => setTimeout(resolve, 50));
                attempts++;
            }
            
            if (typeof gtag === 'undefined') {
                console.warn('[GA4] Google Analytics not loaded after 5 seconds');
                // 设置fallback gtag函数
                window.gtag = (...args) => {
                    console.warn('[GA4] gtag not available, event not sent:', args);
                };
                return;
            }
            
            this.isInitialized = true;
            this.setupSessionData();
            this.setupUserInteractionDetection();
            this.setupConsentManagement();
            this.processEventQueue();
            
            console.log('[GA4] Integration initialized successfully');
            
            // 发送初始化完成事件
            this.trackEvent('ga4_initialized', {
                initialization_time: Date.now() - performance.navigationStart,
                user_agent_category: this.sessionData.user_agent_category
            });
            
        } catch (error) {
            console.error('[GA4] Initialization failed:', error);
            this.isInitialized = false;
        }
    }
    
    // 设置同意管理
    setupConsentManagement() {
        // 检查用户是否设置了Do Not Track
        if (navigator.doNotTrack === '1' || window.doNotTrack === '1') {
            console.log('[GA4] Do Not Track detected, limited tracking enabled');
            this.trackEvent('consent_status', {
                do_not_track: true,
                consent_given: false
            });
            return;
        }
        
        // 设置默认同意状态
        if (typeof gtag !== 'undefined') {
            gtag('consent', 'default', {
                'analytics_storage': 'granted',
                'functionality_storage': 'granted',
                'personalization_storage': 'denied',
                'security_storage': 'granted'
            });
        }
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
            user_agent_category: this.categorizeUserAgent(),
            referrer: document.referrer || 'direct',
            utm_source: this.getUTMParameter('utm_source'),
            utm_medium: this.getUTMParameter('utm_medium'),
            utm_campaign: this.getUTMParameter('utm_campaign')
        };
        
        // 发送会话开始事件
        this.trackEvent('session_start', {
            ...this.sessionData,
            site_type: 'academic_homepage',
            is_new_visitor: this.isNewVisitor()
        });
        
        // 记录初始部分开始时间
        this.sectionStartTimes[this.currentSection] = Date.now();
        
        // 设置用户属性
        this.setUserProperties({
            user_agent_category: this.sessionData.user_agent_category,
            timezone: this.sessionData.timezone,
            language: this.sessionData.language
        });
    }
    
    // 获取UTM参数
    getUTMParameter(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name) || 'none';
    }
    
    // 检查是否为新访客
    isNewVisitor() {
        const visited = localStorage.getItem('ga4_visited');
        if (!visited) {
            localStorage.setItem('ga4_visited', 'true');
            return true;
        }
        return false;
    }
    
    // 用户交互检测
    setupUserInteractionDetection() {
        const interactionEvents = ['click', 'keydown', 'touchstart'];
        const handleFirstInteraction = () => {
            this.userInteracted = true;
            this.trackEvent('first_user_interaction', {
                interaction_time: Date.now() - new Date(this.sessionData.session_start).getTime(),
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
    
    // 验证事件数据
    validateEventData(eventName, eventParams) {
        const validated = { ...eventParams };
        
        // 限制参数数量
        const paramKeys = Object.keys(validated);
        if (paramKeys.length > this.dataValidator.maxParameterCount) {
            console.warn('[GA4] Too many parameters, truncating');
            const truncated = {};
            paramKeys.slice(0, this.dataValidator.maxParameterCount).forEach(key => {
                truncated[key] = validated[key];
            });
            return truncated;
        }
        
        // 限制字符串长度
        Object.keys(validated).forEach(key => {
            if (typeof validated[key] === 'string' && validated[key].length > this.dataValidator.maxStringLength) {
                validated[key] = validated[key].substring(0, this.dataValidator.maxStringLength - 3) + '...';
            }
        });
        
        return validated;
    }
    
    // 跟踪事件（与现有Analytics系统数据互补）
    trackEvent(eventName, eventParams = {}) {
        if (!this.isInitialized) {
            this.eventQueue.push([eventName, eventParams]);
            return;
        }
        
        try {
            // 验证和清理事件数据
            const validatedParams = this.validateEventData(eventName, eventParams);
            
            // 添加学术网站公共参数
            const enrichedParams = {
                ...validatedParams,
                timestamp: new Date().toISOString(),
                page_location: window.location.href,
                current_section: this.currentSection,
                user_interacted: this.userInteracted,
                session_duration: Date.now() - new Date(this.sessionData.session_start).getTime(),
                
                // 自定义维度映射
                custom_parameter_1: this.currentSection, // academic_section
                custom_parameter_2: 'academic_visitor', // visitor_type
                custom_parameter_3: this.categorizeEngagement(Date.now() - new Date(this.sessionData.session_start).getTime()) // interaction_depth
            };
            
            gtag('event', eventName, enrichedParams);
            
            console.log(`[GA4] Event: ${eventName}`, enrichedParams);
            
        } catch (error) {
            console.error('[GA4] Error sending event:', error);
            this.trackError('event_send_error', error.message);
        }
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
        const contentId = this.generateContentId(publicationTitle);
        
        // 学术内容点击事件
        this.trackEvent('publication_click', {
            publication_type: publicationType,
            publication_title: publicationTitle.substring(0, 100),
            link_url: url,
            link_domain: new URL(url).hostname,
            section: 'publications',
            content_type: publicationType,
            custom_parameter_4: publicationType // publication_type维度
        });
        
        // Enhanced Ecommerce - 将论文视为内容项
        gtag('event', 'select_content', {
            content_type: 'academic_publication',
            content_id: contentId,
            items: [{
                item_id: contentId,
                item_name: publicationTitle.substring(0, 100),
                item_category: 'publication',
                item_category2: publicationType,
                item_category3: this.currentSection,
                item_variant: new URL(url).hostname,
                quantity: 1
            }]
        });
        
        // 如果是重要链接类型，发送转换事件
        if (['journal', 'conference', 'preprint'].includes(publicationType)) {
            this.trackConversion('publication_engagement', 1, {
                publication_type: publicationType,
                engagement_type: 'click'
            });
        }
    }
    
    // 跟踪滚动行为（与现有系统数据互补）
    trackScroll(percentage, section) {
        // 只跟踪重要的滚动里程碑
        const milestones = [25, 50, 75, 100];
        if (milestones.includes(percentage)) {
            const engagementLevel = percentage >= 75 ? 'high' : percentage >= 50 ? 'medium' : 'low';
            
            this.trackEvent('scroll', {
                percent_scrolled: percentage,
                section_name: section || this.currentSection,
                engagement_level: engagementLevel,
                custom_parameter_5: engagementLevel // engagement_level维度
            });
            
            // 100%滚动作为转换事件
            if (percentage === 100) {
                this.trackConversion('full_page_scroll', 1, {
                    section: section || this.currentSection
                });
            }
        }
    }
    
    // 跟踪外部链接点击
    trackExternalLink(url, linkText, context = {}) {
        const domain = new URL(url).hostname;
        const linkCategory = this.categorizeLinkType(url);
        
        this.trackEvent('external_link_click', {
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
            link_classes: linkCategory,
            link_text: linkText.substring(0, 50),
            value: 1
        });
        
        // 学术相关链接的额外追踪
        if (['profile', 'code', 'preprint'].includes(linkCategory)) {
            this.trackEvent('academic_link_click', {
                link_type: linkCategory,
                destination_domain: domain,
                source_section: this.currentSection
            });
        }
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
            search_term: searchTerm.substring(0, 100),
            result_count: resultCount
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
            
            // 表单提交作为转换
            this.trackConversion('form_submission', 1, {
                form_type: formData.form_id
            });
        }
    }
    
    // 跟踪错误（增强版本）
    trackError(errorType, errorMessage, errorContext = {}) {
        if (this.errorCount >= this.maxErrors) {
            return; // 防止错误循环
        }
        
        this.errorCount++;
        
        this.trackEvent('exception', {
            description: `${errorType}: ${errorMessage}`.substring(0, 150),
            fatal: false,
            error_type: errorType,
            section: this.currentSection,
            user_agent_category: this.sessionData.user_agent_category,
            error_count: this.errorCount,
            ...errorContext
        });
    }
    
    // 跟踪性能指标
    trackPerformance(metricName, value, context = {}) {
        this.trackEvent('timing_complete', {
            name: metricName,
            value: Math.round(value),
            section: this.currentSection,
            user_agent_category: this.sessionData.user_agent_category,
            ...context
        });
        
        // 关键性能指标也发送到GA4标准事件
        if (['FCP', 'LCP', 'FID', 'CLS'].includes(metricName)) {
            gtag('event', 'timing_complete', {
                name: metricName,
                value: Math.round(value)
            });
        }
    }
    
    // 跟踪用户参与度里程碑（增强版本）
    trackEngagementMilestone(milestone, data = {}) {
        const sessionDuration = Date.now() - new Date(this.sessionData.session_start).getTime();
        const engagementLevel = this.categorizeEngagement(sessionDuration);
        
        this.trackEvent('engagement_milestone', {
            milestone: milestone,
            session_duration: sessionDuration,
            sections_visited: Object.keys(this.sectionStartTimes).length,
            engagement_level: engagementLevel,
            user_interacted: this.userInteracted,
            custom_parameter_5: engagementLevel, // engagement_level维度
            ...data
        });
        
        // 特定里程碑的转换事件
        if (['1_minute', 'deep_engagement', 'high_value'].includes(milestone)) {
            this.trackConversion('engagement_milestone', 1, {
                milestone_type: milestone,
                engagement_depth: engagementLevel
            });
        }
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
    
    // 设置用户属性（增强版本）
    setUserProperties(properties) {
        try {
            // 验证属性
            const validProperties = {};
            Object.keys(properties).forEach(key => {
                const value = properties[key];
                if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                    validProperties[key] = typeof value === 'string' ? value.substring(0, 36) : value;
                }
            });
            
            gtag('set', 'user_properties', validProperties);
            console.log('[GA4] User properties set:', validProperties);
            
        } catch (error) {
            console.error('[GA4] Error setting user properties:', error);
        }
    }
    
    // 发送转换事件（增强版本）
    trackConversion(conversionName, conversionValue = null, parameters = {}) {
        const eventData = {
            event_category: 'conversion',
            event_label: conversionName,
            section: this.currentSection,
            conversion_id: `${conversionName}_${Date.now()}`,
            ...parameters
        };
        
        if (conversionValue !== null) {
            eventData.value = conversionValue;
            eventData.currency = 'USD'; // 学术网站可以用虚拟货币
        }
        
        this.trackEvent('conversion', eventData);
        
        // 发送标准GA4转换事件
        gtag('event', 'conversion', {
            send_to: this.measurementId,
            value: conversionValue || 1,
            currency: 'USD',
            transaction_id: eventData.conversion_id
        });
    }
    
    // 跟踪学术部分浏览
    trackAcademicSectionView(section) {
        this.trackEvent('academic_section_view', {
            section_name: section,
            view_timestamp: Date.now(),
            visitor_type: 'academic_visitor',
            content_category: 'academic_content',
            custom_parameter_1: section, // academic_section维度
            custom_parameter_2: 'academic_visitor' // visitor_type维度
        });
        
        // Enhanced Ecommerce - 页面/屏幕查看
        gtag('event', 'page_view', {
            page_title: `Academic Section: ${section}`,
            page_location: `${window.location.href}#${section}`,
            content_group1: 'academic_sections',
            content_group2: section,
            custom_parameter_1: section
        });
    }
    
    // 获取会话统计信息
    getSessionStats() {
        return {
            session_duration: Date.now() - new Date(this.sessionData.session_start).getTime(),
            sections_visited: Object.keys(this.sectionStartTimes),
            current_section: this.currentSection,
            user_interacted: this.userInteracted,
            measurement_id: this.measurementId,
            events_sent: this.eventQueue.length,
            errors_occurred: this.errorCount,
            is_initialized: this.isInitialized
        };
    }
    
    // 获取GA4集成健康状态
    getHealthStatus() {
        return {
            gtag_available: typeof gtag !== 'undefined',
            dataLayer_available: typeof window.dataLayer !== 'undefined',
            measurement_id: this.measurementId,
            initialization_status: this.isInitialized,
            error_count: this.errorCount,
            session_data_complete: Object.keys(this.sessionData).length > 0,
            user_interaction_detected: this.userInteracted,
            sections_tracked: Object.keys(this.sectionStartTimes).length,
            queue_size: this.eventQueue.length
        };
    }
    
    // 测试GA4连接
    testGA4Connection() {
        try {
            // 发送测试事件
            this.trackEvent('ga4_connection_test', {
                test_timestamp: Date.now(),
                test_id: Math.random().toString(36).substr(2, 9),
                browser: navigator.userAgent.substring(0, 50),
                connection_test: true
            });
            
            console.log('[GA4] Connection test event sent successfully');
            return true;
            
        } catch (error) {
            console.error('[GA4] Connection test failed:', error);
            return false;
        }
    }
    
    // 验证自定义维度映射
    validateCustomDimensions() {
        const testEvent = {
            custom_parameter_1: 'test_section',
            custom_parameter_2: 'test_visitor_type', 
            custom_parameter_3: 'test_interaction_depth',
            custom_parameter_4: 'test_publication_type',
            custom_parameter_5: 'test_engagement_level'
        };
        
        try {
            this.trackEvent('custom_dimensions_test', testEvent);
            console.log('[GA4] Custom dimensions test sent:', testEvent);
            return true;
        } catch (error) {
            console.error('[GA4] Custom dimensions test failed:', error);
            return false;
        }
    }
    
    // 手动刷新数据（立即发送到GA）
    flush() {
        try {
            // GA4会自动批量发送数据，这里主要用于调试
            this.trackEvent('manual_flush', {
                triggered_at: Date.now(),
                session_stats: this.getSessionStats(),
                flush_reason: 'manual_debug'
            });
            
            console.log('[GA4] Manual flush triggered');
            
        } catch (error) {
            console.error('[GA4] Manual flush failed:', error);
        }
    }
    
    // 导出调试数据
    exportDebugData() {
        return {
            config: {
                measurementId: this.measurementId,
                academicConfig: this.academicConfig,
                dataValidator: this.dataValidator
            },
            runtime: {
                isInitialized: this.isInitialized,
                currentSection: this.currentSection,
                userInteracted: this.userInteracted,
                errorCount: this.errorCount
            },
            session: this.sessionData,
            sections: this.sectionStartTimes,
            health: this.getHealthStatus(),
            stats: this.getSessionStats()
        };
    }
    
    // 销毁实例
    destroy() {
        try {
            // 发送会话结束事件
            this.trackEvent('session_end', {
                session_duration: Date.now() - new Date(this.sessionData.session_start).getTime(),
                sections_visited: Object.keys(this.sectionStartTimes).length,
                final_section: this.currentSection,
                total_errors: this.errorCount,
                user_interacted: this.userInteracted
            });
            
            console.log('[GA4] Integration destroyed');
            
        } catch (error) {
            console.error('[GA4] Error during destruction:', error);
        }
    }
}

// 创建全局实例
const ga4Instance = new GA4Integration();

// 全局调试接口
window.__ga4Debug = {
    getInstance: () => ga4Instance,
    getStats: () => ga4Instance.getSessionStats(),
    getHealth: () => ga4Instance.getHealthStatus(),
    testConnection: () => ga4Instance.testGA4Connection(),
    validateDimensions: () => ga4Instance.validateCustomDimensions(),
    flush: () => ga4Instance.flush(),
    exportData: () => ga4Instance.exportDebugData(),
    
    // 比较GA4与自定义分析
    compareWithCustomAnalytics: () => {
        const ga4Data = ga4Instance.exportDebugData();
        const customData = window.__analytics ? window.__analytics.getSessionStats() : null;
        
        return {
            ga4: ga4Data,
            custom: customData,
            comparison: {
                both_initialized: ga4Data.runtime.isInitialized && (customData !== null),
                session_duration_diff: customData ? Math.abs(ga4Data.stats.session_duration - customData.sessionDuration) : null,
                current_section_match: customData ? ga4Data.runtime.currentSection === customData.currentSection : null
            }
        };
    },
    
    // 发送测试事件序列
    runTestSequence: () => {
        console.log('[GA4 Debug] Starting test sequence...');
        
        // 1. 连接测试
        const connectionOk = ga4Instance.testGA4Connection();
        
        // 2. 自定义维度测试
        const dimensionsOk = ga4Instance.validateCustomDimensions();
        
        // 3. 学术事件测试
        ga4Instance.trackPublicationClick(
            { textContent: 'Test Publication', href: 'https://arxiv.org/abs/test' },
            'https://arxiv.org/abs/test'
        );
        
        // 4. 部分切换测试
        ga4Instance.trackSectionChange('test_from', 'test_to');
        
        // 5. 滚动测试
        ga4Instance.trackScroll(50, 'test_section');
        
        // 6. 参与度里程碑测试
        ga4Instance.trackEngagementMilestone('test_milestone', { test: true });
        
        console.log('[GA4 Debug] Test sequence completed');
        
        return {
            connection_test: connectionOk,
            dimensions_test: dimensionsOk,
            health_status: ga4Instance.getHealthStatus()
        };
    }
};

// 导出供其他模块使用
export default ga4Instance; 