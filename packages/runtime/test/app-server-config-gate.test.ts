import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  catalogFingerprint,
  catalogPathFromToml,
  enableCatalogImageInput,
  isCodexAppServerSpawn,
  shouldRestartAppServerOnCatalogChange,
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

test("相对 model_catalog_json 相对 config 目录解析", () => {
  assert.equal(
    catalogPathFromToml('model_catalog_json = "sub2api-model-catalog.json"\n', "/tmp/codex"),
    "/tmp/codex/sub2api-model-catalog.json",
  );
  assert.equal(
    catalogPathFromToml('model_catalog_json = "/abs/catalog.json"\n', "/tmp/codex"),
    "/abs/catalog.json",
  );
});

test("给仅 text 的模型补上 image，已有 image 的不动", () => {
  const raw = JSON.stringify({
    models: [
      { slug: "a", input_modalities: ["text"] },
      { slug: "b", input_modalities: ["text", "image"] },
      { slug: "c", input_modalities: ["TEXT"] },
    ],
  });
  const once = enableCatalogImageInput(raw);
  assert.equal(once.changed, 2);
  const models = JSON.parse(once.json).models;
  assert.deepEqual(models[0].input_modalities, ["text", "image"]);
  assert.deepEqual(models[1].input_modalities, ["text", "image"]);
  assert.deepEqual(models[2].input_modalities, ["TEXT", "image"]);
  assert.equal(enableCatalogImageInput(once.json).changed, 0);
});

test("坏 JSON 不改写", () => {
  const raw = "{not json";
  const out = enableCatalogImageInput(raw);
  assert.equal(out.changed, 0);
  assert.equal(out.json, raw);
});

test("app-server watcher 按 listener 精确解绑，避免多实例互相影响", () => {
  const src = readFileSync(new URL("../src/app-server-config-gate.ts", import.meta.url), "utf8");
  assert.match(src, /unwatchFile\(opts\.configPath, configListener\)/);
  assert.match(src, /unwatchFile\(catalogFile, catalogListener\)/);
});

test("Windows catalog 更新不杀 app-server，避免 Owl 把后端退出当成整应用重启", () => {
  assert.equal(shouldRestartAppServerOnCatalogChange("win32"), false);
  assert.equal(shouldRestartAppServerOnCatalogChange("darwin"), true);
});
