# 场景素材记录

## 原创城市远景

- 项目文件：`static/assets/img/night-district.webp`
- 用途：远距离圆柱城市背景，近景仍由 Three.js 建模。
- 来源：本次任务使用内置 image_gen 生成一张原创图，无外部图库下载。
- 原始尺寸：2172 × 724（3:1）；项目 WebP 约 156 KiB。
- 处理：只转换为 WebP；没有裁切、重绘或将网页文字烘焙进图片。
- 所有姓名、栏目、论文入口由独立 HTML 招牌显示。

最终提示词：

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
