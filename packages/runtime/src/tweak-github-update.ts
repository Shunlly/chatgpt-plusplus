import { createWriteStream, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { finished } from "node:stream/promises";

export type TweakUpdateProgress = {
  id: string;
  phase: "download" | "extract" | "install";
  received: number;
  total: number;
};

/** 把 fetch 响应写到文件，按 chunk 回调进度。total=0 表示没有 Content-Length。 */
export async function writeFetchBodyToFile(
  res: Response,
  dest: string,
  onProgress?: (received: number, total: number) => void,
): Promise<void> {
  const total = Number(res.headers.get("content-length")) || 0;
  if (!res.body) {
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(dest, buf);
    onProgress?.(buf.length, total || buf.length);
    return;
  }
  const file = createWriteStream(dest);
  const reader = res.body.getReader();
  let received = 0;
  let lastEmit = 0;
  const emit = (force = false) => {
    const now = Date.now();
    if (!force && now - lastEmit < 80) return;
    lastEmit = now;
    onProgress?.(received, total);
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (!file.write(value)) {
        await new Promise<void>((resolve, reject) => {
          file.once("drain", resolve);
          file.once("error", reject);
        });
      }
      emit();
    }
  } catch (err) {
    file.destroy();
    throw err;
  }
  file.end();
  await finished(file);
  onProgress?.(received, total || received);
}

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
