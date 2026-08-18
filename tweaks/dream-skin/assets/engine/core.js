/**
 * Dream Skin v2.0 - 核心渲染引擎
 * 支持静态图片、Canvas 动画、视频壁纸三种主题类型
 */

"use strict";

// ==============================
// 性能监控器
// ==============================
class PerformanceMonitor {
  constructor() {
    this.fps = 60;
    this.quality = "high"; // high, medium, low, emergency
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fpsHistory = [];
    this.listeners = new Map();
  }

  measure() {
    const now = performance.now();
    const delta = now - this.lastTime;

    if (delta >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / delta);
      this.frameCount = 0;
      this.lastTime = now;

      // 保留最近 10 秒的 FPS 历史
      this.fpsHistory.push(this.fps);
      if (this.fpsHistory.length > 10) {
        this.fpsHistory.shift();
      }

      // 自动降级策略
      this.adjustQuality();
    }

    this.frameCount++;
    return this.fps;
  }

  adjustQuality() {
    const avgFps = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
    let newQuality = this.quality;

    if (avgFps < 20) {
      newQuality = "emergency";
    } else if (avgFps < 30) {
      newQuality = "low";
    } else if (avgFps < 45) {
      newQuality = "medium";
    } else if (avgFps >= 55) {
      newQuality = "high";
    }

    if (newQuality !== this.quality) {
      const oldQuality = this.quality;
      this.quality = newQuality;
      this.emit("qualityChange", { from: oldQuality, to: newQuality, fps: avgFps });
    }
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
  }

  emit(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(h => h(data));
    }
  }

  getQualityMultiplier() {
    switch (this.quality) {
      case "high": return 1.0;
      case "medium": return 0.5;
      case "low": return 0.25;
      case "emergency": return 0.0;
      default: return 1.0;
    }
  }
}

// ==============================
// 基础渲染器接口
// ==============================
class BaseRenderer {
  constructor(theme, performance) {
    this.theme = theme;
    this.performance = performance;
    this.active = false;
  }

  start() {
    this.active = true;
  }

  stop() {
    this.active = false;
  }

  update(deltaTime) {
    // 由子类实现
  }

  draw() {
    // 由子类实现
  }

  cleanup() {
    this.stop();
  }
}

// ==============================
// 静态图片渲染器（兼容 v1.x）
// ==============================
class StaticRenderer extends BaseRenderer {
  constructor(theme, performance) {
    super(theme, performance);
  }

  start() {
    super.start();
    // 静态渲染器不需要持续更新
  }

  update(deltaTime) {
    // 静态图片无需更新
  }

  draw() {
    // 静态图片通过 CSS 背景实现，无需手动绘制
  }
}

// ==============================
// Canvas 渲染器（新增）
// ==============================
class CanvasRenderer extends BaseRenderer {
  constructor(theme, performance) {
    super(theme, performance);
    this.canvas = null;
    this.ctx = null;
    this.effects = [];
    this.width = 0;
    this.height = 0;
  }

