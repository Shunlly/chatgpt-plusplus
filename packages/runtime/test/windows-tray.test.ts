import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildWindowsTrayMenuTemplate } from "../src/windows-tray-menu";

test("Windows 托盘右键菜单包含最近、新对话、反馈和退出", () => {
  const clicks: string[] = [];
  const template = buildWindowsTrayMenuTemplate({
    onOpen: () => clicks.push("open"),
    onQuit: () => clicks.push("quit"),
    onNewChat: () => clicks.push("new"),
    onSendFeedback: () => clicks.push("feedback"),
    recent: [{ title: "检查安装日志报错", path: "/local/a" }],
    onOpenRecent: (path) => clicks.push(path),
  });
  const labels = template.map((item) => item.label ?? item.type);
  assert.deepEqual(labels, ["最近", "新对话", "发送反馈", "separator", "退出"]);
  assert.equal(template[0].submenu?.[0]?.label, "检查安装日志报错");
  template[0].submenu?.[0]?.click?.();
  template[1].click?.();
  template[2].click?.();
  template[4].click?.();
  assert.deepEqual(clicks, ["/local/a", "new", "feedback", "quit"]);
});

test("没有最近会话时菜单仍可用", () => {
  const template = buildWindowsTrayMenuTemplate({
    onOpen: () => {},
    onQuit: () => {},
  });
  assert.equal(template[0].submenu?.[0]?.label, "暂无最近会话");
  assert.equal(template[0].submenu?.[0]?.enabled, false);
});

test("Windows 托盘只保留 ChatGPT++ 名称，且不覆盖 Owl 右键菜单", () => {
  const src = readFileSync(resolve(process.cwd(), "packages/runtime/src/windows-tray.ts"), "utf8");
  assert.match(src, /CHATGPT_PLUSPLUS_TRAY_TOOLTIP/);
  assert.match(src, /patchElectronTray/);
  assert.match(src, /kickForeignAtStartup/);
  assert.match(src, /listenerCount\("right-click"\)/);
});
