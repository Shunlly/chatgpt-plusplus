import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** 捆绑在本仓库里的 tweak 跟 App 发版不同步，从 main 拉；第三方 tweak 用 GitHub Release tag。 */
export function githubTweakUpdateRef(
  repo: string,
  latestTag: string | null,
  bundledRepo: string,
): string {
  if (repo === bundledRepo) return "main";
  return latestTag?.trim() || "main";
}

export function githubTweakArchiveUrl(repo: string, ref: string): string {
  return `https://codeload.github.com/${repo}/tar.gz/${encodeURIComponent(ref)}`;
}

export function findTweakRootById(dir: string, id: string): string | null {
  if (!existsSync(dir)) return null;
  const manifestPath = join(dir, "manifest.json");
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { id?: unknown };
      if (manifest.id === id) return dir;
    } catch {
      // 坏 manifest 继续往下找
    }
  }
  let names: string[] = [];
  try {
    names = readdirSync(dir);
  } catch {
    return null;
  }
  for (const name of names) {
    if (name === "node_modules" || name === ".git") continue;
    const child = join(dir, name);
    try {
      if (!statSync(child).isDirectory()) continue;
    } catch {
      continue;
    }
    const found = findTweakRootById(child, id);
    if (found) return found;
  }
  return null;
}
