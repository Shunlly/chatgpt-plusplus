/**
 * 独立安装包模式（打包脚本产出单文件二进制 + 旁置 assets）。
 * 打包时会在可执行文件旁放置 standalone.json：
 *   - macOS .app：Contents/Resources/
 *   - Windows / 裸二进制：与可执行文件同目录
 * 非独立安装（npm/Homebrew/源码）下所有探测都返回 null/false。
 */
import { chmodSync, cpSync, existsSync, mkdirSync, realpathSync } from "node:fs";
import { platform } from "node:os";
import { dirname, join } from "node:path";
import { userPaths } from "./paths.js";

/** 独立安装包的资源根目录；非独立安装返回 null。 */
export function standaloneRoot(execPath: string = process.execPath): string | null {
  const candidates = [
    // macOS .app：<App>.app/Contents/Resources
    join(dirname(execPath), "..", "Resources"),
    // Windows / 裸二进制：与可执行文件同目录
    dirname(execPath),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, "standalone.json"))) return dir;
  }
  return null;
}

export function isStandalone(): boolean {
  return standaloneRoot() !== null;
}

/** 独立安装包中的运行时资产目录（loader.cjs + runtime/）。 */
export function standaloneAssetsDir(execPath: string = process.execPath): string | null {
  const root = standaloneRoot(execPath);
  return root ? join(root, "assets") : null;
}

/** 独立安装包的安装根目录，用于记录 state.sourceRoot。 */
export function standaloneSourceRoot(execPath: string = process.execPath): string | null {
  return standaloneRoot(execPath);
}

/**
 * macOS 持久副本的根目录：bin/ 下有 standalone.json 时返回 bin/。
 * 克隆流程会覆盖安装器 app，安装过程必须优先从这里取旁置资源。
 */
export function persistentStandaloneRoot(): string | null {
  const persistent = persistentCliPath();
  if (!persistent) return null;
  const root = dirname(persistent);
  return existsSync(join(root, "standalone.json")) ? root : null;
}

/**
 * 独立包模式的资源根目录：优先 macOS 持久副本，其次当前可执行文件旁置。
 * 非独立安装返回 null。
 */
export function standaloneResourcesRoot(): string | null {
  return persistentStandaloneRoot() ?? standaloneRoot();
}

/**
 * 独立安装包中 CLI 的调用路径。macOS 的安装器 app 会被克隆流程整个替换，
 * 因此安装时先把 CLI 复制到用户目录持久副本，这里优先返回持久副本；
 * 非独立安装返回 null。
 */
export function standaloneCliPath(execPath: string = process.execPath): string | null {
  const persistent = persistentCliPath();
  if (persistent && existsSync(persistent)) return persistent;
  return standaloneRoot(execPath) ? execPath : null;
}

/** 持久副本路径：<userRoot>/bin/chatgpt-plusplus（仅 macOS 需要）。 */
function persistentCliPath(): string | null {
  if (platform() !== "darwin") return null;
  return join(userPaths().binDir, "chatgpt-plusplus");
}

/**
 * 独立包模式下把当前 CLI 及其旁置资源（standalone.json/assets/tweaks）
 * 复制到用户目录持久副本，返回持久路径；非独立安装返回 null。
 * macOS 的克隆流程会整个替换安装器 app，不持久化则修复入口与资源全部丢失。
 */
export function persistStandaloneCli(): string | null {
  const root = standaloneRoot();
  if (!root || platform() !== "darwin") return null;
  const dest = persistentCliPath();
  if (!dest) return null;
  try {
    if (realpathSync(dest) === realpathSync(process.execPath)) return dest;
  } catch {}
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(process.execPath, dest);
  chmodSync(dest, 0o755);
  for (const name of ["standalone.json", "assets", "tweaks"]) {
    const from = join(root, name);
    if (!existsSync(from)) continue;
    cpSync(from, join(dirname(dest), name), { recursive: true });
  }
  return dest;
}
