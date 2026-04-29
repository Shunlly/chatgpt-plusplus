import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

export type Platform = "darwin" | "win32" | "linux";

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
  platform: Platform;
}

const MAC_DEFAULT = "/Applications/Codex.app";

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
    join(homedir(), "Applications", "Codex.app"),
  ].filter(Boolean) as string[];

  const appRoot = candidates.find((p) => existsSync(join(p, "Contents", "Info.plist")));
  if (!appRoot) {
    throw new Error(
      `[!] Codex App Not Found\n\n` +
        `Ensure Codex.app is installed in /Applications or ~/Applications.\n` +
        `Tried:\n  ${candidates.join("\n  ")}\n\n` +
        `If Codex is somewhere else, rerun with:\n` +
        `  codex-plusplus install --app /path/to/Codex.app`,
    );
  }
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
    executable: join(appRoot, "Contents", "MacOS", "Codex"),
    platform: "darwin",
  };
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
    const codexDir = join(local, "codex");
    if (existsSync(codexDir)) {
      // pick highest app-* directory
      try {
        const entries = readdirSync(codexDir)
          .filter((d) => d.startsWith("app-"))
          .map((d) => join(codexDir, d))
          .filter((p) => statSync(p).isDirectory());
        entries.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        const latest = entries.at(-1);
        if (latest) candidates.push(latest);
      } catch {}
    }
    candidates.push(
      join(local, "Programs", "Codex"),
      join(local, "Programs", "codex"),
      join(local, "Codex"),
      join(local, "codex"),
    );
  }
  if (programFiles) candidates.push(join(programFiles, "Codex"), join(programFiles, "codex"));
  if (programFilesX86) candidates.push(join(programFilesX86, "Codex"), join(programFilesX86, "codex"));

  const appRoot = candidates.find((p) => existsSync(join(p, "resources", "app.asar")));
  if (!appRoot) {
    const tried = candidates.length > 0 ? candidates.join("\n  ") : "(no default locations available)";
    throw new Error(
      `[!] Codex App Not Found\n\n` +
        `Ensure Codex is installed in one of the default Windows locations.\n` +
        `Tried:\n  ${tried}\n\n` +
        `If Codex is somewhere else, rerun with --app pointing at its install folder.`,
    );
  }
  const resourcesDir = join(appRoot, "resources");
  return {
    appRoot,
    resourcesDir,
    asarPath: join(resourcesDir, "app.asar"),
    metaPath: null,
    electronBinary: join(appRoot, "Codex.exe"),
    executable: join(appRoot, "Codex.exe"),
    platform: "win32",
  };
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
    platform: "linux",
  };
}
