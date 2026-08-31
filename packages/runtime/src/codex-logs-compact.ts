/**
 * Codex 的 logs_2.sqlite 只删行不 VACUUM，空洞能涨到数 GB，
 * app-server 一写就堵，整应用只能强退。启动时文件过大就直接丢掉，
 * Codex 会自己重建空库。
 */
import { existsSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

export const CODEX_LOGS_MAX_BYTES = 1024 * 1024 * 1024;

export function compactOversizedCodexLogs(
  codexHome: string,
  maxBytes = CODEX_LOGS_MAX_BYTES,
): string[] {
  const base = join(codexHome, "logs_2.sqlite");
  const files = [base, `${base}-wal`, `${base}-shm`];
  try {
    if (!existsSync(base)) return [];
    if (statSync(base).size <= maxBytes) return [];
  } catch {
    return [];
  }

  const removed: string[] = [];
  for (const file of files) {
    try {
      if (!existsSync(file)) continue;
      rmSync(file);
      removed.push(file);
    } catch {
      // 被占用就留到下次启动
    }
  }
  return removed;
}
