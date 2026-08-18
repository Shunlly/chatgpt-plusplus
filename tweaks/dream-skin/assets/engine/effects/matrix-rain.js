/**
 * 矩阵代码雨效果
 * 经典赛博朋克风格，绿色代码字符从上往下流动
 */

"use strict";

class MatrixRainEffect {
  constructor(config, performance) {
    this.config = {
      speed: 5,              // 下落速度 1-10
      density: 1.0,          // 密度倍率 0.5-2.0
      color: "#00ff00",      // 代码颜色
      trailLength: 20,       // 拖尾长度
      glowIntensity: 0.3,    // 发光强度
      fontSize: 16,          // 字体大小
      charset: "01アイウエオカキクケコサシスセソタチツテト", // 字符集
      fadeSpeed: 0.05,       // 淡出速度
      ...config,
    };
    this.performance = performance;
    this.columns = [];
    this.columnWidth = this.config.fontSize;
    this.init();
  }

  init() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const columnCount = Math.floor(width / this.columnWidth);

    this.columns = [];
    for (let i = 0; i < columnCount; i++) {
      this.columns.push(this.createColumn(i, height));
    }
  }

  createColumn(index, maxHeight) {
    return {
      x: index * this.columnWidth,
      y: -Math.random() * maxHeight,
      speed: (Math.random() * 0.5 + 0.5) * this.config.speed,
      chars: [],
      lastUpdate: 0,
    };
  }

  update(deltaTime) {
    const height = window.innerHeight;
    const dt = deltaTime / 1000;
    const qualityMult = this.performance.getQualityMultiplier();

    // 根据性能调整列数
    const targetColumns = Math.floor((window.innerWidth / this.columnWidth) * qualityMult * this.config.density);
    if (this.columns.length > targetColumns) {
      this.columns.length = targetColumns;
    } else if (this.columns.length < targetColumns && this.performance.quality !== "emergency") {
      while (this.columns.length < targetColumns) {
        this.columns.push(this.createColumn(this.columns.length, height));
      }
    }

    // 更新每列
    this.columns.forEach(column => {
      column.y += column.speed * dt * 60;

      // 添加新字符
      if (performance.now() - column.lastUpdate > 50) {
        column.lastUpdate = performance.now();
        const char = this.config.charset[Math.floor(Math.random() * this.config.charset.length)];
        column.chars.unshift({
          char,
          y: column.y,
          opacity: 1.0,
          isHead: true,
        });

        // 限制字符数量
        if (column.chars.length > this.config.trailLength) {
          column.chars.pop();
        }

        // 更新字符状态
        column.chars.forEach((c, i) => {
          c.isHead = i === 0;
          c.y = column.y - i * this.config.fontSize;
          // 拖尾淡出
          if (i > 0) {
            c.opacity = Math.max(0, 1 - (i / this.config.trailLength));
          }
        });
      }

      // 重置到顶部
      if (column.y > height + this.config.fontSize * this.config.trailLength) {
        column.y = -this.config.fontSize;
        column.chars = [];
      }
    });
  }

  draw(ctx) {
    if (this.performance.quality === "emergency") return;

    ctx.font = `${this.config.fontSize}px monospace`;
    ctx.textAlign = "center";

    this.columns.forEach(column => {
      column.chars.forEach(c => {
        if (c.y < 0 || c.y > window.innerHeight) return;

        ctx.save();

        // 头部字符更亮，带发光效果
        if (c.isHead && this.config.glowIntensity > 0) {
          ctx.shadowColor = this.config.color;
          ctx.shadowBlur = this.config.fontSize * this.config.glowIntensity;
          ctx.globalAlpha = 1.0;
          ctx.fillStyle = "#ffffff";
        } else {
          ctx.globalAlpha = c.opacity;
          ctx.fillStyle = this.config.color;
        }

        ctx.fillText(c.char, column.x + this.columnWidth / 2, c.y);
        ctx.restore();
      });
    });
  }

  cleanup() {
    this.columns = [];
  }

  // 鼠标交互：代码躲避鼠标
  onMouseMove(mouseX, mouseY) {
    const avoidRadius = 100;

    this.columns.forEach(column => {
      const dx = column.x - mouseX;
      const dy = column.y - mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < avoidRadius) {
        const force = (avoidRadius - dist) / avoidRadius;
        column.x += (dx / dist) * force * 50;

        // 限制在屏幕内
        column.x = Math.max(0, Math.min(window.innerWidth - this.columnWidth, column.x));
      }
    });
  }

  // 点击特效：涟漪
  onClick(clickX, clickY) {
    const rippleRadius = 150;

    this.columns.forEach(column => {
      const dx = column.x - clickX;
      const dy = column.y - clickY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < rippleRadius) {
        column.speed *= 2; // 加速
        setTimeout(() => {
          column.speed /= 2; // 恢复
        }, 300);
      }
    });
  }
}

// 导出
if (typeof window !== "undefined") {
  window.MatrixRainEffect = MatrixRainEffect;
}
