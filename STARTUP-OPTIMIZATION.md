# ChatGPT++ 启动性能优化方案

## 当前启动性能分析

根据日志分析，当前启动时间：
- **窗口显示**：~500ms（较快）
- **完全可用**：2-3秒（包括网络请求）

### 启动流程时间线

```
0ms:     应用启动
80ms:    Codex CLI 初始化握手完成
397ms:   主窗口加载完成
506ms:   窗口显示（ready-to-show）
~240ms:  Tweak 系统启动
~2000ms: 网络请求完成（登录检查、推送通知等）
```

### 性能瓶颈识别

1. **Codex CLI 启动**（80ms）
   - 116MB Node.js SEA 二进制
   - stdio 传输协议初始化
   
2. **网络请求**（~1.5秒）
   - 登录状态检查
   - 推送通知注册
   - Remote Control 客户端刷新
   
3. **Tweak 系统**（~240ms）
   - Dream Skin 主题加载
   - Settings 注入器
   - React DevTools hook

4. **应用包大小**（1.3GB）
   - 启动时需要验证签名和加载资源

## 优化方案

### 方案 A：延迟加载非关键功能 ⭐ 推荐

**影响**：最小化首屏时间，用户感知明显提升

1. **延迟网络请求**（估计提升 1-1.5秒）
   ```typescript
   // 在窗口显示后 500ms 再执行网络请求
   setTimeout(() => {
     checkLoginStatus();
     registerPushNotifications();
     refreshRemoteControl();
   }, 500);
   ```

2. **延迟 Tweak 加载**（估计提升 200ms）
   ```typescript
   // preload/index.ts - 窗口显示后再加载 tweaks
   async function boot() {
     startSettingsInjector(); // 立即执行，保证设置生效
     
     // 延迟加载 tweaks，不阻塞窗口显示
     requestIdleCallback(() => {
       startTweakHost();
       mountManager();
     });
   }
   ```

3. **按需加载主题资源**
   - Dream Skin 初始只加载当前主题
   - 其他主题在首次切换时加载
   - 背景图片使用懒加载

**预期效果**：首屏时间从 500ms 保持不变，完全可用时间从 2-3秒降至 0.5-1秒

---

### 方案 B：优化 CLI 初始化

**影响**：减少 Codex CLI 启动开销

1. **延迟 CLI 连接**
   - 窗口显示后再初始化 CLI 连接
   - 使用连接池复用已有连接
   
2. **CLI 预热**（较复杂）
   - 后台保持 CLI 进程常驻
   - 使用 Unix socket 通信代替 stdio
   
**预期效果**：节省 50-80ms，但增加复杂度

---

### 方案 C：代码分割和懒加载

**影响**：减少初始 JavaScript 包大小

1. **动态导入非关键模块**
   ```typescript
   // 仅在需要时加载
   const { startStatsigMaintenance } = await import('./statsig-patch');
   ```

2. **Tree shaking 优化**
   - 移除未使用的依赖
   - 使用 ES modules 以便更好的 tree shaking

**预期效果**：节省 50-100ms 解析时间

---

### 方案 D：资源优化

**影响**：减少磁盘 I/O 和内存占用

1. **压缩静态资源**
   - 主题 CSS/JS 使用 gzip 压缩
   - 图片资源使用 WebP 格式
   
2. **减少 CLI 二进制大小**（较难）
   - 使用 Node.js slim 版本
   - 移除未使用的 Node.js 内置模块
   - 当前 116MB → 目标 60-80MB

3. **资源缓存**
   - 主题资源使用 Service Worker 缓存
   - 避免重复读取磁盘

**预期效果**：节省 100-200ms I/O 时间

---

### 方案 E：启动画面优化 ⭐ 推荐

**影响**：改善用户感知，不改变实际启动时间

1. **添加启动动画**
   - 显示品牌 Logo + 进度条
   - 渐进式加载提示（"正在加载主题..."）
   
2. **骨架屏**
   - 在内容加载前显示布局骨架
   - 减少白屏时间的感知

**预期效果**：用户感知启动更快（心理层面提升）

---

## 实施建议

### 第一阶段（快速见效，1-2小时）
1. ✅ **方案 A.1**：延迟网络请求
2. ✅ **方案 A.2**：延迟 Tweak 加载
3. ✅ **方案 E**：添加启动画面（可选）

**预期提升**：完全可用时间从 2-3秒 → 0.5-1秒

### 第二阶段（中等投入，4-8小时）
1. **方案 C**：代码分割
2. **方案 D.1**：资源压缩
3. **方案 D.3**：资源缓存

**预期提升**：额外节省 100-200ms

### 第三阶段（长期优化，2-4天）
1. **方案 B**：CLI 初始化优化
2. **方案 D.2**：CLI 二进制瘦身

**预期提升**：额外节省 100-150ms

---

## 性能监控

添加性能埋点：

```typescript
// 记录关键时间点
const perf = {
  appStart: Date.now(),
  cliReady: 0,
  windowLoaded: 0,
  tweaksReady: 0,
  fullyReady: 0
};

// 上报启动性能数据
console.log('[perf]', {
  cliInit: perf.cliReady - perf.appStart,
  windowLoad: perf.windowLoaded - perf.appStart,
  tweaksLoad: perf.tweaksReady - perf.windowLoaded,
  total: perf.fullyReady - perf.appStart
});
```

---

## 对比目标

| 指标 | 当前 | 目标（第一阶段） | 目标（第二阶段） |
|------|------|------------------|------------------|
| 窗口显示 | 500ms | 300-400ms | 200-300ms |
| 完全可用 | 2-3s | 0.5-1s | 0.3-0.5s |
| 用户感知 | 慢 | 快 | 很快 |

---

## 注意事项

1. **功能完整性**：延迟加载不能影响核心功能
2. **向后兼容**：优化不能破坏现有用户数据
3. **渐进增强**：优先优化高频路径
4. **可测量**：每个优化都要有明确的性能指标

---

## 下一步

1. 选择实施方案（建议从方案 A 开始）
2. 添加性能监控代码
3. 实施优化并测试
4. 对比优化前后的性能数据
5. 迭代改进
