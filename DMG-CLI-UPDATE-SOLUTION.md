# DMG 安装 CLI 自动更新方案

## 问题
用户从 DMG 安装 ChatGPT++.app 后：
- ✅ GUI 安装器更新了（`/Applications/ChatGPT++.app`）
- ❌ CLI 工具没有更新（`~/.local/bin/chatgptplusplus` 还是旧版本）
- 用户运行 `chatgptplusplus status` 看到的还是旧版本

## 当前状态
- DMG 打包时已把 CLI 二进制放在 `ChatGPT++.app/Contents/Resources/cli/chatgpt-plusplus`
- 但没有自动链接到系统 PATH

## 解决方案

### 方案 A: GUI 启动时自动更新 CLI（推荐）

在 `packages/gui/src/main/index.ts` 添加启动时检测：

```typescript
async function checkAndUpdateCli() {
  const appCliPath = path.join(
    app.getAppPath(),
    '..',
    'Resources',
    'cli',
    'chatgpt-plusplus'
  );
  
  const userCliPaths = [
    path.join(os.homedir(), '.local', 'bin', 'chatgpt-plusplus'),
    '/usr/local/bin/chatgpt-plusplus',
  ];
  
  if (!fs.existsSync(appCliPath)) return;
  
  // 读取 app 内 CLI 版本
  const appVersion = execSync(`${appCliPath} --version`).toString().trim();
  
  for (const userCliPath of userCliPaths) {
    if (!fs.existsSync(userCliPath)) continue;
    
    const userVersion = execSync(`${userCliPath} --version`).toString().trim();
    
    if (appVersion !== userVersion) {
      // 版本不一致，提示或自动更新
      const result = await dialog.showMessageBox({
        type: 'question',
        buttons: ['更新', '稍后'],
        defaultId: 0,
        title: 'CLI 工具更新',
        message: `检测到 CLI 工具版本不一致\n\nGUI: ${appVersion}\nCLI: ${userVersion}\n\n是否更新 CLI 工具？`,
      });
      
      if (result.response === 0) {
        // 复制并设置权限
        fs.copyFileSync(appCliPath, userCliPath);
        fs.chmodSync(userCliPath, 0o755);
        
        dialog.showMessageBox({
          type: 'info',
          title: '更新完成',
          message: `CLI 工具已更新到 ${appVersion}`,
        });
      }
    }
  }
}

// 在 app.whenReady() 中调用
app.whenReady().then(() => {
  checkAndUpdateCli();
  // ... 其他初始化
});
```

**优点**:
- ✅ 自动检测版本差异
- ✅ 用户确认后更新
- ✅ 无需额外操作

**缺点**:
- ⚠️ 需要写入权限（可能失败）
- ⚠️ 弹窗可能打扰用户

### 方案 B: 安装说明中明确提示

在 DMG 的 `安装说明.txt` 中添加：

```
安装步骤：

1. 将 ChatGPT++.app 拖拽到 Applications 文件夹

2. 更新 CLI 工具（如果你使用命令行）：
   打开终端，运行：
   
   cp /Applications/ChatGPT++.app/Contents/Resources/cli/chatgpt-plusplus ~/.local/bin/chatgpt-plusplus
   chmod +x ~/.local/bin/chatgpt-plusplus

3. 启动 ChatGPT++.app 开始使用
```

**优点**:
- ✅ 简单明确
- ✅ 用户自主选择

**缺点**:
- ❌ 用户可能忽略
- ❌ 需要手动操作

### 方案 C: 提供安装脚本

在 DMG 中包含一个 `install.command` 脚本（双击即可运行）：

