import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogFingerprint,
  isCodexAppServerSpawn,
} from "../src/app-server-config-gate";

test("识别 Windows/macOS 的 app-server spawn，放过普通 CLI", () => {
  assert.equal(isCodexAppServerSpawn(String.raw`C:\Users\a\ChatGPT\codex.exe`, ["app-server"]), true);
  assert.equal(isCodexAppServerSpawn("/Applications/ChatGPT.app/Contents/Resources/codex", ["app-server"]), true);
  assert.equal(isCodexAppServerSpawn(String.raw`C:\Users\a\ChatGPT\codex.exe`, []), true);
  assert.equal(isCodexAppServerSpawn(String.raw`C:\Users\a\ChatGPT\codex.exe`, ["exec", "hi"]), false);
  assert.equal(isCodexAppServerSpawn("/usr/bin/node", ["app-server"]), false);
});

test("catalogFingerprint 跟踪 model_catalog_json 路径和目标文件", () => {
  const toml = `model_catalog_json = "D:/Download/sub2api-model-catalog (1).json"\n`;
  const a = catalogFingerprint(toml, () => ({ mtimeMs: 1, size: 10 }));
  const b = catalogFingerprint(toml, () => ({ mtimeMs: 2, size: 10 }));
  const c = catalogFingerprint(
    `model_catalog_json = "D:/other.json"\n`,
    () => ({ mtimeMs: 1, size: 10 }),
  );
  assert.ok(a && a.includes("sub2api-model-catalog (1).json"));
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.equal(catalogFingerprint("foo = 1\n"), null);
});
