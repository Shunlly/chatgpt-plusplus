import assert from "node:assert/strict";
import test from "node:test";
import {
  applyStatsigModelVisibilityPatch,
  startStatsigModelVisibilityMaintenance,
} from "../src/preload/statsig-patch";

function fakeLocalStorage(initial: Record<string, string>) {
  const store = new Map(Object.entries(initial));
  const localStorage: Record<string, unknown> = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
      Object.defineProperty(localStorage, k, {
        value: v,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    },
    removeItem: (k: string) => void store.delete(k),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
  };
  for (const [k, v] of store) {
    Object.defineProperty(localStorage, k, {
      value: v,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorage,
    configurable: true,
  });
  return store;
}

function statsigEntry(useHiddenModels: unknown, dataAsString = false): string {
  const data = {
    dynamic_configs: {
      "107580212": {
        name: "107580212",
        value: {
          use_hidden_models: useHiddenModels,
          available_models: [],
          default_model: "gpt-5.5",
        },
        rule_id: "default",
        id_type: "userID",
        secondary_exposures: [],
      },
    },
  };
  return JSON.stringify({ source: "Network", data: dataAsString ? JSON.stringify(data) : data });
}

function readStored(store: Map<string, string>, key: string): unknown {
  const outer = JSON.parse(store.get(key)!);
  const data = typeof outer.data === "string" ? JSON.parse(outer.data) : outer.data;
  return data.dynamic_configs["107580212"].value.use_hidden_models;
}

test("把 use_hidden_models=true 的缓存改为 false", () => {
  const key = "statsig.cached.evaluations.123";
  const store = fakeLocalStorage({ [key]: statsigEntry(true) });
  const r = applyStatsigModelVisibilityPatch();
  assert.deepEqual(r, { matched: 1, changed: 1, skipped: 0 });
  assert.equal(readStored(store, key), false);
});

test("data 为字符串格式时同样改写并写回字符串", () => {
  const key = "statsig.cached.evaluations.123";
  const store = fakeLocalStorage({ [key]: statsigEntry(true, true) });
  const r = applyStatsigModelVisibilityPatch();
  assert.deepEqual(r, { matched: 1, changed: 1, skipped: 0 });
  const outer = JSON.parse(store.get(key)!);
  assert.equal(typeof outer.data, "string");
  assert.equal(readStored(store, key), false);
});

test("已是 false 的缓存不改写但计数 matched", () => {
  const key = "statsig.cached.evaluations.123";
  const store = fakeLocalStorage({ [key]: statsigEntry(false) });
  const r = applyStatsigModelVisibilityPatch();
  assert.deepEqual(r, { matched: 1, changed: 0, skipped: 0 });
  assert.equal(readStored(store, key), false);
});

test("无关 key 与坏 JSON 不抛错", () => {
  const store = fakeLocalStorage({
    "other": "x",
    "statsig.cached.evaluations.bad": "{not json",
    "statsig.cached.evaluations.empty": "",
  });
  const r = applyStatsigModelVisibilityPatch();
  assert.deepEqual(r, { matched: 0, changed: 0, skipped: 2 });
  assert.equal(store.get("other"), "x");
});

function fakeWindowDocument() {
  const listeners = new Map<string, Set<() => void>>();
  const win: Record<string, unknown> = {
    addEventListener: (type: string, fn: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener: (type: string, fn: () => void) => {
      listeners.get(type)?.delete(fn);
    },
    setInterval: (fn: () => void, ms: number) => {
      const t = setTimeout(fn, ms);
      return t as unknown as number;
    },
    clearInterval: (t: number) => clearTimeout(t),
  };
  let hidden = false;
  const doc: Record<string, unknown> = {
    get hidden() {
      return hidden;
    },
    setHidden(v: boolean) {
      hidden = v;
    },
    addEventListener: (type: string, fn: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener: (type: string, fn: () => void) => {
      listeners.get(type)?.delete(fn);
    },
  };
  Object.defineProperty(globalThis, "window", { value: win, configurable: true });
  Object.defineProperty(globalThis, "document", { value: doc, configurable: true });
  return { win, doc, fire: (t: string) => {
    for (const fn of [...(listeners.get(t) ?? [])]) fn();
  } };
}

test("storage 事件触发时把写回 true 的缓存改回 false", () => {
  const key = "statsig.cached.evaluations.123";
  const store = fakeLocalStorage({ [key]: statsigEntry(true) });
  const { fire } = fakeWindowDocument();
  const changedLog: number[] = [];
  const stop = startStatsigModelVisibilityMaintenance({ onChange: (n) => changedLog.push(n) });
  try {
    fire("storage");
    assert.equal(readStored(store, key), false);
    assert.deepEqual(changedLog, [1]);
  } finally {
    stop();
  }
});

test("周期重打兜底（隐藏窗口跳过）", async () => {
  const key = "statsig.cached.evaluations.123";
  const store = fakeLocalStorage({ [key]: statsigEntry(true) });
  const { doc, fire } = fakeWindowDocument();
  const changedLog: number[] = [];
  const stop = startStatsigModelVisibilityMaintenance({ intervalMs: 30, onChange: (n) => changedLog.push(n) });
  try {
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(readStored(store, key), false);
    assert.equal(changedLog.length, 1);
    store.set(key, statsigEntry(true));
    doc.setHidden(true);
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(readStored(store, key), true, "隐藏窗口不应重打");
    doc.setHidden(false);
    fire("visibilitychange");
    assert.equal(readStored(store, key), false, "回前台应重打");
  } finally {
    stop();
  }
});

test("stop 后不再重打", async () => {
  const key = "statsig.cached.evaluations.123";
  const store = fakeLocalStorage({ [key]: statsigEntry(true) });
  fakeWindowDocument();
  const changedLog: number[] = [];
  const stop = startStatsigModelVisibilityMaintenance({ intervalMs: 20, onChange: (n) => changedLog.push(n) });
  stop();
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(readStored(store, key), true);
  assert.deepEqual(changedLog, []);
});
