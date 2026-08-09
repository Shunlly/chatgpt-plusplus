// 独立 GUI 与 tweak 的磁盘桥接自检：selection.json 双向同步 + 幂等轮询。
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const require = createRequire(import.meta.url);

// 极简 DOM 桩，让 start() 走到轮询逻辑（startMainNav 只读不写时安全跳过）
const el = () =>
  new Proxy(
    {
      style: {},
      dataset: {},
      classList: { add() {}, remove() {}, contains: () => false },
      children: [],
      textContent: "",
      innerHTML: "",
      append() {},
      appendChild() {},
      addEventListener() {},
      removeEventListener() {},
      remove() {},
      setAttribute() {},
      getAttribute: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      parentElement: null,
      tagName: "div",
    },
    {
      get(t, k) {
        if (k in t) return t[k];
        return () => {};
      },
      set(t, k, v) {
        t[k] = v;
        return true;
      },
    },
  );

function installDomStubs() {
  (globalThis as any).window = { __CODEX_DREAM_SKIN_STATE__: null };
  (globalThis as any).document = {
    createElement: () => el(),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    documentElement: { classList: { add() {}, remove() {}, contains: () => false } },
  };
  (globalThis as any).location = { search: "", href: "" };
  (globalThis as any).MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  (globalThis as any).URL.createObjectURL = () => "blob:test";
  (globalThis as any).URL.revokeObjectURL = () => {};
  const timers: Array<() => void> = [];
  (globalThis as any).setInterval = (fn: () => void) => {
    timers.push(fn);
    return timers.length;
  };
  (globalThis as any).clearInterval = () => {};
  return timers;
}

test("GUI 写 selection.json 后 tweak 轮询应用（幂等不重复）", async () => {
  const timers = installDomStubs();
  const files = new Map<string, string>([
    ["selection.json", JSON.stringify({ type: "preset", id: "preset-sakura-dawn" })],
  ]);
  const writes: Array<[string, string]> = [];
  let storageSets = 0;
  const storage = new Map<string, unknown>([["selection", { type: "none" }]]);
  const asset = async (p: string) =>
    `data:text/plain;base64,${Buffer.from(JSON.stringify({ name: p })).toString("base64")}`;
  const api = {
    process: "renderer",
    fs: {
      read: async (p: string) => {
        if (!files.has(p)) {
          const e: any = new Error(`ENOENT: ${p}`);
          e.code = "ENOENT";
          throw e;
        }
        return files.get(p)!;
      },
      write: async (p: string, c: string) => {
        files.set(p, c);
        writes.push([p, c]);
      },
      asset,
    },
    storage: {
      get: (k: string) => storage.get(k),
      set: (k: string, v: unknown) => {
        if (k === "selection") storageSets += 1;
        storage.set(k, v);
      },
    },
    log: { info() {}, warn() {}, error() {} },
  };

  const tweak = require(join(ROOT, "tweaks", "dream-skin", "index.js"));
  await tweak.start(api);

  // 1. 磁盘选择优先：start 时 storage 是 none，磁盘是 sakura-dawn → 以磁盘为准
  assert.equal(storageSets, 1);
  assert.deepEqual(storage.get("selection"), { type: "preset", id: "preset-sakura-dawn" });
  // applySaved 的 finally 会把当前选择写回磁盘
  const persisted = JSON.parse(writes.find(([p]) => p === "selection.json")![1]);
  assert.deepEqual(persisted, { type: "preset", id: "preset-sakura-dawn" });

  // 2. GUI 写入新选择 → 下一次轮询应用
  files.set("selection.json", JSON.stringify({ type: "preset", id: "preset-cyber-neon" }));
  const before = storageSets;
  timers[timers.length - 1](); // 轮询回调
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(storageSets, before + 1);
  assert.deepEqual(storage.get("selection"), { type: "preset", id: "preset-cyber-neon" });

  // 3. 磁盘与当前一致 → 不重复应用（storage.set 不再触发）
  const before2 = storageSets;
  timers[timers.length - 1]();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(storageSets, before2);

  tweak.stop();
});
