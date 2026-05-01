import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendCappedLog } from "../src/logging";

test("appendCappedLog keeps log files at or below the byte cap", () => {
  const dir = mkdtempSync(join(tmpdir(), "codexpp-log-"));
  try {
    const file = join(dir, "main.log");
    writeFileSync(file, "a".repeat(95));
    appendCappedLog(file, "b".repeat(20), 100);
    const data = readFileSync(file, "utf8");
    assert.equal(Buffer.byteLength(data), 100);
    assert.equal(data, `${"a".repeat(80)}${"b".repeat(20)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("appendCappedLog truncates oversized entries to the byte cap", () => {
  const dir = mkdtempSync(join(tmpdir(), "codexpp-log-"));
  try {
    const file = join(dir, "preload.log");
    appendCappedLog(file, "abcdef", 4);
    assert.equal(readFileSync(file, "utf8"), "cdef");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
