import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("Windows 宠物拖动接到主进程和 preload", () => {
  const main = readFileSync(resolve(process.cwd(), "packages/runtime/src/main.ts"), "utf8");
  const preload = readFileSync(resolve(process.cwd(), "packages/runtime/src/preload/index.ts"), "utf8");
  const drag = readFileSync(resolve(process.cwd(), "packages/runtime/src/preload/pet-drag.ts"), "utf8");
  assert.match(main, /installWindowsPetDrag/);
  assert.match(preload, /installPetWindowDrag/);
  assert.match(drag, /codexpp:pet-drag-by/);
  assert.match(drag, /isAvatarOverlayWindow/);
});
