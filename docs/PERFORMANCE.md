# Performance

ChatGPT++ 的性能优化说明：推荐配置、监控命令、低端设备优化与常见问题。

## 推荐系统配置

| 项目 | 最低 | 推荐 |
| --- | --- | --- |
| 操作系统 | macOS 14.0+ / Windows 10 1809+ / Linux (systemd) | 最新稳定版 |
| 内存 | 8 GB | 16 GB+ |
| CPU | 4 核 | 8 核+ |
| 磁盘 | 2 GB 可用 | SSD，5 GB 可用 |
| 网络 | 可访问 GitHub API | 稳定网络（自更新/商店依赖） |

ChatGPT 桌面应用本身是 Electron 应用，内存占用大头来自它自身
（渲染进程 + GPU 进程）；ChatGPT++ 运行时只占用其中很小一部分。

## 性能监控命令

```sh
# 主进程内存与崩溃告警（heap>500MB warn / RSS>1GB critical / render-process-gone）
tail -f ~/Library/Application\ Support/chatgpt-plusplus/log/main.log

# 24 小时内存曲线（macOS）
while true; do
  ps aux | grep "ChatGPT++/Contents/MacOS" | grep -v grep | awk '{print strftime("%H:%M:%S"), $6/1024 " MB"}'
  sleep 60
done

# watcher 健康状态
chatgptplusplus doctor

# 主题预览图缓存占用（GUI 主题页控制台会输出告警）
# [dream-skin] 主题预览缓存占用过高（xxxMB），已自动淘汰最久未用条目
```

## 性能设计（v1.0.26+）

- **主题预览懒加载**：主题列表不再内嵌 base64 图片，卡片进入视口前 50px 才读取；
  首屏只解码可见卡片，避免 6+ 张预设主题图同时解码阻塞主线程。
- **Blob URL 引用计数 + LRU 上限**：同一主题图只创建一个 Blob URL，离开视口释放
  引用，缓存超过 200MB 按最久未用淘汰并 revoke，防止长期使用累积内存泄漏。
- **DOM 局部更新**：切换主题只更新激活态/角标，不整页重建网格。
- **watcher 超时保护**：watcher 模式进程级 5 分钟看门狗 + GitHub 请求 30 秒超时，
  杜绝网络黑洞导致的 CPU 100% 死循环。
- **主进程资源监控**：每分钟检查堆内存/RSS，超阈值写日志告警；渲染进程崩溃
  （render-process-gone）自动记录原因与退出码。
- **侧边栏扫描优化**（1.0.24 起）：MutationObserver 只扫描侧边栏区域，
  隐藏窗口零扫描，聊天区内容变化不再触发 layout 风暴。

## 低端设备优化指南

1. **关闭动画**：系统「减少动态效果」可降低主题切换/模糊渲染开销。
2. **减少自定义主题数量**：每个主题的预览图会进入缓存，删除不用的主题
   （GUI 主题页不支持删除时，可删除
   `~/Library/Application Support/chatgpt-plusplus/tweak-data/com.codexplusplus.dream-skin/custom/`
   下对应 `<id>.json` 与 `index.json` 中的条目）。
3. **压缩主题图**：上传前把图片压到 1MB 以内（建议 1920×1080 以下），
   模糊/缩放渲染更省 GPU。
4. **限制同时运行的 tweak**：禁用不常用的 tweak（Settings → Tweaks）。
5. **保持网络通畅**：watcher 卡死的根因是 GitHub 请求无超时；v1.0.26+ 已修复，
   旧版本请升级。

## 常见性能问题

| 症状 | 原因 | 解决 |
| --- | --- | --- |
| watcher 进程 CPU 100% | GitHub 请求无限等待（旧版本无超时） | 升级 v1.0.26+，并清理卡死进程（见 TROUBLESHOOTING） |
| 主题切换卡顿 | 预览图过大 / 动画重绘 | 压缩图片；开启系统减少动态效果 |
| 长期运行内存增长 | 主题图缓存 / tweak 泄漏 | 缓存有 200MB 自动上限；逐个禁用 tweak 排查 |
| 首屏打开慢 | 大量主题同时解码 | v1.0.26+ 已改为懒加载 |
| Electron 崩溃 | 渲染进程异常 | main.log 中查 render-process-gone 条目并反馈 issue |
