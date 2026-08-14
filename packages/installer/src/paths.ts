import { platform } from "node:os";
import { dirname, join, normalize, resolve, sep } from "node:path";
import { existsSync, mkdirSync, renameSync } from "node:fs";
import { chownForTargetUser, targetUserHome } from "./ownership.js";

/**
 * User-data directory layout. Picked per platform conventions; created lazily.
 *
 *   <root>/
 *     runtime/        — extracted runtime bundle (loader pulls from here)
 *     tweaks/         — user tweaks
 *     backup/         — original Codex.app artifacts (asar, plist, framework binary)
 *     config.json     — installer state + per-tweak enable flags
 *     log/            — runtime + installer logs
 *     state.json      — installer state (paths, hashes, version installed against)
 *     self-update-state.json — last ChatGPT++ self-update result
 */
export interface UserPaths {
  root: string;
  runtime: string;
  tweaks: string;
  backup: string;
  configFile: string;
  stateFile: string;
  updateModeFile: string;
  selfUpdateStateFile: string;
  binDir: string;
  logDir: string;
}

/**
 * 路径验证：把用户输入/外部来源的路径解析到 allowedBase 之下，
 * 防止路径遍历攻击（`../` 逃逸、绝对路径绕过）。返回规范化后的安全绝对路径。
 * 所有“外部输入 + 固定基目录”拼接出的文件操作路径都应先过此函数。
 */
export function validatePath(path: string, allowedBase: string): string {
  const base = resolve(allowedBase);
  const normalized = normalize(path);
  // normalize 后若是绝对路径，resolve(base, abs) 会直接返回 abs，必须显式拒绝。
  const resolved = resolve(base, normalized);
  if (resolved !== base && !resolved.startsWith(base + sep)) {
    throw new Error(`Path traversal detected: ${path}`);
  }
  return resolved;
}

export function userPaths(): UserPaths {
  const root = userRoot();
  const paths: UserPaths = {
    root,
    runtime: join(root, "runtime"),
    tweaks: join(root, "tweaks"),
    backup: join(root, "backup"),
    configFile: join(root, "config.json"),
    stateFile: join(root, "state.json"),
    updateModeFile: join(root, "update-mode.json"),
    selfUpdateStateFile: join(root, "self-update-state.json"),
    binDir: join(root, "bin"),
    logDir: join(root, "log"),
  };
  return paths;
}

export function ensureUserPaths(): UserPaths {
  const p = userPaths();
  for (const dir of [p.root, p.runtime, p.tweaks, p.backup, p.binDir, p.logDir]) {
    mkdirSync(dir, { recursive: true });
    chownForTargetUser(dir);
  }
  return p;
}

function userRoot(): string {
  // 兼容旧项目名的环境变量（老用户可能已配置）。
  if (process.env.CHATGPT_PLUSPLUS_HOME) return process.env.CHATGPT_PLUSPLUS_HOME;
  if (process.env.CODEX_PLUSPLUS_HOME) return process.env.CODEX_PLUSPLUS_HOME;

  const home = targetUserHome();
  const legacyRoot = legacyUserRoot(home);
  switch (platform()) {
    case "darwin":
      return migrateUserRoot(join(home, "Library", "Application Support", "chatgpt-plusplus"), legacyRoot);
    case "win32":
      return migrateUserRoot(
        join(process.env.APPDATA ?? join(home, "AppData", "Roaming"), "chatgpt-plusplus"),
        legacyRoot,
      );
    default:
      return migrateUserRoot(
        join(process.env.XDG_DATA_HOME ?? join(home, ".local", "share"), "chatgpt-plusplus"),
        legacyRoot,
      );
  }
}

/** 老版本的用户数据目录（项目还叫 codex-plusplus 时期的命名）。 */
function legacyUserRoot(home: string): string {
  switch (platform()) {
    case "darwin":
      return join(home, "Library", "Application Support", "codex-plusplus");
    case "win32":
      return join(process.env.APPDATA ?? join(home, "AppData", "Roaming"), "codex-plusplus");
    default:
      return join(
        process.env.XDG_DATA_HOME ?? join(home, ".local", "share"),
        "codex-plusplus",
      );
  }
}

/**
 * 一次性迁移：老版本（v1.0.4 及更早）的数据目录叫 codex-plusplus。
 * 新目录不存在且旧目录有数据时整体搬移，保留补丁备份、状态与 tweaks。
 * 首次调用后目录已就位，后续直接返回新路径。
 */
export function migrateUserRoot(current: string, legacy: string): string {
  if (current === legacy || existsSync(current) || !existsSync(legacy)) return current;
  try {
    mkdirSync(dirname(current), { recursive: true });
    renameSync(legacy, current);
  } catch {
    // 迁移失败（例如跨卷或占用）时退回旧目录，保证功能不中断。
    return legacy;
  }
  return current;
}
