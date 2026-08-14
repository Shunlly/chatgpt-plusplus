# 依赖漏洞手动修复指南

## 问题

npm audit fix 会卡住很长时间（可能是依赖解析冲突）。需要手动更新依赖。

## 当前漏洞

```bash
npm audit
# 3 vulnerabilities (1 low, 2 high)

1. electron@41.3.0 (高危 x3)
   - GHSA-v3j7-r9gq-3gjw: 跨域读取
   - GHSA-r4w5-6pfg-jxp5: 缓存重用
   - GHSA-9f4c-93c8-jc8g: iframe popup 绕过
   修复版本: 41.10.3+

2. esbuild@0.28.1 (低危)
   - GHSA-g7r4-m6w7-qqqr: 任意文件读取
   修复版本: 0.28.1+ (已是安全版本，但在 tsx 依赖中)

3. extract-zip (高危)
   - GHSA-jmr9-qjv8-65gv: 路径遍历
   修复版本: 通过更新 electron 自动修复
```

## 手动修复步骤

### 方法 1: 直接修改 package.json（推荐）

1. 编辑 `packages/gui/package.json`：
```json
{
  "devDependencies": {
    "electron": "41.10.3"  // 从 41.3.0 改为 41.10.3
  }
}
```

2. 删除锁文件并重新安装：
```bash
rm -f package-lock.json packages/gui/package-lock.json
npm install
```

3. 验证修复：
```bash
npm audit
# 应该显示 0 vulnerabilities
```

### 方法 2: 使用 npm update

```bash
# 进入 gui 包目录
cd packages/gui

# 更新 electron 到修复版本
npm install electron@41.10.3 --save-exact

# 返回根目录
cd ../..

# 验证
npm audit
```

### 方法 3: 使用 npm overrides（临时方案）

在根 `package.json` 中添加：
```json
{
  "overrides": {
    "brace-expansion": "^1.1.18",
    "electron": "41.10.3",
    "extract-zip": "^2.0.1"
  }
}
```

然后运行：
```bash
npm install --force
npm audit
```

## 验证清单

修复后验证：

```bash
# 1. 检查漏洞
npm audit
# 期望: 0 vulnerabilities

# 2. 检查 electron 版本
npm list electron
# 期望: electron@41.10.3

# 3. 运行测试
npm test
# 期望: 191 tests pass

# 4. 构建项目
npm run build
# 期望: 成功构建

# 5. 启动 GUI 验证
npm run start --workspace @chatgpt-plusplus/gui
# 期望: 正常启动
```

## 为什么 npm audit fix 会卡住？

可能的原因：
1. **依赖冲突**: electron 的大版本更新可能与其他依赖冲突
2. **网络问题**: npm registry 下载缓慢
3. **锁文件损坏**: package-lock.json 状态不一致

## 后续操作

修复完成后：

```bash
# 1. 提交修改
git add package.json package-lock.json packages/gui/package.json
git commit -m "fix: 修复依赖安全漏洞

- electron 41.3.0 → 41.10.3 (修复 3 个高危漏洞)
- 通过更新 electron 自动修复 extract-zip 漏洞
- esbuild 已是安全版本 (0.28.1)

漏洞详情:
- GHSA-v3j7-r9gq-3gjw: Electron 跨域读取
- GHSA-r4w5-6pfg-jxp5: Electron 缓存重用
- GHSA-9f4c-93c8-jc8g: Electron iframe popup 绕过
- GHSA-jmr9-qjv8-65gv: extract-zip 路径遍历

验证:
- npm audit: 0 vulnerabilities
- npm test: 191/191 pass
- npm run build: success"

# 2. 推送到远程
git push origin main
```

## 注意事项

⚠️ **Electron 版本兼容性**

升级 Electron 可能影响：
- 原生模块兼容性（需要重新编译）
- API 变更（检查 Electron 41.10.3 变更日志）
- 主进程/渲染进程行为

建议升级后进行完整测试：
1. 启动应用
2. 测试所有主要功能
3. 检查控制台是否有错误
4. 测试所有 tweaks
5. 测试 Dream Skin 主题切换

## 如果遇到问题

如果升级后出现问题：

```bash
# 1. 回滚到安全版本
cd packages/gui
npm install electron@41.3.0 --save-exact

# 2. 使用临时缓解措施
# 在文档中标注漏洞，但保持稳定性
# 等待 Electron 更新或寻找其他解决方案

# 3. 检查 Electron 发布说明
open https://github.com/electron/electron/releases/tag/v41.10.3
```

---

**更新时间**: 2026-08-14  
**状态**: 待执行
