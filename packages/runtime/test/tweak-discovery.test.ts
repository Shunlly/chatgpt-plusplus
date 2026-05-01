import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { discoverTweaks } from "../src/tweak-discovery";

test("discoverTweaks returns an empty list when the tweaks directory is missing", () => {
  withTempDir((root) => {
    assert.deepEqual(discoverTweaks(join(root, "missing")), []);
  });
});

test("discoverTweaks discovers a valid tweak with explicit main entry", () => {
  withTempDir((root) => {
    const tweak = writeTweak(root, "explicit", {
      ...validManifest("com.example.explicit"),
      main: "custom.js",
      scope: "both",
    });
    writeFileSync(join(tweak, "custom.js"), "module.exports = {};");

    const discovered = discoverTweaks(root);

    assert.equal(discovered.length, 1);
    assert.equal(discovered[0]?.manifest.id, "com.example.explicit");
    assert.equal(discovered[0]?.entry, join(tweak, "custom.js"));
  });
});

test("discoverTweaks falls back to index.js when main is omitted", () => {
  withTempDir((root) => {
    const tweak = writeTweak(root, "fallback-js", validManifest("com.example.js"));
    writeFileSync(join(tweak, "index.js"), "module.exports = {};");

    const discovered = discoverTweaks(root);

    assert.equal(discovered[0]?.entry, join(tweak, "index.js"));
  });
});

test("discoverTweaks falls back to index.cjs when index.js is absent", () => {
  withTempDir((root) => {
    const tweak = writeTweak(root, "fallback-cjs", validManifest("com.example.cjs"));
    writeFileSync(join(tweak, "index.cjs"), "module.exports = {};");

    const discovered = discoverTweaks(root);

    assert.equal(discovered[0]?.entry, join(tweak, "index.cjs"));
  });
});

test("discoverTweaks falls back to index.mjs when js and cjs entries are absent", () => {
  withTempDir((root) => {
    const tweak = writeTweak(root, "fallback-mjs", validManifest("com.example.mjs"));
    writeFileSync(join(tweak, "index.mjs"), "export default {};");

    const discovered = discoverTweaks(root);

    assert.equal(discovered[0]?.entry, join(tweak, "index.mjs"));
  });
});

test("discoverTweaks skips invalid JSON manifests", () => {
  withTempDir((root) => {
    const dir = join(root, "invalid-json");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "manifest.json"), "{not json");
    writeFileSync(join(dir, "index.js"), "module.exports = {};");

    assert.deepEqual(discoverTweaks(root), []);
  });
});

test("discoverTweaks skips manifests missing required fields", () => {
  withTempDir((root) => {
    const tweak = writeTweak(root, "missing-name", {
      id: "com.example.missing",
      version: "0.1.0",
      githubRepo: "example/missing",
    });
    writeFileSync(join(tweak, "index.js"), "module.exports = {};");

    assert.deepEqual(discoverTweaks(root), []);
  });
});

test("discoverTweaks skips manifests with invalid GitHub repo identifiers", () => {
  withTempDir((root) => {
    const tweak = writeTweak(root, "bad-repo", {
      ...validManifest("com.example.badrepo"),
      githubRepo: "not-a-repo",
    });
    writeFileSync(join(tweak, "index.js"), "module.exports = {};");

    assert.deepEqual(discoverTweaks(root), []);
  });
});

test("discoverTweaks skips manifests with invalid scopes", () => {
  withTempDir((root) => {
    const tweak = writeTweak(root, "bad-scope", {
      ...validManifest("com.example.badscope"),
      scope: "everywhere",
    });
    writeFileSync(join(tweak, "index.js"), "module.exports = {};");

    assert.deepEqual(discoverTweaks(root), []);
  });
});

test("discoverTweaks treats explicit missing main entries as invalid", () => {
  withTempDir((root) => {
    const tweak = writeTweak(root, "missing-main", {
      ...validManifest("com.example.missingmain"),
      main: "missing.js",
    });
    writeFileSync(join(tweak, "index.js"), "module.exports = {};");

    assert.deepEqual(discoverTweaks(root), []);
  });
});

test("discoverTweaks skips top-level files", () => {
  withTempDir((root) => {
    writeFileSync(join(root, "not-a-tweak"), "plain file");

    assert.deepEqual(discoverTweaks(root), []);
  });
});

test("discoverTweaks accepts renderer, main, both, and omitted scopes", () => {
  withTempDir((root) => {
    for (const [name, scope] of [
      ["renderer", "renderer"],
      ["main", "main"],
      ["both", "both"],
      ["omitted", undefined],
    ] as const) {
      const tweak = writeTweak(root, name, {
        ...validManifest(`com.example.${name}`),
        scope,
      });
      writeFileSync(join(tweak, "index.js"), "module.exports = {};");
    }

    const ids = discoverTweaks(root).map((t) => t.manifest.id).sort();

    assert.deepEqual(ids, [
      "com.example.both",
      "com.example.main",
      "com.example.omitted",
      "com.example.renderer",
    ]);
  });
});

function withTempDir(fn: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "codexpp-discovery-"));
  try {
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function writeTweak(
  root: string,
  name: string,
  manifest: Record<string, unknown>,
): string {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return dir;
}

function validManifest(id: string): Record<string, unknown> {
  return {
    id,
    name: id,
    version: "0.1.0",
    githubRepo: "example/tweak",
  };
}
