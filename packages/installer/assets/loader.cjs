/* eslint-disable */
/**
 * codex-plusplus loader stub. This file is copied into Codex.app/Contents/Resources/app.asar
 * by the installer, and `package.json#main` is rewritten to point at it.
 *
 * Responsibilities:
 *   1. Resolve the original entry point that we replaced (stored in
 *      package.json#__codexpp.originalMain) and the user runtime location
 *      (also recorded in __codexpp.userRoot).
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
const Module = require("node:module");

const pkg = require("./package.json");
const meta = pkg.__codexpp || {};
const originalMain = meta.originalMain;
const userRoot = meta.userRoot;
const MAX_LOG_BYTES = 10 * 1024 * 1024;

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
      process.stderr.write(`[codex-plusplus loader] ${label}: ${e}\n`);
    }
  }
}

safe("init", () => {
  if (!originalMain) {
    throw new Error("loader: package.json missing __codexpp.originalMain");
  }
  if (!userRoot) {
    throw new Error("loader: package.json missing __codexpp.userRoot");
  }

  // Allow user-installed runtime modules to be require()d from anywhere.
  const runtimeDir = path.join(userRoot, "runtime");
  if (fs.existsSync(runtimeDir)) {
    Module.globalPaths.push(path.join(runtimeDir, "node_modules"));
    process.env.CODEX_PLUSPLUS_USER_ROOT = userRoot;
    process.env.CODEX_PLUSPLUS_RUNTIME = runtimeDir;
    // Load the runtime main-process bootstrap. It will hook BrowserWindow
    // before Codex creates any windows.
    safe("runtime", () => require(path.join(runtimeDir, "main.js")));
  } else {
    process.stderr.write(
      `[codex-plusplus] runtime missing at ${runtimeDir}; loading Codex untweaked.\n`,
    );
  }
});

// Always hand control to the original entry point, even on failure.
require("./" + originalMain);
