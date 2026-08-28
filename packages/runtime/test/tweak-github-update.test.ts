import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  findTweakRootById,
  githubTweakArchiveUrl,
  githubTweakUpdateRef,
} from "../src/tweak-github-update";

test("捆绑仓库从 main 更新，第三方用 release tag", () => {
  assert.equal(githubTweakUpdateRef("Shunlly/chatgpt-plusplus", "v1.2.0", "Shunlly/chatgpt-plusplus"), "main");
  assert.equal(githubTweakUpdateRef("other/tweak", "v2.0.0", "Shunlly/chatgpt-plusplus"), "v2.0.0");
  assert.equal(githubTweakArchiveUrl("Shunlly/chatgpt-plusplus", "main").includes("/tar.gz/main"), true);
});

test("在 monorepo 解压目录里按 manifest.id 找到 tweak", () => {
  const root = mkdtempSync(join(tmpdir(), "tweak-gh-"));
  mkdirSync(join(root, "repo", "tweaks", "vision-toolkit"), { recursive: true });
  mkdirSync(join(root, "repo", "tweaks", "dream-skin"), { recursive: true });
  writeFileSync(join(root, "repo", "tweaks", "dream-skin", "manifest.json"), JSON.stringify({ id: "com.codexplusplus.dream-skin" }));
  writeFileSync(
    join(root, "repo", "tweaks", "vision-toolkit", "manifest.json"),
    JSON.stringify({ id: "com.chatgpt-plusplus.vision-toolkit" }),
  );
  assert.equal(
    findTweakRootById(root, "com.chatgpt-plusplus.vision-toolkit"),
    join(root, "repo", "tweaks", "vision-toolkit"),
  );
});

test("有 githubRepo 的卡片始终显示更新按钮", () => {
  const injector = readFileSync(
    resolve(fileURLToPath(new URL(".", import.meta.url)), "../src/preload/settings-injector.ts"),
    "utf8",
  );
  assert.match(injector, /if \(m\.githubRepo\) \{/);
  assert.match(injector, /compactButton\("更新"/);
  assert.equal(injector.includes('t.update?.updateAvailable && m.githubRepo'), false);
});
