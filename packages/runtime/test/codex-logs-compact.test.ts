import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { compactOversizedCodexLogs } from "../src/codex-logs-compact";

test("小于阈值的 logs_2.sqlite 不动", () => {
  const dir = mkdtempSync(join(tmpdir(), "codexpp-logs-"));
  try {
    const db = join(dir, "logs_2.sqlite");
    writeFileSync(db, "ok");
    writeFileSync(`${db}-wal`, "wal");
    assert.deepEqual(compactOversizedCodexLogs(dir, 100), []);
    assert.equal(readFileSync(db, "utf8"), "ok");
    assert.equal(readFileSync(`${db}-wal`, "utf8"), "wal");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("超大 logs_2.sqlite 连 wal/shm 一起删", () => {
  const dir = mkdtempSync(join(tmpdir(), "codexpp-logs-"));
  try {
    const db = join(dir, "logs_2.sqlite");
    writeFileSync(db, "x".repeat(50));
    writeFileSync(`${db}-wal`, "wal");
    writeFileSync(`${db}-shm`, "shm");
    const removed = compactOversizedCodexLogs(dir, 10);
    assert.deepEqual(removed.sort(), [db, `${db}-shm`, `${db}-wal`].sort());
    assert.throws(() => readFileSync(db));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("没有日志库时是空操作", () => {
  const dir = mkdtempSync(join(tmpdir(), "codexpp-logs-"));
  try {
    assert.deepEqual(compactOversizedCodexLogs(dir, 1), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