  start() {
    super.start();

    // 创建 Canvas 元素
    this.canvas = document.createElement("canvas");
    this.canvas.id = "dream-skin-canvas";
    this.canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: -1;
      pointer-events: none;
    `;

    this.ctx = this.canvas.getContext("2d", { alpha: false });
    this.resize();

    // 监听窗口大小变化
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(document.body);

    // 创建效果实例
    this.effects = this.createEffects(this.theme.effects || []);

    // 插入到 DOM
    const container = document.getElementById("codex-dream-skin-chrome") || document.body;
    container.appendChild(this.canvas);

    // 添加交互支持
    if (this.theme.interactive) {
      this.setupInteractions();
    }
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  createEffects(configs) {
    return configs.map(cfg => {
      switch (cfg.type) {
        case "particles":
          return new ParticleEffect(cfg.config, this.performance);
        case "gradient":
          return new GradientEffect(cfg.config, this.performance);
        case "matrix-rain":
          return window.MatrixRainEffect ? new window.MatrixRainEffect(cfg.config, this.performance) : null;
        case "starry-galaxy":
          return window.StarryGalaxyEffect ? new window.StarryGalaxyEffect(cfg.config, this.performance) : null;
        case "aurora":
          return window.AuroraEffect ? new window.AuroraEffect(cfg.config, this.performance) : null;
        case "breathing":
          return window.BreathingEffect ? new window.BreathingEffect(cfg.config, this.performance) : null;
        case "cyberpunk-neon":
          return window.CyberpunkNeonEffect ? new window.CyberpunkNeonEffect(cfg.config, this.performance) : null;
        default:
          console.warn(`[dream-skin] Unknown effect type: ${cfg.type}`);
          return null;
      }
    }).filter(Boolean);
  }

  update(deltaTime) {
    if (!this.active) return;

    // 更新所有效果
    this.effects.forEach(effect => effect.update(deltaTime));
  }

  draw() {
    if (!this.active || !this.ctx) return;

    // 清空画布
    this.ctx.fillStyle = this.theme.backgroundColor || "#000000";
    this.ctx.fillRect(0, 0, this.width, this.height);

    // 绘制所有效果
    this.effects.forEach(effect => effect.draw(this.ctx));
  }

  setupInteractions() {
    // 鼠标移动
    if (this.theme.interactive.mouse) {
      this.mouseMoveHandler = (e) => {
        this.effects.forEach(effect => {
          if (effect.onMouseMove) {
            effect.onMouseMove(e.clientX, e.clientY);
          }
        });
      };
      document.addEventListener("mousemove", this.mouseMoveHandler);
    }

    // 鼠标点击
    if (this.theme.interactive.click) {
      this.clickHandler = (e) => {
        this.effects.forEach(effect => {
          if (effect.onClick) {
            effect.onClick(e.clientX, e.clientY);
          }
        });
      };
      document.addEventListener("click", this.clickHandler);
    }
  }

  cleanup() {
    super.cleanup();

    // 移除事件监听
    if (this.mouseMoveHandler) {
      document.removeEventListener("mousemove", this.mouseMoveHandler);
      this.mouseMoveHandler = null;
    }

    if (this.clickHandler) {
      document.removeEventListener("click", this.clickHandler);
      this.clickHandler = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.effects.forEach(effect => {
      if (effect.cleanup) effect.cleanup();
    });
    this.effects = [];

    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
    }

    this.ctx = null;
  }
}

// ==============================
// 视频渲染器（新增）
// ==============================
class VideoRenderer extends BaseRenderer {
  constructor(theme, performance) {
    super(theme, performance);
    this.video = null;
  }

  start() {
    super.start();

    // 创建 Video 元素
    this.video = document.createElement("video");
    this.video.id = "dream-skin-video";
    this.video.src = this.theme.videoUrl;
    this.video.loop = true;
    this.video.muted = true;
    this.video.autoplay = true;
    this.video.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      z-index: -1;
      pointer-events: none;
    `;

    // 监听性能降级
    this.performance.on("qualityChange", (data) => {
      if (data.to === "emergency") {
        // 紧急降级：暂停视频
        this.video.pause();
      } else if (data.from === "emergency" && data.to !== "emergency") {
        // 恢复播放
        this.video.play().catch(e => console.warn("[dream-skin] video play failed", e));
      }
    });

    // 插入到 DOM
    const container = document.getElementById("codex-dream-skin-chrome") || document.body;
    container.appendChild(this.video);

    // 开始播放
    this.video.play().catch(e => console.warn("[dream-skin] video autoplay failed", e));
  }

  update(deltaTime) {
    // 视频自动播放，无需手动更新
  }

  draw() {
    // 视频通过 DOM 渲染，无需手动绘制
  }

  cleanup() {
    super.cleanup();

    if (this.video) {
      this.video.pause();
      this.video.remove();
      this.video = null;
    }
  }
}

// ==============================
// 粒子效果
// ==============================
class ParticleEffect {
  constructor(config, performance) {
    this.config = {
      count: 100,
      speed: 5,
      color: "#ffffff",
      size: 2,
      opacity: 0.8,
      shape: "circle", // circle, square, text
      text: "•",
      ...config,
    };
    this.performance = performance;
    this.particles = [];
    this.init();
  }

  init() {
    const count = Math.floor(this.config.count * this.performance.getQualityMultiplier());
    this.particles = [];

    for (let i = 0; i < count; i++) {
      this.particles.push(this.createParticle());
    }
  }

  createParticle() {
    return {
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * this.config.speed,
      vy: (Math.random() - 0.5) * this.config.speed,
      size: Math.random() * this.config.size + 1,
      opacity: Math.random() * this.config.opacity,
      rotation: Math.random() * Math.PI * 2,
    };
  }

