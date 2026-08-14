// Watcher 超时保护（优化方案 1.1）：
//  - CLI 进程内 5 分钟强制退出（WATCHER_RUN_TIMEOUT_MS）
//  - watcherShellScript 含 POSIX 看门狗（sleep 300 后强杀），
//    macOS 默认没有 GNU timeout 命令，必须用 sh 函数实现
//  - 命令注入加固（sanitizeCliToken）
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { platform } from "node:os";
import test from "node:test";
import { WATCHER_RUN_TIMEOUT_MS } from "../src/commands/self-update.js";
import { sanitizeCliToken, watcherShellScript } from "../src/watcher.js";

test("watcher 模式 CLI 看门狗为 5 分钟", () => {
  assert.equal(WATCHER_RUN_TIMEOUT_MS, 5 * 60 * 1000);
});

test("watcherShellScript 包含 POSIX 看门狗（macOS 无 GNU timeout）", () => {
  const script = watcherShellScript();
  assert.match(script, /timeout_run\(\)/);
  assert.match(script, /sleep 300/);
  assert.match(script, /kill -9/);
  assert.match(script, /update --watcher --quiet --no-repair/);
  assert.match(script, /repair --watcher --quiet/);
  // 看门狗函数定义必须先于调用出现
  const def = script.indexOf("timeout_run()");
  const call = script.indexOf("timeout_run ");
  assert.ok(def >= 0 && call > def, "timeout_run 定义应位于调用之前");
});

test("watcherShellScript 是合法 POSIX sh（语法校验）", (t) => {
  if (platform() === "win32") return t.skip("Windows 无 /bin/sh");
  const script = watcherShellScript("/tmp/watcher.log");
  // sh -n 只做语法检查不执行，不触发任何副作用
  execFileSync("/bin/sh", ["-n", "-c", script], { stdio: "ignore" });
});

test("sanitizeCliToken 剥离 shell 元字符", () => {
  assert.equal(sanitizeCliToken("a;b&c|d`e$(f)"), "abcdef");
  assert.equal(sanitizeCliToken("--watcher"), "--watcher");
  assert.equal(sanitizeCliToken("rm -rf /; echo pwned"), "rm -rf / echo pwned");
});
