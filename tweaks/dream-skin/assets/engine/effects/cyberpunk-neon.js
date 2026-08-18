/**
 * 赛博朋克霓虹效果
 * 霓虹线条、故障闪烁、扫描线、点击电流特效
 */

"use strict";

class CyberpunkNeonEffect {
  constructor(config, performance) {
    this.config = {
      neonColor: "#ff006e",        // 霓虹主色
      accentColor: "#3a86ff",      // 强调色
      lineCount: 20,               // 霓虹线条数量
      lineSpeed: 2,                // 线条移动速度
      glitchChance: 0.005,         // 故障出现概率
      glitchDuration: 100,         // 故障持续时间（ms）
      scanlineSpeed: 1,            // 扫描线速度
      scanlineOpacity: 0.1,        // 扫描线不透明度
      gridSize: 50,                // 网格大小
      showGrid: true,              // 是否显示网格
      ...config,
    };
    this.performance = performance;
    this.lines = [];
    this.glitchActive = false;
    this.glitchEndTime = 0;
    this.scanlineY = 0;
    this.electricArcs = []; // 点击产生的电流
    this.init();
  }

  init() {
    const lineCount = Math.floor(this.config.lineCount * this.performance.getQualityMultiplier());
    this.lines = [];

    for (let i = 0; i < lineCount; i++) {
      this.lines.push(this.createLine());
    }
  }

  createLine() {
    const isHorizontal = Math.random() > 0.5;

    return {
      isHorizontal,
      position: Math.random() * (isHorizontal ? window.innerHeight : window.innerWidth),
      offset: Math.random() * 1000,
      speed: (Math.random() * 0.5 + 0.5) * this.config.lineSpeed,
      thickness: Math.random() * 3 + 1,
      color: Math.random() > 0.5 ? this.config.neonColor : this.config.accentColor,
      segments: this.generateSegments(isHorizontal),
    };
  }

  generateSegments(isHorizontal) {
    const max = isHorizontal ? window.innerWidth : window.innerHeight;
    const segments = [];
    let pos = 0;

    while (pos < max) {
      const length = Math.random() * 200 + 50;
      const gap = Math.random() * 100 + 50;

      segments.push({
        start: pos,
        end: Math.min(pos + length, max),
      });

      pos += length + gap;
    }

    return segments;
  }

  update(deltaTime) {
    if (this.performance.quality === "emergency") return;

    const dt = deltaTime / 1000;

    // 更新线条
    this.lines.forEach(line => {
      line.offset += line.speed * dt * 60;

      // 循环
      if (line.offset > 1000) {
        line.offset = 0;
      }
    });

    // 扫描线移动
    this.scanlineY += this.config.scanlineSpeed * dt * 60;
    if (this.scanlineY > window.innerHeight) {
      this.scanlineY = 0;
    }

    // 随机故障
    if (!this.glitchActive && Math.random() < this.config.glitchChance) {
      this.glitchActive = true;
      this.glitchEndTime = performance.now() + this.config.glitchDuration;
    }

    if (this.glitchActive && performance.now() > this.glitchEndTime) {
      this.glitchActive = false;
    }

    // 更新电流效果
    this.electricArcs = this.electricArcs.filter(arc => {
      arc.age += deltaTime;
      arc.opacity = Math.max(0, 1 - arc.age / arc.lifetime);
      return arc.age < arc.lifetime;
    });
  }

  draw(ctx) {
    if (this.performance.quality === "emergency") return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // 绘制网格（低不透明度）
    if (this.config.showGrid && this.performance.quality !== "low") {
      this.drawGrid(ctx, width, height);
    }

    // 绘制霓虹线条
    this.drawNeonLines(ctx, width, height);

    // 绘制扫描线
    this.drawScanline(ctx, width);

    // 绘制电流效果
    this.drawElectricArcs(ctx);

    // 故障效果
    if (this.glitchActive) {
      this.drawGlitch(ctx, width, height);
    }
  }

