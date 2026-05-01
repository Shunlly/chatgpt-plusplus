import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir, platform } from "node:os";
import { basename, join } from "node:path";
import { readPlist } from "./plist.js";

export type Platform = "darwin" | "win32" | "linux";
export type CodexChannel = "stable" | "beta" | "unknown";

export interface CodexInstall {
  /** Path to Codex.app (mac), Codex install dir (win), or AppImage (linux). */
  appRoot: string;
  /** Resources/ dir inside the app. */
  resourcesDir: string;
  /** Path to app.asar. */
  asarPath: string;
  /** Path to Info.plist (mac) or equivalent metadata file. */
  metaPath: string | null;
  /** Path to the Electron Framework binary (for fuse flipping). */
  electronBinary: string;
  /** Original-name executable used when launching. */
  executable: string;
  /** Human-readable app name, when available. */
  appName: string;
  /** Bundle id on macOS, when available. */
  bundleId: string | null;
  /** Known Codex release channel inferred from bundle metadata. */
  channel: CodexChannel;
  platform: Platform;
}

const MAC_DEFAULT = "/Applications/Codex.app";
const MAC_BETA_DEFAULT = "/Applications/Codex (Beta).app";

export function detectPlatform(): Platform {
  const p = platform();
  if (p === "darwin" || p === "win32" || p === "linux") return p;
  throw new Error(`Unsupported platform: ${p}`);
}

export function locateCodex(override?: string): CodexInstall {
  const plat = detectPlatform();
  if (plat === "darwin") return locateMac(override);
  if (plat === "win32") return locateWin(override);
  return locateLinux(override);
}

function locateMac(override?: string): CodexInstall {
  const candidates = [
    override,
    MAC_DEFAULT,
    MAC_BETA_DEFAULT,
    join(homedir(), "Applications", "Codex.app"),
    join(homedir(), "Applications", "Codex (Beta).app"),
    ...findMacCodexApps("/Applications"),
    ...findMacCodexApps(join(homedir(), "Applications")),
  ].filter(Boolean) as string[];

  const appRoot = unique(candidates).find((p) => isMacCodexApp(p));
  if (!appRoot) {
    throw new Error(
      `[!] Codex App Not Found\n\n` +
        `Ensure Codex.app or Codex (Beta).app is installed in /Applications or ~/Applications.\n` +
        `Tried:\n  ${unique(candidates).join("\n  ")}\n\n` +
        `If Codex is somewhere else, rerun with:\n` +
        `  codex-plusplus install --app /path/to/Codex.app`,
    );
  }
  const info = readMacAppInfo(appRoot);
  const resourcesDir = join(appRoot, "Contents", "Resources");
  return {
    appRoot,
    resourcesDir,
    asarPath: join(resourcesDir, "app.asar"),
    metaPath: join(appRoot, "Contents", "Info.plist"),
    electronBinary: join(
      appRoot,
      "Contents",
      "Frameworks",
      "Electron Framework.framework",
      "Versions",
      "A",
      "Electron Framework",
    ),
    executable: join(appRoot, "Contents", "MacOS", info.executable),
    appName: info.name,
    bundleId: info.bundleId,
    channel: inferCodexChannel(info.bundleId, info.name),
    platform: "darwin",
  };
}

function findMacCodexApps(dir: string): string[] {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((name) => /\.app$/i.test(name) && /\bcodex\b/i.test(name))
      .map((name) => join(dir, name));
  } catch {
    return [];
  }
}

