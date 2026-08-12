import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { seedCustomThemes, syncPresets } from "../src/commands/install.js";

test("syncPresets 补齐缺失预设、覆盖同名旧预设，并保留用户自定义文件", () => {
  const root = mkdtempSync(join(tmpdir(), "sync-presets-"));
  try {
    const from = join(root, "from");
    const to = join(root, "to");
    // 内置 presets：a、b
    for (const id of ["a", "b"]) {
      mkdirSync(join(from, "presets", id), { recursive: true });
      writeFileSync(join(from, "presets", id, "theme.json"), `{"id":"${id}","name":"内置 ${id}"}`);
    }
    // 已装 presets：只有 a（旧内容）
    mkdirSync(join(to, "presets", "a"), { recursive: true });
    writeFileSync(join(to, "presets", "a", "theme.json"), "旧内容");
    // 用户自定义文件不应被删
    writeFileSync(join(to, "custom.txt"), "用户数据");

    syncPresets(from, to);

    assert.equal(
      readFileSync(join(to, "presets", "a", "theme.json"), "utf8"),
      `{"id":"a","name":"内置 a"}`,
    );
    assert.equal(
      readFileSync(join(to, "presets", "b", "theme.json"), "utf8"),
      `{"id":"b","name":"内置 b"}`,
    );
    assert.equal(readFileSync(join(to, "custom.txt"), "utf8"), "用户数据");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("内置无 presets 时 syncPresets 不影响已装目录", () => {
  const root = mkdtempSync(join(tmpdir(), "sync-presets-none-"));
  try {
    const from = join(root, "from");
    const to = join(root, "to");
    mkdirSync(from, { recursive: true });
    mkdirSync(to, { recursive: true });
    writeFileSync(join(to, "keep.txt"), "保留");

    syncPresets(from, to);

    assert.equal(readFileSync(join(to, "keep.txt"), "utf8"), "保留");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("seedCustomThemes 补齐缺失主题、保留已存在主题并合并 index 去重", () => {
  const root = mkdtempSync(join(tmpdir(), "seed-custom-"));
  try {
    const fromTweak = join(root, "tweaks", "dream-skin");
    const tweakDataRoot = join(root, "tweak-data");
    const seed = join(fromTweak, "custom-seed");
    // 内置 seed：a、b 两个主题 + index
    mkdirSync(seed, { recursive: true });
    writeFileSync(join(fromTweak, "manifest.json"), JSON.stringify({ id: "com.codexplusplus.dream-skin" }));
    writeFileSync(join(seed, "custom-a.json"), JSON.stringify({ name: "主题A" }));
    writeFileSync(join(seed, "custom-b.json"), JSON.stringify({ name: "主题B" }));
    writeFileSync(join(seed, "index.json"), JSON.stringify([{ id: "custom-a", name: "主题A" }, { id: "custom-b", name: "主题B" }]));
    // 已装 custom：只有 a（旧内容）+ 用户自己的 c
    const customDir = join(tweakDataRoot, "com.codexplusplus.dream-skin", "custom");
    mkdirSync(customDir, { recursive: true });
    writeFileSync(join(customDir, "custom-a.json"), "旧内容");
    writeFileSync(join(customDir, "custom-c.json"), JSON.stringify({ name: "用户主题C" }));
    writeFileSync(join(customDir, "index.json"), JSON.stringify([{ id: "custom-a", name: "旧A" }, { id: "custom-c", name: "用户主题C" }]));

    seedCustomThemes(fromTweak, tweakDataRoot);

    // a 已存在不覆盖，b 补齐
    assert.equal(readFileSync(join(customDir, "custom-a.json"), "utf8"), "旧内容");
    assert.equal(readFileSync(join(customDir, "custom-b.json"), "utf8"), JSON.stringify({ name: "主题B" }));
    // index 合并去重：a/c 保留原有条目，b 追加
    const index = JSON.parse(readFileSync(join(customDir, "index.json"), "utf8"));
    assert.deepEqual(index, [
      { id: "custom-a", name: "旧A" },
      { id: "custom-c", name: "用户主题C" },
      { id: "custom-b", name: "主题B" },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("内置无 custom-seed 时 seedCustomThemes 不影响目标目录", () => {
  const root = mkdtempSync(join(tmpdir(), "seed-custom-none-"));
  try {
    const fromTweak = join(root, "tweaks", "dream-skin");
    const tweakDataRoot = join(root, "tweak-data");
    mkdirSync(fromTweak, { recursive: true });
    writeFileSync(join(fromTweak, "manifest.json"), JSON.stringify({ id: "com.codexplusplus.dream-skin" }));

    seedCustomThemes(fromTweak, tweakDataRoot);

    assert.equal(existsSync(join(tweakDataRoot, "com.codexplusplus.dream-skin", "custom")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
