/**
 * 星空银河效果
 * 白色星点闪烁，缓慢移动，鼠标靠近时星星变亮
 */

"use strict";

class StarryGalaxyEffect {
  constructor(config, performance) {
    this.config = {
      starCount: 150,           // 星星数量
      twinkleSpeed: 0.02,       // 闪烁速度
      moveSpeed: 0.5,           // 移动速度
      minSize: 1,               // 最小星星大小
      maxSize: 3,               // 最大星星大小
      minOpacity: 0.3,          // 最小不透明度
      maxOpacity: 1.0,          // 最大不透明度
      mouseGlowRadius: 150,     // 鼠标发光半径
      mouseGlowIntensity: 0.5,  // 鼠标发光强度
      shootingStarChance: 0.001, // 流星出现概率
      ...config,
    };
    this.performance = performance;
    this.stars = [];
    this.shootingStars = [];
    this.mouseX = -1000;
    this.mouseY = -1000;
    this.init();
  }

  init() {
    const count = Math.floor(this.config.starCount * this.performance.getQualityMultiplier());
    this.stars = [];

    for (let i = 0; i < count; i++) {
      this.stars.push(this.createStar());
    }
  }

  createStar() {
    return {
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * this.config.moveSpeed,
      vy: (Math.random() - 0.5) * this.config.moveSpeed,
      size: Math.random() * (this.config.maxSize - this.config.minSize) + this.config.minSize,
      baseOpacity: Math.random() * (this.config.maxOpacity - this.config.minOpacity) + this.config.minOpacity,
      opacity: 0.5,
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed: (Math.random() * 0.5 + 0.5) * this.config.twinkleSpeed,
    };
  }

  createShootingStar() {
    const angle = Math.random() * Math.PI * 2;
    const speed = 10 + Math.random() * 10;

    return {
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      length: 50 + Math.random() * 100,
      opacity: 1.0,
      lifetime: 1000, // 1秒生命周期
      age: 0,
    };
  }

  update(deltaTime) {
    const dt = deltaTime / 1000;
    const qualityMult = this.performance.getQualityMultiplier();

    // 调整星星数量
    const targetStars = Math.floor(this.config.starCount * qualityMult);
    if (this.stars.length > targetStars) {
      this.stars.length = targetStars;
    } else if (this.stars.length < targetStars && this.performance.quality !== "emergency") {
      while (this.stars.length < targetStars) {
        this.stars.push(this.createStar());
      }
    }

    // 更新星星
    this.stars.forEach(star => {
      // 位置移动
      star.x += star.vx * dt * 60;
      star.y += star.vy * dt * 60;

      // 边界循环
      if (star.x < 0) star.x = window.innerWidth;
      if (star.x > window.innerWidth) star.x = 0;
      if (star.y < 0) star.y = window.innerHeight;
      if (star.y > window.innerHeight) star.y = 0;

      // 闪烁效果
      star.twinklePhase += star.twinkleSpeed * dt * 60;
      const twinkle = (Math.sin(star.twinklePhase) + 1) / 2;
      star.opacity = star.baseOpacity * (0.7 + twinkle * 0.3);

      // 鼠标靠近时变亮
      const dx = star.x - this.mouseX;
      const dy = star.y - this.mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.config.mouseGlowRadius) {
        const glow = 1 - (dist / this.config.mouseGlowRadius);
        star.opacity = Math.min(1, star.opacity + glow * this.config.mouseGlowIntensity);
        star.size = Math.min(this.config.maxSize * 2, star.size * (1 + glow * 0.5));
      }
    });

    // 更新流星
    this.shootingStars = this.shootingStars.filter(shootingStar => {
      shootingStar.x += shootingStar.vx * dt * 60;
      shootingStar.y += shootingStar.vy * dt * 60;
      shootingStar.age += deltaTime;

      // 淡出效果
      shootingStar.opacity = Math.max(0, 1 - (shootingStar.age / shootingStar.lifetime));

      return shootingStar.age < shootingStar.lifetime;
    });

    // 随机生成流星
    if (Math.random() < this.config.shootingStarChance * qualityMult && this.shootingStars.length < 3) {
      this.shootingStars.push(this.createShootingStar());
    }
  }

  draw(ctx) {
    if (this.performance.quality === "emergency") return;

    // 绘制星星
    this.stars.forEach(star => {
      ctx.save();
      ctx.globalAlpha = star.opacity;
      ctx.fillStyle = "#ffffff";

      // 星星发光效果
      if (this.performance.quality === "high") {
        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = star.size * 2;
      }

      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });

    // 绘制流星
    this.shootingStars.forEach(shootingStar => {
      ctx.save();
      ctx.globalAlpha = shootingStar.opacity;

      const gradient = ctx.createLinearGradient(
        shootingStar.x,
        shootingStar.y,
        shootingStar.x - shootingStar.vx * 2,
        shootingStar.y - shootingStar.vy * 2
      );
      gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(shootingStar.x, shootingStar.y);
      ctx.lineTo(
        shootingStar.x - shootingStar.vx * 2,
        shootingStar.y - shootingStar.vy * 2
      );
      ctx.stroke();

      ctx.restore();
    });
  }

  cleanup() {
    this.stars = [];
    this.shootingStars = [];
  }

  onMouseMove(mouseX, mouseY) {
    this.mouseX = mouseX;
    this.mouseY = mouseY;
  }

  onClick(clickX, clickY) {
    // 点击产生小型爆炸效果：生成多个向外扩散的粒子
    const burstCount = 8;
    for (let i = 0; i < burstCount; i++) {
      const angle = (Math.PI * 2 * i) / burstCount;
      this.shootingStars.push({
        x: clickX,
        y: clickY,
        vx: Math.cos(angle) * 5,
        vy: Math.sin(angle) * 5,
        length: 20,
        opacity: 1.0,
        lifetime: 500,
        age: 0,
      });
    }
  }
}

// 导出
if (typeof window !== "undefined") {
  window.StarryGalaxyEffect = StarryGalaxyEffect;
}
