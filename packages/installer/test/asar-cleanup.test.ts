import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { cleanupTempTree } from "../src/asar";

test("asar temp cleanup removes extracted work trees", async () => {
  const root = mkdtempSync(join(tmpdir(), "codexpp-asar-cleanup-"));
  mkdirSync(join(root, "src", "nested"), { recursive: true });
  writeFileSync(join(root, "src", "nested", "file.txt"), "ok");

  await cleanupTempTree(root);

  assert.equal(existsSync(root), false);
});
