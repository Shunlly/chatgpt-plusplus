import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { cleanupRuntimeAndState } from "../src/commands/uninstall";

test(
  "uninstall explains runtime cleanup permission failures",
  { skip: process.platform === "win32" || process.getuid?.() === 0 },
  () => {
    const root = mkdtempSync(join(tmpdir(), "codexpp-uninstall-"));
    const runtime = join(root, "runtime");
    const stateFile = join(root, "state.json");
    mkdirSync(runtime);
    writeFileSync(join(runtime, "loader.js"), "");
    writeFileSync(stateFile, "{}");
    chmodSync(runtime, 0o555);

    try {
      assert.throws(
        () => cleanupRuntimeAndState({ runtime, stateFile }),
        /previous sudo install or repair/,
      );
    } finally {
      chmodSync(runtime, 0o755);
      rmSync(root, { recursive: true, force: true });
    }
  },
);
