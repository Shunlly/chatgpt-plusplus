import assert from "node:assert/strict";
import test from "node:test";
import { isCompactPetWindow } from "../src/preload/compact-window";

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
