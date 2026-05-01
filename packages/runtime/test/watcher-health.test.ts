import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { getWatcherHealth } from "../src/watcher-health";

test("watcher health reports missing install state as not ready", () => {
  withTempDir((root) => {
    const health = getWatcherHealth(root);

    assert.equal(health.status, "error");
    assert.equal(health.watcher, "none");
    assert.equal(health.checks[0]?.name, "Install state");
    assert.equal(health.checks[0]?.status, "error");
  });
});

test("watcher health warns when automatic refresh is disabled", () => {
  withTempDir((root) => {
    writeFileSync(
      join(root, "state.json"),
      JSON.stringify({ version: "0.1.2", watcher: "none", appRoot: "/missing" }),
    );
    writeFileSync(
      join(root, "config.json"),
      JSON.stringify({ codexPlusPlus: { autoUpdate: false } }),
    );

    const health = getWatcherHealth(root);

    assert.equal(
      health.checks.find((check) => check.name === "Automatic refresh")?.status,
      "warn",
    );
    assert.equal(
      health.checks.find((check) => check.name === "Watcher kind")?.status,
      "error",
    );
  });
});

function withTempDir(fn: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "codexpp-watcher-health-"));
  try {
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
