import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const tweakRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../tweaks/conversation-delete");
const src = readFileSync(resolve(tweakRoot, "index.js"), "utf8");

test("会话删除只观察侧边栏并合并扫描，避免聊天区打字卡死", () => {
  assert.match(src, /function ensureSidebarObserver\(\)/);
  assert.match(src, /document\.querySelector\("nav"\) \|\| document\.body/);
  assert.match(src, /function scheduleObserve\(api\)/);
  assert.match(src, /if \(document\.hidden\) return;/);
  assert.match(src, /\}, 200\);/);
  assert.doesNotMatch(src, /observe\(document\.body/);
});

test("会话删除按钮默认不抢点击，宠物窗口不启动", () => {
  assert.match(src, /pointer-events: none/);
  assert.match(src, /compact-window/);
});
