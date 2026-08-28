import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { stageAssets } from "../src/commands/install";

test("stageAssets 只拷 bundle 并清掉旧 runtime 碎文件", () => {
  const dir = mkdtempSync(join(tmpdir(), "chatgptpp-runtime-"));
  try {
    writeFileSync(join(dir, "stale.js"), "old");
    mkdirSync(join(dir, "preload"), { recursive: true });
    writeFileSync(join(dir, "preload", "index.js"), "old");

    stageAssets(dir);

    const names = new Set(readdirSync(dir));
    assert.equal(names.has("stale.js"), false);
    assert.equal(names.has("preload"), false);
    assert.equal(existsSync(join(dir, "main.js")), true);
    assert.equal(existsSync(join(dir, "preload.js")), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
