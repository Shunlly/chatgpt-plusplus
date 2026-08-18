# Dream Skin → Wallpaper Engine 级别升级方案

**目标**: 将当前的 Dream Skin 从"静态图片换肤工具"升级为"Wallpaper Engine 级别的动态主题系统"

**原则**: 专注、克制、可落地

---

## 📊 现状 vs 目标

### 当前 Dream Skin（v1.x）

```
功能:
✅ 上传图片生成主题
✅ 内置 6 个预设主题
✅ 颜色自动提取
✅ 主题持久化

限制:
❌ 只支持静态图片
❌ 预设太少
❌ 无动画效果
❌ 无交互
❌ 无社区分享
```

### 目标 Dream Skin（v2.0）

```
核心升级:
✅ 动态背景（粒子/渐变/视频）
✅ 交互效果（鼠标跟随/点击特效）
✅ 丰富预设（30+ 精美主题）
✅ 主题商店（社区分享）
✅ 性能优化（60fps + 动态降级）

保持简洁:
- 不做 3D
- 不做 VR/AR
- 不做过度复杂的编辑器
- 专注核心体验
```

---

## 🎯 升级策略：三步走

### 第一步：动态化（4 周）
**目标**: 从静态到动态，支持基础动画效果

**核心功能**:
1. **粒子系统**
   - 星空粒子
   - 代码雨（矩阵风格）
   - 雪花飘落

2. **渐变动画**
   - 多色流动渐变
   - 极光效果
   - 呼吸灯

3. **视频壁纸**
   - MP4 循环播放
   - 低性能设备降级到静态

**技术实现**:
- Canvas 2D 渲染器
- 基础性能监控
- 60fps 目标

**交付物**:
- 10 个动态预设主题
- 用户可在静态/动态间切换

---

### 第二步：交互化（2 周）
**目标**: 增加交互效果，提升沉浸感

**核心功能**:
1. **鼠标跟随**
   - 光晕跟随鼠标
   - 粒子躲避鼠标

2. **点击特效**
   - 涟漪波纹
   - 粒子爆炸

3. **打字效果**（可选）
   - 输入时键盘区域闪烁
   - 代码雨加速

**技术实现**:
- 事件监听层
- 交互效果与主题解耦
- 可配置开关（性能考虑）

**交付物**:
- 所有动态主题支持交互
- 设置页可关闭交互效果

---

### 第三步：社区化（2 周）
**目标**: 建立主题分享生态

**核心功能**:
1. **主题商店**
   - 浏览社区主题
   - 一键安装
   - 预览动画

2. **主题上传**
   - 用户可上传自己的主题
   - 简单审核机制

3. **评分/收藏**
   - 本地评分（同步到 GitHub）
   - 收藏列表

**技术实现**:
- GitHub 作为存储（零成本）
- jsDelivr CDN 加速
- 主题包格式标准化

**交付物**:
- 主题商店 UI
- 30+ 初始主题库
- 上传工具

---

## 🎨 核心技术设计

### 1. 主题包格式（极简版）

```json
{
  "id": "cyberpunk-rain",
  "name": "赛博朋克代码雨",
  "type": "canvas",
  "preview": "preview.gif",
  "performance": "medium",
  "effects": [
    {
      "type": "particles",
      "config": {
        "count": 100,
        "speed": 5,
        "color": "#00ff00",
        "shape": "text",
        "text": "01アイウエオ"
      }
    }
  ],
  "interactive": {
    "mouse": true,
    "click": true
  }
}
```

**3 种主题类型**:
- `static` - 静态图片（已有）
- `canvas` - Canvas 动画（新增）
- `video` - 视频壁纸（新增）

### 2. 渲染架构（简化版）

