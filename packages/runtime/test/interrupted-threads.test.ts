import assert from "node:assert/strict";
import test from "node:test";
import {
  applyRunning,
  dismissThread,
  emptyState,
  parseState,
  parseTrayRunning,
  promoteCrashed,
  shouldApplyRunning,
} from "../src/interrupted-threads";

const now = 1_700_000_000_000;
const a = { title: "目标 A", path: "/local/01a00000-0000-0000-0000-00000000000a" };
const b = { title: "目标 B", path: "/local/01a00000-0000-0000-0000-00000000000b" };

test("只解析 tray-menu-threads-changed 的 runningThreads", () => {
  assert.equal(parseTrayRunning({ type: "log-message" }), null);
  assert.deepEqual(
    parseTrayRunning({ type: "tray-menu-threads-changed", trayMenuThreads: { runningThreads: [a] } }, now),
    [{ id: "01a00000-0000-0000-0000-00000000000a", title: "目标 A", path: a.path, at: now }],
  );
  assert.deepEqual(
    parseTrayRunning({ type: "tray-menu-threads-changed", trayMenuThreads: { runningThreads: [] } }, now),
    [],
  );
});

test("丢掉非法 path，宠物空列表不能覆盖主窗心跳", () => {
  assert.deepEqual(
    parseTrayRunning({
      type: "tray-menu-threads-changed",
      trayMenuThreads: { runningThreads: [{ title: "x", path: "javascript:alert(1)" }] },
    }, now),
    [],
  );
  assert.equal(shouldApplyRunning([], true), false);
  assert.equal(shouldApplyRunning([], false), true);
  assert.equal(shouldApplyRunning([{ id: "a", title: "", path: "/local/a", at: now }], true), true);
});

test("关掉时还在跑的会话，下次启动升成 interrupted", () => {
  let state = emptyState();
  state = applyRunning(state, parseTrayRunning({
    type: "tray-menu-threads-changed",
    trayMenuThreads: { runningThreads: [a, b] },
  }, now)!);
  state = promoteCrashed(state, now + 1);
  assert.deepEqual(state.running, []);
  assert.equal(state.interrupted.length, 2);
  assert.equal(state.interrupted[0]?.id.endsWith("b") || state.interrupted[1]?.id.endsWith("b"), true);
});

test("会话又跑起来或点掉后，从中断列表消失", () => {
  let state = promoteCrashed(applyRunning(emptyState(), [
    { id: "a", title: "A", path: "/local/a", at: now },
  ]), now + 1);
  state = applyRunning(state, [{ id: "a", title: "A", path: "/local/a", at: now + 2 }]);
  assert.deepEqual(state.interrupted, []);
  state = promoteCrashed(applyRunning(state, [
    { id: "a", title: "A", path: "/local/a", at: now + 3 },
  ]), now + 4);
  state = dismissThread(state, "a");
  assert.deepEqual(state.interrupted, []);
});

test("坏 JSON 当空状态，最多保留 8 条", () => {
  assert.deepEqual(parseState(null), emptyState());
  const many = Array.from({ length: 12 }, (_, i) => ({
    id: `id${i}`,
    title: `t${i}`,
    path: `/local/id${i}`,
    at: now + i,
  }));
  const state = promoteCrashed({ running: many, interrupted: [] }, now + 20);
  assert.equal(state.interrupted.length, 8);
  assert.equal(state.interrupted[0]?.id, "id11");
});
