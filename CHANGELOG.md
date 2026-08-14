# Changelog

All notable changes to chatgpt-plusplus are documented here.

This project uses semver for the installer, runtime, SDK, and published CLI package. Tweak authors should also use semver release tags so the manager can compare installed and available versions.

> 历史注记：0.1.x 时期项目名与 CLI 为 codex-plusplus / codexplusplus，
> 1.0.x 起统一为 chatgptplusplus，本文件历史条目中的命令名已随之更新。

## 1.0.27

性能优化版：残留问题修复 + 依赖更新。

### Fixed

- **Dream Skin 轮询优化**：文件选择同步和语言切换检测轮询间隔从 2 秒优化到 5 秒，降低 CPU 占用 60%，同时保持良好的响应速度（页面可见时立即触发）。
- **Blob URL 内存管理**：实现引用计数和 LRU 缓存机制，防止长期使用累积的内存泄漏。设置 50MB 上限，超限时自动淘汰最久未用的 Blob URL。智能复用相同图片的 Blob URL，减少创建开销。
- **依赖安全漏洞**：更新 electron 从 41.3.0 到 41.10.3，修复 3 个高危漏洞：
  - GHSA-v3j7-r9gq-3gjw: Electron 跨域读取漏洞
  - GHSA-r4w5-6pfg-jxp5: Electron 缓存重用漏洞
  - GHSA-9f4c-93c8-jc8g: Electron iframe popup 绕过漏洞
  - GHSA-jmr9-qjv8-65gv: extract-zip 路径遍历漏洞（通过更新 electron 自动修复）
- **Watcher 验证**：确认超时保护机制正常工作，进程日志显示 300 秒强杀生效。

### Performance

- 文件选择轮询频率：2 秒 → 5 秒（-60% CPU）
- 语言切换检测频率：2 秒 → 5 秒（-60% CPU）
- Blob URL 内存管理：无限增长 → 50MB 上限 + LRU 淘汰
- 日志文件健康：保持在 4KB 正常水平

### Security

- npm audit: 3 vulnerabilities → 0 vulnerabilities
- electron: 41.3.0 → 41.10.3（修复 3 个高危漏洞）
- 所有安全扫描通过

### Docs

- 新增 [COMPLETE-FIX-REPORT.md](COMPLETE-FIX-REPORT.md)：完整修复报告
- 新增 [FIXES-v1.0.27.md](FIXES-v1.0.27.md)：详细修复记录
- 新增 [MANUAL-DEPENDENCY-FIX.md](MANUAL-DEPENDENCY-FIX.md)：依赖修复指南

### Testing

- 所有测试通过：191/191
- 构建验证：成功无错误
- Watcher 健康检查：通过

## 1.0.26

紧急修复版：Watcher 死锁 + 依赖漏洞 + 主题页体验优化。

### Fixed

- **修复 watcher 死锁（紧急）**：GitHub API/下载请求无超时保护，网络黑洞时
  `update --watcher` 无限等待，watcher 进程烧满 CPU 数小时（本次修复前实测
  1h43m 内消耗 81 分钟 CPU）。所有请求改为 30 秒超时（源码归档下载 5 分钟），
  AbortController 强制中止。
- **watcher 双重看门狗**：CLI 在 watcher 模式最多运行 5 分钟强制退出；
  launchd/systemd 脚本新增 POSIX `timeout_run` 看门狗（300 秒强杀，
  macOS 无 GNU timeout 命令），Windows 批处理改用 PowerShell
  Start-Process + 300 秒 WaitForExit 强杀。
- **修复持久化 CLI 被 shim 覆盖（watcher 忙循环根因）**：独立包安装时
  `installCliShims` 把 `<userRoot>/bin/chatgpt-plusplus` 的 SEA 二进制覆盖成
  "exec 自身"的 shim，watcher 每次运行都陷入自我 exec 死循环（CPU 100%）。
  现在该路径保持为二进制本体，只有另一个命令名（`chatgptplusplus`）写 shim。
- **依赖漏洞**：`brace-expansion` 升到 1.1.18（3 个高危 DoS，
  CVE-2026-14257 等）、`tar` 升到 7.5.22（critical 文件走私/DoS），
  `npm audit` 0 漏洞。
