# Google Analytics 4 集成指南

本指南说明如何在Kaixin Deng的个人学术网站上使用已集成的Google Analytics 4 (GA4) 分析系统。

## 📊 系统概述

您的网站现在拥有**双重分析系统**：
- **自定义分析系统**：详细的控制台输出，完整的用户行为追踪
- **Google Analytics 4**：标准的网络分析，与Google生态系统集成

两个系统**协同工作**，互补数据收集，确保完整的分析覆盖。

## 🚀 快速开始

### 测量ID
```
G-KR0MCDLGWW
```

### 访问GA4仪表板
1. 访问 [Google Analytics](https://analytics.google.com/)
2. 选择您的账户和属性
3. 查看实时数据和报告

## 📈 核心功能

### 1. 学术网站特定跟踪

#### 页面部分跟踪
- **首页** (page-top): 个人介绍和概览
- **论文** (publications): 研究成果展示
- **奖项** (awards): 学术成就
- **工作** (service): 正在进行的项目

#### 论文互动跟踪
- 论文链接点击
- 论文类型识别（期刊、会议、预印本等）
- DOI、arXiv、GitHub链接追踪

#### 学术链接分类
- `arxiv.org` → 预印本
- `doi.org` → 期刊文章
- `ieee.org/acm.org` → 会议论文
- `github.com` → 代码仓库
- `scholar.google` → 学术档案

### 2. 用户行为分析

#### 滚动深度跟踪
- 25%、50%、75%、100% 里程碑
- 部分特定的滚动行为

#### 参与度里程碑
- 10秒、30秒、1分钟停留时间
- 部分切换频率分析
- 深度参与度分类

#### 导航行为
- 菜单点击跟踪
- 移动端菜单使用
- 部分间跳转模式

### 3. 性能监控

#### 页面性能
- 页面加载时间
- First Contentful Paint (FCP)
- 长任务检测

#### 用户体验
- 设备类型识别
- 浏览器兼容性
- 网络状态变化

## 🛠️ 调试和测试

### 浏览器开发者工具

#### 查看实时事件
```javascript
// 在浏览器控制台中执行
console.log('GA4实例:', window.__ga4);
console.log('自定义分析:', window.__analytics);

// 查看会话统计
window.__debug.getGA4Stats();
window.__debug.getSessionStats();

// 比较两个分析系统
window.__debug.compareAnalytics();
```

#### 发送测试事件
```javascript
// 发送测试事件到两个系统
window.__debug.trackTestEvent('custom_test', {
  test_parameter: 'test_value',
  timestamp: Date.now()
});

// 手动刷新数据
window.__debug.flushAnalytics();
```

### GA4实时报告检查

在GA4界面的"实时"报告中验证：
1. **实时用户**: 确认访问被记录
2. **事件计数**: 验证自定义事件发送
3. **页面标题和屏幕类别**: 检查页面跟踪
4. **流量来源**: 确认引荐来源

## 📊 自定义事件列表

### 核心事件

| 事件名称 | 描述 | 参数 |
|---------|------|------|
| `session_start` | 会话开始 | 用户信息、设备信息 |
| `page_initialized` | 页面初始化完成 | 加载的部分列表 |
| `section_enter` | 进入新部分 | 部分名称、来源部分 |
| `section_exit` | 离开部分 | 停留时间、参与度级别 |
| `publication_click` | 论文链接点击 | 论文类型、标题、URL |
| `academic_section_view` | 学术部分浏览 | 部分类型、访问者上下文 |

### 互动事件

| 事件名称 | 描述 | 参数 |
|---------|------|------|
| `navigate` | 导航行为 | 导航方法、目标部分 |
| `scroll` | 滚动里程碑 | 滚动百分比、部分名称 |
| `click` | 外部链接点击 | 链接域名、链接类别 |
| `mobile_menu_toggle` | 移动菜单操作 | 操作类型、当前部分 |
| `engagement_milestone` | 参与度里程碑 | 里程碑类型、时间数据 |

### 技术事件

| 事件名称 | 描述 | 参数 |
|---------|------|------|
| `exception` | 错误跟踪 | 错误类型、描述、上下文 |
| `timing_complete` | 性能指标 | 指标名称、数值、上下文 |
| `first_user_interaction` | 首次用户交互 | 交互时间、当前部分 |

## 📈 报告和分析

### 建议的自定义报告

#### 1. 学术内容效果报告
```
维度: academic_section, publication_type
指标: 事件计数, 参与时间, 转换率
```

#### 2. 访问者参与路径
```
维度: section_name, navigation_method
指标: 会话持续时间, 页面深度, 跳出率
```

#### 3. 论文互动分析
```
维度: publication_type, link_domain
指标: 点击次数, 唯一用户, 转换价值
```

### 转换设置

在GA4中设置以下转换事件：

1. **学术参与转换**
   - 事件名称: `engagement_milestone`
   - 条件: milestone = '1_minute'

2. **论文点击转换**
   - 事件名称: `publication_click`
   - 条件: publication_type != 'unknown'

3. **深度浏览转换**
   - 事件名称: `scroll`
   - 条件: percent_scrolled >= 75

## 🔧 配置选项

### HTML配置（已设置）
```javascript
gtag('config', 'G-KR0MCDLGWW', {
  anonymize_ip: true,
  allow_google_signals: false,
  enhanced_measurements: {
    scrolls: true,
    outbound_clicks: true,
    file_downloads: true
  }
});
```

### 隐私设置
- IP匿名化: ✅ 启用
- Google信号: ❌ 禁用
- 广告个性化: ❌ 禁用
- Do Not Track 尊重: ✅ 启用

## 🎯 优化建议

### 1. 受众细分
创建以下受众：
- **高参与度访问者**: 会话时长 > 2分钟
- **论文重度用户**: 论文点击 > 3次
- **移动端访问者**: 设备类别 = 移动设备
- **学术研究者**: 多个学术链接点击

### 2. 目标设置
- **参与度目标**: 平均会话时长 > 1.5分钟
- **内容效果目标**: 论文点击率 > 15%
- **技术性能目标**: 页面加载时间 < 3秒

### 3. 警报配置
设置以下警报：
- 日活跃用户下降 > 20%
- 平均会话时长下降 > 30%
- 错误事件激增 > 5%

## 🔍 故障排除

### 常见问题

#### 1. 事件未显示在GA4中
```javascript
// 检查gtag是否加载
console.log(typeof gtag); // 应该是 'function'

// 检查GA4实例
console.log(window.__ga4.isInitialized); // 应该是 true

// 检查最近的事件
window.__ga4.getSessionStats();
```

#### 2. 自定义参数未传递
确保在GA4界面中配置了自定义维度：
- `academic_section` → 自定义维度1
- `visitor_type` → 自定义维度2
- `interaction_depth` → 自定义维度3

#### 3. 实时数据延迟
GA4实时数据可能有几分钟延迟，这是正常的。

### 调试命令

```javascript
// 完整的调试信息
console.group('🔍 GA4 调试信息');
console.log('初始化状态:', window.__ga4?.isInitialized);
console.log('当前部分:', window.__ga4?.currentSection);
console.log('用户已交互:', window.__ga4?.userInteracted);
console.log('会话统计:', window.__ga4?.getSessionStats());
console.groupEnd();

// 发送测试转换事件
window.__ga4?.trackConversion('test_conversion', 1);

// 手动触发GA4数据刷新
window.__ga4?.flush();
```

## 📱 移动端优化

### 特殊考虑
- 移动菜单交互追踪
- 触摸事件优化
- 小屏幕滚动行为
- 移动网络性能监控

## 🚀 高级功能

### 1. A/B测试集成
可以与Google Optimize集成进行A/B测试

### 2. 电子商务跟踪
论文被视为"产品"，可以设置虚拟电子商务跟踪

### 3. 自定义指标
创建计算指标来测量学术参与度

## 📞 支持

如果遇到问题，请检查：
1. 浏览器控制台错误信息
2. GA4实时报告
3. 网络请求是否成功发送到analytics.google.com

---

*最后更新: 2024年12月*
*测量ID: G-KR0MCDLGWW*
*集成版本: 1.0* 