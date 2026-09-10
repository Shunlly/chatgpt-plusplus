"use strict";

/**
 * 把安装包内的 runtime / tweaks / 内置主题灌进当前用户目录。
 * loader 在启动时调用：DMG/EXE 开箱即用，不再依赖用户再跑一次 install。
 * 安装器 CLI 里有平行实现（stageTweaks / seedCustomThemes），不能在 SEA 包里
 * require 这份文件，所以两边规则要一起改。
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;

function compareSemver(a, b) {
  const av = SEMVER_RE.exec(String(a || ""));
  const bv = SEMVER_RE.exec(String(b || ""));
  if (!av || !bv) return String(a || "") === String(b || "") ? 0 : 1;
  for (let i = 1; i <= 3; i++) {
    const diff = Number(av[i]) - Number(bv[i]);
    if (diff !== 0) return diff;
  }
  return 0;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function tweakManifestVersion(dir) {
  const manifest = readJson(path.join(dir, "manifest.json"));
  return manifest && typeof manifest.version === "string" ? manifest.version : "0.0.0";
}

function copyIfChanged(src, dest) {
  if (!fs.existsSync(src)) return false;
  if (fs.existsSync(dest)) {
    const s = fs.statSync(src);
    const d = fs.statSync(dest);
    if (s.size === d.size && Math.trunc(s.mtimeMs) === Math.trunc(d.mtimeMs)) return false;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest);
  try {
    const s = fs.statSync(src);
    fs.utimesSync(dest, s.atime, s.mtime);
  } catch {
    // 复制成功即可，时间戳对齐失败不影响加载。
  }
  return true;
}

function copyRuntimeBundles(fromRuntime, toRuntime) {
  if (!fs.existsSync(path.join(fromRuntime, "main.js"))) return false;
  fs.mkdirSync(toRuntime, { recursive: true });
  let copied = false;
  for (const name of ["main.js", "preload.js"]) {
    if (copyIfChanged(path.join(fromRuntime, name), path.join(toRuntime, name))) copied = true;
  }
  const nativeSrc = path.join(fromRuntime, "native");
  const nativeDest = path.join(toRuntime, "native");
  if (fs.existsSync(nativeSrc) && (copied || !fs.existsSync(nativeDest))) {
    fs.cpSync(nativeSrc, nativeDest, { recursive: true });
    copied = true;
  }
  return copied;
}

function syncPresets(fromTweak, toTweak, opts = {}) {
  const fromPresets = path.join(fromTweak, "presets");
  const toPresets = path.join(toTweak, "presets");
  if (!fs.existsSync(fromPresets)) return;
  fs.mkdirSync(toPresets, { recursive: true });
  const replaceExisting = opts.replaceExisting !== false;
  for (const entry of fs.readdirSync(fromPresets)) {
    const from = path.join(fromPresets, entry);
    if (!fs.statSync(from).isDirectory()) continue;
    const to = path.join(toPresets, entry);
    if (fs.existsSync(to)) {
      if (!replaceExisting) continue;
      fs.rmSync(to, { recursive: true, force: true });
    }
    fs.cpSync(from, to, { recursive: true });
  }
}

function seedCustomThemes(fromTweak, tweakDataRoot) {
  const seedDir = path.join(fromTweak, "custom-seed");
  if (!fs.existsSync(seedDir)) return;
  let manifest = {};
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(fromTweak, "manifest.json"), "utf8"));
  } catch {
    // manifest 读取失败时退回目录名，不影响初始化主题。
  }
  const tweakId = typeof manifest.id === "string" ? manifest.id : path.basename(fromTweak);
  const customDir = path.join(tweakDataRoot, tweakId, "custom");
  fs.mkdirSync(customDir, { recursive: true });

  for (const entry of fs.readdirSync(seedDir)) {
    if (!/\.json$/.test(entry)) continue;
    const to = path.join(customDir, entry);
    if (fs.existsSync(to)) continue;
    fs.cpSync(path.join(seedDir, entry), to);
  }

  const indexFile = path.join(customDir, "index.json");
  let index = [];
  try {
    const parsed = JSON.parse(fs.readFileSync(indexFile, "utf8"));
    if (Array.isArray(parsed)) index = parsed;
  } catch {
    // index 缺失或损坏时以 seed 重建。
  }
  const seedIndexFile = path.join(seedDir, "index.json");
  if (fs.existsSync(seedIndexFile)) {
    try {
      const seedIndex = JSON.parse(fs.readFileSync(seedIndexFile, "utf8"));
      if (Array.isArray(seedIndex)) {
        for (const rec of seedIndex) {
          if (!rec || typeof rec.id !== "string") continue;
          if (!index.some((x) => x.id === rec.id)) {
            index.push({ id: rec.id, name: typeof rec.name === "string" ? rec.name : rec.id });
          }
        }
      }
    } catch {
      // seed index 损坏时忽略，不影响已灌入的主题文件。
    }
  }
  const next = JSON.stringify(index);
  let prev = null;
  try {
    prev = fs.readFileSync(indexFile, "utf8");
  } catch {}
  if (prev !== next) fs.writeFileSync(indexFile, next);
}

function stageTweaksFromBundle(fromTweaks, toTweaks, tweakDataRoot, opts = {}) {
  if (!fs.existsSync(fromTweaks)) return;
  fs.mkdirSync(toTweaks, { recursive: true });
  fs.mkdirSync(tweakDataRoot, { recursive: true });
  const refreshPresets = opts.refreshPresets !== false;
  for (const entry of fs.readdirSync(fromTweaks)) {
    const from = path.join(fromTweaks, entry);
    if (!fs.statSync(from).isDirectory()) continue;
    try {
      seedCustomThemes(from, tweakDataRoot);
    } catch {
      // 初始化主题失败不阻断启动，缺失的主题可再次启动/修复补齐。
    }
    const to = path.join(toTweaks, entry);
    if (fs.existsSync(to)) {
      const st = fs.statSync(to);
      if (!st.isDirectory()) {
        fs.unlinkSync(to);
      } else if (compareSemver(tweakManifestVersion(from), tweakManifestVersion(to)) <= 0) {
        try {
          syncPresets(from, to, { replaceExisting: refreshPresets });
        } catch {
          // 预设同步失败不阻断启动。
        }
        continue;
      } else {
        fs.rmSync(to, { recursive: true, force: true });
      }
    }
    fs.cpSync(from, to, { recursive: true });
  }
}

function resolveBundledResources() {
  const candidates = [];
  if (typeof process.resourcesPath === "string" && process.resourcesPath) {
    candidates.push(process.resourcesPath);
  }
  if (process.platform === "darwin") {
    candidates.push(path.join(path.dirname(process.execPath), "..", "Resources"));
  } else if (process.platform === "win32") {
    candidates.push(path.join(path.dirname(process.execPath), "resources"));
    candidates.push(path.join(path.dirname(process.execPath), "..", "resources"));
  }
  return candidates.find((dir) => {
    try {
      return (
        fs.existsSync(path.join(dir, "assets", "runtime", "main.js")) ||
        fs.existsSync(path.join(dir, "tweaks"))
      );
    } catch {
      return false;
    }
  }) || null;
}

function bootstrapUserData(userRoot, bundledResources) {
  if (!userRoot || !bundledResources) return { runtime: false, tweaks: false };
  fs.mkdirSync(userRoot, { recursive: true });
  const bundledRuntime = path.join(bundledResources, "assets", "runtime");
  const bundledTweaks = path.join(bundledResources, "tweaks");
  const runtimeDir = path.join(userRoot, "runtime");
  const tweaksDir = path.join(userRoot, "tweaks");
  const tweakDataRoot = path.join(userRoot, "tweak-data");
  const runtime = copyRuntimeBundles(bundledRuntime, runtimeDir);
  if (fs.existsSync(bundledTweaks)) {
    // 每次启动只补缺失项，避免把预设目录整份重写触发 tweak 热重载。
    stageTweaksFromBundle(bundledTweaks, tweaksDir, tweakDataRoot, { refreshPresets: false });
  }
  return {
    runtime,
    tweaks: fs.existsSync(tweaksDir),
  };
}

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

module.exports = {
  compareSemver,
  copyRuntimeBundles,
  syncPresets,
  seedCustomThemes,
  stageTweaksFromBundle,
  bootstrapUserData,
  resolveBundledResources,
  resolveUserRoot,
};