  update(deltaTime) {
    // 根据性能调整粒子数量
    const targetCount = Math.floor(this.config.count * this.performance.getQualityMultiplier());
    if (this.particles.length > targetCount) {
      this.particles.length = targetCount;
    } else if (this.particles.length < targetCount && this.performance.quality !== "emergency") {
      while (this.particles.length < targetCount) {
        this.particles.push(this.createParticle());
      }
    }

    // 更新粒子位置
    const dt = deltaTime / 1000; // 转换为秒
    this.particles.forEach(p => {
      p.x += p.vx * dt * 60; // 归一化到 60fps
      p.y += p.vy * dt * 60;

      // 边界循环
      if (p.x < -10) p.x = window.innerWidth + 10;
      if (p.x > window.innerWidth + 10) p.x = -10;
      if (p.y < -10) p.y = window.innerHeight + 10;
      if (p.y > window.innerHeight + 10) p.y = -10;
    });
  }

  draw(ctx) {
    if (this.performance.quality === "emergency") return;

    this.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = this.config.color;

      if (this.config.shape === "text") {
        ctx.font = `${p.size * 10}px monospace`;
        ctx.fillText(this.config.text, p.x, p.y);
      } else if (this.config.shape === "square") {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else {
        // circle (default)
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });
  }

  cleanup() {
    this.particles = [];
  }
}

// ==============================
// 渐变效果
// ==============================
class GradientEffect {
  constructor(config, performance) {
    this.config = {
      colors: ["#667eea", "#764ba2"],
      speed: 0.001,
      angle: 0,
      ...config,
    };
    this.performance = performance;
    this.time = 0;
  }

  update(deltaTime) {
    if (this.performance.quality === "emergency") return;

    this.time += deltaTime * this.config.speed;
  }

  draw(ctx) {
    if (this.performance.quality === "emergency") return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // 创建渐变
    const angle = this.config.angle + this.time;
    const x1 = width / 2 + Math.cos(angle) * width;
    const y1 = height / 2 + Math.sin(angle) * height;
    const x2 = width / 2 - Math.cos(angle) * width;
    const y2 = height / 2 - Math.sin(angle) * height;

    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);

    this.config.colors.forEach((color, index) => {
      gradient.addColorStop(index / (this.config.colors.length - 1), color);
    });

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  cleanup() {
    // 无需清理
  }
}

// ==============================
// Dream Skin 引擎
// ==============================
class DreamSkinEngine {
  constructor() {
    this.renderer = null;
    this.currentTheme = null;
    this.performance = new PerformanceMonitor();
    this.animationId = null;
    this.lastFrameTime = performance.now();
    this.paused = false;

    // 监听页面可见性变化
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.pause();
      } else {
        this.resume();
      }
    });
  }

  loadTheme(theme) {
    // 清理旧渲染器
    if (this.renderer) {
      this.renderer.cleanup();
      this.renderer = null;
    }

    this.currentTheme = theme;

    // 根据类型创建渲染器
    switch (theme.type) {
      case "static":
        this.renderer = new StaticRenderer(theme, this.performance);
        break;
      case "canvas":
        this.renderer = new CanvasRenderer(theme, this.performance);
        break;
      case "video":
        this.renderer = new VideoRenderer(theme, this.performance);
        break;
      default:
        console.warn(`[dream-skin] Unknown theme type: ${theme.type}, falling back to static`);
        this.renderer = new StaticRenderer(theme, this.performance);
    }

    this.renderer.start();

    // 只有需要动画的渲染器才启动渲染循环
    if (theme.type === "canvas") {
      this.startRenderLoop();
    } else {
      this.stopRenderLoop();
    }
  }

  startRenderLoop() {
    if (this.animationId) return;

    const render = (timestamp) => {
      if (!this.paused && this.renderer) {
        const deltaTime = timestamp - this.lastFrameTime;
        this.lastFrameTime = timestamp;

        this.performance.measure();
        this.renderer.update(deltaTime);
        this.renderer.draw();
      }

      this.animationId = requestAnimationFrame(render);
    };

    this.lastFrameTime = performance.now();
    this.animationId = requestAnimationFrame(render);
  }

  stopRenderLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  pause() {
    this.paused = true;
  }

  resume() {
    if (this.paused) {
      this.paused = false;
      this.lastFrameTime = performance.now();
    }
  }

  cleanup() {
    this.stopRenderLoop();

    if (this.renderer) {
      this.renderer.cleanup();
      this.renderer = null;
    }

    this.currentTheme = null;
  }

  getStats() {
    return {
      fps: this.performance.fps,
      quality: this.performance.quality,
      themeType: this.currentTheme?.type || "none",
    };
  }
}

// 导出全局单例
if (typeof window !== "undefined") {
  window.DreamSkinEngine = DreamSkinEngine;
}
