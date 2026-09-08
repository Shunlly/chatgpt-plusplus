import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { brandedWindowTitle, CHATGPT_PLUSPLUS_WINDOW_TITLE, installWindowBranding, isCompactBrandingWindow, pickMainBrandingWindow } from "../src/window-branding";

test("把 ChatGPT/Codex 窗口标题改成 ChatGPT++，宠物窗标题不改", () => {
  assert.equal(brandedWindowTitle("ChatGPT"), CHATGPT_PLUSPLUS_WINDOW_TITLE);
  assert.equal(brandedWindowTitle("Codex"), CHATGPT_PLUSPLUS_WINDOW_TITLE);
  assert.equal(brandedWindowTitle("chatgpt"), CHATGPT_PLUSPLUS_WINDOW_TITLE);
  assert.equal(brandedWindowTitle("ChatGPT Desktop"), CHATGPT_PLUSPLUS_WINDOW_TITLE);
  assert.equal(brandedWindowTitle(""), CHATGPT_PLUSPLUS_WINDOW_TITLE);
  assert.equal(brandedWindowTitle("ChatGPT++"), null);
  assert.equal(brandedWindowTitle("foo \u2014 ChatGPT"), "foo \u2014 " + CHATGPT_PLUSPLUS_WINDOW_TITLE);
  assert.equal(brandedWindowTitle("foo - Codex"), "foo \u2014 " + CHATGPT_PLUSPLUS_WINDOW_TITLE);
  assert.equal(brandedWindowTitle("设置"), null);
});

test("installWindowBranding 会改写标题并拦截 page-title-updated", () => {
  const titles = ["ChatGPT"];
  const win = {
    isDestroyed: () => false,
    getTitle: () => titles[0],
    setTitle: (t) => { titles[0] = t; },
    on: (event, listener) => {
      if (event === "page-title-updated") win._onTitle = listener;
    },
    webContents: { getURL: () => "app://-/index.html" },
    _onTitle: undefined,
  };
  const app = {
    setAppUserModelId: (id) => { app.id = id; },
    isReady: () => true,
    on: (event, listener) => {
      if (event === "web-contents-created") app._created = listener;
    },
    id: "",
    _created: undefined,
  };
  installWindowBranding({
    app,
    BrowserWindow: {
      fromWebContents: () => win,
      getAllWindows: () => [win],
    },
    enableTitleHooks: true,
  });
  assert.equal(app.id, "com.chatgpt-plusplus.app");
  assert.equal(titles[0], "ChatGPT++");
  const ev = { prevented: false, preventDefault() { ev.prevented = true; } };
  win._onTitle(ev, "ChatGPT");
  assert.equal(ev.prevented, true);
  assert.equal(titles[0], "ChatGPT++");
});

test("主进程和 preload 接上窗口品牌化", () => {
  const main = readFileSync(resolve(process.cwd(), "packages/runtime/src/main.ts"), "utf8");
  const preload = readFileSync(resolve(process.cwd(), "packages/runtime/src/preload/index.ts"), "utf8");
  assert.match(main, /installWindowBranding/);
  assert.match(main, /from \"\.\/window-branding\"/);
  assert.match(preload, /brandedWindowTitle/);
  assert.match(preload, /startDocumentTitleBranding/);
});

test("isCompactBrandingWindow 识别宠物窗，避免 setTitle 打断拖动", () => {
  assert.equal(
    isCompactBrandingWindow({
      isDestroyed: () => false,
      getTitle: () => "ChatGPT",
      setTitle: () => {},
      on: () => {},
      webContents: { getURL: () => "app://-/index.html?initialRoute=pet" },
    }),
    true,
  );
  assert.equal(
    isCompactBrandingWindow({
      isDestroyed: () => false,
      getTitle: () => "ChatGPT",
      setTitle: () => {},
      on: () => {},
      isAlwaysOnTop: () => true,
      getSize: () => [1280, 800],
      webContents: { getURL: () => "app://-/index.html" },
    }),
    true,
  );
  assert.equal(
    isCompactBrandingWindow({
      isDestroyed: () => false,
      getTitle: () => "ChatGPT",
      setTitle: () => {},
      on: () => {},
      isAlwaysOnTop: () => false,
      getSize: () => [360, 480],
      webContents: { getURL: () => "app://-/index.html" },
    }),
    true,
  );
  assert.equal(
    isCompactBrandingWindow({
      isDestroyed: () => false,
      getTitle: () => "ChatGPT",
      setTitle: () => {},
      on: () => {},
      isAlwaysOnTop: () => false,
      getSize: () => [1280, 800],
      webContents: { getURL: () => "app://-/index.html" },
    }),
    false,
  );
});

function fakeWin(opts: {
  url: string;
  title?: string;
  alwaysOnTop?: boolean;
  size?: number[];
}) {
  return {
    isDestroyed: () => false,
    getTitle: () => opts.title ?? "ChatGPT",
    setTitle: () => {},
    on: () => {},
    isAlwaysOnTop: () => opts.alwaysOnTop ?? false,
    getSize: () => opts.size ?? [1280, 800],
    webContents: { getURL: () => opts.url },
  };
}

test("isCompactBrandingWindow 识别桌面宠物，空 URL 也不提前 setTitle", () => {
  assert.equal(
    isCompactBrandingWindow(fakeWin({ url: "app://-/index.html?initialRoute=%2Favatar-overlay" })),
    true,
  );
  assert.equal(isCompactBrandingWindow(fakeWin({ url: "" })), true);
  assert.equal(isCompactBrandingWindow(fakeWin({ url: "about:blank" })), true);
});

test("pickMainBrandingWindow 只挑主窗", () => {
  const pet = fakeWin({ url: "app://-/index.html?initialRoute=%2Favatar-overlay", size: [180, 200], alwaysOnTop: true });
  const main = fakeWin({ url: "app://-/index.html", size: [1280, 800] });
  assert.equal(pickMainBrandingWindow([pet, main]), main);
  assert.equal(pickMainBrandingWindow([pet]), null);
});

test("Windows 品牌化不再对所有窗口周期 setTitle", () => {
  const src = readFileSync(resolve(process.cwd(), "packages/runtime/src/window-branding.ts"), "utf8");
  assert.match(src, /pickMainBrandingWindow/);
  assert.match(src, /main title once/);
  assert.doesNotMatch(src, /setInterval\(applyAll/);
});
