# 雨水与反射实现

2026-09-05。目标是固定观察点的霓虹街区中，局部积水映出实际建筑与灯管；不把整个广场变成明亮镜面，不引入 React/WebGPU 迁移，也不增加纹理下载。

## 开源方案检索

| 方案与官方来源 | 特点 / 本项目取舍 |
| --- | --- |
| [Three.js Reflector](https://threejs.org/docs/pages/Reflector.html) | 原生平面镜像相机，可捕获镜面视角中的场景几何。已有 r185 依赖，选用一个共享目标加自定义水面 shader。 |
| [Three.js Water](https://threejs.org/docs/pages/Water.html) | 内置水面、法线扰动和反射，默认更偏连续水域；小块浅积水需要不同轮廓和表现。 |
| [Three.js SSRPass](https://threejs.org/docs/pages/SSRPass.html) | 屏幕空间追踪依赖当前深度、法线与画面，可处理非平面反射，但有多次绘制和屏外信息限制；本场景水面同高，平面捕获更直接。 |
| [Drei MeshReflectorMaterial](https://drei.docs.pmnd.rs/shaders/mesh-reflector-material) | 有模糊、深度及粗糙度控制；属于 React Three Fiber 生态，不为这个原生 Three.js 网站引入另一套组件栈。 |
| [realism-effects](https://github.com/0beqz/realism-effects) | 有 SSGI/SSR 等高级效果；检索到的 package.json v1.1.2 声明 Three `^0.151.3` 与另一套 postprocessing 栈，不作为 r185 原生 EffectComposer 的直接替换。 |

以上成本比较来自官方文档与源码结构，不是本项目 GPU 基准成绩。只使用已有 Three.js 的 MIT 许可 addon；没有复制第三方示例 shader 或安装上述其余库。第三方许可保留在 `THIRD_PARTY_NOTICES.md`。

## 渲染结构

- `puddles.mjs` 把少量水滩四边形合为单个 BufferGeometry、单材质、单 Reflector。每块各有局部 UV，不规则噪声轮廓在片元阶段裁切。面朝上，高于地面及阴影层，关闭深度写入，保留深度测试。
- High：共享 512 × 512、无 MSAA 的目标；支持浮点颜色附件时使用线性 HDR HalfFloat，否则退回 UnsignedByte。捕获不运行泛光 composer，结果进入主场景的现有 ACES / sRGB / Bloom 流程。
- 动画播放时，可见水滩最多约 20 Hz 更新捕获；水纹仍跟随场景动画时间。缓存图像和投影矩阵一起保留，不能仅更新矩阵而使用旧图。视口变化、异步远景加载及暂停后的按需绘制会立即更新；所有局部水面都离开视锥时跳过捕获。
- 平面倒影由真实镜像相机生成；五点采样轻微软化，水滴冲击生成扩散衰减环与法线扰动，掠射角增强反射，软边缘和浅色水缘控制与铺装过渡。超出缓存捕获范围时渐隐到轻量水光，避免贴图边界拉伸。
- Low：目标缩为 1 × 1，释放已有大目标，不启动捕获；水面使用同一街区灯色的程序化反光。雨滴数、CPU 更新范围、DPR、阴影及泛光继续同步降级。
- 暂停时停止雨线和水纹动画；手动环视仍可更新静态倒影。隐藏页面 / 阅读面板时整个 world 暂停，不存在独立水面动画循环。
- 捕获过程中隐藏 Reflector 自身，避免递归；异常时恢复主渲染目标、viewport、XR / shadow 状态，降级到轻量水光，不逐帧重复失败。销毁时先移出场景，再释放水面几何、材质和目标，避免与通用 world 清理重复释放。

## 明确限制与验收

- 平面反射不是光线追踪或流体模拟；涟漪为程序化雨滴效果，不与每条空中雨线逐粒碰撞同步。
- CSS3D 的文字保留为可编辑 HTML，不能被 WebGLRenderer 拍入目标。建筑、窗格、灯管、招牌底板与支架会参与倒影，HTML 字形不会。
- 20 Hz 捕获和 512px 是成本预算，不是实测帧率；高速转向、密集雨线和远处细线倒影可能需要在实体设备上微调。手机 Auto 默认不启用额外反射捕获，且仍以原生阅读页为默认入口。
- CPU 回归使用真实 Three.js 几何和 Reflector 相机逻辑，渲染边界为明确标注的测试替身；验证法线、镜像位置、裁剪、限频、降档、异常恢复与资源释放，不代表 shader 已在 GPU 编译。
- 当前云端浏览器禁用 WebGL，无法在这里确认最终 GPU 画面或 iPhone/Android 帧率。待实际设备核验水面边缘、倒影连续性、雨量、招牌点击，以及连续运行后的发热和电量开销。
