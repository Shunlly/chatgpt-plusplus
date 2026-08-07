/**
 * 独立安装包模式（打包脚本产出单文件二进制 + 旁置 assets）。
 * 打包时会在可执行文件旁放置 standalone.json：
 *   - macOS .app：Contents/Resources/
 *   - Windows / 裸二进制：与可执行文件同目录
 * 非独立安装（npm/Homebrew/源码）下所有探测都返回 null/false。
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

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

/** 独立安装包中 CLI 的调用路径：当前可执行文件自身；非独立安装返回 null。 */
export function standaloneCliPath(execPath: string = process.execPath): string | null {
  return standaloneRoot(execPath) ? execPath : null;
}
