import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  WINDOWS_PLUSPLUS_AUMID,
  isManagedStoreAppsPath,
  isStaleManagedChatGptShortcutTarget,
  staleManagedChatGptShortcutCandidates,
  windowsLauncherDir,
  windowsOwlProcessArgs,
  writeWindowsLaunchConfig,
} from "../src/windows-launch";

test("识别商店镜像路径和误指向 ChatGPT.exe 的旧快捷方式", () => {
  const owl = "C:\\Users\\A\\AppData\\Local\\chatgpt-plusplus\\store-apps\\OpenAI.Codex_1\\app\\ChatGPT.exe";
  const plus = "C:\\Users\\A\\AppData\\Local\\chatgpt-plusplus\\store-apps\\OpenAI.Codex_1\\app\\ChatGPT++.exe";
  const store = "C:\\Program Files\\WindowsApps\\OpenAI.Codex_1\\app\\ChatGPT.exe";
  assert.equal(isManagedStoreAppsPath(owl), true);
  assert.equal(isStaleManagedChatGptShortcutTarget(owl), true);
  assert.equal(isStaleManagedChatGptShortcutTarget(plus), false);
  assert.equal(isStaleManagedChatGptShortcutTarget(store), false);
});

test("启动器目录和子进程参数带独立用户数据与 AUMID", () => {
  assert.equal(
    windowsLauncherDir("C:\\Users\\A\\AppData\\Local"),
    join("C:\\Users\\A\\AppData\\Local", "chatgpt-plusplus", "bin"),
  );
  assert.deepEqual(windowsOwlProcessArgs("C:\\Users\\A\\AppData\\Local\\ChatGPT++"), [
    "--user-data-dir=C:\\Users\\A\\AppData\\Local\\ChatGPT++",
    `--app-user-model-id=${WINDOWS_PLUSPLUS_AUMID}`,
  ]);
  const candidates = staleManagedChatGptShortcutCandidates({
    appData: "C:\\Users\\A\\AppData\\Roaming",
    home: "C:\\Users\\A",
  });
  assert.ok(candidates.some((p) => p.endsWith("ChatGPT.lnk")));
});

test("launch.json 写入 owl 主程序路径", () => {
  const dir = mkdtempSync(join(tmpdir(), "chatgptpp-launch-"));
  try {
    mkdirSync(dir, { recursive: true });
    const exe = join(dir, "ChatGPT++.exe");
    writeFileSync(exe, "stub");
    const userDataDir = join(dir, "data");
    const config = writeWindowsLaunchConfig({ launcherDir: dir, owlExe: exe, userDataDir });
    const parsed = JSON.parse(readFileSync(config, "utf8")) as { exe: string; userDataDir: string };
    assert.equal(parsed.exe, exe);
    assert.equal(parsed.userDataDir, userDataDir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
