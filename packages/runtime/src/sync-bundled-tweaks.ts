/**
 * 把 App 包内的内置 tweak 同步到用户 tweaks 目录。
 * 仅当内置 manifest 版本更高时覆盖，避免冲掉用户自装的更高版本。
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const VERSION_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;

export function syncBundledTweaks(srcDir: string, destDir: string): string[] {
  const upgraded: string[] = [];
  if (!srcDir || !existsSync(srcDir)) return upgraded;
  mkdirSync(destDir, { recursive: true });
  for (const entry of readdirSync(srcDir)) {
    const from = join(srcDir, entry);
    if (!statSync(from).isDirectory()) continue;
    if (!existsSync(join(from, "manifest.json"))) continue;
    const to = join(destDir, entry);
    const fromVer = readManifestVersion(from);
    const toVer = existsSync(to) ? readManifestVersion(to) : "0.0.0";
    if (existsSync(to) && compareVersions(fromVer, toVer) <= 0) continue;
    rmSync(to, { recursive: true, force: true });
    cpSync(from, to, { recursive: true });
    upgraded.push(entry);
  }
  return upgraded;
}

export function readManifestVersion(dir: string): string {
  try {
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as { version?: unknown };
    return typeof manifest.version === "string" && manifest.version ? manifest.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export function compareVersions(a: string, b: string): number {
  const av = VERSION_RE.exec(a.trim());
  const bv = VERSION_RE.exec(b.trim());
  if (!av || !bv) return 0;
  for (let i = 1; i <= 3; i++) {
    const diff = Number(av[i]) - Number(bv[i]);
    if (diff !== 0) return diff;
  }
  return 0;
}
