import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { replaceWindowsEmbeddedAsarHash } from "../src/integrity";

test("replaceWindowsEmbeddedAsarHash 原地替换 64 位 hex", () => {
  const dir = mkdtempSync(join(tmpdir(), "codexpp-hash-"));
  try {
    const file = join(dir, "ChatGPT.exe");
    const oldHash = "05c17bbfdf015b00c3ca8aa645b44b315dbfd2cedb8a69ac9e415eeb670deca3";
    const newHash = "d14fe9a7c4495bb6494496c4e73d900aee8d55d57a5ce70d3e3f3a6ba669d0b1";
    writeFileSync(file, Buffer.concat([Buffer.from("HEAD"), Buffer.from(oldHash, "ascii"), Buffer.from("TAIL")]));
    assert.equal(replaceWindowsEmbeddedAsarHash(file, oldHash, newHash), 1);
    const out = readFileSync(file);
    assert.equal(out.includes(Buffer.from(oldHash, "ascii")), false);
    assert.equal(out.includes(Buffer.from(newHash, "ascii")), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
