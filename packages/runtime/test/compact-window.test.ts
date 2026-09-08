import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { isAvatarOverlaySurface, isAvatarOverlayWindow, isCompactPetWindow, shouldSkipTweaks } from "../src/preload/compact-window";

function cls(on: boolean) {
  return { classList: { contains: (name: string) => on && name === "compact-window" } };
}

test("识别宠物 compact-window / about:blank / initialRoute，放过普通会话页", () => {
  assert.equal(isCompactPetWindow({ href: "https://chatgpt.com/", search: "" }, cls(false), cls(false)), false);
  assert.equal(isCompactPetWindow({ href: "https://chatgpt.com/", search: "" }, cls(true), cls(false)), true);
  assert.equal(isCompactPetWindow({ href: "https://chatgpt.com/", search: "" }, cls(false), cls(true)), true);
  assert.equal(isCompactPetWindow({ href: "about:blank", search: "" }, cls(false), cls(false)), false);
  assert.equal(isCompactPetWindow({ href: "https://chatgpt.com/", search: "?initialRoute=pet" }, cls(false), cls(false)), true);
});

test("宠物窗启动中断会话条，但不跑 tweak 宿主", () => {
  const src = readFileSync(resolve(process.cwd(), "packages/runtime/src/preload/index.ts"), "utf8");
  assert.match(src, /startInterruptedPetOverlay\(\)/);
  assert.match(src, /skip tweaks: compact\/pet window/);
  assert.match(src, /if \(shouldSkipTweaks\(\)\)/);
  assert.match(src, /shouldStartInterruptedPetOverlay/);
  assert.match(src, /isAvatarOverlayWindow/);
});

test("打开中断会话不会把宠物窗当主窗", () => {
  const src = readFileSync(resolve(process.cwd(), "packages/runtime/src/main.ts"), "utf8");
  const start = src.indexOf("function openCodexThreadRoute");
  assert.ok(start > 0);
  const body = src.slice(start, start + 1200);
  assert.match(body, /!isCompactBrowserWindow\(win\)/);
  assert.match(body, /createFreshWindow/);
});

test("宠物活动槽 HTML 跳过 tweak，主会话页不跳过", () => {
  const overlay = { href: "app://-/avatar-overlay-composition-surface.html?surfaceId=activity-slot-1", search: "?surfaceId=activity-slot-1" };
  const pet = { href: "app://-/index.html?initialRoute=%2Favatar-overlay", search: "?initialRoute=%2Favatar-overlay" };
  const main = { href: "app://-/index.html", search: "" };
  assert.equal(isAvatarOverlaySurface(overlay), true);
  assert.equal(isAvatarOverlayWindow(pet), true);
  assert.equal(isAvatarOverlayWindow(overlay), true);
  assert.equal(isAvatarOverlayWindow(main), false);
  assert.equal(isCompactPetWindow(overlay, cls(false), cls(false)), false);
  assert.equal(shouldSkipTweaks(overlay, cls(false), cls(false)), true);
  assert.equal(shouldSkipTweaks(pet, cls(false), cls(false)), true);
  assert.equal(shouldSkipTweaks(main, cls(false), cls(false)), false);
});
