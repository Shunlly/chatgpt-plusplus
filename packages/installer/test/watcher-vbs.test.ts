// Windows watcher 由 wscript 经 VBS 隐藏运行（不弹 cmd 窗口），路径含空格时转义正确。
// WScript.Shell.Run 不能直接启动 .cmd，必须经 cmd.exe /c 包装。
import assert from "node:assert/strict";
import test from "node:test";
import { windowsWatcherVbsContent } from "../src/watcher.js";

test("watcher VBS 隐藏运行且正确转义含空格路径", () => {
  const vbs = windowsWatcherVbsContent("C:\\Users\\Foo Bar\\AppData\\Roaming\\chatgpt-plusplus\\bin\\watcher.cmd");
  assert.match(vbs, /^CreateObject\("WScript\.Shell"\)\.Run "cmd\.exe \/c /);
  assert.match(vbs, /, 0, False$/);
  assert.match(vbs, /cmd\.exe \/c ""C:\\Users\\Foo Bar\\AppData\\Roaming\\chatgpt-plusplus\\bin\\watcher\.cmd""/);
});
