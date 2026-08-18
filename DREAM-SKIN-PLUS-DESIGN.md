# Dream Skin Plus - 完整设计方案

**项目**: ChatGPT++ Dream Skin Plus  
**版本**: v2.0  
**目标**: Wallpaper Engine 级别的动态主题系统

---

## 📋 目录

1. [产品定位](#产品定位)
2. [用户体验设计](#用户体验设计)
3. [技术架构设计](#技术架构设计)
4. [主题商店设计](#主题商店设计)
5. [创作工具设计](#创作工具设计)
6. [性能优化方案](#性能优化方案)
7. [开发计划](#开发计划)

---

## 🎯 产品定位

### 愿景
**让每个 ChatGPT 用户都能拥有独一无二的、会动的、可交互的个性化界面。**

### 对标产品
- **Wallpaper Engine** (Steam) - 动态壁纸标杆
- **Lively Wallpaper** (开源) - 轻量级动态壁纸
- **Rainmeter** (Windows) - 桌面定制
- **macOS Dynamic Wallpapers** - 系统级动态壁纸

### 差异化优势
| 维度 | Wallpaper Engine | Dream Skin Plus |
|------|------------------|-----------------|
| 应用场景 | 桌面壁纸 | ChatGPT 应用内 |
| 技术栈 | C++/DirectX | Web/Canvas/WebGL |
| 社区规模 | 百万级 | 待建立 |
| 门槛 | 付费 $3.99 | 免费开源 |
| 集成度 | 独立应用 | 深度集成 ChatGPT |
| 互动性 | 桌面交互 | 对话交互（未来） |

### 核心价值
1. **视觉震撼** - 第一眼就被吸引
2. **个性表达** - 每个人都是独特的
3. **创作自由** - 从使用者到创作者
4. **社区生态** - 分享与发现的乐趣
5. **性能平衡** - 美观与流畅兼得

---

## 🎨 用户体验设计

### 2.1 主界面改版

#### 当前界面（v1.x）
```
侧边栏:
└── Theme（主题）
    ├── 当前主题预览（小图）
    ├── 预设主题网格（6个）
    └── 上传图片按钮

问题:
❌ 预设太少（仅 6 个）
❌ 无分类，难以查找
❌ 无预览效果（静态图）
❌ 无动态主题支持
❌ 无社区内容
```

#### 新界面（v2.0）

```
全新三栏布局:

┌────────────────────────────────────────────────────────────────┐
│  Dream Skin Plus                    🔍 搜索主题...    👤 我的   │
├──────────┬─────────────────────────────────────────┬───────────┤
│          │                                         │           │
│ 导航栏   │           主题展示区                    │  预览面板 │
│          │                                         │           │
│ 🏠 首页  │  ┌─────┬─────┬─────┬─────┐            │ ┌───────┐ │
│ 🔥 热门  │  │     │     │     │     │            │ │       │ │
│ 🆕 最新  │  │ 主题 │ 主题 │ 主题 │ 主题 │            │ │ 实时  │ │
│ ⭐ 精选  │  │  1  │  2  │  3  │  4  │            │ │ 预览  │ │
│          │  └─────┴─────┴─────┴─────┘            │ │       │ │
│ 分类:    │  ┌─────┬─────┬─────┬─────┐            │ │ [动画] │ │
│ 🌌 抽象  │  │     │     │     │     │            │ │       │ │
│ 🌲 自然  │  │ 主题 │ 主题 │ 主题 │ 主题 │            │ ├───────┤ │
│ 🤖 科幻  │  │  5  │  6  │  7  │  8  │            │ │ 主题名 │ │
│ 🎨 极简  │  └─────┴─────┴─────┴─────┘            │ │ 作者   │ │
│ ⚡ 赛博  │                                         │ │ ⭐ 4.8 │ │
│ 🎭 二次元│  [加载更多...]                         │ │ 📥 1.2k│ │
│          │                                         │ ├───────┤ │
│ 我的:    │                                         │ │ 立即  │ │
│ 💾 已安装│                                         │ │ 使用  │ │
│ ❤️  收藏  │                                         │ └───────┘ │
│ 📤 上传  │                                         │           │
│          │                                         │           │
└──────────┴─────────────────────────────────────────┴───────────┘
```

**改进点**:
✅ 三栏布局，信息层次清晰
✅ 分类导航，快速定位
✅ 实时预览（鼠标悬停看动画）
✅ 丰富的主题卡片信息
✅ 独立预览面板（避免频繁切换）

### 2.2 主题卡片设计

#### 卡片信息架构
```
┌─────────────────┐
│                 │
│   [预览图/GIF]  │  ← 256x144 缩略图
│                 │
├─────────────────┤
│ 🌌 赛博朋克雨夜 │  ← 主题名称
│ by @creator     │  ← 作者
├─────────────────┤
│ ⭐ 4.8 📥 1.2k  │  ← 评分 + 下载量
│ 🎬 动态 ⚡ 交互 │  ← 特性标签
├─────────────────┤
│ [安装] [预览]   │  ← 操作按钮
└─────────────────┘

鼠标悬停:
- 预览图播放动画（GIF/视频）
- 显示更多信息（文件大小、性能需求）
- 快速操作按钮（收藏、分享）
```

#### 特性标签系统
```
类型标签:
🖼️  静态 - Static
🎬 动态 - Animated
⚡ 交互 - Interactive
🎵 音频 - Audio Reactive

性能标签:
🟢 轻量 - Low Impact (CPU < 5%)
🟡 中等 - Medium (CPU 5-15%)
🔴 高负载 - High (CPU > 15%)

技术标签:
📐 CSS - Pure CSS
🎨 Canvas - Canvas 2D
✨ WebGL - WebGL Accelerated
🎥 Video - Video Background
```

### 2.3 主题详情页

#### 布局设计
```
┌──────────────────────────────────────────────────────────┐
│  ← 返回                        [收藏] [分享] [举报]      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│              [全屏实时预览]                              │
│          （循环播放，可交互）                            │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ 🌌 赛博朋克代码雨                                        │
│ by @username  •  上传于 2026-08-01                      │
│ ⭐⭐⭐⭐⭐ 4.8 (128 评分)  •  📥 1,258 次安装             │
├──────────────────────────────────────────────────────────┤
│ 描述:                                                    │
│ 矩阵风格的代码雨效果，支持鼠标交互。当鼠标移动时，      │
│ 代码流会向两侧分开；点击时产生涟漪扩散效果。            │
│                                                          │
│ 标签: #赛博朋克 #粒子 #交互 #极客                       │
├──────────────────────────────────────────────────────────┤
│ 📊 性能需求                                              │
│ • CPU: 中等 (~10%)                                      │
│ • 内存: ~20MB                                           │
│ • GPU: 推荐支持 WebGL                                   │
│ • 帧率: 目标 60fps                                      │
├──────────────────────────────────────────────────────────┤
│ ⚙️ 自定义选项                                            │
│ • 代码速度: [━━━●━━━] 5                                 │
│ • 代码颜色: [🎨 #00ff00]                                │
│ • 粒子密度: [低] [中] ●[高]                             │
│ • 鼠标效果: ☑ 启用                                      │
├──────────────────────────────────────────────────────────┤
│          [立即安装] [试用 30 秒]                         │
├──────────────────────────────────────────────────────────┤
│ 💬 评论 (23)                                             │
│ ┌────────────────────────────────────────────────────┐  │
│ │ @user1: 太酷了！完美的赛博朋克风格 ⭐⭐⭐⭐⭐          │  │
│ │ 2 天前                                  👍 12       │  │
│ ├────────────────────────────────────────────────────┤  │
│ │ @user2: 能否增加速度调节？             ⭐⭐⭐⭐      │  │
│ │ 3 天前                                  👍 8        │  │
│ └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 2.4 交互流程设计

#### 流程 1: 浏览与安装
```
用户进入主题页
    ↓
浏览分类/搜索
    ↓
鼠标悬停预览（2秒后播放动画）
    ↓
点击卡片 → 打开详情页
    ↓
查看全屏预览 + 配置选项
    ↓
调整自定义参数
    ↓
点击"立即安装"
    ↓
下载主题包（进度条）
    ↓
自动应用 + 弹窗提示"已安装"
    ↓
可选：分享到社区 / 评分
```

#### 流程 2: 创作与发布
```
用户点击"创建主题"
    ↓
选择创作方式：
    • 上传图片（AI 生成）
    • 选择模板（修改参数）
    • 从零开始（代码编辑器）
    ↓
[上传图片路径]
    ↓ 上传图片
    ↓ AI 分析颜色 + 生成主题
    ↓ 实时预览
    ↓ 微调参数
    
[模板路径]
    ↓ 选择模板（粒子/波纹/渐变）
    ↓ 可视化参数面板
    ↓ 实时预览
    ↓ 保存配置
    
[代码路径]
    ↓ 打开在线编辑器
    ↓ 编写 JS/CSS/Shader
    ↓ 实时预览（右侧面板）
    ↓ 调试与优化
    ↓
填写主题信息：
    • 名称、描述
    • 标签、分类
    • 预览图/GIF
    • 自定义选项定义
    ↓
点击"发布"
    ↓
审核（自动 + 人工）
    ↓
发布到主题商店
    ↓
获得创作者徽章 🏅
```

#### 流程 3: 性能优化交互
```
系统检测到性能下降（FPS < 30）
    ↓
弹出提示：
┌─────────────────────────────────┐
│ ⚠️ 性能提示                     │
│                                 │
│ 当前主题影响性能（FPS: 28）    │
│                                 │
│ 建议操作：                      │
│ • [降低质量] → 自动降级到中等  │
│ • [切换主题] → 选择轻量主题    │
│ • [关闭动画] → 静态模式        │
│ • [忽略]                       │
└─────────────────────────────────┘
    ↓
用户选择后
    ↓
系统自动调整 + 记住偏好
```

---

## 🏗️ 技术架构设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    ChatGPT UI Layer                     │
│         (Electron Renderer / Chromium)                  │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼────────┐    ┌──────────▼──────────┐
│  Theme Engine  │    │   Theme Store UI    │
│  (核心渲染器)  │    │   (商店界面)        │
└───────┬────────┘    └──────────┬──────────┘
        │                         │
        │  ┌──────────────────────┘
        │  │
┌───────▼──▼──────────────────────────────────┐
│          Theme Management Layer             │
│  (主题管理、资源加载、配置持久化)            │
└───────┬─────────────────────────────────────┘
        │
┌───────▼─────────────────────────────────────┐
│         Rendering Backends                  │
│  ┌──────────┬──────────┬──────────────┐    │
│  │ CSS      │ Canvas2D │ WebGL        │    │
│  │ Renderer │ Renderer │ Renderer     │    │
│  └──────────┴──────────┴──────────────┘    │
└─────────────────────────────────────────────┘
        │
┌───────▼─────────────────────────────────────┐
│       Performance Monitor                   │
│  (FPS监控、自动降级、内存管理)              │
└─────────────────────────────────────────────┘
```

### 3.2 核心模块设计

#### ThemeEngine（主题引擎）
```javascript
class ThemeEngine {
  constructor(config) {
    this.config = config;
    this.currentTheme = null;
    this.renderer = null;
    this.performance = new PerformanceMonitor();
    this.interactionLayer = new InteractionLayer();
    
    this.init();
  }

  // 初始化引擎
  init() {
    this.detectCapabilities();
    this.setupCanvas();
    this.startRenderLoop();
  }

  // 检测浏览器能力
  detectCapabilities() {
    return {
      webgl: this.checkWebGLSupport(),
      canvas2d: true,
      video: this.checkVideoSupport(),
      performance: this.estimatePerformance(),
    };
  }

  // 加载主题
  async loadTheme(themeId) {
    // 1. 获取主题元数据
    const metadata = await this.fetchThemeMetadata(themeId);
    
    // 2. 验证依赖
    if (!this.validateDependencies(metadata)) {
      throw new Error('Theme dependencies not met');
    }
    
    // 3. 下载主题资源
    const resources = await this.downloadThemeResources(metadata);
    
    // 4. 选择合适的渲染器
    this.renderer = this.selectRenderer(metadata.type);
    
    // 5. 初始化主题
    await this.renderer.init(resources, metadata.config);
    
    // 6. 应用主题
    this.currentTheme = {
      id: themeId,
      metadata,
      renderer: this.renderer,
    };
    
    // 7. 触发事件
    this.emit('theme-loaded', themeId);
  }

  // 选择渲染器
  selectRenderer(type) {
    const capabilities = this.capabilities;
    const performanceLevel = this.performance.getLevel();

    switch(type) {
      case 'static':
        return new StaticRenderer();
      
      case 'css':
        return new CSSRenderer();
      
      case 'canvas':
        return performanceLevel >= 2 
          ? new Canvas2DRenderer() 
          : new CSSRenderer(); // 降级
      
      case 'webgl':
        return capabilities.webgl && performanceLevel >= 3
          ? new WebGLRenderer()
          : new Canvas2DRenderer(); // 降级
      
      case 'video':
        return capabilities.video && performanceLevel >= 2
          ? new VideoRenderer()
          : new StaticRenderer(); // 降级
      
      default:
        return new StaticRenderer();
    }
  }

  // 渲染循环
  startRenderLoop() {
    let lastTime = performance.now();
    
    const loop = (currentTime) => {
      const deltaTime = (currentTime - lastTime) / 1000; // 秒
      lastTime = currentTime;

      // 性能监控
      this.performance.measure();

      // 渲染当前帧
      if (this.renderer && !document.hidden) {
        this.renderer.update(deltaTime);
        this.renderer.render();
      }

      // 交互层更新
      this.interactionLayer.update(deltaTime);

      // 继续循环
      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  // 卸载主题
  unloadTheme() {
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    this.currentTheme = null;
  }
}
```

#### 渲染器接口
```javascript
// 所有渲染器的基类
class BaseRenderer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.config = null;
    this.resources = null;
  }

  // 初始化（子类实现）
  async init(resources, config) {
    throw new Error('Must implement init()');
  }

  // 更新逻辑（子类实现）
  update(deltaTime) {
    throw new Error('Must implement update()');
  }

  // 渲染（子类实现）
  render() {
    throw new Error('Must implement render()');
  }

  // 清理资源（子类实现）
  dispose() {
    throw new Error('Must implement dispose()');
  }

  // 配置更新
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
}

// Canvas 2D 渲染器
class Canvas2DRenderer extends BaseRenderer {
  async init(resources, config) {
    this.canvas = document.getElementById('theme-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.config = config;
    this.resources = resources;
    
    // 初始化效果
    this.effects = this.createEffects(config.effects);
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  createEffects(effectConfigs) {
    return effectConfigs.map(cfg => {
      switch(cfg.type) {
        case 'particles':
          return new ParticleEffect(cfg);
        case 'gradient':
          return new GradientEffect(cfg);
        case 'waves':
          return new WaveEffect(cfg);
        default:
          return null;
      }
    }).filter(Boolean);
  }

  update(deltaTime) {
    this.effects.forEach(effect => {
      if (effect.enabled) {
        effect.update(deltaTime);
      }
    });
  }

  render() {
    // 清空画布
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 渲染所有效果
    this.effects.forEach(effect => {
      if (effect.enabled) {
        effect.draw(this.ctx);
      }
    });
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  dispose() {
    this.effects.forEach(effect => effect.dispose && effect.dispose());
    this.effects = [];
    window.removeEventListener('resize', this.resize);
  }
}

// WebGL 渲染器
class WebGLRenderer extends BaseRenderer {
  async init(resources, config) {
    this.canvas = document.getElementById('theme-canvas');
    this.gl = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl');
    
    if (!this.gl) {
      throw new Error('WebGL not supported');
    }

    this.config = config;
    this.resources = resources;

    // 编译着色器
    this.program = await this.compileShader(config.shader);
    
    // 设置缓冲区
    this.setupBuffers();
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  async compileShader(shaderConfig) {
    const gl = this.gl;

    // 顶点着色器
    const vertexShader = this.createShader(
      gl.VERTEX_SHADER,
      shaderConfig.vertex
    );

    // 片段着色器
    const fragmentShader = this.createShader(
      gl.FRAGMENT_SHADER,
      shaderConfig.fragment
    );

    // 链接程序
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Shader program failed to link: ' + 
        gl.getProgramInfoLog(program));
    }

    return program;
  }

  createShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error('Shader compilation error: ' + 
        gl.getShaderInfoLog(shader));
    }

    return shader;
  }

  setupBuffers() {
    const gl = this.gl;
    
    // 全屏四边形
    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);

    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  }

  update(deltaTime) {
    // 更新 uniform 变量
    this.time = (this.time || 0) + deltaTime;
  }

  render() {
    const gl = this.gl;
    
    gl.useProgram(this.program);
    
    // 设置 uniforms
    const timeLocation = gl.getUniformLocation(this.program, 'u_time');
    const resolutionLocation = gl.getUniformLocation(this.program, 'u_resolution');
    
    gl.uniform1f(timeLocation, this.time);
    gl.uniform2f(resolutionLocation, this.canvas.width, this.canvas.height);
    
    // 绘制
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  dispose() {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteBuffer(this.buffer);
    window.removeEventListener('resize', this.resize);
  }
}
```

---

## 🛍️ 主题商店设计

### 4.1 数据模型

#### 主题包结构
```json
{
  "id": "cyberpunk-rain-v1",
  "manifest_version": "2.0",
  "name": "赛博朋克代码雨",
  "name_i18n": {
    "en": "Cyberpunk Code Rain",
    "zh-CN": "赛博朋克代码雨",
    "ja": "サイバーパンクコードレイン"
  },
  "version": "1.0.0",
  "author": {
    "name": "username",
    "url": "https://github.com/username",
    "avatar": "https://..."
  },
  "description": "矩阵风格的代码雨效果，支持鼠标交互",
  "description_i18n": {
    "en": "Matrix-style code rain with mouse interaction",
    "zh-CN": "矩阵风格的代码雨效果，支持鼠标交互"
  },
  "category": "cyberpunk",
  "tags": ["particles", "interactive", "cyberpunk", "matrix"],
  "preview": {
    "thumbnail": "thumb.jpg",
    "gif": "preview.gif",
    "video": "preview.mp4",
    "screenshots": ["screen1.jpg", "screen2.jpg"]
  },
  "type": "canvas",
  "features": {
    "animated": true,
    "interactive": true,
    "audio_reactive": false,
    "customizable": true
  },
  "performance": {
    "impact": "medium",
    "avg_cpu": 10,
    "avg_memory": 20,
    "min_fps": 45,
    "target_fps": 60
  },
  "requirements": {
    "webgl": false,
    "canvas2d": true,
    "min_resolution": [1280, 720]
  },
  "files": {
    "main": "theme.js",
    "config": "config.json",
    "assets": ["matrix-font.png", "glow.png"]
  },
  "size": {
    "total": 245760,
    "assets": 204800,
    "code": 40960
  },
  "config_schema": {
    "speed": {
      "type": "slider",
      "label": "代码速度",
      "min": 1,
      "max": 10,
      "default": 5,
      "unit": ""
    },
    "color": {
      "type": "color",
      "label": "代码颜色",
      "default": "#00ff00"
    },
    "density": {
      "type": "select",
      "label": "粒子密度",
      "options": [
        {"value": "low", "label": "低"},
        {"value": "medium", "label": "中"},
        {"value": "high", "label": "高"}
      ],
      "default": "medium"
    },
    "mouse_effect": {
      "type": "boolean",
      "label": "鼠标效果",
      "default": true
    }
  },
  "metadata": {
    "created_at": "2026-08-01T10:00:00Z",
    "updated_at": "2026-08-10T15:30:00Z",
    "downloads": 1258,
    "rating": {
      "average": 4.8,
      "count": 128
    },
    "license": "MIT"
  }
}
```

#### 用户数据模型
```json
{
  "user": {
    "id": "user123",
    "username": "creator",
    "avatar": "https://...",
    "bio": "Passionate theme creator",
    "badges": ["verified", "top_creator", "early_adopter"],
    "stats": {
      "themes_created": 12,
      "total_downloads": 15420,
      "total_ratings": 856,
      "avg_rating": 4.7,
      "followers": 234
    },
    "themes": ["theme-id-1", "theme-id-2", ...],
    "favorites": ["theme-id-x", ...],
    "installed": ["theme-id-y", ...],
    "current_theme": "theme-id-z"
  }
}
```

### 4.2 API 设计

#### RESTful API
```
GET /api/themes
  查询参数:
    - category: string (抽象/自然/科幻/极简/赛博/二次元)
    - sort: string (popular/recent/rating/downloads)
    - page: number
    - limit: number (默认 20)
    - search: string
    - tags: string[] (逗号分隔)
    - features: string[] (animated/interactive/audio)
  返回:
    {
      "themes": [主题列表],
      "total": 总数,
      "page": 当前页,
      "has_more": boolean
    }

GET /api/themes/:id
  返回: 主题完整信息

POST /api/themes/:id/install
  Body: { version: "1.0.0" }
  返回: 下载URL和安装token

GET /api/themes/:id/download
  查询参数: token (from install endpoint)
  返回: 主题包文件 (zip)

POST /api/themes/:id/rate
  Body: { rating: 1-5, comment: "..." }
  返回: 更新后的评分

GET /api/themes/:id/comments
  查询参数: page, limit
  返回: 评论列表

POST /api/themes
  (创作者上传主题)
  Body: FormData (主题包 + 元数据)
  返回: 新主题ID

PUT /api/themes/:id
  (更新主题)
  Body: FormData
  返回: 更新确认

DELETE /api/themes/:id
  (删除主题)
  返回: 删除确认

GET /api/users/:username/themes
  返回: 用户创作的主题列表

GET /api/featured
  返回: 编辑精选主题列表

GET /api/trending
  返回: 热门趋势主题列表
```

### 4.3 存储方案

#### 方案 A: GitHub Registry（推荐初期）
```
优点:
✅ 零成本
✅ 天然版本控制
✅ 开源透明
✅ CDN 加速（jsDelivr/unpkg）
✅ 社区熟悉

缺点:
❌ API 限流（5000/小时）
❌ 审核流程需自建
❌ 无内置评分系统

实现:
- 主题仓库: github.com/chatgpt-plusplus/themes
- 目录结构:
  themes/
    cyberpunk-rain/
      manifest.json
      theme.js
      assets/
      README.md
    ...
- Topics: chatgpt-plusplus-theme
- Releases: 版本发布
- Issues: 问题反馈
- Discussions: 社区讨论
```

#### 方案 B: 自建轻量 Registry
```
技术栈:
- 后端: Cloudflare Workers / Vercel Serverless
- 数据库: Supabase (PostgreSQL)
- 存储: Cloudflare R2 / AWS S3
- CDN: Cloudflare

优点:
✅ 完全控制
✅ 自定义功能
✅ 更好的性能
✅ 集成评分/评论

缺点:
❌ 开发成本
❌ 运维成本
❌ 需要服务器

成本估算（月）:
- Cloudflare Workers: $5
- Supabase: $25
- R2 Storage: $0.015/GB
- CDN: 免费（Cloudflare）
总计: ~$30/月（1万用户以内）
```

#### 推荐方案: 混合模式
```
Phase 1 (0-3月): GitHub Registry
  - 快速启动
  - 验证需求
  - 建立社区

Phase 2 (3-6月): 混合模式
  - GitHub 作为源（版本控制）
  - 自建 API（缓存 + 增强功能）
  - 评分/评论存储在 Supabase

Phase 3 (6月+): 完全自建
  - 迁移到自建 Registry
  - GitHub 作为备份
  - 企业级功能
```

---

## 🎨 创作工具设计

### 5.1 在线编辑器

#### 界面布局
```
┌──────────────────────────────────────────────────────────┐
│ Dream Skin Creator                   [保存] [发布] [?]   │
├──────────────┬───────────────────────────────────────────┤
│              │                                           │
│  文件树      │           代码编辑器                      │
│              │        (Monaco Editor)                    │
│ 📁 my-theme  │                                           │
│  ├ 📄 theme.js   // 主逻辑                              │
│  ├ 📄 config.json                                        │
│  ├ 📁 assets                                             │
│  │  └ 🖼️ bg.png                                          │
│  └ 📄 manifest.json                                      │
│              │                                           │
│              │                                           │
├──────────────┼───────────────────────────────────────────┤
│              │                                           │
│  控制面板    │           实时预览                        │
│              │                                           │
│ ▶️ 运行      │    [主题效果实时显示]                     │
│ ⏸️  暂停      │                                           │
│ 🔄 重载      │                                           │
│              │                                           │
│ FPS: 60      │                                           │
│ CPU: 8%      │                                           │
│ 内存: 15MB   │                                           │
│              │                                           │
└──────────────┴───────────────────────────────────────────┘
```

#### 功能特性
```
代码编辑:
✅ 语法高亮（JavaScript/CSS/GLSL）
✅ 智能补全（API 提示）
✅ 错误检测（ESLint）
✅ 格式化（Prettier）
✅ 多文件编辑
✅ 版本历史（Undo/Redo）

实时预览:
✅ 热更新（保存即刷新）
✅ 性能监控
✅ 错误提示（控制台）
✅ 交互测试

资源管理:
✅ 拖拽上传图片
✅ 图片压缩优化
✅ 资源大小提示
✅ CDN URL 支持

调试工具:
✅ 断点调试
✅ 变量监视
✅ 性能分析（Profiler）
✅ 帧率监控
```

### 5.2 可视化编辑器（无代码）

#### 粒子系统编辑器
```
┌──────────────────────────────────────────────────────────┐
│ 粒子效果编辑器                                           │
├──────────────┬───────────────────────────────────────────┤
│ 预设模板:    │                                           │
│ • 星空       │           [实时预览区]                    │
│ • 雨/雪      │                                           │
│ • 烟花       │      [粒子效果实时演示]                   │
│ • 泡泡       │                                           │
│ • 代码雨     │                                           │
├──────────────┤                                           │
│ 参数调节:    │                                           │
│              │                                           │
│ 粒子数量     │                                           │
│ [━━━●━━━] 100│                                           │
│              │                                           │
│ 粒子大小     │                                           │
│ [━━●━━━━] 3  │                                           │
│              │                                           │
│ 速度         │                                           │
│ [━━━━●━━] 5  │                                           │
│              │                                           │
│ 颜色         │                                           │
│ [🎨 #ffffff] │                                           │
│              │                                           │
│ 不透明度     │                                           │
│ [━━━━━●━] 0.8│                                           │
│              │                                           │
│ 重力         │                                           │
│ [━●━━━━━] -2 │                                           │
│              │                                           │
│ 生命周期     │                                           │
│ [━━━●━━━] 5s │                                           │
│              │                                           │
│ ☑ 鼠标交互   │                                           │
│ ☑ 边界反弹   │                                           │
│ ☐ 尾迹效果   │                                           │
│              │                                           │
│ [导出代码]   │                                           │
└──────────────┴───────────────────────────────────────────┘
```

### 5.3 模板系统

#### 内置模板库
```
1. 粒子模板
   - 星空粒子
   - 雨滴效果
   - 雪花飘落
   - 泡泡上升
   - 代码雨
   - 烟花爆炸

2. 渐变模板
   - 多色渐变流动
   - 极光效果
   - 彩虹光谱
   - 呼吸灯
   - 波浪渐变

3. 几何模板
   - 波纹扩散
   - 网格变形
   - 低多边形
   - 三角形网络
   - 六边形蜂巢

4. Shader 模板
   - 噪声场
   - 分形图案
   - 光线追踪
   - 流体模拟
   - 火焰效果

5. 交互模板
   - 鼠标跟随
   - 点击波纹
   - 拖拽粒子
   - 视差滚动
```

---

## ⚡ 性能优化方案

### 6.1 性能监控

#### PerformanceMonitor 类
```javascript
class PerformanceMonitor {
  constructor() {
    this.fps = 60;
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fpsHistory = [];
    this.cpuUsage = 0;
    this.memoryUsage = 0;
    this.quality = 'auto';
  }

  measure() {
    this.frameCount++;
    const now = performance.now();
    const elapsed = now - this.lastTime;

    if (elapsed >= 1000) {
      // 计算 FPS
      this.fps = Math.round((this.frameCount * 1000) / elapsed);
      this.fpsHistory.push(this.fps);
      if (this.fpsHistory.length > 60) {
        this.fpsHistory.shift();
      }

      this.frameCount = 0;
      this.lastTime = now;

      // 检查内存
      if (performance.memory) {
        this.memoryUsage = Math.round(
          performance.memory.usedJSHeapSize / 1048576
        );
      }

      // 触发质量调整
      this.adjustQuality();
    }
  }

  adjustQuality() {
    const avgFps = this.getAverageFPS();

    if (avgFps < 30 && this.quality !== 'low') {
      this.quality = 'low';
      this.emit('quality-change', 'low');
      console.warn('Performance degraded, switching to low quality');
    } else if (avgFps < 45 && this.quality !== 'medium') {
      this.quality = 'medium';
      this.emit('quality-change', 'medium');
    } else if (avgFps >= 55 && this.quality !== 'high') {
      this.quality = 'high';
      this.emit('quality-change', 'high');
    }

    // 内存压力检测
    if (this.memoryUsage > 200) {
      this.emit('memory-pressure', this.memoryUsage);
      console.warn(`High memory usage: ${this.memoryUsage}MB`);
    }
  }

  getAverageFPS() {
    if (this.fpsHistory.length === 0) return 60;
    return this.fpsHistory.reduce((a, b) => a + b) / this.fpsHistory.length;
  }

  getLevel() {
    const avgFps = this.getAverageFPS();
    if (avgFps < 30) return 1; // low
    if (avgFps < 45) return 2; // medium
    if (avgFps < 55) return 3; // high
    return 4; // ultra
  }

  getReport() {
    return {
      fps: {
        current: this.fps,
        average: this.getAverageFPS(),
        min: Math.min(...this.fpsHistory),
        max: Math.max(...this.fpsHistory),
      },
      memory: {
        usage: this.memoryUsage,
        limit: performance.memory?.jsHeapSizeLimit / 1048576,
      },
      quality: this.quality,
      recommendation: this.getRecommendation(),
    };
  }

  getRecommendation() {
    const level = this.getLevel();
    if (level === 1) {
      return '建议关闭动画或切换到轻量主题';
    } else if (level === 2) {
      return '当前性能一般，建议降低粒子密度';
    } else if (level === 3) {
      return '性能良好';
    } else {
      return '性能优秀，可启用高级效果';
    }
  }
}
```

### 6.2 渲染优化策略

#### 策略 1: 动态降级
```javascript
质量档位定义:

Ultra (Level 4):
- WebGL 着色器
- 60fps 目标
- 粒子数量: 100%
- 特效全开
- 适用于: 高性能设备

High (Level 3):
- Canvas 2D / 简单 WebGL
- 60fps 目标
- 粒子数量: 75%
- 部分特效
- 适用于: 主流设备

Medium (Level 2):
- Canvas 2D
- 45fps 目标
- 粒子数量: 50%
- 基础特效
- 适用于: 中等设备

Low (Level 1):
- CSS 动画
- 30fps 目标
- 粒子数量: 25%
- 特效禁用
- 适用于: 低端设备

Static (Level 0):
- 纯静态图片
- 无动画
- 无粒子
- 适用于: 极低端/省电模式
```

#### 策略 2: 后台节流
```javascript
class BackgroundThrottler {
  constructor(themeEngine) {
    this.engine = themeEngine;
    this.isVisible = !document.hidden;
    this.normalFPS = 60;
    this.backgroundFPS = 5;

    document.addEventListener('visibilitychange', () => {
      this.isVisible = !document.hidden;
      this.handleVisibilityChange();
    });
  }

  handleVisibilityChange() {
    if (this.isVisible) {
      // 恢复正常帧率
      this.engine.setTargetFPS(this.normalFPS);
      console.log('Restored normal rendering');
    } else {
      // 降低到后台帧率
      this.engine.setTargetFPS(this.backgroundFPS);
      console.log('Switched to background throttling');
    }
  }
}
```

#### 策略 3: 对象池
```javascript
class ParticlePool {
  constructor(maxSize = 1000) {
    this.pool = [];
    this.maxSize = maxSize;
    this.active = [];
  }

  acquire() {
    let particle;
    if (this.pool.length > 0) {
      // 从池中复用
      particle = this.pool.pop();
    } else {
      // 创建新对象
      particle = {
        x: 0, y: 0,
        vx: 0, vy: 0,
        size: 1,
        opacity: 1,
        life: 1,
      };
    }
    this.active.push(particle);
    return particle;
  }

  release(particle) {
    const index = this.active.indexOf(particle);
    if (index !== -1) {
      this.active.splice(index, 1);
      if (this.pool.length < this.maxSize) {
        // 重置并放回池中
        particle.life = 0;
        this.pool.push(particle);
      }
    }
  }

  releaseAll() {
    while (this.active.length > 0) {
      const particle = this.active.pop();
      if (this.pool.length < this.maxSize) {
        this.pool.push(particle);
      }
    }
  }
}
```

#### 策略 4: 离屏渲染
```javascript
class OffscreenRenderer {
  constructor(width, height) {
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = width;
    this.offscreenCanvas.height = height;
    this.offscreenCtx = this.offscreenCanvas.getContext('2d');
  }

  // 预渲染静态元素
  preRender(drawFunction) {
    this.offscreenCtx.clearRect(
      0, 0,
      this.offscreenCanvas.width,
      this.offscreenCanvas.height
    );
    drawFunction(this.offscreenCtx);
  }

  // 将预渲染结果绘制到主画布
  drawToCanvas(ctx, x = 0, y = 0) {
    ctx.drawImage(this.offscreenCanvas, x, y);
  }
}

// 使用示例
const backgroundRenderer = new OffscreenRenderer(1920, 1080);
backgroundRenderer.preRender((ctx) => {
  // 绘制复杂背景（只需一次）
  drawComplexBackground(ctx);
});

// 每帧只需复制预渲染结果
function render(ctx) {
  backgroundRenderer.drawToCanvas(ctx); // 快速
  drawDynamicElements(ctx); // 只渲染动态部分
}
```

### 6.3 内存管理

#### 策略: 纹理/资源管理
```javascript
class ResourceManager {
  constructor() {
    this.textures = new Map();
    this.maxCacheSize = 50 * 1024 * 1024; // 50MB
    this.currentSize = 0;
  }

  async loadTexture(url) {
    // 检查缓存
    if (this.textures.has(url)) {
      const cached = this.textures.get(url);
      cached.refs++;
      cached.lastUsed = Date.now();
      return cached.image;
    }

    // 加载新纹理
    const image = await this.loadImage(url);
    const size = this.estimateSize(image);

    // 检查是否需要淘汰
    if (this.currentSize + size > this.maxCacheSize) {
      this.evict(size);
    }

    // 缓存
    this.textures.set(url, {
      image,
      size,
      refs: 1,
      lastUsed: Date.now(),
    });
    this.currentSize += size;

    return image;
  }

  releaseTexture(url) {
    const cached = this.textures.get(url);
    if (cached) {
      cached.refs = Math.max(0, cached.refs - 1);
    }
  }

  evict(requiredSize) {
    // LRU 淘汰：优先淘汰无引用且最久未用的
    const candidates = Array.from(this.textures.entries())
      .filter(([url, data]) => data.refs === 0)
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed);

    let freed = 0;
    for (const [url, data] of candidates) {
      if (freed >= requiredSize) break;
      
      this.textures.delete(url);
      this.currentSize -= data.size;
      freed += data.size;
      
      console.log(`Evicted texture: ${url} (${data.size} bytes)`);
    }
  }

  estimateSize(image) {
    // 估算图片内存占用 (width * height * 4 bytes per pixel)
    return image.width * image.height * 4;
  }

  loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  clear() {
    this.textures.clear();
    this.currentSize = 0;
  }

  getStats() {
    return {
      cached: this.textures.size,
      totalSize: this.currentSize,
      maxSize: this.maxCacheSize,
      usage: (this.currentSize / this.maxCacheSize * 100).toFixed(1) + '%',
    };
  }
}
```

---

## 📅 开发计划

### Phase 1: 核心引擎（4 周）

#### Week 1: 架构搭建
- [x] ThemeEngine 核心类设计
- [x] BaseRenderer 接口定义
- [x] PerformanceMonitor 实现
- [x] 基础 Canvas2DRenderer
- [ ] 单元测试（覆盖率 80%+）

**交付物**:
- 可运行的主题引擎 demo
- 性能监控面板
- 技术文档

#### Week 2: 动态背景实现
- [ ] 粒子系统（星空、雨雪、代码雨）
- [ ] 渐变动画（极光、呼吸灯）
- [ ] 几何动画（波纹、网格）
- [ ] 效果参数化

**交付物**:
- 5 种粒子效果
- 3 种渐变动画
- 3 种几何动画
- 配置 JSON schema

#### Week 3: 交互层实现
- [ ] InteractionLayer 类
- [ ] 鼠标跟随效果
- [ ] 点击特效（涟漪、爆炸）
- [ ] 滚动视差
- [ ] 触摸支持（移动端未来）

**交付物**:
- 完整交互系统
- 交互效果 demo
- 性能基准测试

#### Week 4: WebGL 渲染器
- [ ] WebGLRenderer 实现
- [ ] 着色器编译器
- [ ] 内置 Shader 库（5-10 个）
- [ ] ShaderToy 兼容层

**交付物**:
- WebGL 渲染器
- 10 个预设 Shader
- Shader 文档

**里程碑 1**: ✅ 核心引擎完成，支持 15+ 动态效果

---

### Phase 2: 主题商店（4 周）

#### Week 5: UI 设计与实现
- [ ] 三栏布局实现
- [ ] 主题卡片组件
- [ ] 详情页设计
- [ ] 搜索与筛选
- [ ] 响应式适配

**交付物**:
- 完整 UI 界面
- 组件库文档

#### Week 6: 主题管理
- [ ] 主题安装/卸载
- [ ] 主题切换动画
- [ ] 配置持久化
- [ ] 版本管理
- [ ] 更新检测

**交付物**:
- 主题管理系统
- 安装流程测试

#### Week 7: GitHub Registry 集成
- [ ] GitHub API 集成
- [ ] 主题索引构建
- [ ] CDN 加速（jsDelivr）
- [ ] 离线缓存
- [ ] 错误处理

**交付物**:
- Registry 服务
- API 文档

#### Week 8: 社区功能
- [ ] 评分系统（本地存储）
- [ ] 评论系统（GitHub Issues）
- [ ] 收藏功能
- [ ] 分享功能（生成链接）

**交付物**:
- 社区功能完整
- 用户指南

**里程碑 2**: ✅ 主题商店上线，包含 30+ 预设主题

---

### Phase 3: 创作工具（3 周）

#### Week 9-10: 在线编辑器
- [ ] Monaco Editor 集成
- [ ] 文件系统（虚拟）
- [ ] 实时预览
- [ ] 错误提示
- [ ] 代码补全

**交付物**:
- 在线编辑器
- 开发者文档

#### Week 11: 可视化编辑器
- [ ] 粒子编辑器
- [ ] 参数面板
- [ ] 预设模板
- [ ] 导出功能

**交付物**:
- 无代码编辑器
- 模板库（10+）

**里程碑 3**: ✅ 创作工具完成，用户可创作主题

---

### Phase 4: 优化与上线（2 周）

#### Week 12: 性能优化
- [ ] 性能基准测试
- [ ] 内存泄漏检测
- [ ] 打包优化
- [ ] 懒加载实现

**交付物**:
- 性能报告
- 优化文档

#### Week 13: 测试与发布
- [ ] 集成测试
- [ ] Beta 用户测试
- [ ] Bug 修复
- [ ] 文档完善
- [ ] v2.0 发布

**交付物**:
- Dream Skin Plus v2.0
- 完整文档
- 发布说明

**里程碑 4**: ✅ v2.0 正式发布

---

## 📊 成功指标

### 技术指标
- ✅ 60fps 稳定运行（主流设备）
- ✅ CPU 占用 < 15%（动态主题）
- ✅ 内存占用 < 50MB（正常使用）
- ✅ 首次加载 < 2 秒
- ✅ 主题切换 < 1 秒

### 用户指标
- ✅ 内置主题 30+
- ✅ 社区主题 50+（3 个月内）
- ✅ 日活用户 1000+
- ✅ 主题安装 10,000+
- ✅ 用户满意度 4.5+/5

### 创作者指标
- ✅ 创作者 20+
- ✅ 平均评分 4.0+
- ✅ 月新增主题 10+

---

## 💡 未来展望

### v2.1 (Q4 2026)
- 🎵 音频可视化（对话语音）
- 🌐 主题国际化
- 📱 移动端优化
- 🎮 游戏引擎集成（Phaser.js）

### v2.2 (Q1 2027)
- 🤖 AI 生成主题（文本 → 主题）
- 🔗 主题联动（随对话内容变化）
- 🎨 3D 主题（Three.js）
- 🌈 AR 效果（实验性）

### v3.0 (Q2 2027)
- 🎬 视频主题编辑器
- 🎼 音乐响应式主题
- 🌍 实时协作创作
- 💰 付费主题市场

---

## 🎓 总结

Dream Skin Plus 的核心价值是**让 ChatGPT 界面从工具变成艺术品**。

### 关键成功因素
1. **视觉震撼** - 第一眼就被吸引
2. **性能平衡** - 美观不影响使用
3. **创作自由** - 人人都能创作
4. **社区生态** - 分享与发现
5. **持续迭代** - 永不停止创新

### 下一步行动
1. ✅ 评审本设计方案
2. ✅ 确定开发优先级
3. ✅ 组建开发团队（或独立开发）
4. ✅ 启动 Phase 1 开发
5. ✅ 建立社区频道

**让我们一起打造 Wallpaper Engine 级别的主题系统！** 🚀
