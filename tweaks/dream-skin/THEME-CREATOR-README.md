# Dream Skin v2.0 主题创建工具

现在你可以自主创建自己的动态主题了！🎨

---

## 🚀 快速开始

### 方法 1：使用可视化编辑器（推荐）

1. **打开编辑器**
   ```bash
   # 在浏览器中打开
   open tweaks/dream-skin/theme-editor.html
   ```

2. **设计主题**
   - 左侧面板：配置主题参数
   - 右侧面板：实时预览效果
   - 所见即所得！

3. **导出主题**
   - 点击"📥 导出主题 JSON"
   - 复制生成的 JSON
   - 保存为 `theme.json`

4. **安装主题**
   ```bash
   # 创建主题目录
   mkdir -p tweaks/dream-skin/presets/my-awesome-theme
   
   # 保存 theme.json
   # 将复制的 JSON 保存到 my-awesome-theme/theme.json
   ```

5. **激活主题**
   - 在 `index.js` 的 `PRESET_IDS` 数组中添加你的主题 ID
   - 重启应用

---

### 方法 2：手动编写 JSON

1. **复制模板**
   ```bash
   cp tweaks/dream-skin/THEME-TEMPLATE.json my-theme.json
   ```

2. **编辑配置**
   - 参考 `THEME-DEVELOPMENT-GUIDE.md`
   - 修改效果类型、颜色、参数等

3. **保存到 presets 目录**
   ```bash
   mkdir -p tweaks/dream-skin/presets/my-theme
   mv my-theme.json tweaks/dream-skin/presets/my-theme/theme.json
   ```

---

## 📚 三个核心文档

### 1. **theme-editor.html** - 可视化编辑器
- 实时预览
- 拖拽调参
- 一键导出
- 适合：快速创作、视觉设计

### 2. **THEME-TEMPLATE.json** - JSON 模板
- 标准格式
- 完整字段
- 注释说明
- 适合：手动编写、批量生成

### 3. **THEME-DEVELOPMENT-GUIDE.md** - 开发指南
- 完整文档
- 效果类型
- 参数说明
- API 参考
- 适合：深入学习、高级定制

---

## 🎨 内置效果类型

主题编辑器内置 7 种效果类型：

| 效果类型 | 特点 | 性能 | 交互 |
|---------|------|------|------|
| **particles** | 粒子系统，星空/雪花 | 低 | ❌ |
| **gradient** | 流动渐变背景 | 低 | ❌ |
| **matrix-rain** | 赛博朋克代码雨 | 中 | ✅ |
| **starry-galaxy** | 闪烁星空 + 流星 | 低 | ✅ |
| **aurora** | 北极光波浪 | 中 | ❌ |
| **breathing** | 呼吸明暗变化 | 低 | ❌ |
| **cyberpunk-neon** | 霓虹线条 + 故障 | 高 | ✅ |

---

## 💡 创作建议

### ✅ 推荐做法

1. **先用编辑器快速原型**
   - 拖动滑块调参数
   - 实时看效果
   - 找到满意的配置

2. **导出 JSON 后微调**
   - 添加 customization 配置项
   - 优化性能参数
   - 编写详细描述

3. **测试不同设备**
   - 高性能设备（桌面）
   - 中等设备（笔记本）
   - 低性能设备（老机器）

4. **分享你的主题**
   - 提交到主题库
   - 在社区发布
   - 收集用户反馈

### ❌ 避免

1. **过度复杂** - 一个主题不要堆太多效果
2. **忽略性能** - 始终监控 FPS（右上角显示）
3. **无意义参数** - 只暴露用户真正需要调的参数
4. **缺少描述** - 让用户知道主题的特点

---

## 🔧 高级技巧

### 组合多个效果

编辑导出的 JSON，在 `effects` 数组中添加多个效果：

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

### 添加用户可配置项

```json
{
  "customization": {
    "speed": {
      "label": "动画速度",
      "type": "range",
      "min": 1,
      "max": 10,
      "default": 5,
      "path": "effects.0.config.speed"
    }
  }
}
```

### 创建自定义效果类

参考 `THEME-DEVELOPMENT-GUIDE.md` 的"创建自定义效果"章节。

---

## 🐛 故障排查

### 主题不显示？

1. 检查 `schemaVersion` 是否为 `2`
2. 检查 `type` 是否为 `"canvas"`
3. 检查效果类型拼写是否正确
4. 打开浏览器控制台查看错误

### FPS 太低？

1. 降低粒子数量 / 线条数量
2. 减少效果层数
3. 设置更低的 `performance` 等级
4. 关闭高开销特效（如模糊、阴影）

### 交互无响应？

1. 检查 `interactive.mouse` 和 `interactive.click` 是否启用
2. 确认该效果类型支持交互
3. 某些效果在低性能模式会禁用交互

---

## 📦 主题分享

### 打包主题

```bash
# 1. 创建主题包目录
mkdir my-theme-pack

# 2. 复制主题
cp -r tweaks/dream-skin/presets/my-theme my-theme-pack/

# 3. 添加 README
cat > my-theme-pack/README.md << EOF
# My Awesome Theme

描述你的主题...

## 安装

1. 复制到 presets 目录
2. 在 index.js 添加 ID
3. 重启应用
EOF

# 4. 打包
zip -r my-theme.zip my-theme-pack
```

### 提交到主题库

1. Fork 项目仓库
2. 添加你的主题到 `tweaks/dream-skin/presets/`
3. 更新 `index.js` 的 `PRESET_IDS`
4. 提交 Pull Request

---

## 🎓 学习资源

### 示例主题

查看内置主题的配置：

```bash
tweaks/dream-skin/presets/
├── preset-matrix-rain/theme.json       # 矩阵代码雨
├── preset-starry-galaxy/theme.json     # 星空银河
├── preset-aurora-night/theme.json      # 极光之夜
├── preset-breathing-color/theme.json   # 呼吸颜色
└── preset-cyberpunk-neon/theme.json    # 赛博朋克霓虹
```

### 效果源码

了解效果实现原理：

```bash
tweaks/dream-skin/assets/engine/effects/
├── matrix-rain.js      # 矩阵代码雨效果
├── starry-galaxy.js    # 星空银河效果
├── aurora.js           # 极光效果
├── breathing.js        # 呼吸效果
└── cyberpunk-neon.js   # 赛博朋克霓虹效果
```

### Canvas 2D API

如果要创建自定义效果，学习 Canvas API：
- [MDN Canvas Tutorial](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial)
- [Canvas 2D API Reference](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D)

---

## 🌟 灵感来源

不知道做什么主题？试试这些方向：

### 自然系
- 🌊 海浪拍岸
- 🍂 落叶飘零
- 🌸 樱花飞舞
- 🌙 月光森林

### 科技系
- 🤖 机械脉动
- 🔬 DNA 螺旋
- 📡 数据流
- ⚡ 电路板

### 艺术系
- 🎨 水墨渲染
- 🖼️ 像素艺术
- 🌈 色彩漩涡
- ✨ 光影交错

### 情绪系
- 😌 平静专注
- 🔥 激情澎湃
- 💤 舒适放松
- ⚡ 活力充沛

---

## 💬 获取帮助

- **文档**: `THEME-DEVELOPMENT-GUIDE.md`
- **模板**: `THEME-TEMPLATE.json`
- **编辑器**: `theme-editor.html`
- **示例**: `presets/` 目录

开始创作吧！让你的想象力成为现实！🚀