function isMacCodexApp(appRoot: string): boolean {
  const infoPath = join(appRoot, "Contents", "Info.plist");
  if (!existsSync(infoPath)) return false;
  const info = readMacAppInfo(appRoot);
  return inferCodexChannel(info.bundleId, info.name) !== "unknown";
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function readMacAppInfo(appRoot: string): { name: string; executable: string; bundleId: string | null } {
  const metaPath = join(appRoot, "Contents", "Info.plist");
  try {
    const plist = readPlist(metaPath);
    const name = String(plist.CFBundleDisplayName ?? plist.CFBundleName ?? basename(appRoot, ".app"));
    const executable = String(plist.CFBundleExecutable ?? name);
    const bundleId = typeof plist.CFBundleIdentifier === "string" ? plist.CFBundleIdentifier : null;
    return { name, executable, bundleId };
  } catch {
    const name = basename(appRoot, ".app");
    return { name, executable: name, bundleId: null };
  }
}

export function inferCodexChannel(bundleId: string | null, appName?: string): CodexChannel {
  if (bundleId === "com.openai.codex") return "stable";
  if (bundleId === "com.openai.codex.beta") return "beta";
  if (/\bbeta\b/i.test(appName ?? "")) return "beta";
  if (/\bcodex\b/i.test(appName ?? "")) return "stable";
  return "unknown";
}

function locateWin(override?: string): CodexInstall {
  // Squirrel.Windows commonly installs under %LOCALAPPDATA%\codex\app-<version>.
  // Some Electron installers use %LOCALAPPDATA%\Programs\Codex instead.
  const local = process.env.LOCALAPPDATA;
  const programFiles = process.env.ProgramFiles;
  const programFilesX86 = process.env["ProgramFiles(x86)"];
  const candidates: string[] = [];
  if (override) candidates.push(override);
  if (local) {
    candidates.push(...windowsCodexCandidates(local));
    candidates.push(
      join(local, "Programs", "Codex (Beta)"),
      join(local, "Programs", "Codex Beta"),
      join(local, "Programs", "codex-beta"),
      join(local, "Programs", "Codex"),
      join(local, "Programs", "codex"),
      join(local, "Codex (Beta)"),
      join(local, "Codex Beta"),
      join(local, "codex-beta"),
      join(local, "Codex"),
      join(local, "codex"),
    );
    candidates.push(...windowsCodexCandidates(join(local, "Programs")));
  }
  if (programFiles) {
    candidates.push(
      join(programFiles, "Codex (Beta)"),
      join(programFiles, "Codex Beta"),
      join(programFiles, "codex-beta"),
      join(programFiles, "Codex"),
      join(programFiles, "codex"),
      ...windowsCodexCandidates(programFiles),
    );
  }
  if (programFilesX86) {
    candidates.push(
      join(programFilesX86, "Codex (Beta)"),
      join(programFilesX86, "Codex Beta"),
      join(programFilesX86, "codex-beta"),
      join(programFilesX86, "Codex"),
      join(programFilesX86, "codex"),
      ...windowsCodexCandidates(programFilesX86),
    );
  }

  const tried = unique(candidates);
  const appRoot = tried.find(isWinCodexRoot);
  if (!appRoot) {
    const triedText = tried.length > 0 ? tried.join("\n  ") : "(no default locations available)";
    throw new Error(
      `[!] Codex App Not Found\n\n` +
        `Ensure Codex is installed in one of the default Windows locations.\n` +
        `Tried:\n  ${triedText}\n\n` +
        `If Codex is somewhere else, rerun with --app pointing at its install folder.`,
    );
  }
  const resourcesDir = join(appRoot, "resources");
  const executable = findWinExecutable(appRoot);
  const appName = basename(executable, ".exe");
  return {
    appRoot,
    resourcesDir,
    asarPath: join(resourcesDir, "app.asar"),
    metaPath: null,
    electronBinary: executable,
    executable,
    appName,
    bundleId: null,
    channel: inferCodexChannel(null, appName),
    platform: "win32",
  };
}

function windowsCodexCandidates(root: string): string[] {
  if (!existsSync(root)) return [];
  const candidates: string[] = [];
  try {
    for (const entry of readdirSync(root)) {
      if (!/\bcodex\b/i.test(entry)) continue;
      const dir = join(root, entry);
      try {
        if (!statSync(dir).isDirectory()) continue;
      } catch {
        continue;
      }
      candidates.push(dir);
      const latest = latestWindowsSquirrelAppDir(dir);
      if (latest) candidates.push(latest);
    }
  } catch {}
  return candidates;
}

function latestWindowsSquirrelAppDir(root: string): string | null {
  try {
    const entries = readdirSync(root)
      .filter((d) => /^app-/i.test(d))
      .map((d) => join(root, d))
      .filter((p) => statSync(p).isDirectory());
    entries.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return entries.at(-1) ?? null;
  } catch {
    return null;
  }
}

function isWinCodexRoot(appRoot: string): boolean {
  return existsSync(join(appRoot, "resources", "app.asar"));
}

function findWinExecutable(appRoot: string): string {
  try {
    const exe = readdirSync(appRoot).find((name) => /\.exe$/i.test(name) && /\bcodex\b/i.test(name));
    if (exe) return join(appRoot, exe);
  } catch {}
  return join(appRoot, "Codex.exe");
}

function locateLinux(override?: string): CodexInstall {
  // Codex isn't yet shipped on Linux at time of writing; assume an Electron-style
  // unpacked install or a deb/rpm in /opt.
  const candidates = [
    override,
    "/opt/Codex",
    "/opt/codex",
    join(homedir(), ".local", "share", "Codex"),
  ].filter(Boolean) as string[];
  const appRoot = candidates.find((p) => existsSync(join(p, "resources", "app.asar")));
  if (!appRoot) {
    throw new Error(
      `[!] Codex App Not Found\n\n` +
        `Ensure Codex is installed in a supported Linux location.\n` +
        `Tried:\n  ${candidates.join("\n  ")}\n\n` +
        `If Codex is somewhere else, rerun with --app pointing at its install folder.`,
    );
  }
  const resourcesDir = join(appRoot, "resources");
  return {
    appRoot,
    resourcesDir,
    asarPath: join(resourcesDir, "app.asar"),
    metaPath: null,
    electronBinary: join(appRoot, "codex"),
    executable: join(appRoot, "codex"),
    appName: "Codex",
    bundleId: null,
    channel: "stable",
    platform: "linux",
  };
}
