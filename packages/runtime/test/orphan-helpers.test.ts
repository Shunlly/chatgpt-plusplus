import assert from "node:assert/strict";
import test from "node:test";
import {
  isHelperCommand,
  isLiveMainCommand,
  parseProcessTable,
  pidsToKill,
  sweepOrphanHelpers,
} from "../src/orphan-helpers";

const crash = "/Applications/ChatGPT++.app/Contents/Frameworks/x/Helpers/browser_crashpad_handler --database=/x/ChatGPT++/Crashpad";
const mod = "/Applications/ChatGPT++.app/Contents/Resources/native/bare-modifier-monitor --key DoubleCommand";
const mcp = "node --max-old-space-size=128 /Users/x/Library/Application Support/chatgpt-plusplus/tweaks/vision-toolkit/mcp-server.mjs";
const main = "/Applications/ChatGPT++.app/Contents/MacOS/ChatGPT --user-data-dir=/tmp";
const chrome = "/Applications/Google Chrome.app/Helpers/chrome_crashpad_handler --database=/Google/Chrome/Crashpad";

test("只认 ChatGPT++ 的帮手，放过 Chrome", () => {
  assert.equal(isHelperCommand(crash), true);
  assert.equal(isHelperCommand(chrome), false);
  assert.equal(isHelperCommand(mod), true);
  assert.equal(isHelperCommand(mcp), true);
  assert.equal(isLiveMainCommand(main), true);
  assert.equal(isLiveMainCommand(crash), false);
});

test("crashpad 都挂 pid 1：只杀比主进程更早启动的", () => {
  const t0 = 1_700_000_000_000;
  const rows = [
    { pid: 100, ppid: 1, command: main, startMs: t0 },
    { pid: 101, ppid: 1, command: crash, startMs: t0 + 1000 },
    { pid: 90, ppid: 1, command: crash, startMs: t0 - 60_000 },
    { pid: 91, ppid: 1, command: chrome, startMs: t0 - 60_000 },
  ];
  assert.deepEqual(pidsToKill(rows, 100), [90]);
});

test("修饰键 / MCP 仍按祖先：ppid=1 杀，挂在主进程下留着", () => {
  const rows = parseProcessTable(`
  100  1 ${main}
  110  100 ${mod}
  200  1 ${mod}
  201  1 ${mcp}
`.trim());
  assert.deepEqual(pidsToKill(rows, 100).sort((a, b) => a - b), [200, 201]);
});

test("sweep 调 kill，失败的 pid 跳过", () => {
  const killed = sweepOrphanHelpers({
    selfPid: 99,
    rows: [
      { pid: 9, ppid: 1, command: mod },
      { pid: 8, ppid: 1, command: mcp },
    ],
    kill: (pid) => {
      if (pid === 8) throw new Error("gone");
    },
  });
  assert.deepEqual(killed, [9]);
});
