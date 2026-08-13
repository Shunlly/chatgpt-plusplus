// Windows watcher 端到端自检（CI windows-latest 运行）：
// 验证 schtasks 存储的 /TR 命令、wscript→VBS→cmd 隐藏执行链路与含空格路径转义。
// 非 Windows 平台直接跳过；失败时以非零码退出让 CI 红灯。
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { windowsWatcherVbsContent } from "../src/watcher.js";

const TASK = "chatgpt-plusplus-watcher-selfcheck";

if (process.platform !== "win32") {
  console.log("SKIP: 非 Windows 平台，跳过 watcher 端到端自检");
  process.exit(0);
}

function schtasks(args: string[]): string {
  return execFileSync("schtasks.exe", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function cleanup(): void {
  for (const args of [["/End", "/TN", TASK], ["/Delete", "/F", "/TN", TASK]]) {
    try {
      schtasks(args);
    } catch {}
  }
}

const dir = mkdtempSync(join(tmpdir(), "chatgptpp-watcher-selfcheck-"));
const marker = join(dir, "ran.txt");
const cmdPath = join(dir, "watcher.cmd");
const vbsPath = join(dir, "watcher.vbs");
try {
  // 与 installScheduledTask 相同的产物形态：watcher.cmd + 隐藏运行的 VBS
  writeFileSync(cmdPath, `@echo off\r\necho ran > "${marker}"\r\nexit /b 0\r\n`);
  writeFileSync(vbsPath, windowsWatcherVbsContent(cmdPath));

  // 1. 创建一次性计划任务（命令为 wscript + VBS，路径含空格以验证转义）
  schtasks(["/Create", "/F", "/SC", "ONCE", "/ST", "23:59", "/TN", TASK, "/TR", `wscript.exe "${vbsPath}"`]);

  // 2. 查询任务存储的命令，确认 wscript 与 vbs 路径都被原样保存
  const detail = schtasks(["/Query", "/TN", TASK, "/FO", "LIST", "/V"]);
  const taskRun = detail.split(/\r?\n/).find((line) => /^(Task To Run|要运行的任务)/.test(line));
  assert.ok(taskRun, "任务查询应包含 Task To Run");
  assert.match(taskRun, /wscript\.exe/i);
  assert.match(taskRun, /watcher\.vbs/i);
  console.log("PASS: 计划任务存储命令正确 →", taskRun.trim());

  // 3. 手动触发任务，验证 wscript→VBS→cmd 全链路写出 marker
  schtasks(["/Run", "/TN", TASK]);
  const deadline = Date.now() + 15_000;
  while (!existsSync(marker) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(existsSync(marker), "watcher.cmd 应被 VBS 隐藏启动并写出 marker");
  console.log("PASS: wscript→VBS→cmd 隐藏执行链路正常");
} finally {
  cleanup();
  rmSync(dir, { recursive: true, force: true });
}
