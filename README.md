# Kaixin Deng 的个人主页

GitHub Pages 托管的静态学术主页。内容使用 Markdown 维护，构建时生成完整 HTML；浏览器不需要解析 Markdown、加载配置或等待统计服务，即可阅读全部正文。

## 本地运行

需要 Node.js 22+ 和 npm；预览命令另外使用 Python 3。

```bash
npm ci
npm test
npm run build
npm run serve
```

打开 `http://localhost:8000`。`dist/` 是可重新生成的部署产物，不要直接编辑。构建后双击 `dist/index.html` 也可阅读内容；统计只在配置的正式域名运行。

## 文件职责

| 文件                          | 职责                                             |
| ----------------------------- | ------------------------------------------------ |
| `contents/config.yml`         | 标题、停更说明、正式网址、Umami Website ID       |
| `contents/*.md`               | 个人介绍、论文、奖项和现有工作内容               |
| `templates/index.html`        | 页面结构、标题层级、导航和元数据                 |
| `scripts/build.mjs`           | 渲染 Markdown，生成稳定的事件标记和部署产物      |
| `static/css/main.css`         | 桌面、手机、打印和减少动态效果的样式             |
| `static/js/navigation.js`     | 当前栏目高亮；不依赖统计服务                     |
| `static/js/analytics.js`      | Umami 加载及三种点击事件                         |
| `static/js/math.js`           | 仅在内容包含公式时加载 MathJax                   |
| `tests/homepage.test.mjs`     | 静态页面、事件分类、拒绝追踪和失败降级的回归测试 |
| `.github/workflows/pages.yml` | PR 检查；master 构建并部署 `dist/`               |

浏览器端没有 Bootstrap、Google Fonts、Markdown/YAML 解析器或旧版兼容脚本。原有横幅图片与蓝色视觉风格保留。导航直接显示并自动换行，避免菜单脚本失效后无法导航。正文、论文与联系链接在禁用 JavaScript 时仍可使用。

## 接入 Umami Cloud

1. 在自己的 Umami Cloud 账户创建网站，域名填写 `www.dengkaixin.com`。
2. 打开该网站的 **Tracking code**，复制 `data-website-id` 中的 UUID。这是公开网站标识，不是 API Key、密码或登录令牌。
3. 在 `contents/config.yml` 的 `umami-website-id` 中填入该值。也可设置 GitHub 仓库 Actions variable `UMAMI_WEBSITE_ID`，它优先于文件配置。
4. 合并修改后，Actions 只部署生成的 `dist/`，不会上传开发依赖、测试或源配置。
5. 在正式主页进行一次访问和一次目标链接点击，在 Umami 的实时页及 Events 中核对。

缺少 ID 时，本地和 PR 构建不加载统计。正式部署会明确失败并保留上一版线上页面，避免误认为迁移已启用。UUID 格式检查不能证明该 ID 属于正确账户，仍需后台核验。更换正式域名时同时修改 `CNAME`、`config.yml` 的 `url` 和 Umami 网站配置。

官方脚本：`https://cloud.umami.is/script.js`。不代理、不绕过广告拦截器，不自建事件队列或模拟“发送成功”。脚本加载之前或被拦截时的点击不会补报；浏览器追踪本身也不是完整的服务器访问日志。

参考：[安装追踪代码](https://docs.umami.is/docs/collect-data)、[追踪配置](https://docs.umami.is/docs/tracker-configuration)、[事件接口](https://docs.umami.is/docs/tracker-functions)。

## 唯一启用的指标与事件

基础浏览、访客、来源、设备和国家/地区由 Umami 自身处理。页面浏览由官方脚本自动记录，本站不手动重复发送。不采集 URL 查询参数或栏目 hash；当前“来源”指引荐来源，不包含 UTM 营销归因。

| 自定义事件          | 参数                                    | 何时触发                                           |
| ------------------- | --------------------------------------- | -------------------------------------------------- |
| `publication_click` | `publication_id`, `link_type`           | 点击某篇论文的出版页、预印本、项目、代码或专利链接 |
| `profile_click`     | `platform`: `google_scholar` / `github` | 点击 Kaixin 的 Google Scholar 或 GitHub 个人主页   |
| `contact_click`     | 无                                      | 点击邮箱链接；不表示已发送邮件                     |

`link_type` 枚举：`paper`、`preprint`、`project`、`code`、`patent`。不发送邮箱地址、完整点击 URL、论文全文或访客标识作为自定义参数。页脚仓库、License、导航、滚动、停留、错误、性能和键盘操作都不产生自定义事件。没有会话回放、热图或身份识别调用。

支持触摸点击、键盘激活、普通点击及鼠标中键；不拦截链接默认行为，不等待统计才跳转。每次实际点击记一次，不把“点击一次”和“去重访客”混为一谈。

### 论文维护

每篇论文之前保留一个独立且稳定的标识：

```markdown
<!-- publication: supergpqa -->

**论文标题**

[Paper ↗](https://neurips.cc/virtual/2025/poster/121825) |
[Code ↗](https://github.com/SuperGPQA/SuperGPQA)
```

重排论文或修改标题时不要更改标识，否则报表会分成两个条目。不要复用相同标识。代码链接通过 `github.com`、预印本通过 `arxiv.org`、项目通过 `*.github.io`、专利通过 `xueshu.baidu.com` 分类，其余默认为 `paper`。新增其他平台时修改 `classifyLink` 并补充对应测试。

Markdown 支持原有可信 HTML 标签，例如会议徽章；源文件应仅由仓库维护者编辑，不应用作接收不可信访客输入的系统。公式仍支持 `$...$` 和 `$$...$$`，仅有公式的构建才引用 MathJax，正文不依赖公式脚本完成加载。

## 隐私与排除自己的访问

开启浏览器 DNT 时，在加载 Umami 前退出。支持 Umami 的 `umami.disabled` 本地排除标记，设置方法见 [官方说明](https://docs.umami.is/docs/exclude-my-own-visits)。预览域名和 localhost 默认不统计。

本站移除了自定义 IP 地理查询、设备详情采集、离线事件队列、缓存清空逻辑和 GA4。不会为了版本更新清除访客其他浏览器数据。

## 验证范围

`npm test` 不访问真实 Umami，不污染生产统计；覆盖完整 HTML、所有 11 篇论文和 24 个已标记链接、唯一 ID、锚点、事件参数、中键/嵌套点击、DNT、本地排除、存储权限异常、统计失败和长栏目高亮。

布局包含窄屏断点、可换行长链接、44px 导航点击高度和减少动态效果支持。自动 DOM 测试不等于真实手机/桌面视觉验收；发布前仍可在 Safari、Chrome、Firefox 中检查 320px、390px、768px、1440px 和 200% 文字缩放。Umami 实际入库需要配置真实 Website ID 后核验。

## License

[MIT](LICENSE)
