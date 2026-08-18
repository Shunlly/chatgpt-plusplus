/**
 * 极光之夜效果
 * 多色渐变流动，类似北极光，平滑过渡，无交互（纯视觉）
 */

"use strict";

class AuroraEffect {
  constructor(config, performance) {
    this.config = {
      colors: [
        "#667eea", // 紫蓝
        "#764ba2", // 紫红
        "#f093fb", // 粉色
        "#4facfe", // 蓝色
        "#00f2fe", // 青色
      ],
      speed: 0.0005,          // 流动速度
      waveAmplitude: 100,     // 波动幅度
      waveFrequency: 0.003,   // 波动频率
      layers: 3,              // 极光层数
      opacity: 0.7,           // 整体不透明度
      blurAmount: 40,         // 模糊程度（更柔和）
      ...config,
    };
    this.performance = performance;
    this.time = 0;
    this.layers = [];
    this.init();
  }

  init() {
    const layerCount = Math.floor(this.config.layers * this.performance.getQualityMultiplier());
    this.layers = [];

    for (let i = 0; i < layerCount; i++) {
      this.layers.push({
        offset: (Math.PI * 2 * i) / layerCount,
        speed: (0.8 + Math.random() * 0.4) * this.config.speed,
        amplitude: this.config.waveAmplitude * (0.7 + Math.random() * 0.6),
        frequency: this.config.waveFrequency * (0.8 + Math.random() * 0.4),
        colorIndex: i % this.config.colors.length,
      });
    }
  }

  update(deltaTime) {
    if (this.performance.quality === "emergency") return;

    this.time += deltaTime * 0.001; // 转换为秒

    // 根据性能调整层数
    const targetLayers = Math.floor(this.config.layers * this.performance.getQualityMultiplier());
    if (this.layers.length > targetLayers) {
      this.layers.length = targetLayers;
    } else if (this.layers.length < targetLayers && this.performance.quality !== "emergency") {
      while (this.layers.length < targetLayers) {
        const i = this.layers.length;
        this.layers.push({
          offset: (Math.PI * 2 * i) / this.config.layers,
          speed: (0.8 + Math.random() * 0.4) * this.config.speed,
          amplitude: this.config.waveAmplitude * (0.7 + Math.random() * 0.6),
          frequency: this.config.waveFrequency * (0.8 + Math.random() * 0.4),
          colorIndex: i % this.config.colors.length,
        });
      }
    }
  }

  draw(ctx) {
    if (this.performance.quality === "emergency") return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // 绘制每一层极光
    this.layers.forEach((layer, index) => {
      ctx.save();

      // 创建波浪形渐变
      const gradient = this.createAuroraGradient(ctx, layer, width, height);

      // 设置不透明度（越靠后的层越淡）
      const layerOpacity = this.config.opacity * (1 - (index * 0.2) / this.layers.length);
      ctx.globalAlpha = layerOpacity;

      // 设置模糊效果（高质量时）
      if (this.performance.quality === "high" && this.config.blurAmount > 0) {
        ctx.filter = `blur(${this.config.blurAmount}px)`;
      }

      // 绘制极光带
      this.drawAuroraWave(ctx, layer, gradient, width, height);

      ctx.restore();
    });
  }

  createAuroraGradient(ctx, layer, width, height) {
    const time = this.time * layer.speed + layer.offset;

    // 动态渐变角度
    const angle = time;
    const x1 = width / 2 + Math.cos(angle) * width;
    const y1 = height / 2 + Math.sin(angle) * height;
    const x2 = width / 2 - Math.cos(angle) * width;
    const y2 = height / 2 - Math.sin(angle) * height;

    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);

    // 使用配置的颜色创建渐变
    const colorCount = this.config.colors.length;
    const startIndex = layer.colorIndex;

    for (let i = 0; i <= 2; i++) {
      const colorIndex = (startIndex + i) % colorCount;
      gradient.addColorStop(i / 2, this.config.colors[colorIndex]);
    }

    return gradient;
  }

  drawAuroraWave(ctx, layer, gradient, width, height) {
    const time = this.time * layer.speed + layer.offset;
    const points = 50; // 波浪曲线的点数
    const step = width / points;

    ctx.fillStyle = gradient;
    ctx.beginPath();

    // 起点
    ctx.moveTo(0, height);

    // 绘制波浪上边缘
    for (let i = 0; i <= points; i++) {
      const x = i * step;
      const wave1 = Math.sin(x * layer.frequency + time) * layer.amplitude;
      const wave2 = Math.cos(x * layer.frequency * 0.7 + time * 0.8) * layer.amplitude * 0.5;
      const y = height / 2 + wave1 + wave2;

      if (i === 0) {
        ctx.lineTo(x, y);
      } else {
        // 使用贝塞尔曲线平滑连接
        const prevX = (i - 1) * step;
        const cpX = (prevX + x) / 2;
        ctx.quadraticCurveTo(cpX, y, x, y);
      }
    }

    // 绘制波浪下边缘（稍微偏移）
    for (let i = points; i >= 0; i--) {
      const x = i * step;
      const wave1 = Math.sin(x * layer.frequency + time) * layer.amplitude;
      const wave2 = Math.cos(x * layer.frequency * 0.7 + time * 0.8) * layer.amplitude * 0.5;
      const y = height / 2 + wave1 + wave2 + layer.amplitude * 1.5;

      ctx.lineTo(x, y);
    }

    // 闭合路径
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
  }

  cleanup() {
    this.layers = [];
  }
}

// 导出
if (typeof window !== "undefined") {
  window.AuroraEffect = AuroraEffect;
}