```javascript
// 核心引擎
class DreamSkinEngine {
  constructor() {
    this.renderer = null;
    this.currentTheme = null;
    this.performance = new PerformanceMonitor();
  }

  // 加载主题
  loadTheme(theme) {
    // 根据类型选择渲染器
    switch(theme.type) {
      case 'static':
        this.renderer = new StaticRenderer(theme);
        break;
      case 'canvas':
        this.renderer = new CanvasRenderer(theme);
        break;
      case 'video':
        this.renderer = new VideoRenderer(theme);
        break;
    }
    
    this.renderer.start();
  }

  // 渲染循环
  render(deltaTime) {
    if (this.renderer) {
      this.performance.measure();
      this.renderer.update(deltaTime);
      this.renderer.draw();
    }
  }
}

// Canvas 渲染器
class CanvasRenderer {
  constructor(theme) {
    this.canvas = document.getElementById('dream-skin-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.effects = this.createEffects(theme.effects);
  }

  createEffects(configs) {
    return configs.map(cfg => {
      switch(cfg.type) {
        case 'particles':
          return new ParticleEffect(cfg.config);
        case 'gradient':
          return new GradientEffect(cfg.config);
        default:
          return null;
      }
    }).filter(Boolean);
  }

  update(dt) {
    this.effects.forEach(e => e.update(dt));
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.effects.forEach(e => e.draw(this.ctx));
  }
}
```

### 3. 粒子系统（通用）

```javascript
class ParticleEffect {
  constructor(config) {
    this.particles = [];
    this.config = config;
    this.init();
  }

  init() {
    for (let i = 0; i < this.config.count; i++) {
      this.particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * this.config.speed,
        vy: (Math.random() - 0.5) * this.config.speed,
        size: Math.random() * 3 + 1,
        opacity: Math.random(),
      });
    }
  }

  update(dt) {
    this.particles.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      
      // 边界循环
      if (p.x < 0) p.x = window.innerWidth;
      if (p.x > window.innerWidth) p.x = 0;
      if (p.y < 0) p.y = window.innerHeight;
      if (p.y > window.innerHeight) p.y = 0;
    });
  }

  draw(ctx) {
    this.particles.forEach(p => {
      ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}
```

### 4. 性能优化（关键）

```javascript
class PerformanceMonitor {
  constructor() {
    this.fps = 60;
    this.quality = 'auto';
  }

  measure() {
    // 测量 FPS
    this.fps = this.calculateFPS();
    
    // 自动降级
    if (this.fps < 30) {
      this.quality = 'low';
      this.emit('downgrade', 'low');
    } else if (this.fps < 45) {
      this.quality = 'medium';
    } else {
      this.quality = 'high';
    }
  }

  // 降级策略
  downgrade() {
    // 减少粒子数量
    // 降低刷新率
    // 简化渲染
  }
}
```

---

## 🎬 初始主题库（30个）

### 分类设计

```
1. 抽象艺术 (5个)
   - 彩虹渐变流动
   - 几何粒子云
   - 光谱波纹
   - 液态金属
   - 抽象线条

2. 自然风光 (5个)
   - 星空银河 ⭐
   - 极光之夜 ⭐
   - 樱花飘落
   - 海洋波浪
   - 雨天窗户

3. 科幻未来 (5个)
   - 矩阵代码雨 ⭐⭐⭐ (最优先)
   - 赛博朋克霓虹 ⭐⭐
   - 全息投影
   - 数据流
   - 量子粒子

4. 极简主义 (5个)
   - 纯色呼吸 ⭐
   - 简约线条
   - 极简渐变
   - 单色噪点
   - 黑白几何

5. 赛博朋克 (5个)
   - 霓虹雨夜 ⭐⭐
   - 故障艺术
   - 扫描线
   - 像素雨
   - 终端矩阵

6. 动漫二次元 (5个)
   - 樱花季节
   - 星空物语
   - 夜空焰火
   - 魔法粒子
   - 光之翼

⭐ = 优先级
```

### 最优先开发（5个）

#### 1. 矩阵代码雨（赛博朋克经典）
```javascript
效果:
- 绿色代码字符从上往下流动
- 速度随机
- 鼠标经过时代码分开
- 点击产生涟漪

参数:
- 速度: 1-10
- 密度: 低/中/高
- 颜色: #00ff00（可改）
- 字符集: 01 + 日文片假名
```

