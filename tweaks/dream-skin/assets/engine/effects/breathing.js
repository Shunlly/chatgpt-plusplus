/**
 * 纯色呼吸效果
 * 单色背景，缓慢明暗变化，类似呼吸节奏，无交互（专注）
 */

"use strict";

class BreathingEffect {
  constructor(config, performance) {
    this.config = {
      baseColor: "#1a1a2e",      // 基础颜色
      breathSpeed: 0.0015,       // 呼吸速度（越小越慢）
      minBrightness: 0.6,        // 最小亮度（相对于基础色）
      maxBrightness: 1.2,        // 最大亮度（相对于基础色）
      easing: "sine",            // 缓动函数：sine, linear, cubic
      vignette: true,            // 是否添加暗角效果
      vignetteStrength: 0.3,     // 暗角强度
      ...config,
    };
    this.performance = performance;
    this.time = 0;
    this.baseRgb = this.hexToRgb(this.config.baseColor);
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : { r: 26, g: 26, b: 46 };
  }

  rgbToString(rgb) {
    return `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`;
  }

  update(deltaTime) {
    if (this.performance.quality === "emergency") return;

    this.time += deltaTime * this.config.breathSpeed;
  }

  draw(ctx) {
    if (this.performance.quality === "emergency") return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // 计算呼吸亮度
    const brightness = this.calculateBrightness();

    // 应用亮度到基础颜色
    const currentColor = {
      r: this.baseRgb.r * brightness,
      g: this.baseRgb.g * brightness,
      b: this.baseRgb.b * brightness,
    };

    // 填充背景
    ctx.fillStyle = this.rgbToString(currentColor);
    ctx.fillRect(0, 0, width, height);

    // 添加暗角效果
    if (this.config.vignette) {
      this.drawVignette(ctx, width, height);
    }
  }

  calculateBrightness() {
    const { minBrightness, maxBrightness, easing } = this.config;
    const range = maxBrightness - minBrightness;

    let normalizedValue;

    switch (easing) {
      case "sine":
        // 正弦波（平滑呼吸）
        normalizedValue = (Math.sin(this.time) + 1) / 2;
        break;

      case "cubic":
        // 三次缓动（慢进快出）
        const t = (Math.sin(this.time) + 1) / 2;
        normalizedValue = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        break;

      case "linear":
      default:
        // 线性
        normalizedValue = (Math.sin(this.time) + 1) / 2;
        break;
    }

    return minBrightness + normalizedValue * range;
  }

  drawVignette(ctx, width, height) {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.max(width, height);

    // 创建径向渐变
    const gradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, radius
    );

    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(0.6, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, `rgba(0, 0, 0, ${this.config.vignetteStrength})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  cleanup() {
    // 无需清理
  }

  // 允许动态更改颜色
  setColor(hexColor) {
    this.config.baseColor = hexColor;
    this.baseRgb = this.hexToRgb(hexColor);
  }
}

// 导出
if (typeof window !== "undefined") {
  window.BreathingEffect = BreathingEffect;
}
