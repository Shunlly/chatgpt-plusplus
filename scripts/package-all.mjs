#!/usr/bin/env node
/**
 * 一键打包：macOS 本地生成 DMG，Windows EXE 由 GitHub Actions 构建并自动下载。
 *
 * 用法：
 *   npm run package:all            # 一键出 mac DMG + Windows EXE
 *   npm run package:all -- --skip-dmg   # 只出 Windows EXE（不重新打 DMG）
 *   npm run package:all -- --skip-win   # 只出 macOS DMG
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "dist", "installers");
const args = process.argv.slice(2);
const skipDmg = args.includes("--skip-dmg");
const skipWin = args.includes("--skip-win");

function run(cmd, cmdArgs, cwd = ROOT) {
  console.log(`\n$ ${cmd} ${cmdArgs.join(" ")}`);
  const r = spawnSync(cmd, cmdArgs, { cwd, stdio: "inherit", encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`${cmd} 失败（退出码 ${r.status}）`);
  }
  return r;
}

// 1. macOS DMG（本机）
if (!skipDmg) {
  if (process.platform !== "darwin") {
    throw new Error("DMG 只能在 macOS 上构建；请在本机执行，或加 --skip-dmg 只构建 Windows EXE");
  }
  run("npm", ["run", "package:dmg"]);
} else {
  console.log("⏭ 跳过 DMG（--skip-dmg）");
}

// 2. Windows EXE（GitHub Actions）
if (!skipWin) {
  console.log("\n🚀 触发 GitHub Actions 构建 Windows EXE …");
  run("gh", ["workflow", "run", "release.yml", "--ref", "main"]);
  // 等待新触发的 run 出现
  let runId = null;
  for (let i = 0; i < 30; i++) {
    const out = spawnSync("gh", ["run", "list", "--workflow=release.yml", "--limit=1", "--json=databaseId,status"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    if (out.status === 0) {
      const runs = JSON.parse(out.stdout);
      if (runs.length > 0 && runs[0].status === "in_progress") {
        runId = runs[0].databaseId;
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  if (!runId) throw new Error("未找到进行中的 GitHub Actions 构建");
  console.log(`⏳ 等待构建 #${runId} 完成 …`);
  run("gh", ["run", "watch", String(runId), "--exit-status", "--interval", "20"]);
  mkdirSync(OUT, { recursive: true });
  run("gh", ["run", "download", String(runId), "-n", "exe", "-D", OUT]);
} else {
  console.log("⏭ 跳过 Windows EXE（--skip-win）");
}

console.log("\n✅ 一键打包完成，产物在：", OUT);