#### 2. 星空银河（自然经典）
```javascript
效果:
- 白色星点闪烁
- 缓慢移动
- 大小不一
- 鼠标靠近时星星变亮

参数:
- 星星数量: 50-200
- 闪烁速度: 慢/中/快
- 移动速度: 0-5
```

#### 3. 极光之夜（视觉震撼）
```javascript
效果:
- 多色渐变流动
- 类似北极光
- 平滑过渡
- 无交互（纯视觉）

参数:
- 颜色组合: 蓝绿/紫红/橙黄
- 流动速度: 1-10
- 波动幅度: 小/中/大
```

#### 4. 赛博朋克霓虹（热门风格）
```javascript
效果:
- 霓虹线条
- 故障闪烁
- 扫描线效果
- 点击产生电流

参数:
- 霓虹颜色: 粉红/蓝色/紫色
- 闪烁频率: 低/中/高
- 故障强度: 0-10
```

#### 5. 纯色呼吸（极简派）
```javascript
效果:
- 单色背景
- 缓慢明暗变化
- 类似呼吸节奏
- 无交互（专注）

参数:
- 基础颜色: 任意
- 呼吸速度: 慢/中/快
- 变化幅度: 10-50%
```

---

## 🛍️ 主题商店（MVP版）

### UI 设计（极简）

```
┌────────────────────────────────────────┐
│ Dream Skin 主题                        │
│ ┌─────────┐  当前: 赛博朋克代码雨     │
│ │ [预览]  │  [更换]                    │
│ └─────────┘                            │
├────────────────────────────────────────┤
│ 🔍 搜索...         [分类 ▼] [排序 ▼]  │
├────────────────────────────────────────┤
│                                        │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐    │
│  │     │ │     │ │     │ │     │    │
│  │ 主题1│ │ 主题2│ │ 主题3│ │ 主题4│    │
│  │     │ │     │ │     │ │     │    │
│  │ ⭐4.8│ │ ⭐4.6│ │ ⭐4.9│ │ ⭐4.5│    │
│  │📥1.2k│ │📥890│ │📥2.3k│ │📥650│    │
│  └─────┘ └─────┘ └─────┘ └─────┘    │
│                                        │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐    │
│  │ 主题5│ │ 主题6│ │ 主题7│ │ 主题8│    │
│  └─────┘ └─────┘ └─────┘ └─────┘    │
│                                        │
│         [加载更多...]                  │
│                                        │
├────────────────────────────────────────┤
│ 💾 我的主题 (3)                        │
│ 📤 上传主题                            │
└────────────────────────────────────────┘
```

### 主题详情（点击后）

```
┌────────────────────────────────────────┐
│ ← 返回                                 │
├────────────────────────────────────────┤
│                                        │
│     [全屏动态预览]                     │
│     （实际效果展示）                   │
│                                        │
├────────────────────────────────────────┤
│ 🌌 赛博朋克代码雨                      │
│ by @creator  •  ⭐ 4.8 (128)          │
│ 📥 1,258 次安装                        │
├────────────────────────────────────────┤
│ 矩阵风格的代码雨，支持鼠标交互        │
│                                        │
│ 性能: 🟡 中等 (~10% CPU)              │
│ 类型: 🎬 动态 ⚡ 交互                  │
├────────────────────────────────────────┤
│ ⚙️ 自定义                              │
│ 代码速度  [━━━●━━━] 5                 │
│ 代码颜色  [🎨 #00ff00]                │
│ 粒子密度  [低] ●[中] [高]             │
│ 鼠标效果  ☑ 启用                      │
├────────────────────────────────────────┤
│      [立即安装]  [收藏]                │
└────────────────────────────────────────┘
```

### 技术实现（GitHub）

