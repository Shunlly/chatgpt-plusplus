// Dream Skin 内存泄漏防护（优化方案 4.3 / 4.4）：
// Blob URL 引用计数、同图复用、LRU 容量淘汰、dispose 全量释放。
import assert from "node:assert/strict";
import test from "node:test";
import { ArtStore, dataUrlToBlob } from "../src/art-store.js";

// 1x1 红色 PNG 的 data URL（base64）
const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const PNG_2PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQDzACjHgAAmcAAk8e0GQAAAAASUVORK5CYII=";

function fakeUrlFactory(): { create: (b: Blob) => string; revoke: (u: string) => void; revoked: Set<string> } {
  let counter = 0;
  const revoked = new Set<string>();
  return {
    create: () => `blob:fake-${counter++}`,
    revoke: (u: string) => revoked.add(u),
    revoked,
  };
}

test("dataUrlToBlob 解析 MIME 与字节内容", () => {
  const blob = dataUrlToBlob(PNG_1PX);
  assert.equal(blob.type, "image/png");
  assert.ok(blob.size > 0);
});

test("相同 dataUrl 复用同一 Blob URL（引用计数）", () => {
  const { create, revoke } = fakeUrlFactory();
  const store = new ArtStore({ createObjectURL: create, revokeObjectURL: revoke });
  const a = store.acquire(PNG_1PX);
  const b = store.acquire(PNG_1PX); // 同图二次获取 → 复用
  assert.equal(a, b);
  assert.equal(store.entryCount, 1);
  store.release(PNG_1PX);
  store.release(PNG_1PX);
  // 引用归零后条目仍在缓存中（LRU 可复用），未立即 revoke
  assert.equal(store.entryCount, 1);
  const c = store.acquire(PNG_1PX);
  assert.equal(c, a, "缓存命中应复用原 URL");
});

test("容量超限按 LRU 淘汰并 revoke", () => {
  const { create, revoke, revoked } = fakeUrlFactory();
  let counter = 0;
  // 上限设得极小：只能容纳一个条目
  const store = new ArtStore({
    maxBytes: 100,
    createObjectURL: create,
    revokeObjectURL: revoke,
    now: () => counter++,
  });
  const first = store.acquire(PNG_1PX);
  store.release(PNG_1PX); // 卡片离开视口：引用归零但仍在缓存
  store.acquire(PNG_2PX); // 触发淘汰：踢掉无引用且最久未用的条目
  assert.ok(revoked.has(first), "最久未用的旧条目应被 revoke");
  assert.equal(store.entryCount, 1);
  assert.ok(store.totalBytesUsed <= 100);
  // 被引用的条目不会被淘汰（避免正在显示的卡片背景失效）
  const store2 = new ArtStore({
    maxBytes: 60,
    createObjectURL: create,
    revokeObjectURL: revoke,
    now: () => counter++,
  });
  store2.acquire(PNG_1PX);
  const held = store2.acquire(PNG_2PX);
  assert.ok(!revoked.has(held), "仍被引用的条目不应被 revoke");
});

test("dispose 全量释放全部 Blob URL", () => {
  const { create, revoke, revoked } = fakeUrlFactory();
  const store = new ArtStore({ createObjectURL: create, revokeObjectURL: revoke });
  const a = store.acquire(PNG_1PX);
  const b = store.acquire(PNG_2PX);
  store.dispose();
  assert.ok(revoked.has(a));
  assert.ok(revoked.has(b));
  assert.equal(store.entryCount, 0);
  assert.equal(store.totalBytesUsed, 0);
});

test("内存防护阈值告警", () => {
  const { create, revoke } = fakeUrlFactory();
  const store = new ArtStore({
    maxBytes: 50,
    createObjectURL: create,
    revokeObjectURL: revoke,
  });
  assert.equal(store.isOverWarnThreshold, false);
  store.acquire(PNG_1PX); // 51 字节 > warnBytes(40)
  assert.equal(store.isOverWarnThreshold, true);
});
