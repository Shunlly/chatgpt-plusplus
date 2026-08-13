// settings-injector 的侧边栏扫描过滤逻辑自检：
// 验证“只有与已判定侧边栏区域相关的变化才触发重扫”，避免聊天区每帧 DOM
// 变化导致全量扫描所有 div 卡死；这是卡死修复的核心回归测试。
import assert from "node:assert/strict";
import { test } from "node:test";
import { mutationsTouchSidebar } from "../src/preload/sidebar-scan-filter";

interface FakeArea {
  isConnected: boolean;
  contains: (t: unknown) => boolean;
}

function record(target: unknown) {
  return { target } as unknown as MutationRecord;
}

function area(inside: unknown[]): FakeArea {
  return {
    isConnected: true,
    contains: (t) => inside.includes(t),
  };
}

test("尚未判定侧边栏归属时必须扫描", () => {
  assert.equal(mutationsTouchSidebar([record({})], null), true);
});

test("已判定侧边栏被移除/断开时重扫", () => {
  const gone = area([]);
  gone.isConnected = false;
  assert.equal(mutationsTouchSidebar([record("x")], gone), true);
});

test("变化发生在侧边栏区域内时重扫", () => {
  const item = {};
  const sidebar = area([item]);
  assert.equal(mutationsTouchSidebar([record(item)], sidebar), true);
  assert.equal(mutationsTouchSidebar([record(sidebar)], sidebar), true);
});

test("变化发生在侧边栏区域外时跳过", () => {
  const sidebar = area([]);
  assert.equal(mutationsTouchSidebar([record("chat-message")], sidebar), false);
});

test("一批变化中任一落在区域内就重扫", () => {
  const item = {};
  const sidebar = area([item]);
  const records = [record("chat-1"), record(item), record("chat-2")];
  assert.equal(mutationsTouchSidebar(records, sidebar), true);
});
