# 场景素材记录

## 原创城市远景

- 项目文件：`static/assets/img/night-district-v3.webp`
- 用途：远距离圆柱城市背景，近景仍由 Three.js 建模。
- 来源：内置 image_gen 本次全新生成一张城市图，无外部图库下载。
- 原始尺寸：2172 × 724（3:1）；当前项目 WebP 37,340 字节（约 36.5 KiB）。
- 处理：简化远楼轮廓、收敛窗灯与雾光；仅转换 WebP 格式，没有将网页文字烘焙进图片。前两版保留在 Git 历史中。
- 所有姓名、栏目、论文入口由独立 HTML 招牌显示。

第一版生成提示词（原图保留在 Git 历史中）：

```text
Use case: stylized-concept
Asset type: original raster panoramic environment backdrop for the inside of a distant cylindrical skyline in a real Three.js cyberpunk personal portfolio scene. This is a skyline texture asset, not a website mockup.
Primary request: An exceptionally cinematic dark rainy East Asian cyberpunk city at midnight, dense industrial towers, wet cyan and teal illumination with acid lime accents and a few restrained vermilion light accents. Subtle layered fog, atmospheric depth, believable intricate architectural detail, industrial vents and antennae.
Composition/framing: Extra-wide panoramic 3:1 composition, approximately 3072 × 1024 pixels. Distant skyline viewed from street level. Evenly distributed buildings across the full width, no central subject or dominant tower, continuous dense urban rhythm. The upper half is mainly very dark midnight sky and hazy silhouettes; the lower half is dark tower facades with sparse luminous windows and panels. No foreground ground plane is needed. Far left and far right edges should share similar dark tones and architectural scale so this can wrap around a cylinder unobtrusively.
Style/medium: Premium stylized cinematic architectural environment concept art, dark, rain-soaked, rich atmospheric lighting, crisp enough to ground real 3D foreground objects but distant enough to remain a backdrop.
Lighting/mood: Moody near-black palette with wet light diffusion, restrained bloom, subtle fog, cyan teal glow punctuated by acid lime and tiny vermilion lights. Preserve dark areas; do not wash out the sky.
Constraints: Absolutely no readable text, letters, glyphs, digits, logos, UI, people, characters, or watermark. Any billboard surfaces must be blank dark luminous panels. Actual editable lettering will be rendered separately by code. No foreground hero object, no ground foreground, no borders, no inset panels. Generate exactly one image.
```

## 第三方代码

运行时依赖 Three.js 0.185.0（MIT），经 esbuild 打包并保留包内许可证注释。完整 Three.js 许可见 `THIRD_PARTY_NOTICES.md`。构建时使用 marked、js-yaml、esbuild；版本记录在 `package-lock.json`。

风格检索用于确定雨夜城市、霓虹反射与工业建筑方向，没有将检索到的图库作品下载或复制到项目。已有 favicon 继续保留。

## 城市第二版编辑记录

输入：第一版 `night-district.webp`。输出原图 2172 × 724，编码为 `night-district-v2.webp`，339,188 字节。仅此一次编辑生成，文字招牌没有合成进图片。

```text
Use case: style-transfer.
Asset type: panoramic distant city environment texture for an existing Three.js personal homepage.
Input image 1 is the EDIT TARGET. Edit this city image once, preserving its panoramic distant-city composition, roughly 3:1 landscape aspect ratio, broad even distribution of architecture across the full width, and deep ink-black negative sky.
Primary request: make this existing city visibly more cinematic and strongly cyberpunk. Build a denser layered megacity with plausible intricately detailed architecture, nested tower silhouettes, external pipes, dense antennae, gantries and skybridges. Preserve the distant panoramic viewpoint with no large near-camera objects. Introduce saturated electric cyan and teal illumination, vivid but restrained magenta and violet building light accents, selective amber and red window/light pools, and large luminous totally blank facade displays. Tiny distant aerial transport lights and subtle glowing light trails weave between towers. Make dramatic separated warm and cold light pools, brilliant restrained edge highlights, and luminous light shafts through atmospheric rain haze. Wet metallic facades catch colored reflections. Deep shadowed structure remains readable. Layered fog gives depth while the upper sky remains predominantly ink-black. High-end realistic cinematic CGI environmental matte painting, sharp intricate structures with optical atmospheric depth, controlled bloom, rich selective color, avoid an overall washed-out cyan tint.
Composition constraints: approximately 3:1 landscape, suitable for wrapping on a background cylinder; spread city detail evenly rather than one giant central hero building. Maintain dark negative sky above skyline and complex urban mass below. This is only a distant scene backdrop; editable interface text and physical foreground are elsewhere.
Avoid absolutely: readable letters, glyphs, digits, words, logos, people, characters, UI, borders, embedded webpage text, signage text, watermark. All display surfaces are blank color fields without symbols. Generate one chosen edited asset only.
```

## 城市第三版：安静的远景

依据实机截图中写实贴图与简洁 3D 建筑不协调的问题，全新生成一张更简化的城市全景。采用深靛蓝、雾化楼群与稀疏青色／洋红窗灯，移除原素材的强光柱、飞行器和高对比细节。原始 PNG 为 2172 × 724；仅以质量 86 转码为 WebP，37,340 字节，比第二版减少约 89%。

圆柱高度按原图 3:1 比例计算，三次环绕重复；真实楼体遮挡远景。材质以顶点透明度淡出上下边缘与重复接缝，保留内置色彩管理，前景霓虹继续承担主要视觉亮点。

```text
Use case: stylized-concept
Asset type: one panoramic background texture for a Three.js cyberpunk personal homepage, behind simple geometric 3D towers.
Primary request: Create exactly one very wide 3:1 panoramic image, 3072 × 1024 pixels, of a distant cyberpunk city at night, restrained and atmospheric.
Scene/backdrop: distant simplified architectural masses in soft layered hazy silhouettes; urban masses occupy the lower half and middle-low portion, with the top third nearly featureless deep navy night atmosphere. No foreground street.
Style/medium: softly illustrated real-time game environment backdrop, simple matte architectural forms, minimal high-frequency detail.
Composition/framing: panoramic straight-on distant skyline, uniform quiet visual density across the full width; no giant prominent hero building. Left and right edges have similar darkness and building scale so texture repetition stays quiet.
Lighting/mood: very subdued, dark, low contrast; matte indigo fog gently separates overlapping buildings without losing silhouettes to all-black. No dramatic illumination.
Color palette: inky indigo and blue-black architecture and atmosphere; sparse tiny desaturated cyan windows and only occasional muted magenta windows. All light points subdued.
Constraints: image only, no text or typography, no logos, no sign words, no watermark. No bright blue vertical shafts or beams, no flying cars or any vehicles, no people, no mountains, no moon, no sun, no foreground elements. Avoid bright neon ribbons, spotlights, dramatic lighting, cinematic hero composition, dense photographic detail, glossy surfaces, high contrast, and a showy photoreal poster aesthetic.
```

## 本地字体

- Rajdhani SemiBold，Indian Type Foundry，SIL Open Font License 1.1。
- 官方来源：[Google Fonts / Rajdhani](https://github.com/google/fonts/tree/main/ofl/rajdhani)。
- `static/assets/fonts/rajdhani-semibold.woff`，29,920 字节；从官方 TTF 生成拉丁字符与常用标点子集，保留字体许可元数据。其余字符通过系统字体回退。
- 完整许可：`static/assets/fonts/OFL-Rajdhani.txt`。页面不请求 Google Fonts 或第三方字体 CDN。
