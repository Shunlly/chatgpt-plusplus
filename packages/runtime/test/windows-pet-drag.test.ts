import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { isOversizedPetDragRect } from "../src/preload/pet-drag";

test("Windows 宠物拖动接到主进程和 preload", () => {
  const main = readFileSync(resolve(process.cwd(), "packages/runtime/src/main.ts"), "utf8");
  const preload = readFileSync(resolve(process.cwd(), "packages/runtime/src/preload/index.ts"), "utf8");
  const drag = readFileSync(resolve(process.cwd(), "packages/runtime/src/preload/pet-drag.ts"), "utf8");
  const host = readFileSync(resolve(process.cwd(), "packages/runtime/src/windows-pet-drag.ts"), "utf8");
  assert.match(main, /installWindowsPetDrag/);
  assert.match(preload, /installPetWindowDrag/);
  assert.match(drag, /codexpp:pet-drag-by/);
  assert.match(drag, /isPetDragHandle/);
  assert.doesNotMatch(host, /setIgnoreMouseEvents/);
});

test("铺满窗口的空白层不能当拖动热区，宠物本体可以", () => {
  assert.equal(isOversizedPetDragRect(800, 600, 800, 600), true);
  assert.equal(isOversizedPetDragRect(112, 121, 800, 600), false);
});