  drawGrid(ctx, width, height) {
    ctx.save();
    ctx.strokeStyle = this.config.neonColor;
    ctx.globalAlpha = 0.05;
    ctx.lineWidth = 1;

    // 垂直线
    for (let x = 0; x < width; x += this.config.gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // 水平线
    for (let y = 0; y < height; y += this.config.gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawNeonLines(ctx, width, height) {
    ctx.save();

    this.lines.forEach(line => {
      ctx.strokeStyle = line.color;
      ctx.lineWidth = line.thickness;
      ctx.globalAlpha = 0.8;

      // 霓虹发光效果
      if (this.performance.quality === "high") {
        ctx.shadowColor = line.color;
        ctx.shadowBlur = 10;
      }

      line.segments.forEach(segment => {
        const offset = Math.sin(line.offset * 0.01) * 20;

        if (line.isHorizontal) {
          const y = line.position + offset;
          ctx.beginPath();
          ctx.moveTo(segment.start, y);
          ctx.lineTo(segment.end, y);
          ctx.stroke();
        } else {
          const x = line.position + offset;
          ctx.beginPath();
          ctx.moveTo(x, segment.start);
          ctx.lineTo(x, segment.end);
          ctx.stroke();
        }
      });
    });

    ctx.restore();
  }

  drawScanline(ctx, width) {
    if (this.performance.quality === "low") return;

    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 255, ${this.config.scanlineOpacity})`;
    ctx.fillRect(0, this.scanlineY, width, 2);
    ctx.restore();
  }

  drawElectricArcs(ctx) {
    ctx.save();

    this.electricArcs.forEach(arc => {
      ctx.strokeStyle = arc.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = arc.opacity;

      if (this.performance.quality === "high") {
        ctx.shadowColor = arc.color;
        ctx.shadowBlur = 15;
      }

      ctx.beginPath();
      ctx.moveTo(arc.startX, arc.startY);

      // 绘制曲折的电流
      for (let i = 0; i < arc.segments.length; i++) {
        const seg = arc.segments[i];
        ctx.lineTo(seg.x, seg.y);
      }

      ctx.stroke();
    });

    ctx.restore();
  }

  drawGlitch(ctx, width, height) {
    // RGB 分离效果
    const offset = Math.random() * 10 - 5;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    // 红色通道偏移
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(offset, 0, width, height);

    // 青色通道偏移
    ctx.fillStyle = "#00ffff";
    ctx.fillRect(-offset, 0, width, height);

    ctx.restore();

    // 随机水平条纹
    for (let i = 0; i < 5; i++) {
      const y = Math.random() * height;
      const h = Math.random() * 20 + 5;
      const offset = Math.random() * 50 - 25;

      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.drawImage(
        ctx.canvas,
        0, y, width, h,
        offset, y, width, h
      );
      ctx.restore();
    }
  }

  cleanup() {
    this.lines = [];
    this.electricArcs = [];
  }

  onMouseMove(mouseX, mouseY) {
    // 鼠标附近的线条会微微偏移
    this.lines.forEach(line => {
      const dist = line.isHorizontal
        ? Math.abs(line.position - mouseY)
        : Math.abs(line.position - mouseX);

      if (dist < 100) {
        const force = (100 - dist) / 100;
        // 线条会被吸引过来
        if (line.isHorizontal) {
          line.position += (mouseY - line.position) * force * 0.05;
        } else {
          line.position += (mouseX - line.position) * force * 0.05;
        }
      }
    });
  }

  onClick(clickX, clickY) {
    // 产生电流效果：从点击点向外发散
    const arcCount = 5;

    for (let i = 0; i < arcCount; i++) {
      const angle = (Math.PI * 2 * i) / arcCount + Math.random() * 0.5;
      const distance = 100 + Math.random() * 100;
      const segments = [];

      let currentX = clickX;
      let currentY = clickY;

      // 生成曲折路径
      for (let j = 0; j < 10; j++) {
        const stepAngle = angle + (Math.random() - 0.5) * 0.5;
        const stepDist = distance / 10;

        currentX += Math.cos(stepAngle) * stepDist;
        currentY += Math.sin(stepAngle) * stepDist;

        segments.push({ x: currentX, y: currentY });
      }

      this.electricArcs.push({
        startX: clickX,
        startY: clickY,
        segments,
        color: Math.random() > 0.5 ? this.config.neonColor : this.config.accentColor,
        opacity: 1.0,
        age: 0,
        lifetime: 300,
      });
    }

    // 触发故障效果
    this.glitchActive = true;
    this.glitchEndTime = performance.now() + 50;
  }
}

// 导出
if (typeof window !== "undefined") {
  window.CyberpunkNeonEffect = CyberpunkNeonEffect;
}
