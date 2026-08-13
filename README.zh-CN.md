# ChatGPT++

[English](./README.md) | **简体中文**

ChatGPT++ 让你可以向 OpenAI ChatGPT 桌面应用安装本地 tweak（扩展）。Tweak 可以修改 UI、添加设置页面、运行主进程代码，并通过 ChatGPT++ 桥接层使用操作系统级原生能力。
[加入 Discord 社区](https://discord.gg/6bY6gGX36H)。

<img width="1400" alt="ChatGPT++ 主侧边栏与 Dream Skin 主题入口" src="docs/screenshots/main-nav.png" />

> 非官方项目，与 OpenAI 无关。请自行承担使用风险。

## 快速了解

ChatGPT++ 会修改你本地的 ChatGPT 应用，让 ChatGPT 启动时加载一个体积很小的 ChatGPT++ 运行时。

这个运行时存放在你的用户数据目录中，而不是 ChatGPT 应用内部。它会在本地 `tweaks/` 文件夹里发现 tweak，并在 ChatGPT 打开时加载它们。

应用补丁非常小。你的 tweak、配置、日志、备份和运行时文件都放在应用包之外，因此修改 tweak 时无需重新构建 ChatGPT。

当 ChatGPT 更新时，补丁通常会被移除。ChatGPT++ 会安装一个监听器（watcher），检测到这种情况后自动重新打补丁。

1.0.0 带来了更干净的补丁方式、更好的调试输出、Owl 运行时检测、浏览器宿主调试，以及对 AppKit、Metal、辅助进程和 tweak 自持原生模块的原生桥接支持。

## 目录

- [安装](#安装)
- [ChatGPT++ 是什么](#chatgpt-是什么)
- [工作原理](#工作原理)
- [常用命令](#常用命令)
- [文件存放位置](#文件存放位置)
- [编写 Tweak](#编写-tweak)
- [Dream Skin 主题换肤](#dream-skin-主题换肤)
- [Owl 与原生桥接](#owl-与原生桥接)
- [浏览器宿主模式](#浏览器宿主模式)
- [更新与恢复](#更新与恢复)
- [安全](#安全)
- [更多文档](#更多文档)

## 安装

从 Codex 智能安装：

```text
Inspect and install this for me: https://github.com/Shunlly/chatgpt-plusplus
Tell me where you install it and send me the local path for adding new tweaks.
```

Homebrew：

```sh
brew install Shunlly/chatgpt-plusplus/chatgptplusplus
chatgptplusplus install
```

安装包（DMG / EXE）：

GitHub Releases 提供免安装 Node 环境的安装包：macOS 下载 `.dmg`，Windows 下载 `*-setup.exe`。

- macOS：打开 dmg，双击 `ChatGPT++.app`（或拖入「应用程序」），会自动打开终端并执行 `install`。
- Windows：运行安装器，安装完成后会自动给 ChatGPT/Codex 打补丁；开始菜单里有「安装与修复」入口。

安装包与源码安装相互独立；安装包版本的更新需重新下载新版安装包（`update` 命令会给出提示）。

GitHub 源码安装脚本：

```sh
curl -fsSL https://raw.githubusercontent.com/Shunlly/chatgpt-plusplus/main/install.sh | bash
```

Windows PowerShell：

```powershell
irm https://raw.githubusercontent.com/Shunlly/chatgpt-plusplus/main/install.ps1 | iex
```

Bun：

```sh
bun install -g github:Shunlly/chatgpt-plusplus
chatgptplusplus install
```

安装完成后启动 ChatGPT++，打开设置，找到 ChatGPT++ 区域。

## ChatGPT++ 是什么

ChatGPT++ 是 ChatGPT 桌面应用的 tweak 加载器。

它提供：

- 一个本地 `tweaks/` 文件夹。
- 一个可加载渲染进程与主进程 tweak 的运行时。
- ChatGPT 内的 ChatGPT++ 设置区域。
- 用于安装、修复、更新、调试和 tweak 开发的命令行工具。
- 一个在 ChatGPT 更新后自动修复 ChatGPT++ 的监听器。
- 面向 tweak 作者的公开 SDK。
- 面向高级 macOS tweak 的原生桥接 API。

它不会替换 ChatGPT、代理你的账号，也不会运行一个独立的 ChatGPT 克隆。它只是修改已安装的应用，使其可以加载本地代码。

## 工作原理

安装流程：

1. ChatGPT++ 找到你的 ChatGPT 应用。
2. 备份未打补丁的应用文件。
3. 修改 ChatGPT 的 `app.asar`，让 ChatGPT++ 加载器最先运行。
4. 在用户数据目录中部署 ChatGPT++ 运行时。
5. 按需重新签名应用。
6. 为未来的 ChatGPT 更新安装监听器。

运行流程：

1. 启动 ChatGPT++。
2. ChatGPT++ 加载器启动。
3. 加载器从磁盘启动 ChatGPT++ 运行时。
4. ChatGPT 正常启动。
5. ChatGPT++ 发现已启用的 tweak。
6. 渲染进程 tweak 在 ChatGPT 窗口中运行。
7. 主进程 tweak 在 ChatGPT 主进程中运行。
8. 设置界面显示 ChatGPT++ 页面和 tweak 控件。

## 常用命令

| 命令 | 作用 |
|---|---|
| `chatgptplusplus install` | 给 ChatGPT 打补丁并安装运行时。 |
| `chatgptplusplus status` | 显示已安装版本与补丁状态。 |
| `chatgptplusplus debug` | 显示应用路径、运行时类型、路径、打开状态与桥接状态。 |
| `chatgptplusplus repair` | 应用更新或安装损坏后重新打补丁。 |
| `chatgptplusplus update` | 从最新的 GitHub Release 更新 ChatGPT++。 |
| `chatgptplusplus update-codex` | 让 ChatGPT 准备官方更新器，重启后重新打补丁。 |
| `chatgptplusplus doctor` | 诊断签名、完整性、权限与常见故障。 |
| `chatgptplusplus safe-mode` | 禁用所有 tweak（不删除）。 |
| `chatgptplusplus safe-mode --off` | 退出安全模式。 |
| `chatgptplusplus uninstall` | 卸载 ChatGPT++，并在安全时恢复应用。 |
| `chatgptplusplus uninstall --purge` | 同时删除 tweak、配置、日志、备份和 ChatGPT++ 用户数据。 |

Tweak 开发命令：

| 命令 | 作用 |
|---|---|
| `chatgptplusplus create-tweak ./my-tweak` | 创建新的 tweak 文件夹。 |
| `chatgptplusplus validate-tweak ./my-tweak` | 校验 tweak 的 manifest 和入口文件。 |
| `chatgptplusplus dev ./my-tweak` | 把本地 tweak 链接到 ChatGPT++ 用于开发。 |

源码检出命令：

```sh
npm run build
npm test
node packages/installer/dist/cli.js install
node packages/installer/dist/cli.js debug
```

## 文件存放位置

ChatGPT++ 几乎把所有内容都放在 ChatGPT 之外。

| 项目 | 位置 |
|---|---|
| 加载器补丁 | ChatGPT `app.asar` 内部 |
| 运行时 | `<user-data-dir>/runtime/` |
| Tweak | `<user-data-dir>/tweaks/` |
| Tweak 数据 | `<user-data-dir>/tweak-data/` |
| 配置 | `<user-data-dir>/config.json` |
| 状态 | `<user-data-dir>/state.json` |
| 日志 | `<user-data-dir>/log/` |
| 备份 | `<user-data-dir>/backup/` |

默认用户数据路径：

| 系统 | 路径 |
|---|---|
| macOS | `~/Library/Application Support/chatgpt-plusplus/` |
| Windows | `%APPDATA%/chatgpt-plusplus/` |
| Linux | `$XDG_DATA_HOME/chatgpt-plusplus/` 或 `~/.local/share/chatgpt-plusplus/` |

在 Windows Store 安装中，ChatGPT++ 还会在 `%LOCALAPPDATA%/chatgpt-plusplus/store-apps/` 下创建一份可写的受管应用副本。请使用 ChatGPT++ 快捷方式启动该副本。

## 编写 Tweak

一个 tweak 就是一个包含 manifest 和入口文件的文件夹：

```text
my-tweak/
  manifest.json
  index.js
```

最小 `manifest.json`：

```json
{
  "id": "com.you.my-tweak",
  "name": "My Tweak",
  "version": "0.1.0",
  "githubRepo": "you/my-tweak",
  "description": "Adds a ChatGPT++ settings page.",
  "scope": "renderer",
  "main": "index.js"
}
```

最小 `index.js`：

```js
module.exports = {
  start(api) {
    api.settings.registerPage({
      id: "main",
      title: api.manifest.name,
      render(root) {
        root.textContent = "Hello from ChatGPT++.";
      },
    });
  },
  stop() {},
};
```

本地开发循环：

```sh
chatgptplusplus create-tweak ./my-tweak --id com.you.my-tweak --name "My Tweak"
chatgptplusplus validate-tweak ./my-tweak
chatgptplusplus dev ./my-tweak
```

完整文档见 [编写 Tweak](./docs/WRITING-TWEAKS.md)。

## Dream Skin 主题换肤

本仓库自带了 `tweaks/dream-skin` 主题换肤 tweak，可以用上传的图片为 ChatGPT 桌面版换主题。

- 主侧边栏新增**主题**一级入口：新对话 → 拉取请求 → 已安排 → 插件 → **主题**，切换更方便。
- 预设主题与自定义主题一键切换。
- 上传图片即可**新建主题**，自动提取配色并应用到整个应用界面。
- 修复新会话输入框需要滚动才能看到的问题，打开即见、立即可输入。

![Dream Skin 主题管理页](docs/screenshots/theme-page.png)

## Owl 与原生桥接

当前 macOS 版 ChatGPT 使用 Owl：一个带 Chromium 和 Electron 兼容 JavaScript 运行时的原生应用外壳。

ChatGPT++ 1.0.0 可以检测 Owl 并通过以下命令报告能力状态：

```sh
chatgptplusplus debug
```

Tweak 作者应使用 ChatGPT++ SDK，而不是直接操作 Owl 内部：

- `api.codex.runtime.getInfo()`
- `api.codex.runtime.getCapabilities()`
- `api.codex.windows.*`
- `api.codex.cdp.*`
- `api.codex.native.*`

原生桥接支持包括：

- Tweak 自持的 `.node` 模块。
- 面向 Swift、AppKit、Metal 和 MetalKit 的 Objective-C++/N-API 封装。
- 原生子面板。
- 基于 Metal 的子窗口覆盖层。
- 辅助进程。

从 [原生桥接](./docs/tweaks/native-bridge.md) 开始。

## 浏览器宿主模式

浏览器宿主模式会在普通浏览器标签页中打开 ChatGPT 界面，同时由一个隐藏的 ChatGPT 窗口提供私有应用桥接：

```sh
chatgptplusplus browser --port 8765
```

然后打开：

```text
http://127.0.0.1:8765/
```

这对调试和浏览器自动化很有用。该功能是实验性的。此模式下应用内浏览器使用 iframe 垫片，因此部分网站可能禁止嵌入。

## 更新与恢复

更新 ChatGPT++：

```sh
chatgptplusplus update
```

> 通过 dmg/exe 安装包安装时，`update` 不会替换二进制，会提示前往 GitHub Releases 下载新版安装包；`repair` 仍可直接使用。

在 macOS 上运行官方 ChatGPT 更新器：

```sh
chatgptplusplus update-codex
```

修复 ChatGPT++：

```sh
chatgptplusplus repair --force
```

临时禁用 tweak：

```sh
chatgptplusplus safe-mode
```

恢复正常 tweak 加载：

```sh
chatgptplusplus safe-mode --off
```

卸载：

```sh
chatgptplusplus uninstall
```

彻底卸载（包含 tweak/配置/日志/备份）：

```sh
chatgptplusplus uninstall --purge
```

## 安全

ChatGPT++ 会在你的 ChatGPT 桌面应用内运行本地代码。请只安装来自可信来源的 tweak。

重要说明：

- ChatGPT++ 不会静默更新 tweak 文件。
- Tweak 更新检查会链接到 GitHub Releases 供审查。
- 原生 tweak 可以运行原生代码，需要额外审查。
- 原生桥接路径被限制在 tweak 目录内的文件。
- Tweak 数据 API 默认使用 ChatGPT++ 的用户数据目录。

参见 [安全](./SECURITY.md)。

## 更多文档

- [架构](./docs/ARCHITECTURE.md)
- [故障排查](./docs/TROUBLESHOOTING.md)
- [编写 Tweak](./docs/WRITING-TWEAKS.md)
- [Tweak API 参考](./docs/tweaks/api-reference.md)
- [Manifest 参考](./docs/tweaks/manifest.md)
- [运行时与生命周期](./docs/tweaks/runtime-lifecycle.md)
- [UI 与 DOM 模式](./docs/tweaks/ui-and-dom.md)
- [MCP 服务器](./docs/tweaks/mcp.md)
- [Owl 运行时表面](./docs/OWL-RUNTIME.md)
- [Owl 桥接路线图](./docs/OWL-BRIDGE-ROADMAP.md)

## 致谢与上游项目

ChatGPT++ 是面向 Codex 桌面应用的 tweak 系统的延续项目。
MIT 许可证头部保留原作者版权（c）2026 Bennett。

## 贡献者

- [Alex Naidis (@TheCrazyLex)](https://github.com/TheCrazyLex) —— macOS 权限加固与 sudo 安装处理。

## 许可证

MIT。
