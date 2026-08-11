/* eslint-disable */
/**
 * chatgpt-plusplus loader stub. This file is copied into Codex.app/Contents/Resources/app.asar
 * by the installer, and `package.json#main` is rewritten to point at it.
 *
 * Responsibilities:
 *   1. Resolve the original entry point that we replaced (stored in
 *      package.json#__codexpp.originalMain). The user runtime location is
 *      derived from the CURRENT user at launch (never the path baked into
 *      the installer), so the same DMG/EXE works on any machine.
 *   2. Hook `require` so renderer preloads can find our runtime.
 *   3. Load the runtime's main-process entry BEFORE the original main entry.
 *      The runtime patches Electron's BrowserWindow to inject our preload script.
 *   4. Load the original main entry. If anything in our pipeline throws, log
 *      it but always fall through to the original main so Codex still launches
 *      (broken tweak system > broken Codex).
 */

"use strict";

const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const Module = require("node:module");

const pkg = require("./package.json");
const meta = pkg.__codexpp || {};
const originalMain = meta.originalMain;
const MAX_LOG_BYTES = 10 * 1024 * 1024;

// 用户数据目录按“当前运行用户”动态推导，而不是用打包时写入的绝对路径：
// DMG/EXE 在别的机器（别的用户名）安装后，写死的路径不存在会导致应用裸跑、
// tweak/主题全部丢失。环境变量优先（兼容自定义位置），其次按平台默认。
function resolveUserRoot() {
  if (process.env.CHATGPT_PLUSPLUS_HOME) return process.env.CHATGPT_PLUSPLUS_HOME;
  if (process.env.CODEX_PLUSPLUS_HOME) return process.env.CODEX_PLUSPLUS_HOME;
  const home = os.homedir();
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "chatgpt-plusplus");
  }
  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", "chatgpt-plusplus");
  }
  return path.join(process.env.XDG_DATA_HOME || path.join(home, ".local", "share"), "chatgpt-plusplus");
}
const userRoot = resolveUserRoot();

function appendCappedLog(file, line) {
  const incoming = Buffer.from(line);
  if (incoming.byteLength >= MAX_LOG_BYTES) {
    fs.writeFileSync(file, incoming.subarray(incoming.byteLength - MAX_LOG_BYTES));
    return;
  }
  if (fs.existsSync(file)) {
    const size = fs.statSync(file).size;
    const allowedExisting = MAX_LOG_BYTES - incoming.byteLength;
    if (size > allowedExisting) {
      const existing = fs.readFileSync(file);
      fs.writeFileSync(file, existing.subarray(Math.max(0, existing.byteLength - allowedExisting)));
    }
  }
  fs.appendFileSync(file, incoming);
}

function safe(label, fn) {
  try {
    fn();
  } catch (e) {
    try {
      const logDir = path.join(userRoot || "", "log");
      fs.mkdirSync(logDir, { recursive: true });
      const line = `[${new Date().toISOString()}] ${label}: ${(e && e.stack) || e}\n`;
      appendCappedLog(path.join(logDir, "loader.log"), line);
    } catch (_) {
      // last resort: stderr
      process.stderr.write(`[chatgpt-plusplus loader] ${label}: ${e}\n`);
    }
  }
}

safe("init", () => {
  if (!originalMain) {
    throw new Error("loader: package.json missing __codexpp.originalMain");
  }

  // Allow user-installed runtime modules to be require()d from anywhere.
  const runtimeDir = path.join(userRoot, "runtime");
  if (fs.existsSync(runtimeDir)) {
    Module.globalPaths.push(path.join(runtimeDir, "node_modules"));
    process.env.CHATGPT_PLUSPLUS_USER_ROOT = userRoot;
    process.env.CHATGPT_PLUSPLUS_RUNTIME = runtimeDir;
    // 兼容旧版运行时：同时写入旧环境变量名。
    process.env.CODEX_PLUSPLUS_USER_ROOT = userRoot;
    process.env.CODEX_PLUSPLUS_RUNTIME = runtimeDir;
    // Load the runtime main-process bootstrap. It will hook BrowserWindow
    // before Codex creates any windows.
    safe("runtime", () => require(path.join(runtimeDir, "main.js")));
  } else {
    process.stderr.write(
      `[chatgpt-plusplus] runtime missing at ${runtimeDir}; loading Codex untweaked.\n`,
    );
  }
});

// Always hand control to the original entry point, even on failure.
require("./" + originalMain);
