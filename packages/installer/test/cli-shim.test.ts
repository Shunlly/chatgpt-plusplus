// 回归测试：installCliShims 不得覆盖持久化 CLI 二进制。
// v1.0.22~v1.0.25 曾把 SEA 二进制所在路径写成"exec 自身"的 shim，
// 导致 watcher 每次运行都陷入自我 exec 死循环（CPU 100%）。
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { platform } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { shimClashesWithCli } from "../src/cli-shim.js";
import { standaloneCliPath } from "../src/standalone.js";

test("shim 目标与持久化 CLI 二进制冲突时被拒绝（darwin）", (t) => {
  if (platform() !== "darwin") return t.skip("持久化 CLI 仅 macOS 独立包模式");
  const root = mkdtempSync(join(tmpdir(), "codexpp-shim-"));
  const bin = join(root, "bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, "chatgpt-plusplus"), "FAKE-SEA-BINARY");
  const prev = process.env.CHATGPT_PLUSPLUS_HOME;
  process.env.CHATGPT_PLUSPLUS_HOME = root;
  try {
    assert.equal(
      standaloneCliPath(),
      join(bin, "chatgpt-plusplus"),
      "独立包模式下 standaloneCliPath 应指向持久化二进制",
    );
    // 二进制所在路径必须保持为二进制本体
    assert.equal(shimClashesWithCli(join(bin, "chatgpt-plusplus")), true);
    // 另一个命令名的 shim 不冲突，可以正常写
    assert.equal(shimClashesWithCli(join(bin, "chatgptplusplus")), false);
  } finally {
    if (prev === undefined) delete process.env.CHATGPT_PLUSPLUS_HOME;
    else process.env.CHATGPT_PLUSPLUS_HOME = prev;
    rmSync(root, { recursive: true, force: true });
  }
});
