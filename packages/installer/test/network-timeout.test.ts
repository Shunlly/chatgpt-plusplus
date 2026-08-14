// 网络请求超时保护（优化方案 1.2）：
// fetchWithTimeout 在指定时间内未完成必须中止并抛错，
// 防止 GitHub API 网络黑洞把 watcher/自更新拖入无限等待。
import assert from "node:assert/strict";
import test from "node:test";
import { fetchWithTimeout } from "../src/commands/self-update.js";

test("fetchWithTimeout 在超时后中止并抛错", async () => {
  // 模拟网络黑洞：fetch 永不 resolve，但注册 abort 处理以便验证信号生效。
  const originalFetch = globalThis.fetch;
  let aborted = false;
  globalThis.fetch = ((_url: string, init?: { signal?: AbortSignal }) => {
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        aborted = true;
        reject(new DOMException("Aborted", "AbortError"));
      });
    });
  }) as typeof fetch;
  try {
    await assert.rejects(
      fetchWithTimeout("https://api.github.com/repos/x/y/releases/latest", 50),
      /timed out after 50ms/,
    );
    assert.equal(aborted, true, "AbortController 应已中止请求");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchWithTimeout 正常响应时返回结果并清理定时器", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return { ok: true, status: 200, statusText: "OK", json: async () => ({ tag_name: "v1.0.26" }) } as Response;
  }) as typeof fetch;
  try {
    const res = await fetchWithTimeout("https://api.github.com/repos/x/y/releases/latest", 2000);
    assert.equal(res.ok, true);
    const body = (await res.json()) as { tag_name: string };
    assert.equal(body.tag_name, "v1.0.26");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchWithTimeout 透传底层错误", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("ENOTFOUND");
  }) as typeof fetch;
  try {
    await assert.rejects(fetchWithTimeout("https://api.github.com/x", 2000), /ENOTFOUND/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
