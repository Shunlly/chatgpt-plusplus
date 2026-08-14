# Troubleshooting

## Watcher 进程卡死 / CPU 100%

**症状**：`ps aux | grep chatgpt-plusplus` 里能看到 `update --watcher` 或
`repair --watcher` 进程长期不退出（几分钟甚至几十小时），CPU 时间持续增长。

**根因**（v1.0.25 前已发生）：

1. **GitHub API 请求没有超时**——网络黑洞/代理挂起时 `fetch` 永不返回，watcher 被
   拖入无限等待（日志里 `~/Library/Logs/chatgpt-plusplus-watcher.log` 长时间无新内容）；
2. **持久化 CLI 被 shim 覆盖（v1.0.22~v1.0.25，macOS 独立包）**——`installCliShims`
   把 `<userRoot>/bin/chatgpt-plusplus` 的 SEA 二进制覆盖成"exec 自身"的 shim，
   watcher 每次运行都陷入自我 exec 死循环，表现为 `/bin/sh .../bin/chatgpt-plusplus
   update --watcher` 进程 R 状态、CPU 时间飞速增长——这是 CPU 100% 的直接元凶。

**立即处理**：

```sh
# 1. 找出并终止卡死的 watcher 进程（PID 以实际为准）
ps aux | grep "update --watcher\|repair --watcher" | grep -v grep
kill -9 <pid>

# 2. 停用 launchd 代理，防止它反复拉起卡死进程
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.chatgptplusplus.watcher.plist

# 3. 确认已清理
ps aux | grep chatgpt-plusplus | grep -v grep
```

**修复后**（v1.0.26+）：

- CLI 在 watcher 模式有进程级看门狗：任何流程最多运行 5 分钟，超时强制退出；
- 所有 GitHub API / 下载请求带 30 秒超时（源码归档下载 5 分钟）；
- shell 看门狗（`timeout_run`）在 300 秒后强杀 CLI，与进程内超时双重兜底；
- 持久化 CLI 不再被 shim 覆盖（`bin/chatgpt-plusplus` 保持为 SEA 二进制）。

**升级后自检**：

```sh
# bin/chatgpt-plusplus 必须是二进制（不要是 shell 脚本）：
file ~/Library/Application\ Support/chatgpt-plusplus/bin/chatgpt-plusplus
# 期望输出：Mach-O ... executable（而非 "POSIX shell script"）

# 手动跑一轮 watcher 流程，应能正常退出：
timeout 360 ~/Library/Application\ Support/chatgpt-plusplus/bin/chatgpt-plusplus update --watcher --quiet --no-repair; echo "exit=$?"
```

**验证**：运行 `timeout 360 chatgptplusplus update --watcher --quiet`，
应能在 5 分钟内正常退出（0 或非 0 都算退出，而不是挂住）。

## 内存泄漏 / 内存占用持续增长

**症状**：ChatGPT++ 长时间运行后内存占用持续上升，`活动监视器` 中 RSS 超过 1GB。

**排查**：

```sh
# 主进程日志会记录内存告警（heap > 500MB warn / RSS > 1GB critical）
grep -i "memory\|heap" ~/Library/Application\ Support/chatgpt-plusplus/log/main.log | tail

# 渲染进程崩溃也会写入 main.log（render-process-gone 条目）
grep "render-process-gone" ~/Library/Application\ Support/chatgpt-plusplus/log/main.log
```

**常见原因与对策**：

- 主题预览图缓存：预览图 Blob URL 有引用计数 + 200MB LRU 上限，正常会自动淘汰；
- 自定义主题过多或图片过大：删除不用的主题（GUI 主题页），或压缩图片后重建；
- 第三方 tweak 泄漏：逐个禁用 tweak 观察内存是否回落。

## 系统过热 / 保护性重启

**排查清单**：

1. `ps aux | sort -rk 3 | head` 找出 CPU 占用异常的进程（watcher 卡死是最常见原因，见上）；
2. 检查 `log/main.log` 与 `log/installer.log` 末尾的报错；
3. 检查系统日志中是否有 ChatGPT++ 相关崩溃（`log show --last 1h --predicate 'process == "ChatGPT"'`）；
4. 若与 watcher 相关：升级到 v1.0.26+（含超时保护），并确认 `launchctl list | grep chatgptplusplus` 正常。

## "Codex is damaged and can't be opened" / Gatekeeper rejection

The re-sign step failed or was skipped. Run:

```sh
chatgptplusplus doctor
```

If the signature check fails, manually re-sign:

```sh
chatgptplusplus repair --force
xattr -dr com.apple.quarantine /Applications/Codex.app
```

On macOS, ChatGPT++ signs ad-hoc by default. `chatgptplusplus install --local`
or `chatgptplusplus repair --local` opts into a local "ChatGPT++ Local Signing"
identity, but that can involve Keychain access prompts.

## App launches but nothing about chatgpt-plusplus appears

1. Open DevTools (View menu) and look for `[chatgpt-plusplus]` lines.
2. Check `~/Library/Application Support/chatgpt-plusplus/log/loader.log`.
3. If empty, the loader is not being executed → integrity check failed and the app silently fell back. Run `chatgptplusplus repair`.

## Codex auto-updated and the patch is gone

The watcher should normally re-apply the patch automatically. To force it immediately, run:

```sh
chatgptplusplus repair
```

Check the watcher is installed:

```sh
launchctl list | grep chatgptplusplus      # macOS
systemctl --user status chatgpt-plusplus-watcher  # Linux
schtasks /Query /TN chatgpt-plusplus-watcher       # Windows
```

## "Tweaks" tab doesn't appear in Settings

Codex's Settings markup may have changed. The injector's heuristics need an update. As a workaround:

1. Open DevTools, run `document.querySelectorAll('[role=dialog]')` while Settings is open. If nothing matches, the dialog uses different attributes — please file an issue with the markup snippet.
2. Until fixed, your tweaks still load (check the console). Their settings sections just have no UI to attach to yet.

## Tweak fails to load

Check the renderer console:

```
[chatgpt-plusplus] tweak load failed: <id> <error>
```

Common causes:

- `manifest.json` not valid JSON
- Missing `id`/`name`/`version` fields
- Entry script throws during `require`
- ESM-style `export default` in a `.js` file (use `.mjs` or `module.exports`)

## Uninstall is incomplete

The uninstaller only restores files we backed up at install time. If you've upgraded `chatgpt-plusplus` and the original app version no longer matches, the restored backup may be stale. Either:

- Reinstall Codex from a fresh download
- Or `chatgptplusplus install` against the new Codex, then `uninstall`

## I want to start fresh

```sh
chatgptplusplus uninstall --purge
```

This removes the runtime, watcher, tweaks, config, logs, backups, and ChatGPT++ user data. Then reinstall Codex.app from the official download.
