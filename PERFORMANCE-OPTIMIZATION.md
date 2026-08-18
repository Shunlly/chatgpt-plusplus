# 性能优化总结

## 优化目标
解决应用启动加载缓慢的问题

## 实施的优化措施

### 1. 预加载脚本优化 (preload/index.ts)
**优化内容：** 使用 `requestIdleCallback` 异步加载 Tweaks

**改动：**
```typescript
// 优化前：同步加载
loadTweaks();

// 优化后：空闲时异步加载
if (typeof requestIdleCallback !== "undefined") {
  requestIdleCallback(() => loadTweaks(), { timeout: 1000 });
} else {
  setTimeout(() => loadTweaks(), 100);
}
```

**效果：** 不阻塞主线程，提升首屏显示速度

---

### 2. Statsig 配置轮询优化 (preload/statsig-patch.ts)
**优化内容：** 降低配置轮询频率

**改动：**
```typescript
// 优化前：10 秒轮询一次
const intervalMs = opts.intervalMs ?? 10_000;

// 优化后：30 秒轮询一次
const intervalMs = opts.intervalMs ?? 30_000;
```

**效果：** 减少后台网络请求和 CPU 占用

---

### 3. 启动画面 (splash.html)
**优化内容：** 新增轻量级启动画面，遮盖主窗口加载过程

**特性：**
- 透明窗口设计
- 响应式布局
- 主题适配（跟随系统深色/浅色模式）
- 加载动画和进度条

**效果：** 改善用户感知的启动速度

---

### 4. GUI 主进程优化 (gui/src/main.ts)
**优化内容：**
1. 创建 `createSplashWindow()` 函数显示启动画面
2. 修改 `createWindow()` 使用 `ready-to-show` 事件延迟显示主窗口
3. 添加 `autoUpdateCli()` 函数后台检查 CLI 更新

**改动：**
```typescript
// 启动流程优化
const splash = createSplashWindow();
const win = await createWindow({ splash });
// 主窗口准备好后自动关闭启动画面
```

**效果：** 避免白屏，平滑过渡到主界面

---

### 5. 图片懒加载 (tweaks/dream-skin/index.js)
**优化内容：** 使用 `IntersectionObserver` 实现预设缩略图懒加载

**改动：**
```javascript
// 只加载可见区域的图片
const lazyObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const img = entry.target;
      const presetId = img.dataset.presetId;
      api.fs.asset(`presets/${presetId}/background.jpg`)
        .then((dataUrl) => img.src = dataUrlToObjectUrl(dataUrl));
      lazyObserver.unobserve(img);
    }
  });
}, { rootMargin: "50px" });
```

**效果：** 减少初始加载的资源数量，降低内存占用

---

### 6. CLI 命令延迟加载 (installer/src/cli.ts)
**优化内容：** 将所有命令模块改为动态导入

**改动：**
```typescript
// 优化前：顶层同步导入所有命令
import { install } from "./commands/install.js";
import { uninstall } from "./commands/uninstall.js";
// ... 更多导入

// 优化后：按需动态导入
async function runInstall(opts: InstallCliOpts): Promise<void> {
  const { install } = await import("./commands/install.js");
  return install({...opts, localSigning: resolveLocalSigning(opts)});
}

async function runUninstall(opts: UninstallCliOpts): Promise<void> {
  const { uninstall } = await import("./commands/uninstall.js");
  return uninstall(opts);
}
```

**优化的命令：**
- install
- uninstall
- repair
- updateCodex
- selfUpdate
- status
- debug
- browserUi
- doctor
- safeMode
- showPatchFailedAlert

**效果：** 
- 减少 CLI 初始化时的模块加载量
- 降低内存占用
- 只有实际执行的命令才会加载对应模块

---

## 性能测试结果

### CLI 启动时间
```
优化前: 70-80ms
优化后: 60-70ms
```

### 动态导入验证
```bash
$ grep -c "import(" dist/cli.js
14
```
确认已正确编译为动态导入

---

## 架构约束

### CLI 初始化瓶颈
通过分析发现，CLI 最大的性能瓶颈是 **Node.js SEA (Single Executable Application)** 的冷启动：

- **CLI 二进制大小：** 116MB
- **冷启动时间：** ~2040ms
- **缓存后启动：** ~80ms

这个瓶颈由官方 ChatGPT 应用的主进程控制，我们无法直接优化。

**应对策略：**
1. **UI 感知优化：** 启动画面、异步加载、懒加载
2. **代码优化：** 动态导入减少初始加载量

详细分析见：[CLI-OPTIMIZATION-ANALYSIS.md](./CLI-OPTIMIZATION-ANALYSIS.md)

---

## 总结

本次优化采用 **双管齐下** 的策略：
1. **改善用户感知：** 通过 UI 优化让启动过程看起来更快
2. **降低实际开销：** 通过代码分割和延迟加载减少初始化负担

虽然受限于底层架构（Node.js SEA），无法从根本上消除 CLI 初始化的开销，但通过这些优化措施，显著改善了用户体验。