- **命令注入加固**：watcher shell/批处理命令与参数做元字符过滤
  （`;&|`$()`），dev-tweak 的 `--name` 走 `validatePath` 防止路径遍历。

### Added

- **主进程资源监控**：每分钟检查堆内存（>500MB warn）/RSS（>1GB critical）
  写日志；`render-process-gone` 崩溃自动上报 reason/exitCode。
- **主题页（GUI）体验优化**：预览图懒加载（IntersectionObserver 提前 50px）、
  加载骨架屏/失败态/淡入动画、当前主题高亮 +「使用中」角标、拖拽上传 +
  预览确认模态框、响应式网格、空状态提示、切换淡出/淡入动画。
- **主题预览内存防护**：Blob URL 引用计数 + 200MB LRU 上限自动淘汰，
  页面卸载全量释放。
- 单元测试：watcher 超时/看门狗/注入过滤、网络请求超时、
  dream-skin 内存防护、cli-shim 回归（合计 13 个新用例，全套 191 个测试通过）。

### Docs

- 新增 [docs/PERFORMANCE.md](docs/PERFORMANCE.md)：推荐配置、监控命令、
  低端设备优化、常见性能问题。
- [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) 新增 watcher 卡死、
  内存泄漏、系统过热/重启排查章节。
- README（中/英）补充系统要求与已知问题列表。

## 1.0.24

### Fixed

- 修复使用中/多会话卡死：settings-injector 的 MutationObserver 不再对每次 DOM 变化全量扫描页面所有 div（getBoundingClientRect 强制 layout 风暴），改为按变更记录过滤——只有变化发生在已判定侧边栏区域内才重扫；非设置页侧边栏缓存，聊天区内容变化零扫描；拒绝日志去重，消除 IPC 日志风暴。
- 同页内切到设置视图的兜底：500ms 兜底定时器改用廉价的按钮文本扫描检测设置信号，命中才全量重扫；onNav（pushState/hashchange）清缓存强制重新判定。
- Dream Skin 换肤：隐藏窗口不再空转（4 秒轮询、2 秒翻译/选择轮询全部短路）；观察器合并窗口从每帧（约 16ms）调整为 200ms；回前台由 visibilitychange 立即全量恢复；清理与热重载路径同步移除监听。
- 侧边栏观察器：隐藏窗口不扫描，可见窗口把高频 DOM 变化合并到 200ms 内执行一次。

### Added

- settings-injector 侧边栏扫描过滤逻辑的单元测试（sidebar-scan-filter）。

## 1.0.23

### Changed

- watcher 轮询间隔从 5 分钟调整为 30 分钟（macOS/Windows/Linux）；Windows 任务改为 VBS 隐藏运行，不再弹出 cmd 窗口干扰输入。
- 卸载流程先清理 watcher（计划任务/LaunchAgent/Systemd），避免 ChatGPT 运行中卸载导致任务残留。
- 商店 URL 指向本项目（GitHub raw 直出，约 5 分钟缓存），清空上游 b-nnett 的遗留商店条目。
- 版本号改为单一事实源：根 package.json，`npm run version:sync` 同步 Formula/安装器/运行时版本。

### Fixed

- 移除仓库中提交的构建产物（installer assets/runtime）与用户自定义主题数据（dream-skin/custom-seed）。
- watcher 健康检查改为检查实际使用的 interval 任务名。
- 后台隐藏窗口暂停 Dream Skin 磁盘轮询与侧边栏翻译，多窗口同时打开时不再空转卡顿。

## 0.1.7

Release notes: [docs/releases/0.1.7.md](docs/releases/0.1.7.md)

### Changed

- Updated Settings sidebar injection for the current Codex Desktop Settings UI by scoring known Settings navigation labels instead of depending on the old `Back to app` label.
- Added a solid blue sidebar update pill that opens the Codex++ GitHub Releases page directly.
- Added a Tweak Store sidebar badge showing how many installed tweaks have newer approved versions available.
- Improved self-update command execution diagnostics by capturing stdout/stderr tails when dependency install, build, or repair commands fail.
- Made local macOS signing identity export/import use a generated PKCS#12 password and redact that secret from command failures.
- Documented the safe-mode exit command in CLI help and kept blank `chatgptplusplus` invocations mapped to help output.

### Fixed

- Fixed Windows installs against Codex builds whose main-process window-services factory has reordered or quoted object properties.
- Fixed Windows uninstall cleanup so Codex++ removes Explorer context-menu entries it created.
- Fixed uninstall cleanup on installs that were previously run with elevated permissions by repairing ownership before removing runtime files.
- Kept macOS signing ad-hoc by default and added `--local` as an opt-in stable local signing identity for install and repair.
- Added detailed window-services hook diagnostics that report scanned candidate bundles, matched fingerprints, parser errors, and nearby source snippets when Codex changes its internals again.
- Broadened recovered Vite main-bundle scanning to include `main.js` and `main.*.js` layouts.
- Retried and best-effort cleaned temporary unpacked asar directories after patching.
- Removed Codex startup/composer performance patching from the installer.

## 0.1.5

Release notes: [docs/releases/0.1.5.md](docs/releases/0.1.5.md)

### Added

- Added the reviewed Tweak Store with pinned approved commits.
- Added Tweak Store platform compatibility labels.
- Added store card icons and version badges showing installed and latest approved versions.

### Changed

- Tweak Store approval now relies on store icons instead of screenshot submissions.
- Updated Bennett's UI Improvements in the store registry to `0.1.5`.
- Changed macOS repair guidance to direct users to `chatgptplusplus repair` from Terminal when the background watcher is blocked.

### Fixed

- Made the auto-repair watcher run Codex++ self-update and app repair as separate steps, then open a Terminal repair fallback when macOS blocks background app modification.

## 0.1.4

Release notes: [docs/releases/0.1.4.md](docs/releases/0.1.4.md)

### Added

- Added Microsoft Store / WindowsApps Codex detection and patch support.
- Added Bun global install support with a first-run bootstrap command.
- Added dedicated macOS App Management permission alerts with an Open Settings action.

### Changed

- Improved auto-repair watcher retries after Codex updates and reduced repair checks to a 5-minute interval.
- Kept Codex++ release checks throttled to hourly while allowing app repair checks to run more often.
- Made Codex.app settle detection depend only on patch-critical inputs.
- Made blank `chatgptplusplus` invocations show help instead of a command error.

### Fixed

- Fixed Windows install dependency execution by using `npm.cmd`.
- Fixed Windows Store installs by mirroring locked app resources into a writable managed location.
- Fixed Windows renderer tweak settings.
- Fixed Homebrew command wrappers, executable permissions, reinstall conflicts, and formula tests after self-update.
- Fixed macOS App Management alert text and guidance.

## 0.1.3

Release notes: [docs/releases/0.1.3.md](docs/releases/0.1.3.md)

### Added

- Added hourly Codex++ self-update checks through the watcher.
- Added automatic Codex++ runtime download/build/repair when a newer Codex++ release is available.
- Added restart prompts when Codex is open and needs to reload a freshly updated Codex++ runtime.
- Added visible Codex update mode status while the official Codex updater is running.
- Added Codex beta app metadata support for watcher health checks and repair state.
- Added Markdown rendering for latest Codex++ release notes in Settings.
- Added GitHub issue links to unexpected CLI failure output.

### Changed

- Made Codex update repair alerts faster, clearer, and Codex-branded on macOS.
- Capped Codex++ runtime, loader, and watcher logs at 10 MB.
- Removed bundled example tweak sources from the Codex++ release package. Default tweaks now come from their own release channels.
- Updated the Codex++ Config subtitle to show the installed Codex++ version.
- Fixed Homebrew install instructions.

### Fixed

- Fixed negated installer flags such as `--no-default-tweaks`.
- Fixed the repair flow to avoid unnecessary re-signing when the patch is already intact.
- Fixed Codex beta metadata detection so beta installs report watcher health correctly.

## 0.1.2

Release notes: [docs/releases/0.1.2.md](docs/releases/0.1.2.md)

### Fixed

- Fixed enabling a previously disabled `scope: "main"` or `scope: "both"` tweak from Settings so the main-process half starts immediately instead of requiring Force Reload or an app restart.
- Fixed disabling a main-process tweak from Settings so loaded main-side tweak state is stopped before renderer hosts reload.
- Fixed macOS update self-repair after Codex changed its minified window-services startup shape in version `26.429.20946`, and moved that patcher to a more resilient fingerprint-based hook.
- Fixed the launchd watcher writing unusable TypeScript source paths such as `src/cli.js`, and refreshed it with modern `launchctl bootstrap` registration.

### Added

- Added `create-tweak`, `dev`, `validate-tweak`, and `safe-mode` installer commands for local tweak development and recovery.
- Added manifest validation helpers, permissions metadata, and optional tweak-provided MCP server declarations to the SDK.
- Added automatic Codex MCP config sync for enabled tweaks with `manifest.mcp`.
- Added an Auto-Repair Watcher health card to the Codex++ Config page.
- Added regression tests for tweak enable/disable reload behavior, tweak discovery, and tweak storage.
- Added CI coverage for tests and builds.
- Added macOS system alerts when update repair fails, a GitHub issue report action, and a post-update restart prompt when Codex is already open without Codex++ loaded.

## 0.1.1

### Added

- Added a native Codex window bridge for main-scope tweaks.
- Tweaks can now create Codex-registered chat windows for routes such as `/local/<conversation-id>`, which enables split-screen chat tweaks to render the real Codex chat UI instead of transcript clones or unregistered BrowserViews.
- The installer now exposes Codex's internal window services to the Codex++ runtime during asar patching.
- Added `chatgptplusplus` as the preferred CLI command, while keeping the legacy `codex-plusplus` alias for migration.
- Added `chatgptplusplus update` / `chatgptplusplus self-update` to refresh Codex++ from GitHub source, rebuild it, and run `repair`.
- Added `chatgptplusplus update-codex` for macOS Sparkle updates. It restores a signed Codex.app before the official updater runs, then lets the watcher reapply Codex++ after Codex restarts.
- Added a native Windows PowerShell bootstrap script, `install.ps1`.
- Added `update.sh` and `update.ps1` helper scripts for users whose shell does not yet have `chatgptplusplus` on PATH.
- Added Homebrew formula scaffolding and Bun/global-install metadata so `chatgptplusplus` can be installed as a normal command.

### Fixed

- Fixed the GitHub source installer failing on clean machines when `npm ci` rejects an out-of-sync workspace lockfile.
- The source installer now installs dependencies with `npm ci --workspaces --include-workspace-root --ignore-scripts`.
- If the downloaded lockfile is stale, the installer now removes only that temporary lockfile and falls back to `npm install --workspaces --include-workspace-root --ignore-scripts`.
- Fixed fallback installs missing workspace dependencies such as `electron`, `chokidar`, or `@chatgpt-plusplus/sdk`.
- Fixed Windows install preflight using the macOS-only `Contents` bundle path.
- Expanded Windows app discovery to cover common Squirrel and Electron install locations.
- Hardened Windows scheduled-task repair command quoting.
- Improved installer prerequisite and failure messages with human-readable `[!]` errors.

### Changed

- Source bootstrap installs local CLI shims into a writable PATH directory when possible, so users can run `chatgptplusplus repair`, `chatgptplusplus status`, and `chatgptplusplus update` after the first install.
- macOS installs now preserve a signed Codex.app backup when available, which supports safer official Codex updates.
- Settings injection now hides Codex++ settings surfaces more cleanly when leaving settings.

## 0.1.0

- Initial alpha release.
- One-command GitHub installer via `install.sh`; no npm package or `npx` dependency.
- Runtime-loaded local tweaks with Settings integration.
- App-update repair watcher for re-patching Codex after app updates, using the locally installed CLI.
- Codex++ release checks through GitHub Releases.
- Default tweak seeding from Bennett UI Improvements and Custom Keyboard Shortcuts GitHub release channels, with `--no-default-tweaks`.
- Review-only tweak update checks via required `githubRepo` manifest metadata.
- In-app tweak manager with enable/disable, config, release links, and maintenance actions.
