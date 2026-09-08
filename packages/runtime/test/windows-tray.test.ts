import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

test("Windows 托盘只保留 ChatGPT++ 名称", () => {
  const src = readFileSync(resolve(process.cwd(), "packages/runtime/src/windows-tray.ts"), "utf8");
  assert.match(src, /CHATGPT_PLUSPLUS_TRAY_TOOLTIP/);
  assert.match(src, /patchElectronTray/);
  assert.match(src, /inst.destroy/);
  assert.match(src, /setTimeout\(start, 4000\)/);
});
