import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncPresets } from "../src/commands/install.js";

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
