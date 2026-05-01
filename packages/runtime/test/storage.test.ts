import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createDiskStorage } from "../src/storage";

test("storage returns defaults before values are set", () => {
  withTempDir((root) => {
    const storage = createDiskStorage(root, "com.example.empty");

    assert.equal(storage.get("missing", "fallback"), "fallback");
    assert.deepEqual(storage.all(), {});
  });
});

test("storage persists values after flush", () => {
  withTempDir((root) => {
    const storage = createDiskStorage(root, "com.example.persist");

    storage.set("answer", 42);
    storage.set("nested", { ok: true });
    storage.flush();

    const reloaded = createDiskStorage(root, "com.example.persist");
    assert.equal(reloaded.get("answer"), 42);
    assert.deepEqual(reloaded.get("nested"), { ok: true });
  });
});

test("storage delete persists removals after flush", () => {
  withTempDir((root) => {
    const storage = createDiskStorage(root, "com.example.delete");

    storage.set("keep", "yes");
    storage.set("remove", "no");
    storage.flush();
    storage.delete("remove");
    storage.flush();

    const reloaded = createDiskStorage(root, "com.example.delete");
    assert.equal(reloaded.get("keep"), "yes");
    assert.equal(reloaded.get("remove", null), null);
  });
});

test("storage all returns a defensive copy", () => {
  withTempDir((root) => {
    const storage = createDiskStorage(root, "com.example.copy");

    storage.set("value", "original");
    const snapshot = storage.all();
    snapshot.value = "mutated";

    assert.equal(storage.get("value"), "original");
    storage.flush();
  });
});

test("storage sanitizes tweak ids before using them as filenames", () => {
  withTempDir((root) => {
    const storage = createDiskStorage(root, "unsafe/id:with*chars");

    storage.set("ok", true);
    storage.flush();

    const file = join(root, "storage", "unsafe_id_with_chars.json");
    assert.equal(existsSync(file), true);
    assert.equal(JSON.parse(readFileSync(file, "utf8")).ok, true);
  });
});

test("storage recovers from corrupt JSON by moving the old file aside", () => {
  withTempDir((root) => {
    const dir = join(root, "storage");
    const file = join(dir, "com.example.corrupt.json");
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, "{not json", { flag: "w" });

    const storage = createDiskStorage(root, "com.example.corrupt");

    assert.deepEqual(storage.all(), {});
    assert.equal(existsSync(file), false);
    assert.equal(
      readdirSync(dir).some((name) => name.startsWith("com.example.corrupt.json.corrupt-")),
      true,
    );
  });
});

function withTempDir(fn: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "codexpp-storage-"));
  try {
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
