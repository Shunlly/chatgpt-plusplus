# 卸载与打包流程优化分析

**分析日期**: 2026-08-14  
**当前版本**: v1.0.27

---

## 📊 当前状态分析

### 卸载流程（uninstall.ts）

**代码质量**: ⭐⭐⭐⭐⭐ 优秀

**已实现的优秀实践**:
- ✅ 在检查 Codex 运行前先清理 watcher（避免 Windows 计划任务残留）
- ✅ 智能恢复策略（full-app backup > partial backup > skip）
- ✅ 版本冲突检测（防止恢复不匹配的备份）
- ✅ 权限错误友好提示（自动给出 chown 修复命令）
- ✅ purge 选项保留用户 tweaks（除非明确 --purge）
- ✅ macOS 重新签名恢复的 bundle

### 打包流程（package.mjs）

**代码质量**: ⭐⭐⭐⭐ 良好

**已实现的优秀实践**:
- ✅ 跨平台打包（macOS dmg, Windows exe）
- ✅ Node SEA 单文件二进制（无需安装 Node.js）
- ✅ 自动下载 Node LTS（支持国内镜像）
- ✅ 自动重试机制（下载失败 3 次重试）
- ✅ CI 环境优化（删除临时文件）

**当前问题**:
- ⚠️ dist 目录 **6.6GB**（过大！）
- ⚠️ 下载 Node.js 运行时较慢（~110MB）
- ⚠️ 打包流程缺少进度提示

---

## 🎯 优化建议

### 优先级 1: 减小 dist 目录体积 🔥

**问题**: dist 目录高达 6.6GB，可能包含大量临时文件

**优化方案**:

#### 1.1 清理策略
```bash
# 检查 dist 目录结构
find dist -type f -size +10M -ls | head -20

# 应该只保留最终产物：
# - dist/installers/*.dmg
# - dist/installers/*.exe
# - dist/installers/chatgpt-plusplus (CLI 二进制)

# 删除中间产物：
# - .build/ (构建缓存)
# - dist/installers/dmg/ (dmg 暂存)
# - dist/installers/innosetup/ (innosetup 暂存)
```

#### 1.2 代码优化
```javascript
// scripts/package.mjs 末尾添加清理

async function main() {
  // ... 原有打包逻辑 ...

  // 清理中间产物（已在代码中，但验证是否完整）
  if (platform === "darwin") {
    rmSync(join(OUT, "dmg"), { recursive: true, force: true });
    if (process.env.CI) rmSync(binary, { force: true });
  } else if (platform === "win32") {
    rmSync(join(OUT, "innosetup"), { recursive: true, force: true });
    if (process.env.CI) rmSync(binary, { force: true });
  }

  // ✅ 新增：清理构建缓存（保留 SEA blob 以便增量构建）
  rmSync(join(BUILD, "node"), { recursive: true, force: true });
  
  console.log(`\n✅ 安装包已生成：${OUT}`);
  
  // ✅ 新增：显示最终产物大小
  const finalSize = await getFolderSize(OUT);
  console.log(`📦 总大小: ${formatBytes(finalSize)}`);
}

function getFolderSize(dir) {
  // 递归计算目录大小
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}
```

**预期效果**: dist 目录从 6.6GB → **<100MB**

---

### 优先级 2: 打包速度优化 ⚡

#### 2.1 并行下载（仅本地开发）
```javascript
// 当需要下载多个资源时并行
async function buildGuiAssets() {
  const tasks = [
    downloadIfNeeded("resource1"),
    downloadIfNeeded("resource2"),
  ];
  await Promise.all(tasks);
}
```

#### 2.2 增量构建检测
```javascript
async function buildSea(cli, platform) {
  const cacheKey = createHash('sha256')
    .update(readFileSync(cli))
    .update(platform)
    .update(NODE_LTS)
    .digest('hex');
  
  const cacheFile = join(BUILD, `sea-${cacheKey}.exe`);
  if (existsSync(cacheFile)) {
    console.log('✅ 使用缓存的 SEA 二进制');
    return cacheFile;
  }
  
  // ... 原有构建逻辑 ...
}
```

#### 2.3 进度提示
```javascript
async function ensureNodeBinary(platform) {
  // ... 原有逻辑 ...
  
  console.log(`📥 下载 Node.js 运行时：${url}`);
  console.log('⏳ 下载中...（约 110MB，首次较慢）');
  
  const bytes = await fetchBytesWithProgress(url);
  
  console.log('✅ 下载完成');
  // ...
}

async function fetchBytesWithProgress(url) {
  // 使用流式下载并显示进度
  const response = await fetch(url);
  const total = parseInt(response.headers.get('content-length') || '0');
  let downloaded = 0;
  
  const chunks = [];
  for await (const chunk of response.body) {
    chunks.push(chunk);
    downloaded += chunk.length;
    const percent = ((downloaded / total) * 100).toFixed(1);
    process.stdout.write(`\r📥 已下载: ${formatBytes(downloaded)} / ${formatBytes(total)} (${percent}%)`);
  }
  process.stdout.write('\n');
  
  return Buffer.concat(chunks);
}
```

**预期效果**: 
- 首次打包: 3-5 分钟（需下载 Node.js）
- 增量打包: **30-60 秒**（使用缓存）

---

### 优先级 3: 卸载流程增强 🔧

