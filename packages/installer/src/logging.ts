import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { platform } from "node:os";
import { join } from "node:path";
import { userPaths } from "./paths.js";
import { targetUserHome } from "./ownership.js";

export const MAX_LOG_BYTES = 10 * 1024 * 1024;

export function capLogFile(path: string, maxBytes = MAX_LOG_BYTES): void {
  try {
    if (!existsSync(path)) return;
    const size = statSync(path).size;
    if (size <= maxBytes) return;
    const existing = readFileSync(path);
    writeFileSync(path, existing.subarray(Math.max(0, existing.byteLength - maxBytes)));
  } catch {
    // Logging cleanup is best-effort and must not break installer commands.
  }
}

/**
 * 把安装/修复命令的失败信息追加写入 <userRoot>/log/installer.log。
 * NSIS 安装器只能显示 stdout，用户复制日志文件内容即可定位根因。
 */
export function appendInstallerError(message: string): void {
  try {
    const paths = userPaths();
    mkdirSync(paths.logDir, { recursive: true });
    const file = join(paths.logDir, "installer.log");
    capLogFile(file);
    appendFileSync(file, `\n[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // 日志写入失败不能掩盖原始错误。
  }
}

export function capKnownLogFiles(): void {
  const paths = userPaths();
  for (const file of ["main.log", "preload.log", "loader.log"]) {
    capLogFile(join(paths.logDir, file));
  }
  if (platform() === "darwin") {
    capLogFile(join(targetUserHome(), "Library", "Logs", "chatgpt-plusplus-watcher.log"));
  }
}