```
仓库结构:
github.com/chatgpt-plusplus/themes/
├── index.json (主题索引)
├── themes/
│   ├── cyberpunk-rain/
│   │   ├── manifest.json
│   │   ├── theme.js
│   │   ├── preview.gif
│   │   └── README.md
│   ├── starry-sky/
│   │   └── ...
│   └── ...
└── README.md

CDN:
https://cdn.jsdelivr.net/gh/chatgpt-plusplus/themes@main/themes/cyberpunk-rain/theme.js

API:
GET https://api.github.com/repos/chatgpt-plusplus/themes/contents/themes
→ 获取主题列表

客户端缓存:
- 安装后本地缓存
- 定期检查更新
- 离线可用
```

---

## ⚡ 性能优化（必须）

### 1. 动态降级

```javascript
性能档位:

High (FPS > 55):
- 粒子数量 100%
- 60fps 目标
- 所有特效开启

Medium (FPS 30-55):
- 粒子数量 50%
- 45fps 目标
- 减少特效

Low (FPS < 30):
- 粒子数量 25%
- 30fps 目标
- 禁用交互

Emergency (FPS < 20):
- 切回静态图
- 提示用户
```

### 2. 后台节流

```javascript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // 降到 5fps 或暂停
    engine.setFPS(5);
  } else {
    // 恢复正常
    engine.setFPS(60);
  }
});
```

### 3. 内存管理

```javascript
- 粒子对象池（复用）
- Canvas 尺寸限制
- 定期 GC
- Blob URL 释放
```

---

## 📅 8 周开发计划

### Week 1-2: 核心引擎
- [x] DreamSkinEngine 架构
- [ ] CanvasRenderer 实现
- [ ] PerformanceMonitor
- [ ] 粒子系统基础

**交付**: 可运行的代码雨 demo

### Week 3: 预设主题
- [ ] 矩阵代码雨
- [ ] 星空银河
- [ ] 极光之夜
- [ ] 纯色呼吸
- [ ] 赛博朋克霓虹

**交付**: 5 个精品主题

### Week 4: 交互层
- [ ] 鼠标跟随
- [ ] 点击特效
- [ ] 配置界面

**交付**: 交互功能完整

### Week 5: 扩充主题库
- [ ] 再做 10 个主题
- [ ] 视频壁纸支持
- [ ] 性能测试

**交付**: 15 个主题

### Week 6: 主题商店 UI
- [ ] 商店界面
- [ ] 详情页
- [ ] 安装流程

**交付**: 商店 MVP

### Week 7: GitHub 集成
- [ ] themes 仓库搭建
- [ ] 30 个主题打包
- [ ] CDN 配置
- [ ] 自动更新

**交付**: 完整主题库

### Week 8: 优化上线
- [ ] 性能优化
- [ ] Bug 修复
- [ ] 文档完善
- [ ] v2.0 发布

**交付**: Dream Skin v2.0

---

## ✅ 成功标准

### 技术指标
- ✅ 60fps（主流设备）
- ✅ CPU < 15%（动态主题）
- ✅ 内存 < 30MB
- ✅ 加载 < 1 秒

### 用户体验
- ✅ 30+ 精美主题
- ✅ 流畅动画
- ✅ 一键切换
- ✅ 简单配置

### 社区反馈
- ✅ GitHub Stars +500
- ✅ 用户好评 90%+
- ✅ 社区主题 10+（3个月）

---

## 🎯 核心价值

**一句话**: 让 ChatGPT 界面从"工具窗口"变成"艺术品"。

### 用户视角
> "哇！这个代码雨太酷了！"
> "我的 ChatGPT 比别人的好看太多！"
> "每天换一个主题，心情都变好了！"

### 对比竞品
- OpenAI 官方: 只有亮/暗两种模式
- 其他增强工具: 最多改改颜色
- Dream Skin v2: Wallpaper Engine 级别动态主题

---

## 🚀 下一步行动

1. **确认方案** ✅
2. **搭建开发环境** 
   - Fork 项目
   - 创建 `dream-skin-v2` 分支
3. **Week 1 开发启动**
   - 实现核心引擎
   - 做出代码雨 demo
4. **持续迭代**
   - 每周发布进度
   - 社区收集反馈

**专注做好一件事：让 Dream Skin 成为 ChatGPT 最好的主题系统！** 🎨
