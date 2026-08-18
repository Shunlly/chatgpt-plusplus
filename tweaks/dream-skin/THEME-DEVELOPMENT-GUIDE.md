# Dream Skin v2.0 主题开发指南

欢迎使用 Dream Skin v2.0 主题系统！本指南将教你如何创建自己的动态主题。

---

## 📋 目录

1. [快速开始](#快速开始)
2. [主题结构](#主题结构)
3. [效果类型](#效果类型)
4. [创建自定义效果](#创建自定义效果)
5. [性能优化](#性能优化)
6. [调试技巧](#调试技巧)
7. [示例主题](#示例主题)

---

## 快速开始

### 最简单的主题（纯色背景）

创建一个 `theme.json` 文件：

```json
{
  "schemaVersion": 2,
  "id": "my-first-theme",
  "name": "我的第一个主题",
  "type": "canvas",
  "version": "1.0.0",
  "author": "你的名字",
  "description": "一个简单的动态主题",
  "tags": ["dynamic", "custom"],
  "performance": "low",
  "backgroundColor": "#1a1a2e",
  "appearance": "dark",
  "effects": [],
  "interactive": {
    "mouse": false,
    "click": false
  }
}
```

这会创建一个纯色背景。让我们添加一些效果！

---

## 主题结构

### 基本字段

```json
{
  "schemaVersion": 2,          // 必须是 2（v2.0 主题）
  "id": "unique-theme-id",     // 唯一标识符（小写字母、数字、连字符）
  "name": "主题显示名称",       // 用户看到的名称
  "type": "canvas",            // 类型：static/canvas/video
  "version": "1.0.0",          // 版本号
  "author": "作者名",          // 作者
  "description": "主题描述",   // 简短描述
  "tags": ["tag1", "tag2"],   // 标签
  "performance": "medium",     // 性能等级：low/medium/high
  "backgroundColor": "#000",   // 背景颜色
  "appearance": "dark"         // 外观：dark/light/auto
}
```

### 效果配置

```json
{
  "effects": [
    {
      "type": "particles",     // 效果类型
      "config": {              // 效果配置
        "count": 100,
        "speed": 5,
        "color": "#ffffff"
      }
    }
  ]
}
```

### 交互配置

```json
{
  "interactive": {
    "mouse": true,    // 是否响应鼠标移动
    "click": true     // 是否响应点击
  }
}
```

---

## 效果类型

### 1. 粒子效果 (`particles`)

基础粒子系统，适合创建星空、雪花、漂浮物等。

```json
{
  "type": "particles",
  "config": {
    "count": 100,              // 粒子数量
    "speed": 5,                // 移动速度
    "color": "#ffffff",        // 颜色
    "size": 2,                 // 大小
    "opacity": 0.8,            // 不透明度
    "shape": "circle",         // 形状：circle/square/text
    "text": "•"                // 形状为 text 时的字符
  }
}
```

**示例：简单星空**
```json
{
  "type": "particles",
  "config": {
    "count": 150,
    "speed": 1,
    "color": "#ffffff",
    "size": 2,
    "opacity": 0.8,
    "shape": "circle"
  }
}
```

---

### 2. 渐变效果 (`gradient`)

流动的渐变背景。

```json
{
  "type": "gradient",
  "config": {
    "colors": ["#667eea", "#764ba2"],  // 颜色列表
    "speed": 0.001,                    // 流动速度
    "angle": 0                         // 初始角度
  }
}
```

**示例：紫色渐变**
```json
{
  "type": "gradient",
  "config": {
    "colors": ["#667eea", "#764ba2", "#f093fb"],
    "speed": 0.001,
    "angle": 0
  }
}
```

---

### 3. 矩阵代码雨 (`matrix-rain`)

经典赛博朋克代码雨效果。

```json
{
  "type": "matrix-rain",
  "config": {
    "speed": 5,                // 下落速度 (1-10)
    "density": 1.0,            // 密度倍率 (0.5-2.0)
    "color": "#00ff00",        // 代码颜色
    "trailLength": 20,         // 拖尾长度
    "glowIntensity": 0.3,      // 发光强度
    "fontSize": 16,            // 字体大小
    "charset": "01アイウエオ",  // 字符集
    "fadeSpeed": 0.05          // 淡出速度
  }
}
```

**交互：**
- 鼠标靠近：代码躲避
- 点击：产生涟漪加速效果

---

### 4. 星空银河 (`starry-galaxy`)

星星闪烁、流星效果。

```json
{
  "type": "starry-galaxy",
  "config": {
    "starCount": 150,           // 星星数量
    "twinkleSpeed": 0.02,       // 闪烁速度
    "moveSpeed": 0.5,           // 移动速度
    "minSize": 1,               // 最小星星大小
    "maxSize": 3,               // 最大星星大小
    "minOpacity": 0.3,          // 最小不透明度
    "maxOpacity": 1.0,          // 最大不透明度
    "mouseGlowRadius": 150,     // 鼠标发光半径
    "mouseGlowIntensity": 0.5,  // 鼠标发光强度
    "shootingStarChance": 0.001 // 流星出现概率
  }
}
```

**交互：**
- 鼠标靠近：星星变亮
- 点击：粒子向外爆炸

---

### 5. 极光 (`aurora`)

北极光效果，多层波浪渐变。

```json
{
  "type": "aurora",
  "config": {
    "colors": [                 // 颜色组合
      "#667eea", "#764ba2", 
      "#f093fb", "#4facfe", "#00f2fe"
    ],
    "speed": 0.0005,            // 流动速度
    "waveAmplitude": 100,       // 波动幅度
    "waveFrequency": 0.003,     // 波动频率
    "layers": 3,                // 极光层数
    "opacity": 0.7,             // 整体不透明度
    "blurAmount": 40            // 模糊程度
  }
}
```

**无交互**（纯视觉）

---

### 6. 呼吸效果 (`breathing`)

单色背景呼吸明暗变化。

```json
{
  "type": "breathing",
  "config": {
    "baseColor": "#1a1a2e",     // 基础颜色
    "breathSpeed": 0.0015,      // 呼吸速度
    "minBrightness": 0.6,       // 最小亮度
    "maxBrightness": 1.2,       // 最大亮度
    "easing": "sine",           // 缓动函数：sine/linear/cubic
    "vignette": true,           // 是否添加暗角
    "vignetteStrength": 0.3     // 暗角强度
  }
}
```

**无交互**（专注模式）

---

### 7. 赛博朋克霓虹 (`cyberpunk-neon`)

霓虹线条、故障效果、电流特效。

```json
{
  "type": "cyberpunk-neon",
  "config": {
    "neonColor": "#ff006e",     // 霓虹主色
    "accentColor": "#3a86ff",   // 强调色
    "lineCount": 20,            // 霓虹线条数量
    "lineSpeed": 2,             // 线条移动速度
    "glitchChance": 0.005,      // 故障出现概率
    "glitchDuration": 100,      // 故障持续时间(ms)
    "scanlineSpeed": 1,         // 扫描线速度
    "scanlineOpacity": 0.1,     // 扫描线不透明度
    "gridSize": 50,             // 网格大小
    "showGrid": true            // 是否显示网格
  }
}
```

**交互：**
- 鼠标靠近：线条被吸引
- 点击：电流向外发散

---

## 创建自定义效果

如果内置效果不够用，你可以创建自己的效果！

### 步骤 1：创建效果类

创建文件 `my-custom-effect.js`：

```javascript
"use strict";

class MyCustomEffect {
  constructor(config, performance) {
    this.config = {
      // 默认配置
      param1: 100,
      param2: "#ffffff",
      ...config,  // 合并用户配置
    };
    this.performance = performance;  // 性能监控器
    this.init();
  }

  init() {
    // 初始化效果
  }

  update(deltaTime) {
    // 每帧更新（deltaTime 是毫秒）
    if (this.performance.quality === "emergency") return;

    // 根据性能调整
    const qualityMult = this.performance.getQualityMultiplier();
    // qualityMult: high=1.0, medium=0.5, low=0.25, emergency=0.0
  }

  draw(ctx) {
    // 绘制到 Canvas
    if (this.performance.quality === "emergency") return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // 使用 Canvas 2D API 绘制
    ctx.fillStyle = this.config.param2;
    ctx.fillRect(0, 0, width, height);
  }

  cleanup() {
    // 清理资源
  }

  // 可选：鼠标交互
  onMouseMove(mouseX, mouseY) {
    // 响应鼠标移动
  }

  // 可选：点击交互
  onClick(clickX, clickY) {
    // 响应点击
  }
}

// 导出到全局
if (typeof window !== "undefined") {
  window.MyCustomEffect = MyCustomEffect;
}
```

### 步骤 2：在主题中使用

```json
{
  "type": "my-custom",
  "config": {
    "param1": 200,
    "param2": "#ff0000"
  }
}
```

### 步骤 3：注册效果

需要修改核心引擎的 `createEffects` 方法添加你的效果类型。

---

## 性能优化

### 性能等级

选择合适的性能等级：

- **low**: CPU < 5%, 适合所有设备（星空、呼吸）
- **medium**: CPU 10-15%, 主流设备（矩阵、极光）
- **high**: CPU 15-20%, 高性能设备（霓虹）

### 优化技巧

#### 1. 动态调整数量

```javascript
update(deltaTime) {
  const qualityMult = this.performance.getQualityMultiplier();
  const targetCount = Math.floor(this.baseCount * qualityMult);
  
  // 调整粒子数量
  if (this.particles.length > targetCount) {
    this.particles.length = targetCount;
  }
}
```

#### 2. 紧急降级

```javascript
draw(ctx) {
  if (this.performance.quality === "emergency") return;
  
  // 正常绘制
}
```

#### 3. 高质量特效

```javascript
draw(ctx) {
  if (this.performance.quality === "high") {
    // 只在高质量模式启用发光
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 10;
  }
  
  // 基础绘制
}
```

---

## 调试技巧

### 1. 实时性能监控

在浏览器控制台查看性能：

```javascript
// 获取引擎实例
const engine = window.__CODEX_DREAM_SKIN_V2_ENGINE__;

// 查看统计信息
console.log(engine.getStats());
// 输出: { fps: 60, quality: "high", themeType: "canvas" }
```

### 2. 调试绘制

在 `draw()` 中添加调试信息：

```javascript
draw(ctx) {
  // 绘制 FPS 信息
  ctx.fillStyle = "#ffffff";
  ctx.font = "16px monospace";
  ctx.fillText(`FPS: ${this.performance.fps}`, 10, 30);
  ctx.fillText(`Quality: ${this.performance.quality}`, 10, 50);
}
```

### 3. 检查配置

```javascript
console.log(this.config);
```

---

## 示例主题

### 示例 1：简单雪花

```json
{
  "schemaVersion": 2,
  "id": "simple-snow",
  "name": "简单雪花",
  "type": "canvas",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "轻飘飘的雪花",
  "tags": ["nature", "winter"],
  "performance": "low",
  "backgroundColor": "#1a1a2e",
  "appearance": "dark",
  "effects": [
    {
      "type": "particles",
      "config": {
        "count": 100,
        "speed": 2,
        "color": "#ffffff",
        "size": 3,
        "opacity": 0.8,
        "shape": "circle"
      }
    }
  ],
  "interactive": {
    "mouse": false,
    "click": false
  }
}
```

### 示例 2：彩虹渐变 + 粒子

```json
{
  "schemaVersion": 2,
  "id": "rainbow-particles",
  "name": "彩虹粒子",
  "type": "canvas",
  "version": "1.0.0",
  "performance": "medium",
  "backgroundColor": "#000000",
  "appearance": "dark",
  "effects": [
    {
      "type": "gradient",
      "config": {
        "colors": ["#ff0000", "#ff7f00", "#ffff00", "#00ff00", "#0000ff", "#8b00ff"],
        "speed": 0.0008,
        "angle": 0
      }
    },
    {
      "type": "particles",
      "config": {
        "count": 50,
        "speed": 3,
        "color": "#ffffff",
        "size": 4,
        "opacity": 0.6,
        "shape": "circle"
      }
    }
  ],
  "interactive": {
    "mouse": false,
    "click": false
  }
}
```

### 示例 3：互动矩阵

```json
{
  "schemaVersion": 2,
  "id": "interactive-matrix",
  "name": "互动矩阵",
  "type": "canvas",
  "version": "1.0.0",
  "performance": "medium",
  "backgroundColor": "#000000",
  "appearance": "dark",
  "effects": [
    {
      "type": "matrix-rain",
      "config": {
        "speed": 8,
        "density": 1.5,
        "color": "#00ff00",
        "trailLength": 25,
        "glowIntensity": 0.5,
        "fontSize": 14,
        "charset": "01アイウエオカキクケコサシスセソ"
      }
    }
  ],
  "interactive": {
    "mouse": true,
    "click": true
  }
}
```

---

## 自定义配置界面

你可以为主题添加配置选项，让用户自定义：

```json
{
  "customization": {
    "speed": {
      "label": "速度",
      "type": "range",
      "min": 1,
      "max": 10,
      "default": 5,
      "path": "effects.0.config.speed"
    },
    "color": {
      "label": "颜色",
      "type": "color",
      "default": "#00ff00",
      "path": "effects.0.config.color"
    },
    "density": {
      "label": "密度",
      "type": "select",
      "options": [
        { "label": "低", "value": 0.5 },
        { "label": "中", "value": 1.0 },
        { "label": "高", "value": 1.5 }
      ],
      "default": 1.0,
      "path": "effects.0.config.density"
    }
  }
}
```

**配置类型：**
- `range`: 滑块（min/max/default）
- `color`: 颜色选择器
- `select`: 下拉选择
- `boolean`: 开关

---

## 最佳实践

### ✅ 推荐做法

1. **测试性能** - 在不同设备上测试
2. **提供配置** - 让用户自定义
3. **清晰命名** - 使用描述性的 ID 和名称
4. **添加标签** - 方便分类和搜索
5. **写好描述** - 让用户知道主题效果

### ❌ 避免

1. **过度复杂** - 不要在一个主题中堆太多效果
2. **忽略性能** - 始终监控 FPS
3. **硬编码** - 使用配置项而非固定值
4. **无交互提示** - 如果有交互，在描述中说明

---

## 常见问题

### Q: 主题不显示？
A: 检查：
1. `schemaVersion` 是否为 2
2. `type` 是否为 "canvas"
3. 效果类型是否拼写正确
4. 浏览器控制台是否有错误

### Q: 性能太差？
A: 尝试：
1. 降低粒子数量
2. 减少效果层数
3. 设置更低的 performance 等级
4. 实现性能自适应

### Q: 如何测试主题？
A: 
1. 将 theme.json 放到 `presets/` 目录
2. 在 index.js 的 PRESET_IDS 中添加
3. 重新构建并测试

---

## 获取帮助

- **示例主题**: 查看 `presets/` 目录
- **效果代码**: 查看 `assets/engine/effects/` 目录
- **核心引擎**: 查看 `assets/engine/core.js`

祝你创作愉快！🎨
