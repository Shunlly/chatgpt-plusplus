# Dream Skin v2.0 - 主题创作工具 🎨

欢迎来到 Dream Skin v2.0 主题创作系统！

现在你可以完全自主地创建、定制和分享动态主题。

---

## 🚀 快速开始（5分钟）

```bash
# 1. 打开可视化编辑器
open theme-editor.html

# 2. 调整参数，实时预览

# 3. 导出 JSON

# 4. 安装主题
node theme-cli.js install my-theme.json

# 完成！
```

详细教程: [QUICKSTART.md](./QUICKSTART.md)

---

## 📚 完整文档

### 新手入门
- **[QUICKSTART.md](./QUICKSTART.md)** - 5分钟创建第一个主题（分步教程）
- **[THEME-CREATOR-README.md](./THEME-CREATOR-README.md)** - 完整工作流程和最佳实践

### 开发者
- **[THEME-DEVELOPMENT-GUIDE.md](./THEME-DEVELOPMENT-GUIDE.md)** - 完整 API 文档和开发指南
- **[THEME-TEMPLATE.json](./THEME-TEMPLATE.json)** - 标准 JSON 模板

### 概览
- **[THEME-CREATION-OVERVIEW.md](./THEME-CREATION-OVERVIEW.md)** - 工具链总览和学习路径

---

## 🛠️ 工具

### 1. 可视化编辑器 `theme-editor.html`
- ✅ 所见即所得
- ✅ 实时预览
- ✅ 零代码创作
- ✅ 一键导出

**使用**: 浏览器打开 `theme-editor.html`

### 2. CLI 管理工具 `theme-cli.js`
- ✅ 验证主题格式
- ✅ 自动安装主题
- ✅ 列出已安装主题

**使用**:
```bash
node theme-cli.js validate <file>   # 验证
node theme-cli.js install <file>    # 安装
node theme-cli.js list              # 列表
```

---

## 🎨 7种内置效果

| 效果 | 特点 | 性能 | 交互 | 难度 |
|------|------|------|------|------|
| **particles** | 粒子系统（星空/雪花） | 低 | ❌ | ⭐☆☆☆☆ |
| **gradient** | 流动渐变背景 | 低 | ❌ | ⭐☆☆☆☆ |
| **matrix-rain** | 赛博朋克代码雨 | 中 | ✅ | ⭐⭐☆☆☆ |
| **starry-galaxy** | 闪烁星空 + 流星 | 低 | ✅ | ⭐⭐⭐☆☆ |
| **aurora** | 北极光波浪 | 中 | ❌ | ⭐⭐⭐☆☆ |
| **breathing** | 呼吸明暗变化 | 低 | ❌ | ⭐⭐☆☆☆ |
| **cyberpunk-neon** | 霓虹线条 + 故障 | 高 | ✅ | ⭐⭐⭐⭐☆ |

---

## 💡 创作路径

### 路径 1: 快速原型（推荐新手）⭐
```
theme-editor.html → 拖动滑块 → 导出 JSON → CLI 安装
```
**时间**: 5-10分钟 | **难度**: ⭐☆☆☆☆

### 路径 2: 深度定制（进阶）
```
复制模板 → 手动编辑 JSON → 组合多效果 → 添加配置项
```
**时间**: 20-30分钟 | **难度**: ⭐⭐⭐☆☆

### 路径 3: 自定义效果（高级）
```
创建效果类 → 实现 Canvas 渲染 → 注册到引擎
```
**时间**: 1-3小时 | **难度**: ⭐⭐⭐⭐⭐

---

## 📖 示例主题

查看 `presets/` 目录下的内置主题：

- **preset-matrix-rain** - 矩阵代码雨（鼠标躲避交互）
- **preset-starry-galaxy** - 星空银河（流星效果）
- **preset-aurora-night** - 极光之夜（多层波浪）
- **preset-breathing-color** - 呼吸颜色（极简专注）
- **preset-cyberpunk-neon** - 赛博朋克霓虹（故障艺术）

每个主题都有完整的 `theme.json` 配置文件可供参考。

---

## 🎯 学习路径

### 入门（1小时）
1. 阅读 [QUICKSTART.md](./QUICKSTART.md)
2. 使用编辑器创建主题
3. 使用 CLI 安装

### 进阶（3小时）
1. 阅读 [THEME-CREATOR-README.md](./THEME-CREATOR-README.md)
2. 学习 7 种效果类型
3. 手动编写 JSON

### 高级（10小时）
1. 深入学习 [THEME-DEVELOPMENT-GUIDE.md](./THEME-DEVELOPMENT-GUIDE.md)
2. 创建自定义效果类
3. 研究内置效果源码

---

## 🌟 灵感来源

### 自然系 🌿
海浪、落叶、樱花、雨滴、月光、星空、极光、日落

### 科技系 💻
代码雨、数据流、电路板、全息、机械、DNA、量子、赛博

### 艺术系 🎨
水墨、像素、漩涡、光影、几何、线条、粒子、流体

### 情绪系 💭
平静、激情、放松、活力、思考、阳光、慵懒、宁静

查看完整灵感库: [THEME-CREATOR-README.md](./THEME-CREATOR-README.md)

---

## 🔧 故障排查

**主题不显示？**
- 检查 `schemaVersion` 是否为 `2`
- 检查 `type` 是否为 `"canvas"`
- 查看浏览器控制台错误

**FPS 太低？**
- 降低粒子数量/线条数量
- 选择更低的性能等级
- 关闭高开销特效

**交互无响应？**
- 检查 `interactive.mouse/click` 是否启用
- 确认该效果类型支持交互

查看完整故障排查: [QUICKSTART.md](./QUICKSTART.md#-故障排查)

---

## 🤝 分享你的主题

### 方式 1: Pull Request
1. Fork 项目仓库
2. 添加主题到 `presets/your-theme/`
3. 更新 `index.js` 的 `PRESET_IDS`
4. 提交 PR

### 方式 2: 主题包
```bash
# 打包主题
zip -r my-theme.zip presets/my-theme

# 分享 ZIP 文件
```

### 方式 3: GitHub Gist
上传 `theme.json` 到 Gist，分享链接

---

## 📈 进度

### ✅ Week 1-4 完成
- ✅ 核心引擎 (Schema v2)
- ✅ 5 个精品主题
- ✅ 可视化编辑器
- ✅ CLI 管理工具
- ✅ 完整文档

### ⏳ Week 5-8 计划
- ⏳ 主题市场 UI
- ⏳ GitHub 集成
- ⏳ 扩展主题库（15-20个）
- ⏳ v2.0 正式发布

查看详细进度: [DEVELOPMENT-PROGRESS.md](./DEVELOPMENT-PROGRESS.md)

---

## 🙏 致谢

感谢所有为 Dream Skin 贡献主题和反馈的用户！

---

## 📞 获取帮助

- 📖 [快速入门](./QUICKSTART.md)
- 📚 [完整文档](./THEME-DEVELOPMENT-GUIDE.md)
- 🔍 [工作流指南](./THEME-CREATOR-README.md)
- 🎯 [工具总览](./THEME-CREATION-OVERVIEW.md)

---

**开始创作，让创意成为现实！** 🎨✨
