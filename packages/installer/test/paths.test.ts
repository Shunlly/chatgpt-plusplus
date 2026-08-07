import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { migrateUserRoot } from "../src/paths";

test("migrateUserRoot 把旧目录整体搬到新目录", () => {
  const root = mkdtempSync(join(tmpdir(), "codexpp-paths-"));
  try {
    const legacy = join(root, "codex-plusplus");
    const current = join(root, "chatgpt-plusplus");
    mkdirSync(join(legacy, "log"), { recursive: true });
    writeFileSync(join(legacy, "state.json"), "{}");
    writeFileSync(join(legacy, "log", "installer.log"), "err");

    const result = migrateUserRoot(current, legacy);
    assert.equal(result, current);
    assert.equal(existsSync(legacy), false);
    assert.equal(existsSync(join(current, "log", "installer.log")), true);
    assert.equal(readFileSync(join(current, "state.json"), "utf8"), "{}");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("migrateUserRoot 新目录已存在时不搬旧目录", () => {
  const root = mkdtempSync(join(tmpdir(), "codexpp-paths-"));
  try {
    const legacy = join(root, "codex-plusplus");
    const current = join(root, "chatgpt-plusplus");
    mkdirSync(legacy, { recursive: true });
    writeFileSync(join(legacy, "old.txt"), "1");
    mkdirSync(current, { recursive: true });
    writeFileSync(join(current, "new.txt"), "2");

    const result = migrateUserRoot(current, legacy);
    assert.equal(result, current);
    assert.equal(existsSync(join(legacy, "old.txt")), true);
    assert.equal(existsSync(join(current, "new.txt")), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("migrateUserRoot 旧目录不存在时直接返回新目录", () => {
  const root = mkdtempSync(join(tmpdir(), "codexpp-paths-"));
  try {
    const current = join(root, "chatgpt-plusplus");
    const result = migrateUserRoot(current, join(root, "codex-plusplus"));
    assert.equal(result, current);
    assert.equal(existsSync(current), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