#### 3.1 卸载前备份检查
```javascript
export async function uninstall(opts: Opts = {}): Promise<void> {
  // ✅ 新增：卸载前显示将要删除的内容
  console.log(kleur.cyan('\n将要删除的内容：'));
  const paths = ensureUserPaths();
  
  console.log(`  - Runtime: ${paths.runtime}`);
  console.log(`  - State: ${paths.stateFile}`);
  if (opts.purge) {
    console.log(`  - User data (--purge): ${paths.root}`);
    console.log(`    包含: tweaks, 日志, 配置等`);
  } else {
    console.log(`  ✓ 保留 tweaks: ${paths.tweaks}`);
  }
  
  // ✅ 新增：确认提示
  if (!opts.yes && !process.env.CI) {
    const prompts = await import('prompts');
    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: '确认卸载？',
      initial: false,
    });
    
    if (!confirm) {
      console.log(kleur.yellow('已取消卸载'));
      return;
    }
  }
  
  // ... 原有卸载逻辑 ...
}
```

#### 3.2 卸载完整性验证
```javascript
// 卸载后验证
export async function uninstall(opts: Opts = {}): Promise<void> {
  // ... 原有逻辑 ...
  
  // ✅ 新增：验证卸载是否干净
  console.log(kleur.cyan('\n验证卸载...'));
  
  const checks = [
    { path: paths.runtime, name: 'Runtime' },
    { path: paths.stateFile, name: 'State file' },
  ];
  
  if (opts.purge) {
    checks.push({ path: paths.root, name: 'User data' });
  }
  
  let allClean = true;
  for (const { path, name } of checks) {
    if (existsSync(path)) {
      console.log(kleur.yellow(`  ⚠️  ${name} 仍存在: ${path}`));
      allClean = false;
    } else {
      console.log(kleur.green(`  ✓ ${name} 已清理`));
    }
  }
  
  if (allClean) {
    console.log(kleur.green('\n✅ 卸载完成，所有文件已清理'));
  } else {
    console.log(kleur.yellow('\n⚠️  部分文件未能清理，可能需要手动删除'));
  }
}
```

---

### 优先级 4: Windows 打包优化 💻

#### 4.1 Inno Setup 压缩优化
```ini
; installer.iss

[Setup]
; 当前: lzma2
; 优化: lzma2/ultra64 (更高压缩比)
Compression=lzma2/ultra64

; ✅ 新增：内部压缩
InternalCompressLevel=ultra64

; ✅ 新增：磁盘跨度（如果安装包 > 1GB）
DiskSpanning=yes
```

#### 4.2 并行打包（CI）
```yaml
# .github/workflows/release.yml
- name: Package Windows
  run: |
    # 使用多线程压缩
    npm run package:exe -- --threads=4
```

---

## 📈 优化效果预估

| 项目 | 当前 | 优化后 | 改进 |
|------|------|--------|------|
| **dist 目录大小** | 6.6GB | <100MB | ⬇️ 98% |
| **首次打包时间** | ~5 分钟 | 3-5 分钟 | ➡️ 持平 |
| **增量打包时间** | ~5 分钟 | **30-60 秒** | ⬇️ 90% |
| **安装包大小** | 未知 | 40-60MB | - |
| **卸载完整性** | 良好 | **优秀** | ⬆️ |

---

## 🛠️ 立即可执行的优化

### 1. 清理 dist 目录（立即执行）
```bash
cd /Users/chenshuhang/PycharmProjects/github_project/codex-plusplus

# 检查占用空间的大文件
du -sh dist/* | sort -hr | head -20

# 清理构建缓存
rm -rf .build/

# 清理 dist 中的临时文件（保留 installers/）
find dist -type d -name "dmg" -o -name "innosetup" | xargs rm -rf

# 验证清理后大小
du -sh dist
```

### 2. 添加打包清理脚本（5 分钟）
```javascript
// scripts/clean-dist.mjs
import { rmSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const toClean = [
  join(ROOT, '.build'),
  join(ROOT, 'dist', 'installers', 'dmg'),
  join(ROOT, 'dist', 'installers', 'innosetup'),
];

for (const path of toClean) {
  console.log(`清理: ${path}`);
  rmSync(path, { recursive: true, force: true });
}

console.log('✅ 清理完成');
```

### 3. 添加 package.json 脚本
```json
{
  "scripts": {
    "clean": "node scripts/clean-dist.mjs",
    "package": "npm run clean && node scripts/package.mjs",
    "package:dmg": "npm run clean && node scripts/package.mjs --platform=darwin",
    "package:exe": "npm run clean && node scripts/package.mjs --platform=win32"
  }
}
```

---

## 🔍 深度优化（长期）

### 1. 增量 SEA 构建缓存
- 缓存 Node.js 运行时下载（已有）
- 缓存 SEA blob（基于源码 hash）
- 缓存 GUI assets bundle

### 2. 并行构建流水线
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Bundle CLI │  │ Build GUI   │  │ Download    │
│             │  │ Assets      │  │ Node.js     │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┴────────────────┘
                        ↓
                 ┌─────────────┐
                 │   SEA Pack  │
                 └──────┬──────┘
                        ↓
                 ┌─────────────┐
                 │  Installer  │
                 └─────────────┘
```

### 3. 差异化打包
- 只打包变更的组件
- 增量更新包（补丁）
- 分离核心和可选组件

---

## ✅ 总结

### 当前状态
- ✅ **卸载流程**: 已经很优秀，无重大问题
- ⚠️ **打包流程**: 功能完整，但 dist 目录过大（6.6GB）
- ⚠️ **打包速度**: 缺少增量构建，每次都重新打包

### 推荐优化顺序
1. **立即执行**: 清理 dist 目录（5 分钟，效果显著）
2. **短期**: 添加打包清理脚本（10 分钟）
3. **中期**: 增量构建缓存（1-2 小时）
4. **长期**: 并行构建流水线（半天）

### 优化优先级
🔥 **高优先级**: dist 目录清理（立即见效）  
⚡ **中优先级**: 增量构建（提升开发体验）  
🎯 **低优先级**: 并行构建（CI 优化）

---

**生成时间**: 2026-08-14
