import assert from "node:assert/strict";
import test from "node:test";
import { parseCompanionProcessLines, shouldQuitCompanionProcess, shouldQuitForeignChatgptProcess } from "../src/windows-quit";

test("退出 ChatGPT++ 时关掉商店镜像里的 ChatGPT.exe，放过官方商店版", () => {
  const self = 10;
  assert.equal(
    shouldQuitCompanionProcess({
      pid: 11,
      selfPid: self,
      name: "ChatGPT.exe",
      path: "C:\\Users\\A\\AppData\\Local\\chatgpt-plusplus\\store-apps\\OpenAI.Codex_1\\app\\ChatGPT.exe",
    }),
    true,
  );
  assert.equal(
    shouldQuitCompanionProcess({
      pid: 12,
      selfPid: self,
      name: "ChatGPT++.exe",
      path: "C:\\Users\\A\\AppData\\Local\\chatgpt-plusplus\\store-apps\\OpenAI.Codex_1\\app\\ChatGPT++.exe",
    }),
    true,
  );
  assert.equal(
    shouldQuitCompanionProcess({
      pid: 13,
      selfPid: self,
      name: "ChatGPT.exe",
      path: "C:\\Program Files\\WindowsApps\\OpenAI.Codex_1\\app\\ChatGPT.exe",
    }),
    false,
  );
  assert.equal(
    shouldQuitCompanionProcess({
      pid: self,
      selfPid: self,
      name: "ChatGPT++.exe",
      path: "C:\\Users\\A\\AppData\\Local\\chatgpt-plusplus\\store-apps\\OpenAI.Codex_1\\app\\ChatGPT++.exe",
    }),
    false,
  );
  const pids = parseCompanionProcessLines(
    [
      "11\tChatGPT.exe\tC:\\Users\\A\\AppData\\Local\\chatgpt-plusplus\\store-apps\\x\\app\\ChatGPT.exe\t",
      "13\tChatGPT.exe\tC:\\Program Files\\WindowsApps\\OpenAI.Codex\\ChatGPT.exe\t",
    ].join("\n"),
    10,
  );
  assert.deepEqual(pids, [11]);
});

test("启动 ChatGPT++ 时关掉商店官方 ChatGPT，保留自己的镜像", () => {
  const self = 10;
  assert.equal(
    shouldQuitForeignChatgptProcess({
      pid: 99,
      selfPid: self,
      name: "ChatGPT.exe",
      path: "",
    }),
    true,
  );
  assert.equal(
    shouldQuitForeignChatgptProcess({
      pid: 98,
      selfPid: self,
      name: "ChatGPT.exe",
      path: "C:\\Program Files\\WindowsApps\\OpenAI.Codex_1\\app\\ChatGPT.exe",
    }),
    true,
  );
  assert.equal(
    shouldQuitForeignChatgptProcess({
      pid: 11,
      selfPid: self,
      name: "ChatGPT.exe",
      path: "C:\\Users\\A\\AppData\\Local\\chatgpt-plusplus\\store-apps\\OpenAI.Codex_1\\app\\ChatGPT.exe",
    }),
    false,
  );
});
