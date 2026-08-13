// Windows watcher 由 wscript 经 VBS 隐藏运行（不弹 cmd 窗口），路径含空格时转义正确。
import assert from "node:assert/strict";
import test from "node:test";
import { windowsWatcherVbsContent } from "../src/watcher.js";

test("watcher VBS 隐藏运行且正确转义含空格路径", () => {
  const vbs = windowsWatcherVbsContent("C:\\Users\\Foo Bar\\AppData\\Roaming\\chatgpt-plusplus\\bin\\watcher.cmd");
  assert.match(vbs, /^CreateObject\("WScript\.Shell"\)\.Run /);
  assert.match(vbs, /, 0, False$/);
  assert.match(vbs, /""C:\\Users\\Foo Bar\\AppData\\Roaming\\chatgpt-plusplus\\bin\\watcher\.cmd""/);
});
