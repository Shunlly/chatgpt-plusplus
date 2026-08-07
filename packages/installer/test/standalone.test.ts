import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  standaloneAssetsDir,
  standaloneCliPath,
  standaloneRoot,
  standaloneSourceRoot,
} from "../src/standalone";

test("standaloneRoot 识别 macOS .app 的 Resources 目录", () => {
  const root = mkdtempSync(join(tmpdir(), "codexpp-standalone-app-"));
  try {
    const resources = join(root, "ChatGPT++.app", "Contents", "Resources");
    mkdirSync(resources, { recursive: true });
    writeFileSync(join(resources, "standalone.json"), "{}");
    const execPath = join(root, "ChatGPT++.app", "Contents", "MacOS", "chatgpt-plusplus");

    assert.equal(standaloneRoot(execPath), resources);
    assert.equal(standaloneAssetsDir(execPath), join(resources, "assets"));
    assert.equal(standaloneSourceRoot(execPath), resources);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("standaloneRoot 识别 Windows 同目录布局，且缺失标记时返回 null", () => {
  const root = mkdtempSync(join(tmpdir(), "codexpp-standalone-win-"));
  const prevHome = process.env.CODEX_PLUSPLUS_HOME;
  // 隔离持久副本探测：macOS 上本机若已有持久 CLI，会优先返回它而非旁置路径。
  process.env.CODEX_PLUSPLUS_HOME = join(tmpdir(), "codexpp-standalone-home-none");
  try {
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, "standalone.json"), "{}");
    const execPath = join(root, "chatgpt-plusplus.exe");
    assert.equal(standaloneRoot(execPath), root);
    assert.equal(standaloneCliPath(execPath), execPath);
  } finally {
    if (prevHome === undefined) delete process.env.CODEX_PLUSPLUS_HOME;
    else process.env.CODEX_PLUSPLUS_HOME = prevHome;
    rmSync(root, { recursive: true, force: true });
  }

  const empty = mkdtempSync(join(tmpdir(), "codexpp-standalone-empty-"));
  try {
    assert.equal(standaloneRoot(join(empty, "cli")), null);
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});
