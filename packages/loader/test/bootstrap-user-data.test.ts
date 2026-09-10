import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const boot = require("../bootstrap-user-data.cjs") as {
  bootstrapUserData: (userRoot: string, bundledResources: string) => { runtime: boolean; tweaks: boolean };
  seedCustomThemes: (fromTweak: string, tweakDataRoot: string) => void;
  syncPresets: (fromTweak: string, toTweak: string) => void;
};

function write(file: string, body: string) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
}

test("bootstrapUserData 首次启动会灌 runtime、tweak 和内置主题", () => {
  const root = mkdtempSync(join(tmpdir(), "chatgptpp-boot-"));
  try {
    const bundled = join(root, "Resources");
    const userRoot = join(root, "user");
    write(join(bundled, "assets", "runtime", "main.js"), "runtime-main");
    write(join(bundled, "assets", "runtime", "preload.js"), "runtime-preload");
    write(
      join(bundled, "tweaks", "dream-skin", "manifest.json"),
      JSON.stringify({ id: "com.codexplusplus.dream-skin", version: "2.0.2" }),
    );
    write(join(bundled, "tweaks", "dream-skin", "index.js"), "tweak");
    write(join(bundled, "tweaks", "dream-skin", "presets", "preset-a", "theme.json"), '{"name":"极光"}');
    write(
      join(bundled, "tweaks", "dream-skin", "custom-seed", "custom-a.json"),
      JSON.stringify({ name: "五条悟", artUrl: "data:image/png;base64,aa" }),
    );
    write(
      join(bundled, "tweaks", "dream-skin", "custom-seed", "index.json"),
      JSON.stringify([{ id: "custom-a", name: "五条悟" }]),
    );

    const result = boot.bootstrapUserData(userRoot, bundled);
    assert.equal(result.runtime, true);
    assert.equal(result.tweaks, true);
    assert.equal(readFileSync(join(userRoot, "runtime", "main.js"), "utf8"), "runtime-main");
    assert.equal(existsSync(join(userRoot, "tweaks", "dream-skin", "index.js")), true);
    assert.equal(
      readFileSync(join(userRoot, "tweaks", "dream-skin", "presets", "preset-a", "theme.json"), "utf8"),
      '{"name":"极光"}',
    );
    const customDir = join(userRoot, "tweak-data", "com.codexplusplus.dream-skin", "custom");
    assert.equal(JSON.parse(readFileSync(join(customDir, "custom-a.json"), "utf8")).name, "五条悟");
    assert.deepEqual(JSON.parse(readFileSync(join(customDir, "index.json"), "utf8")), [
      { id: "custom-a", name: "五条悟" },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("bootstrapUserData 不覆盖用户已有自定义主题，并补齐缺失种子", () => {
  const root = mkdtempSync(join(tmpdir(), "chatgptpp-boot-keep-"));
  try {
    const bundled = join(root, "Resources");
    const userRoot = join(root, "user");
    write(join(bundled, "assets", "runtime", "main.js"), "runtime-main");
    write(join(bundled, "assets", "runtime", "preload.js"), "runtime-preload");
    write(
      join(bundled, "tweaks", "dream-skin", "manifest.json"),
      JSON.stringify({ id: "com.codexplusplus.dream-skin", version: "2.0.2" }),
    );
    write(join(bundled, "tweaks", "dream-skin", "custom-seed", "custom-a.json"), '{"name":"种子A"}');
    write(join(bundled, "tweaks", "dream-skin", "custom-seed", "custom-b.json"), '{"name":"种子B"}');
    write(
      join(bundled, "tweaks", "dream-skin", "custom-seed", "index.json"),
      JSON.stringify([
        { id: "custom-a", name: "种子A" },
        { id: "custom-b", name: "种子B" },
      ]),
    );

    const customDir = join(userRoot, "tweak-data", "com.codexplusplus.dream-skin", "custom");
    write(join(customDir, "custom-a.json"), "用户改过的A");
    write(join(customDir, "custom-c.json"), '{"name":"用户C"}');
    write(
      join(customDir, "index.json"),
      JSON.stringify([
        { id: "custom-a", name: "旧A" },
        { id: "custom-c", name: "用户C" },
      ]),
    );

    boot.bootstrapUserData(userRoot, bundled);
    assert.equal(readFileSync(join(customDir, "custom-a.json"), "utf8"), "用户改过的A");
    assert.equal(readFileSync(join(customDir, "custom-b.json"), "utf8"), '{"name":"种子B"}');
    assert.deepEqual(JSON.parse(readFileSync(join(customDir, "index.json"), "utf8")), [
      { id: "custom-a", name: "旧A" },
      { id: "custom-c", name: "用户C" },
      { id: "custom-b", name: "种子B" },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("bootstrapUserData 在没有 bundled resources 时不破坏空用户目录", () => {
  const root = mkdtempSync(join(tmpdir(), "chatgptpp-boot-empty-"));
  try {
    const userRoot = join(root, "user");
    mkdirSync(userRoot, { recursive: true });
    boot.bootstrapUserData(userRoot, join(root, "missing-resources"));
    assert.equal(existsSync(join(userRoot, "runtime", "main.js")), false);
    assert.equal(existsSync(join(userRoot, "tweaks")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("bootstrapUserData 启动时只补缺失预设，不覆盖用户已装的同名预设", () => {
  const root = mkdtempSync(join(tmpdir(), "chatgptpp-boot-preset-"));
  try {
    const bundled = join(root, "Resources");
    const userRoot = join(root, "user");
    write(join(bundled, "assets", "runtime", "main.js"), "runtime-main");
    write(join(bundled, "assets", "runtime", "preload.js"), "runtime-preload");
    write(
      join(bundled, "tweaks", "dream-skin", "manifest.json"),
      JSON.stringify({ id: "com.codexplusplus.dream-skin", version: "2.0.2" }),
    );
    write(join(bundled, "tweaks", "dream-skin", "presets", "preset-a", "theme.json"), '{"name":"新A"}');
    write(join(bundled, "tweaks", "dream-skin", "presets", "preset-b", "theme.json"), '{"name":"新B"}');
    write(
      join(userRoot, "tweaks", "dream-skin", "manifest.json"),
      JSON.stringify({ id: "com.codexplusplus.dream-skin", version: "2.0.2" }),
    );
    write(join(userRoot, "tweaks", "dream-skin", "presets", "preset-a", "theme.json"), '{"name":"旧A"}');

    boot.bootstrapUserData(userRoot, bundled);
    assert.equal(
      readFileSync(join(userRoot, "tweaks", "dream-skin", "presets", "preset-a", "theme.json"), "utf8"),
      '{"name":"旧A"}',
    );
    assert.equal(
      readFileSync(join(userRoot, "tweaks", "dream-skin", "presets", "preset-b", "theme.json"), "utf8"),
      '{"name":"新B"}',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
