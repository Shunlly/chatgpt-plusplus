# v1.1.0 发布手动操作指南

## 当前状态

### ✅ 已完成
- ✅ 主题创作工具链开发完成 (3128+ 行代码)
- ✅ 所有代码已提交到本地 Git (14 个提交)
- ✅ 版本号已升级到 1.1.0
- ✅ macOS DMG 已生成: `dist/installers/ChatGPT++-1.1.0-macos-arm64.dmg` (602MB)
- ✅ 发布说明已准备: `RELEASE-v1.1.0.md`

### ⚠️ 网络问题
- Git push 遇到 HTTP 408 超时错误
- 需要手动推送或使用其他网络环境

---

## 🚀 手动发布步骤

### 步骤 1: 推送代码到 GitHub

**方式 A: 命令行重试**
```bash
cd /Users/chenshuhang/PycharmProjects/github_project/codex-plusplus

# 增加超时时间
git config http.postBuffer 524288000
git config http.lowSpeedLimit 0
git config http.lowSpeedTime 999999

# 推送
git push origin main
```

**方式 B: 使用 GitHub Desktop**
1. 打开 GitHub Desktop
2. 选择 codex-plusplus 仓库
3. 点击 "Push origin"

**方式 C: 使用 SSH (如果配置了)**
```bash
git remote set-url origin git@github.com:chenshuhang/codex-plusplus.git
git push origin main
```

---

### 步骤 2: 创建 GitHub Release

**在浏览器中操作:**

1. **访问 Releases 页面**
   - 打开 https://github.com/chenshuhang/codex-plusplus/releases
   - 点击 "Draft a new release"

2. **填写 Release 信息**
   - **Tag**: `v1.1.0` (创建新标签)
   - **Target**: `main` 分支
   - **Title**: `v1.1.0 - Dream Skin 主题创作工具链`

3. **复制发布说明**
   - 打开 `RELEASE-v1.1.0.md`
   - 复制全部内容到 Release 描述框

4. **上传 macOS 安装包**
   - 点击 "Attach binaries by dropping them here or selecting them"
   - 上传: `dist/installers/ChatGPT++-1.1.0-macos-arm64.dmg`
   - 等待上传完成 (602MB，可能需要几分钟)

5. **暂不发布** (先保存为草稿)
   - 点击 "Save draft" (不要点 "Publish release")
   - 等待 GitHub Actions 构建 Windows EXE

---

### 步骤 3: 等待 GitHub Actions 构建 Windows EXE

**推送成功后，GitHub Actions 会自动触发:**

1. **查看 Actions 状态**
   - 访问 https://github.com/chenshuhang/codex-plusplus/actions
   - 找到最新的 workflow run

2. **等待构建完成**
   - Windows EXE 构建大约需要 10-20 分钟
   - 构建完成后会生成 artifact

3. **下载 Windows EXE**
   - 在 Actions 页面找到构建完成的 run
   - 下载 artifacts 中的 Windows 安装包
   - 解压得到 `ChatGPT++-1.1.0-win-x64-setup.exe`

---

### 步骤 4: 补充 Windows EXE 到 Release

1. **编辑 Release 草稿**
   - 返回 https://github.com/chenshuhang/codex-plusplus/releases
   - 找到 v1.1.0 草稿，点击 "Edit"

2. **上传 Windows 安装包**
   - 上传刚下载的 `ChatGPT++-1.1.0-win-x64-setup.exe`
   - 等待上传完成

3. **发布 Release**
   - 检查信息无误
   - 点击 "Publish release"

---

### 步骤 5: 验证发布

1. **检查 Release 页面**
   - 确认两个安装包都存在:
     - ✅ ChatGPT++-1.1.0-macos-arm64.dmg
     - ✅ ChatGPT++-1.1.0-win-x64-setup.exe

2. **测试下载链接**
   - 点击安装包链接，确认可以下载

3. **更新文档** (可选)
   - 在 README 中添加 v1.1.0 下载链接
   - 更新 CHANGELOG

---

## 📝 发布说明要点

### 核心功能
- 🎨 可视化主题编辑器 (零代码创作)
- 🔧 CLI 管理工具 (验证/安装/列表)
- 📚 完整文档体系 (3128+ 行)
- 🎯 7 种内置效果 + 无限自定义

### 用户价值
- 5分钟创建动态主题 ⭐
- 30分钟深度定制
- 3小时开发自定义效果

### 统计数据
- 工具: 3 个
- 文档: 5 个
- 代码量: 3128+ 行

---

## 🔍 故障排查

### 如果 Git push 一直失败

**尝试分批推送:**
```bash
# 只推送部分提交
git push origin HEAD~5:main  # 先推送前面的提交
git push origin main          # 再推送剩余的
```

**或使用 Git LFS (如果安装了):**
```bash
git lfs install
git push origin main
```

### 如果 GitHub Actions 没有触发

**手动触发 workflow:**
1. 访问 Actions 页面
2. 选择 build workflow
3. 点击 "Run workflow"
4. 选择 main 分支
5. 点击 "Run"

---

## 📦 文件位置

### 本地文件
- macOS DMG: `/Users/chenshuhang/PycharmProjects/github_project/codex-plusplus/dist/installers/ChatGPT++-1.1.0-macos-arm64.dmg`
- 发布说明: `/Users/chenshuhang/PycharmProjects/github_project/codex-plusplus/RELEASE-v1.1.0.md`
- 检查清单: `/Users/chenshuhang/PycharmProjects/github_project/codex-plusplus/RELEASE-CHECKLIST.md`

### Git 状态
- 分支: `main`
- 本地领先: 14 个提交
- 标签: 需要在 GitHub 上创建 v1.1.0

---

## ✅ 发布完成后

1. 通知用户新版本发布
2. 在社区发布公告
3. 更新文档站点（如果有）
4. 准备下一个版本开发

---

**预计总时间**: 30-60 分钟（取决于网络速度和 Actions 构建时间）

**关键点**: 
- 确保 git push 成功
- 等待 GitHub Actions 完成
- 上传两个安装包到 Release
