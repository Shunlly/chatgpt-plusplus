import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compareVersions, syncBundledTweaks } from "../src/sync-bundled-tweaks";

test("内置版本更高时覆盖，用户版本更高时保留", () => {
  const root = mkdtempSync(join(tmpdir(), "sync-bundled-tweaks-"));
  try {
    const src = join(root, "src");
    const dest = join(root, "dest");
    writeTweak(join(src, "dream-skin"), "2.0.1", "new");
    writeTweak(join(dest, "dream-skin"), "2.0.0", "old");
    writeTweak(join(src, "keep-mine"), "1.0.0", "bundled");
    writeTweak(join(dest, "keep-mine"), "9.0.0", "user");

    const upgraded = syncBundledTweaks(src, dest);
    assert.deepEqual(upgraded, ["dream-skin"]);
    assert.equal(readFileSync(join(dest, "dream-skin", "marker.txt"), "utf8"), "new");
    assert.equal(JSON.parse(readFileSync(join(dest, "dream-skin", "manifest.json"), "utf8")).version, "2.0.1");
    assert.equal(readFileSync(join(dest, "keep-mine", "marker.txt"), "utf8"), "user");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("源目录不存在时不做事", () => {
  assert.deepEqual(syncBundledTweaks("/no/such/tweaks", mkdtempSync(join(tmpdir(), "sync-empty-"))), []);
});

test("compareVersions 识别补丁号", () => {
  assert.equal(compareVersions("2.0.1", "2.0.0") > 0, true);
  assert.equal(compareVersions("2.0.0", "2.0.0"), 0);
});

function writeTweak(dir: string, version: string, marker: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "manifest.json"), JSON.stringify({ id: "x", version }));
  writeFileSync(join(dir, "marker.txt"), marker);
}

test("内置修复版本升级时会把旧用户副本替换掉", () => {
  const root = mkdtempSync(join(tmpdir(), "sync-bundled-tweaks-fix-"));
  try {
    const src = join(root, "src");
    const dest = join(root, "dest");
    writeTweak(join(src, "dream-skin"), "2.0.2", "fixed");
    writeTweak(join(dest, "dream-skin"), "2.0.1", "leaky");
    assert.deepEqual(syncBundledTweaks(src, dest), ["dream-skin"]);
    assert.equal(readFileSync(join(dest, "dream-skin", "marker.txt"), "utf8"), "fixed");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
