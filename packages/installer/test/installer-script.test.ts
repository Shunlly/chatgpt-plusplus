import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("Windows 安装完成页的启动项可取消，且安装后先创建启动器", () => {
  const script = readFileSync(resolve(process.cwd(), "scripts/innosetup/installer.iss"), "utf8");
  assert.match(script, /\[Run\][\s\S]*?Description: "启动 ChatGPT\+\+"; Flags: nowait postinstall/);
  assert.match(script, /procedure RunPostInstall\(\)[\s\S]*?Exec\(.*?['"]install['"][\s\S]*?CreateChatGptPlusPlusShortcuts\(\);/);
});
