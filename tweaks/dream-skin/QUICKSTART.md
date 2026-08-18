# 🎨 5分钟创建你的第一个主题

跟随这个教程，你将在 5 分钟内创建并安装一个动态主题！

---

## 步骤 1: 打开编辑器 (30秒)

```bash
# 在浏览器中打开
open tweaks/dream-skin/theme-editor.html
```

或者直接双击 `theme-editor.html` 文件。

---

## 步骤 2: 填写基本信息 (1分钟)

在左侧编辑器中：

1. **主题 ID**: `my-ocean-theme`（小写字母+连字符）
2. **主题名称**: `深海之境`
3. **作者**: 你的名字
4. **描述**: `平静的深海，漂浮的光点`
5. **标签**: 输入 `ocean` 按回车，再输入 `calm` 按回车

---

## 步骤 3: 设置外观 (1分钟)

1. **背景颜色**: 点击颜色选择器，选择深蓝色 `#0a1929`
2. **外观模式**: 保持 `暗色`
3. **性能等级**: 选择 `低` (适合所有设备)

---

## 步骤 4: 配置效果 (2分钟)

1. **效果类型**: 选择 `粒子效果` (particles)

2. **调整参数**:
   - 粒子数量: 拖到 `120`
   - 移动速度: 拖到 `2` (缓慢漂浮)
   - 颜色: 选择浅蓝色 `#4dd0e1`
   - 大小: 拖到 `3`
   - 不透明度: 拖到 `0.6`

3. **交互设置**: 
   - ✅ 勾选 `启用鼠标交互`（鼠标靠近时粒子会反应）

---

## 步骤 5: 实时预览 (30秒)

看右侧预览区域：

- 深蓝色背景 ✅
- 浅蓝色光点缓慢漂浮 ✅
- 移动鼠标，光点会反应 ✅
- 右上角显示 FPS 和性能质量 ✅

满意吗？太棒了！让我们导出。

---

## 步骤 6: 导出主题 (30秒)

1. 点击底部 `📥 导出主题 JSON` 按钮
2. 弹出窗口显示 JSON 代码
3. 点击 `📋 复制到剪贴板`
4. 保存到文件 `my-ocean-theme.json`

---

## 步骤 7: 安装主题 (30秒)

打开终端，运行：

```bash
cd tweaks/dream-skin
node theme-cli.js install path/to/my-ocean-theme.json
```

你会看到：

```
ℹ️  正在安装主题: my-ocean-theme.json
✅ 主题已安装到: tweaks/dream-skin/presets/my-ocean-theme
✅ 已将 my-ocean-theme 添加到 PRESET_IDS
✅ 安装完成！
ℹ️  主题 ID: my-ocean-theme
ℹ️  主题名称: 深海之境
ℹ️  描述: 平静的深海，漂浮的光点
```

---

## 步骤 8: 激活主题 (10秒)

重启应用，在 Dream Skin 设置中选择 `深海之境` 主题。

🎉 **恭喜！你创建了第一个动态主题！**

---

## 🚀 下一步

### 尝试其他效果类型

回到编辑器，选择不同的效果：

- **矩阵代码雨** - 赛博朋克风格
- **星空银河** - 闪烁星星 + 流星
- **极光** - 北极光波浪
- **呼吸效果** - 专注模式
- **赛博朋克霓虹** - 故障艺术

### 组合多个效果

导出的 JSON 可以手动编辑，添加多个效果：

```json
{
  "effects": [
    {
      "type": "gradient",
      "config": {
        "colors": ["#667eea", "#764ba2"],
        "speed": 0.001
      }
    },
    {
      "type": "particles",
      "config": {
        "count": 50,
        "speed": 3,
        "color": "#ffffff"
      }
    }
  ]
}
```

### 添加用户配置项

让其他用户也能调整你的主题：

```json
{
  "customization": {
    "particleCount": {
      "label": "粒子数量",
      "type": "range",
      "min": 50,
      "max": 200,
      "default": 120,
      "path": "effects.0.config.count"
    },
    "color": {
      "label": "粒子颜色",
      "type": "color",
      "default": "#4dd0e1",
      "path": "effects.0.config.color"
    }
  }
}
```

### 创建自定义效果

阅读 `THEME-DEVELOPMENT-GUIDE.md` 学习如何创建自己的效果类！

---

## 💡 快速技巧

### 性能优化

- **低性能** (CPU < 5%): particles, gradient, breathing
- **中性能** (CPU 10-15%): matrix-rain, aurora
- **高性能** (CPU 15-20%): cyberpunk-neon

### 颜色搭配

**自然系：**
- 海洋: `#0a1929` + `#4dd0e1`
- 森林: `#1a2e1a` + `#66bb6a`
- 日落: `#2e1a1a` + `#ff6e40`

**科技系：**
- 赛博朋克: `#0a0a1a` + `#ff006e` + `#3a86ff`
- 矩阵: `#000000` + `#00ff00`
- 霓虹: `#1a0a2e` + `#ff006e` + `#00f5ff`

**情绪系：**
- 平静: 蓝色 + 低速度
- 活力: 红/橙色 + 高速度
- 专注: 单色 + 呼吸效果

---

## 🎯 常见问题

**Q: 主题不显示？**  
A: 检查浏览器控制台是否有错误，确认 `schemaVersion` 是 `2`

**Q: FPS 太低？**  
A: 降低粒子数量，选择更低的性能等级

**Q: 如何分享主题？**  
A: 打包 JSON 文件，上传到 GitHub，或提交 Pull Request

**Q: 可以卖主题吗？**  
A: Dream Skin 是开源项目，主题应该免费分享 😊

---

## 📚 更多资源

- **完整文档**: `THEME-DEVELOPMENT-GUIDE.md`
- **JSON 模板**: `THEME-TEMPLATE.json`
- **工作流指南**: `THEME-CREATOR-README.md`
- **示例主题**: `presets/` 目录

---

开始创作吧！期待看到你的作品！🌟
