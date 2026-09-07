import assert from "node:assert/strict";
import test from "node:test";
import { buildWindowsTrayMenuTemplate } from "../src/windows-tray-menu";

test("Windows 托盘右键菜单包含打开和退出", () => {
  const clicks: string[] = [];
  const template = buildWindowsTrayMenuTemplate({
    onOpen: () => clicks.push("open"),
    onQuit: () => clicks.push("quit"),
  });
  const labels = template.map((item) => item.label ?? item.type);
  assert.deepEqual(labels, ["打开 ChatGPT++", "separator", "退出 ChatGPT++"]);
  template[0].click?.(null as never, null as never, null as never);
  template[2].click?.(null as never, null as never, null as never);
  assert.deepEqual(clicks, ["open", "quit"]);
});