```bash
#!/bin/bash
# install.command - 自动安装 ChatGPT++ 及 CLI 工具

set -e

echo "正在安装 ChatGPT++..."

# 1. 复制 app
if [ ! -d "/Applications/ChatGPT++.app" ]; then
  echo "❌ 请先将 ChatGPT++.app 拖拽到 Applications 文件夹"
  exit 1
fi

# 2. 更新 CLI
CLI_SOURCE="/Applications/ChatGPT++.app/Contents/Resources/cli/chatgpt-plusplus"
CLI_TARGET="$HOME/.local/bin/chatgpt-plusplus"

if [ -f "$CLI_SOURCE" ]; then
  mkdir -p "$HOME/.local/bin"
  cp "$CLI_SOURCE" "$CLI_TARGET"
  chmod +x "$CLI_TARGET"
  echo "✅ CLI 工具已更新"
else
  echo "⚠️  CLI 工具未找到"
fi

# 3. 确认安装
VERSION=$("$CLI_TARGET" --version 2>/dev/null || echo "未知")
echo ""
echo "✅ 安装完成！"
echo "   版本: $VERSION"
echo ""
echo "现在可以启动 ChatGPT++.app 使用了"
echo ""

read -p "按回车键关闭..."
```

**优点**:
- ✅ 一键安装
- ✅ 自动化
- ✅ 用户体验好

**缺点**:
- ⚠️ macOS 可能阻止运行脚本
- ⚠️ 需要用户双击脚本

### 方案 D: GUI 内置"更新 CLI"按钮

在 GUI 设置页添加一个按钮：

```
设置 → ChatGPT++ → 高级
  [检查 CLI 更新]  [立即更新 CLI]
  
  CLI 工具版本: 1.0.26
  GUI 版本: 1.0.27
  状态: ⚠️ CLI 工具需要更新
```

**优点**:
- ✅ 用户可见
- ✅ 主动控制
- ✅ 清晰的状态显示

**缺点**:
- ⚠️ 需要用户手动点击
- ⚠️ 开发工作量中等

## 推荐实施顺序

### 短期（立即）
1. **方案 B**: 更新 `安装说明.txt`，明确告知用户需要更新 CLI
2. **方案 C**: 添加 `install.command` 脚本到 DMG

### 中期（1-2 周）
3. **方案 D**: 在 GUI 设置页添加"更新 CLI"功能

### 长期（可选）
4. **方案 A**: 实现自动检测和提示（需要仔细处理权限问题）

## 立即行动

修改 `scripts/package.mjs` 的 `installNotes` 函数：

```javascript
function installNotes(ver) {
  return `ChatGPT++ ${ver} 安装说明

安装步骤：

1. 将 ChatGPT++.app 拖拽到 Applications 文件夹（或其他位置）

2. 更新 CLI 工具（如果你使用命令行）：
   
   方式一：双击 DMG 中的 "install.command" 脚本（推荐）
   
   方式二：打开终端，运行以下命令：
   
   cp /Applications/ChatGPT++.app/Contents/Resources/cli/chatgpt-plusplus ~/.local/bin/chatgpt-plusplus
   chmod +x ~/.local/bin/chatgpt-plusplus

3. 启动 ChatGPT++.app 开始使用

---

如果遇到问题，请访问：
https://github.com/Shunlly/chatgpt-plusplus/issues
`;
}
```

并在 `buildDmg` 函数中添加安装脚本：

```javascript
function buildDmg(binary, ver) {
  // ... 现有代码 ...
  
  // 添加安装脚本
  const installScript = `#!/bin/bash
set -e
CLI_SOURCE="/Applications/ChatGPT++.app/Contents/Resources/cli/chatgpt-plusplus"
CLI_TARGET="$HOME/.local/bin/chatgpt-plusplus"
if [ -f "$CLI_SOURCE" ]; then
  mkdir -p "$HOME/.local/bin"
  cp "$CLI_SOURCE" "$CLI_TARGET"
  chmod +x "$CLI_TARGET"
  VERSION=$("$CLI_TARGET" --version)
  osascript -e 'display notification "CLI 工具已更新到 '"$VERSION"'" with title "ChatGPT++"'
  echo "✅ 安装完成！版本: $VERSION"
else
  echo "❌ 未找到 CLI 工具"
  exit 1
fi
`;
  
  writeFileSync(join(stage, "install.command"), installScript);
  chmodSync(join(stage, "install.command"), 0o755);
  
  // ... 继续生成 DMG ...
}
```

## 总结

当前问题是 DMG 安装流程缺少 CLI 更新步骤，导致用户困惑。

**最佳解决方案组合**：
1. 立即更新安装说明
2. 添加 install.command 脚本
3. 中期在 GUI 内添加"更新 CLI"功能

这样既解决了燃眉之急，又为未来的自动化铺路。
