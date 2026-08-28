import assert from "node:assert/strict";
import test from "node:test";
import { shouldIgnoreTweakWatchPath } from "../src/tweak-watch-ignore";

test("忽略 Windows node_modules 与主题图，不忽略 tweak 源码", () => {
  assert.equal(
    shouldIgnoreTweakWatchPath(String.raw`C:\Users\a\chatgpt-plusplus\tweaks\foo\node_modules\x`),
    true,
  );
  assert.equal(
    shouldIgnoreTweakWatchPath(String.raw`C:\Users\a\tweaks\dream-skin\presets\x\background.jpg`),
    true,
  );
  assert.equal(shouldIgnoreTweakWatchPath("/Users/a/tweaks/foo/node_modules/x"), true);
  assert.equal(shouldIgnoreTweakWatchPath("/Users/a/tweaks/dream-skin/index.js"), false);
  assert.equal(
    shouldIgnoreTweakWatchPath(String.raw`C:\Users\a\tweaks\dream-skin\index.js`),
    false,
  );
});
