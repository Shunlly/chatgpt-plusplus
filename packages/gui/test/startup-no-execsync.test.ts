import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const src = readFileSync(resolve(fileURLToPath(new URL(".", import.meta.url)), "../src/main.ts"), "utf8");

test("GUI 启动路径不再 execSync SEA --version", () => {
  assert.equal(src.includes("execSync"), false);
  assert.equal(src.includes("autoUpdateCli"), false);
  assert.match(src, /if \(state\?\.appRoot && existsSync\(state\.appRoot\)\) candidates\.push\(state\.appRoot\)/);
});
