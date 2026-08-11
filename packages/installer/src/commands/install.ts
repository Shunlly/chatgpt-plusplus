import kleur from "kleur";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, writeFileSync, mkdirSync, openSync, closeSync, unlinkSync, readdirSync, rmSync, copyFileSync, renameSync, chmodSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDedicatedMacApp, locateCodex, MAC_CHATGPTPP_DEFAULT, type CodexInstall } from "../platform.js";
import { ensureUserPaths } from "../paths.js";
import { backupOnce, patchAsar, readFileInAsar, readHeaderHash } from "../asar.js";
import { setIntegrity, getIntegrity } from "../integrity.js";
import { writeFuse } from "../fuses.js";
import { clearQuarantine, prepareCodeSigning, signCodexApp, signatureInfo } from "../codesign.js";
import { readPlist, writePlist } from "../plist.js";
import { writeState } from "../state.js";
import { installWatcher, type WatcherKind } from "../watcher.js";
import { CHATGPT_PLUSPLUS_VERSION, compareSemver } from "../version.js";
import { formatCliShimResult, installCliShims } from "../cli-shim.js";
import { findSourceRoot } from "../source-root.js";
import { isStandalone, persistStandaloneCli, standaloneAssetsDir, standaloneResourcesRoot, standaloneSourceRoot } from "../standalone.js";
import {
  CODEX_WINDOW_SERVICES_KEY,
  describeCodexWindowServicesSource,
  patchCodexWindowServicesSource,
  type CodexWindowServicesSourceDiagnostics,
} from "../codex-window-services.js";
import { chownForTargetUser } from "../ownership.js";
import { getOpenReport, type OpenReport } from "./debug.js";
import { openCodex, quitCodex } from "../alerts.js";

interface Opts {
  app?: string;
  fuse?: boolean; // sade --no-fuse → fuse: false
  resign?: boolean;
  localSigning?: boolean;
  watcher?: boolean;
  watcherKind?: WatcherKind;
  quiet?: boolean;
  verbose?: boolean;
}

const here = dirname(fileURLToPath(import.meta.url));

// 独立包模式下优先取持久副本根目录：macOS 克隆流程会覆盖安装器 app，
// 其旁置的 assets/tweaks/standalone.json 会随克隆消失，持久副本在用户目录。
function resolveAssetsDir(): string {
  const root = standaloneResourcesRoot();
  return root ? join(root, "assets") : standaloneAssetsDir() ?? resolve(here, "..", "..", "assets");
}
function resolveSourceRoot(): string {
  return standaloneResourcesRoot() ?? standaloneSourceRoot() ?? findSourceRoot(here);
}
export async function install(opts: Opts = {}): Promise<void> {
  const wantsFuseFlip = opts.fuse !== false;
  const resign = opts.resign !== false;
  let localSigning = opts.localSigning === true;
  const wantWatcher = opts.watcher !== false;

  const step = makeStepper({ quiet: opts.quiet === true, verbose: opts.verbose === true });
  // 独立包模式：先把 CLI 复制到用户目录，避免克隆流程覆盖安装器 app 后失去修复入口。
  if (isStandalone()) {
    const persistentCli = persistStandaloneCli();
    if (persistentCli) step(`CLI: ${kleur.cyan(persistentCli)}`);
  }
  const codex = ensureDedicatedApp(locateCodex(opts.app), step);
  const fuseFlip = shouldFlipElectronFuse(codex, wantsFuseFlip);
  const codexVersion = readCodexVersion(codex.metaPath);
  step(`${codex.appName}: ${kleur.cyan(codex.appRoot)}${codexVersion ? ` (${kleur.cyan(codexVersion)}, ${codex.channel})` : ` (${codex.channel})`}`);
  if (wantsFuseFlip && !fuseFlip) {
    step.detail("Skipping Electron fuse flip; Electron Framework binary was not found");
  }
  preflightSystemTools(codex.platform, resign, codex.metaPath !== null);
  const reopenAfterPatch = preflightAppClosed(codex, step);

  // Pre-flight every app-bundle target we will mutate so permission failures
  // surface before we patch app.asar or touch backups.
  preflightWritableTargets(codex, { fuseFlip });
  step.detail("Bundle writable");

  let preparedSigning: ReturnType<typeof prepareCodeSigning> = null;
  if (resign && codex.platform === "darwin") {
    try {
      preparedSigning = prepareCodeSigning({ useLocalIdentity: localSigning });
    } catch (e) {
      if (!localSigning) throw e;
      localSigning = false;
      console.warn(
        kleur.yellow(
          `Local signing setup failed; falling back to ad-hoc signing.\n${(e as Error).message}`,
        ),
      );
    }
  }

  const paths = ensureUserPaths();
  step.detail(`User dir: ${kleur.cyan(paths.root)}`);
  step(formatCliStep(formatCliShimResult(installCliShims(paths.binDir))));
  const launcher = installWindowsManagedAppLauncher(codex);
  if (launcher) step(`Installed patched ChatGPT++ launcher${launcher.shortcutPaths.length === 1 ? "" : "s"}: ${launcher.shortcutPaths.map((p) => kleur.cyan(p)).join(", ")}`);

  // 1. Backup originals.
  const pristineAppBackup = codex.platform === "darwin" ? join(paths.backup, "Codex.app") : null;
  const backupAsar = join(paths.backup, "app.asar");
  const backupAsarUnpacked = join(paths.backup, "app.asar.unpacked");
  const backupPlist = codex.metaPath ? join(paths.backup, "Info.plist") : null;
  const backupFramework = join(paths.backup, "Electron Framework");
  let appBackupRefreshed = false;
  if (pristineAppBackup) {
    appBackupRefreshed = backupUnpatchedApp(codex.appRoot, pristineAppBackup, {
      hasPatchMarker: hasChatgptPlusPlusAsarMarker(codex.asarPath),
      step: step.detail,
    });
  }
  backupOnce(codex.asarPath, backupAsar);
  if (existsSync(`${codex.asarPath}.unpacked`)) {
    backupOnce(`${codex.asarPath}.unpacked`, backupAsarUnpacked);
  }
  if (codex.metaPath && backupPlist) backupOnce(codex.metaPath, backupPlist);
  if (fuseFlip) backupOnce(codex.electronBinary, backupFramework);
  step(appBackupRefreshed ? "Backup refreshed" : "Backup ready");

  const { headerHash: originalAsarHash } = readHeaderHash(codex.asarPath);

  // 2. Stage runtime + loader into the user dir.
  stageAssets(paths.runtime);
  step("Runtime staged");
  stageTweaks(paths.tweaks);
  step.detail(`Tweaks: ${kleur.cyan(paths.tweaks)}`);

  // 3. Patch app.asar entry point to require our loader.
  const originalEntry = await injectLoader(codex.asarPath, step.detail);
  const { headerHash: patchedAsarHash } = readHeaderHash(codex.asarPath);
  step.detail(`Patched app.asar (entry was ${kleur.dim(originalEntry)})`);

  // 4. Update Info.plist hash so Electron's integrity check passes.
  if (codex.metaPath) {
    setIntegrity(codex, patchedAsarHash);
    step.detail(`Updated ElectronAsarIntegrity → ${kleur.dim(patchedAsarHash.slice(0, 12))}…`);
  }

  // 5. Belt-and-suspenders: flip the integrity validation fuse off.
  let fuseFlipped = false;
  if (fuseFlip) {
    try {
      const r = writeFuse(
        codex.electronBinary,
        "EnableEmbeddedAsarIntegrityValidation",
        "off",
      );
      step.detail(`Fuse EnableEmbeddedAsarIntegrityValidation: ${r.from} → ${r.to}`);
      fuseFlipped = true;
    } catch (e) {
      console.warn(kleur.yellow(`Fuse flip failed: ${(e as Error).message}`));
    }
  }
  step("App patched");

  // 6. Re-sign on macOS.
  let resigned = false;
  let signingMode: "local-identity" | "adhoc" | undefined;
  let signingIdentity: string | undefined;
  let signingIdentityHash: string | undefined;
  if (resign && codex.platform === "darwin") {
    clearQuarantine(codex.appRoot);
    const signing = signCodexApp(codex.appRoot, {
      useLocalIdentity: localSigning,
      preparedIdentity: preparedSigning,
    });
    resigned = true;
    signingMode = signing?.mode;
    signingIdentity = signing?.identity;
    signingIdentityHash = signing?.identityHash;
    if (signing?.mode === "local-identity") {
      step(
        `Signing: ${signing.createdIdentity ? "created local identity" : "local identity"} ${kleur.cyan(signing.identity)}`,
      );
    } else {
      step("Signing: ad-hoc");
    }
  }

  // 7. Auto-repair watcher.
  let watcher: WatcherKind = opts.watcherKind ?? "none";
  if (wantWatcher) {
    try {
      watcher = installWatcher(codex.appRoot);
      step(`Watcher: ${watcher}`);
    } catch (e) {
      console.warn(kleur.yellow(`Watcher install failed: ${(e as Error).message}`));
    }
  }

  // 8. Persist state.
  writeState(paths.stateFile, {
    version: CHATGPT_PLUSPLUS_VERSION,
    installedAt: new Date().toISOString(),
    appRoot: codex.appRoot,
    originalAsarHash,
    patchedAsarHash,
    codexVersion,
    codexChannel: codex.channel,
    codexBundleId: codex.bundleId,
    fuseFlipped,
    resigned,
    signingMode,
    signingIdentity,
    signingIdentityHash,
    originalEntryPoint: originalEntry,
    watcher,
    sourceRoot: resolveSourceRoot(),
  });
  chownForTargetUser(paths.root, { recursive: true });
  if (reopenAfterPatch) {
    openCodex(codex.appRoot, { detached: true, delayMs: 1_000 });
    step("Codex reopened");
  }

  if (!opts.quiet) {
    console.log();
    console.log(kleur.green().bold("✓ chatgpt-plusplus installed."));
    console.log(`  Tweaks: ${kleur.cyan(paths.tweaks)}`);
    console.log(`  Logs:   ${kleur.cyan(paths.logDir)}`);
    if (launcher) {
      console.log(`  Launch ${kleur.cyan("ChatGPT++")} from Start Menu or Desktop.`);
      console.log(`  Opening the Microsoft Store ${kleur.cyan("Codex")} app directly will launch the unpatched app.`);
    } else {
      console.log();
      console.log(
        codex.platform === "darwin"
          ? `  Launch ${kleur.cyan(basename(codex.appRoot, ".app"))}; the Tweaks tab will appear in Settings.`
          : `  Launch ChatGPT normally; the Tweaks tab will appear in Settings.`,
      );
      console.log();
    }
  }
}

/**
 * 独立副本模式（macOS）：把源 Codex/ChatGPT 应用复制成 ChatGPT++.app 并改
 * bundle id，后续 patch、签名、启动全部作用于副本，原版应用不被改动。
 */
export function ensureDedicatedApp(
  codex: CodexInstall,
  step: { detail?: (msg: string) => void; (msg: string): void } = () => {},
): CodexInstall {
  if (codex.platform !== "darwin") return codex;

  const homeTarget = join(homedir(), "Applications", "ChatGPT++.app");
  const targetRoot = [MAC_CHATGPTPP_DEFAULT, homeTarget].find((p) => existsSync(p)) ?? MAC_CHATGPTPP_DEFAULT;

  // codex 就是副本（watcher/repair 用 --app 指定副本）：确保启动器后直接复用。
  if (codex.appRoot === targetRoot && isDedicatedMacApp(codex.appRoot)) {
    step(`Using dedicated ${kleur.cyan(targetRoot)}`);
    ensureIsolatedLauncher(targetRoot);
    return codex;
  }

  // 安装器 app（com.chatgptplusplus.installer）不满足 isMacCodexApp，
  // locateCodex 不会返回它，但目标位置可能还残留安装器自身：必须重建。
  // 副本落后于原版（ChatGPT 更新过）时也重建，保证 ChatGPT++ 同步新版。
  const existing = existsSync(targetRoot) && isDedicatedMacApp(targetRoot) ? locateCodex(targetRoot) : null;
  const needsClone =
    !existsSync(targetRoot) ||
    !isDedicatedMacApp(targetRoot) ||
    isMacCopyBroken(targetRoot) ||
    compareSemver(readCodexVersion(codex.metaPath) ?? "", readCodexVersion(existing?.metaPath ?? null) ?? "") > 0;
  if (!needsClone) {
    step(`Using dedicated ${kleur.cyan(targetRoot)}`);
    ensureIsolatedLauncher(targetRoot);
    return locateCodex(targetRoot);
  }

  const reason = !existsSync(targetRoot)
    ? "not found"
    : !isDedicatedMacApp(targetRoot)
      ? "not a patched copy"
      : isMacCopyBroken(targetRoot)
        ? "binary corrupted"
        : "source app is newer";
  step(`Cloning ${kleur.cyan(codex.appRoot)} to ${kleur.cyan(targetRoot)} (${reason})`);
  rmSync(targetRoot, { recursive: true, force: true });
  execFileSync("ditto", [codex.appRoot, targetRoot], { stdio: "ignore" });
  const plistPath = join(targetRoot, "Contents", "Info.plist");
  const pl = readPlist(plistPath);
  pl.CFBundleDisplayName = "ChatGPT++";
  pl.CFBundleName = "ChatGPT++";
  pl.CFBundleIdentifier = "com.openai.chatgptpp";
  writePlist(plistPath, pl);
  ensureIsolatedLauncher(targetRoot);
  step.detail?.("Renamed bundle to ChatGPT++ (com.openai.chatgptpp)");
  return locateCodex(targetRoot);
}

/**
 * 副本与原版共享硬编码的 ~/Library/Application Support/Codex 数据目录，
 * 会触发单实例锁冲突导致打不开。用 Mach-O 启动器给真实二进制追加
 * --user-data-dir 指向独立目录（原生层生效，JS setPath 无法覆盖）。
 */
/** 是否为我们的 Mach-O 启动器（编译产物含独立数据目录路径字面量）。 */
export function isOurIsolatedLauncher(binaryPath: string): boolean {
  try {
    return readFileSync(binaryPath).includes(Buffer.from("Application Support/ChatGPT++"));
  } catch {
    return false;
  }
}

/**
 * 副本完整性检查：真实二进制（ChatGPT.bin）必须不是我们的启动器。
 * 若 .bin 已是启动器，说明真二进制已丢失（中断的重装），需要重建副本。
 */
export function isMacCopyBroken(appRoot: string): boolean {
  const realBinary = join(appRoot, "Contents", "MacOS", "ChatGPT.bin");
  return existsSync(realBinary) && isOurIsolatedLauncher(realBinary);
}

/**
 * 副本与原版共享硬编码的 ~/Library/Application Support/Codex 数据目录，
 * 会触发单实例锁冲突导致打不开。用 Mach-O 启动器给真实二进制追加
 * --user-data-dir 指向独立目录（原生层生效，JS setPath 无法覆盖）。
 */
function ensureIsolatedLauncher(appRoot: string): void {
  const macosDir = join(appRoot, "Contents", "MacOS");
  const launcher = join(macosDir, "ChatGPT");
  const realBinary = join(macosDir, "ChatGPT.bin");
  if (!existsSync(launcher)) {
    throw new Error(`找不到 ${launcher}，无法安装独立数据目录启动器。`);
  }
  // 防呆：.bin 已是启动器意味着真二进制已丢失，必须重建副本而非继续。
  if (existsSync(realBinary) && isOurIsolatedLauncher(realBinary)) {
    throw new Error(`${appRoot} 的 ChatGPT.bin 不是真实二进制（启动器覆盖了真二进制），需要重建副本。`);
  }
  if (existsSync(realBinary)) {
    // .bin 是真二进制：确保 launcher 是最新启动器（旧版分离参数会被 Chromium 忽略）。
    if (isOurIsolatedLauncher(launcher)) return;
    compileIsolatedLauncher(launcher);
    return;
  }
  renameSync(launcher, realBinary);
  compileIsolatedLauncher(launcher);
}

function compileIsolatedLauncher(launcher: string): void {
  execFileSync("clang", ["-O2", "-o", launcher, "-x", "c", "-"], {
    input: LAUNCHER_C,
    stdio: ["pipe", "ignore", "ignore"],
  });
  chmodSync(launcher, 0o755);
}

// ponytail: 单架构启动器，按本机架构编译；需要同时支持 x64 mac 时用
// clang -arch arm64 -arch x86_64 编译通用二进制。
const LAUNCHER_C = `#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

int main(int argc, char **argv) {
  const char *home = getenv("HOME");
  if (!home) home = "/";
  char ud[4096];
  snprintf(ud, sizeof(ud), "%s/Library/Application Support/ChatGPT++", home);
  char real[4096];
  const char *slash = strrchr(argv[0], '/');
  if (slash) {
    snprintf(real, sizeof(real), "%.*s/ChatGPT.bin", (int)(slash - argv[0]), argv[0]);
  } else {
    snprintf(real, sizeof(real), "./ChatGPT.bin");
  }
  // 必须用 "=" 形式且作为单个参数：路径含空格时分离形式会被 Chromium 截断。
  char udflag[4608];
  snprintf(udflag, sizeof(udflag), "--user-data-dir=%s", ud);
  char **args = malloc((size_t)(argc + 2) * sizeof(char *));
  if (!args) return 127;
  args[0] = argv[0];
  args[1] = udflag;
  for (int i = 1; i < argc; i++) args[i + 1] = argv[i];
  args[argc + 1] = NULL;
  execv(real, args);
  perror("execv");
  return 127;
}
`;

export function readCodexVersion(metaPath: string | null): string | null {
  if (!metaPath || !existsSync(metaPath)) return null;
  try {
    const pl = readPlist(metaPath);
    return (pl["CFBundleShortVersionString"] as string) ?? null;
  } catch {
    return null;
  }
}

export function shouldFlipElectronFuse(
  codex: Pick<CodexInstall, "electronBinary">,
  requested: boolean,
): boolean {
  return requested && existsSync(codex.electronBinary);
}

export function shouldBackupUnpatchedApp(input: { hasPatchMarker: boolean; signature: ReturnType<typeof signatureInfo> }): boolean {
  if (input.hasPatchMarker) return false;
  return input.signature.ok;
}

export function backupUnpatchedApp(
  appRoot: string,
  backupPath: string,
  opts: { hasPatchMarker: boolean; step?: (msg: string) => void },
): boolean {
  const sig = signatureInfo(appRoot);
  if (!shouldBackupUnpatchedApp({ hasPatchMarker: opts.hasPatchMarker, signature: sig })) return false;

  rmSync(backupPath, { recursive: true, force: true });
  execFileSync("ditto", [appRoot, backupPath], { stdio: "ignore" });
  opts.step?.(`Backed up unpatched Codex.app to ${kleur.cyan(backupPath)}`);
  return true;
}

export function hasChatgptPlusPlusAsarMarker(asarPath: string): boolean {
  try {
    const pkg = JSON.parse(readFileInAsar(asarPath, "package.json").toString("utf8")) as {
      main?: unknown;
      __codexpp?: unknown;
    };
    return (
      pkg.main === "chatgpt-plusplus-loader.cjs" ||
      pkg.main === "codex-plusplus-loader.cjs" ||
      typeof pkg.__codexpp === "object"
    );
  } catch {
    return false;
  }
}

/**
 * Replace app.asar's package.json `main` with our loader, copying the
 * loader.cjs into the asar so it can resolve. Returns the original entry path.
 */
async function injectLoader(
  asarPath: string,
  step: (msg: string) => void = () => {},
): Promise<string> {
  let originalMain = "";
  await patchAsar(asarPath, (dir) => {
    const pkgPath = join(dir, "package.json");
    if (!existsSync(pkgPath)) {
      throw new Error("app.asar has no package.json — Codex layout changed?");
    }
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    originalMain = String(pkg.main ?? "");
    if (!originalMain) throw new Error("app.asar package.json has no `main` field");

    // 已打过补丁时保留原入口并刷新 loader 指向；不再写入 userRoot——
    // 用户数据目录由 loader 按“当前运行用户”动态推导，避免 DMG/EXE
    // 换机器安装后指向打包机的绝对路径导致应用裸跑、tweak 全部丢失。
    if (pkg["__codexpp"]) {
      originalMain = String(pkg["__codexpp"].originalMain);
    }
    pkg["__codexpp"] = {
      originalMain,
      loader: "chatgpt-plusplus-loader.cjs",
    };
    pkg.main = "chatgpt-plusplus-loader.cjs";
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

    // Copy our loader stub into the asar root.
    const loaderSrc = join(resolveAssetsDir(), "loader.cjs");
    if (!existsSync(loaderSrc)) {
      // Fall back to the in-repo path during development.
      const devLoader = resolve(here, "..", "..", "..", "..", "loader", "loader.cjs");
      if (!existsSync(devLoader)) {
        throw new Error(`loader.cjs not found at ${loaderSrc} or ${devLoader}`);
      }
      cpSync(devLoader, join(dir, "chatgpt-plusplus-loader.cjs"));
    } else {
      cpSync(loaderSrc, join(dir, "chatgpt-plusplus-loader.cjs"));
    }

    patchCodexWindowServices(dir, originalMain, step);
  });
  return originalMain;
}

interface CodexWindowServicesCandidateDiagnostic {
  relativePath: string;
  bytes: number;
  diagnostics: CodexWindowServicesSourceDiagnostics;
  parserError?: string;
}

function patchCodexWindowServices(
  appDir: string,
  originalMain: string,
  step: (msg: string) => void = () => {},
): void {
  const candidates = findCodexMainCandidates(appDir, originalMain);
  const candidateNames = candidates.map((p) => relative(appDir, p) || basename(p));
  step(
    `Scanning Codex window services hook candidates (${candidates.length}): ${
      candidateNames.length ? candidateNames.map((p) => kleur.dim(p)).join(", ") : kleur.yellow("none")
    }`,
  );
  const diagnostics: CodexWindowServicesCandidateDiagnostic[] = [];

  for (const mainPath of candidates) {
    const source = readFileSync(mainPath, "utf8");
    const relativePath = relative(appDir, mainPath) || basename(mainPath);
    const candidateDiagnostic: CodexWindowServicesCandidateDiagnostic = {
      relativePath,
      bytes: source.length,
      diagnostics: describeCodexWindowServicesSource(source, CODEX_WINDOW_SERVICES_KEY),
    };
    diagnostics.push(candidateDiagnostic);

    let patched: ReturnType<typeof patchCodexWindowServicesSource> = null;
    try {
      patched = patchCodexWindowServicesSource(source, CODEX_WINDOW_SERVICES_KEY);
    } catch (e) {
      candidateDiagnostic.parserError = (e as Error).message;
      continue;
    }

    if (patched) {
      if (patched.changed) writeFileSync(mainPath, patched.source);
      step(
        `Exposed Codex window services from ${kleur.dim(relativePath)} using ${kleur.cyan(patched.strategy)}${
          patched.serviceVar ? ` (${patched.serviceVar})` : ""
        }`,
      );
      return;
    }
  }

  throw new Error(formatWindowServicesHookFailure(originalMain, diagnostics));
}

export function findCodexMainCandidates(appDir: string, originalMain: string): string[] {
  const originalPath = resolve(appDir, originalMain);
  const out = existsSync(originalPath) ? [originalPath] : [];
  const buildDir = resolve(appDir, ".vite", "build");
  const roots: Array<{ dir: string; recursive: boolean }> = [
    { dir: appDir, recursive: false },
    { dir: buildDir, recursive: true },
  ];
  const originalDir = dirname(originalPath);
  if (originalDir !== appDir && !isSameOrInside(originalDir, buildDir)) {
    roots.push({ dir: originalDir, recursive: true });
  }

  const discovered = roots
    .flatMap((root) => collectJavaScriptFiles(root.dir, root.recursive))
    .sort((a, b) => {
      const rank = candidateRank(basename(a)) - candidateRank(basename(b));
      if (rank !== 0) return rank;
      const name = basename(a).localeCompare(basename(b));
      if (name !== 0) return name;
      return relative(appDir, a).localeCompare(relative(appDir, b));
    });

  const seen = new Set(out);
  for (const candidate of discovered) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    out.push(candidate);
  }
  return out;
}

function candidateRank(name: string): number {
  if (/^main(?:[-.].*)?\.js$/.test(name)) return 0;
  if (/^bootstrap(?:[-.].*)?\.js$/.test(name)) return 1;
  if (/^(app|desktop|src)(?:[-.].*)?\.js$/.test(name)) return 2;
  if (/preload|worker|service/i.test(name)) return 4;
  return 3;
}

function collectJavaScriptFiles(dir: string, recursive: boolean): string[] {
  const out: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const target = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (recursive) out.push(...collectJavaScriptFiles(target, true));
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        out.push(target);
      }
    }
  } catch {}
  return out;
}

function isSameOrInside(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (rel !== "" && !rel.startsWith("..") && !isAbsolute(rel));
}

function formatWindowServicesHookFailure(
  originalMain: string,
  diagnostics: CodexWindowServicesCandidateDiagnostic[],
): string {
  const lines = [
    "Codex window services hook point not found.",
    "",
    "ChatGPT++ could not identify ChatGPT's main-process window services factory.",
    "This usually means Codex changed its bundled main-process layout or renamed the service object properties.",
    "",
    `Original entry point: ${originalMain}`,
    `Candidate files scanned: ${diagnostics.length}`,
  ];

  if (diagnostics.length === 0) {
    lines.push("No candidate files existed inside app.asar.");
    return lines.join("\n");
  }

  for (const candidate of diagnostics) {
    const fingerprints = candidate.diagnostics.matchedFingerprints;
    lines.push(
      "",
      `Candidate: ${candidate.relativePath}`,
      `  Bytes: ${candidate.bytes}`,
      `  Marker already present: ${candidate.diagnostics.hasMarker ? "yes" : "no"}`,
      `  Object factory calls: ${candidate.diagnostics.objectCalls}`,
      `  buildFlavor properties: ${candidate.diagnostics.buildFlavorProperties}`,
      `  Window-service fingerprints: ${fingerprints.length ? fingerprints.join(", ") : "none"}`,
    );
    if (candidate.parserError) {
      lines.push(`  Parser error: ${candidate.parserError}`);
    }
    if (candidate.diagnostics.snippet) {
      lines.push(`  Nearby source: ${candidate.diagnostics.snippet}`);
    }
  }

  return lines.join("\n");
}

/**
 * 把安装包内置的 tweaks（如 Dream Skin 皮肤）复制到用户 tweaks 目录；
 * 已存在同名目录时保留不动，仅当内置 tweak 的 manifest 版本号高于已装
 * 版本时覆盖升级（用户自定义 tweak 或同版本本地修改不被覆盖）。
 * 非独立安装且有仓库 tweaks 时同样生效。
 */
export function stageTweaks(tweaksDir: string): void {
  const candidates = [
    // 独立包：<Resources>/tweaks
    join(dirname(resolveAssetsDir()), "tweaks"),
    // 源码安装：仓库根目录 tweaks
    resolve(here, "..", "..", "..", "..", "tweaks"),
  ];
  const src = candidates.find(existsSync);
  if (!src) return;
  mkdirSync(tweaksDir, { recursive: true });
  for (const entry of readdirSync(src)) {
    const from = join(src, entry);
    if (!statSync(from).isDirectory()) continue;
    const to = join(tweaksDir, entry);
    // 旧版本会把仓库 tweaks 以软链接方式安装；与真实目录并存会导致
    // 同一 manifest.id 被加载两次，统一替换为真实副本。
    if (existsSync(to)) {
      const st = statSync(to);
      if (!st.isDirectory()) {
        unlinkSync(to);
      } else if (compareSemver(tweakManifestVersion(from), tweakManifestVersion(to)) <= 0) {
        continue;
      } else {
        rmSync(to, { recursive: true, force: true });
      }
    }
    cpSync(from, to, { recursive: true });
  }
  chownForTargetUser(tweaksDir, { recursive: true });
}

/** 读取 tweak 的 manifest 版本号，读取失败视为 0.0.0。 */
function tweakManifestVersion(dir: string): string {
  try {
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as {
      version?: unknown;
    };
    return typeof manifest.version === "string" ? manifest.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export function stageAssets(runtimeDir: string): void {
  mkdirSync(runtimeDir, { recursive: true });
  const src = join(resolveAssetsDir(), "runtime");
  if (existsSync(src)) {
    cpSync(src, runtimeDir, { recursive: true });
    chownForTargetUser(runtimeDir, { recursive: true });
    return;
  }
  // Dev fallback: copy from the in-tree built runtime.
  const devSrc = resolve(here, "..", "..", "..", "..", "runtime", "dist");
  if (existsSync(devSrc)) {
    cpSync(devSrc, runtimeDir, { recursive: true });
    chownForTargetUser(runtimeDir, { recursive: true });
    return;
  }
  throw new Error(
    `Runtime assets not found. Expected at ${src} (built package) or ${devSrc} (dev).\n` +
      `Run \`npm run build\` from the workspace root.`,
  );
}

interface Stepper {
  (msg: string): void;
  detail(msg: string): void;
}

function makeStepper(opts: { quiet?: boolean; verbose?: boolean } = {}): Stepper {
  let n = 1;
  const emit = (msg: string) => {
    if (!opts.quiet) console.log(`${kleur.dim(`[${n++}]`)} ${msg}`);
  };
  const step = emit as Stepper;
  step.detail = (msg: string) => {
    if (opts.verbose) emit(msg);
  };
  return step;
}

function formatCliStep(message: string): string {
  return message.replace(/^Installed CLI(?::)?/, "CLI");
}

export function preflightWritableTargets(
  codex: Pick<CodexInstall, "resourcesDir" | "asarPath" | "metaPath" | "electronBinary" | "platform">,
  opts: { fuseFlip: boolean },
): void {
  preflightWritableDirectory(codex.resourcesDir, codex.platform);
  preflightWritableFile(codex.asarPath, codex.platform);
  if (codex.metaPath) preflightWritableFile(codex.metaPath, codex.platform);
  if (opts.fuseFlip) preflightWritableFile(codex.electronBinary, codex.platform);
}

/**
 * Touch a probe file inside the app bundle to surface (and trigger) macOS
 * App Management TCC denials before we begin destructive work.
 */
function preflightWritableDirectory(targetDir: string, platform: string): void {
  const probe = join(targetDir, ".codexpp-write-probe");
  const copyProbe = join(targetDir, ".codexpp-copy-probe");
  try {
    const fd = openSync(probe, "w");
    closeSync(fd);
    copyFileSync(probe, copyProbe);
    unlinkSync(probe);
    unlinkSync(copyProbe);
  } catch (e) {
    try {
      unlinkSync(probe);
    } catch {}
    try {
      unlinkSync(copyProbe);
    } catch {}
    throw writableError(e, targetDir, platform);
  }
}

function preflightWritableFile(targetFile: string, platform: string): void {
  try {
    const fd = openSync(targetFile, "r+");
    closeSync(fd);
  } catch (e) {
    throw writableError(e, targetFile, platform);
  }
}

function writableError(e: unknown, target: string, platform: string): unknown {
  const err = e as NodeJS.ErrnoException;
  if (err.code !== "EPERM" && err.code !== "EACCES") return e;

  const isMac = platform === "darwin";
  const inWindowsApps =
    platform === "win32" && /\\WindowsApps\\/i.test(`${target}\\`);
  const msg =
    `Cannot write to ${target}.\n\n` +
    (isMac
      ? macAppManagementFix(target, err.code)
      : inWindowsApps
        ? `Windows Store installs live under WindowsApps and Windows is blocking the patch write.\n` +
          `Fix:\n` +
          `  1. Quit Codex completely\n` +
          `  2. Re-open PowerShell as Administrator\n` +
          `  3. Re-run this command.\n\n` +
          `If Administrator still cannot write here, this Store install is locked by Windows package protections.\n` +
          `Use a writable Codex install folder and rerun with --app pointing at it.\n`
        : `Check filesystem permissions for the Codex install folder.\n`) +
    `\nOriginal error: ${err.message}`;
  return new Error(msg);
}

function macAppManagementFix(target: string, code: string | undefined): string {
  const permissionSteps =
    `macOS App Management is blocking modification of ${target}.\n` +
    `Run "chatgptplusplus repair" in your terminal.\n`;
  const sudoFallback =
    code === "EACCES"
      ? `If ChatGPT.app is root-owned and repair still cannot write to it, run "sudo chatgptplusplus repair".\n`
      : "";

  return permissionSteps + sudoFallback;
}

export function assertCodexNotRunning(
  codex: CodexInstall,
  open: OpenReport = getOpenReport(codex),
): void {
  if (open.status === "closed") return;
  if (open.hasMainProcess === false) return;

  throw new Error(formatCodexRunningError(codex, open));
}

export interface PrepareCodexForPatchingController {
  getOpenReport?: (codex: CodexInstall) => OpenReport;
  quitCodex?: (appRoot: string) => void;
  step?: (msg: string) => void;
}

export function prepareCodexForPatching(
  codex: CodexInstall,
  controller: PrepareCodexForPatchingController = {},
): boolean {
  const readOpenReport = controller.getOpenReport ?? getOpenReport;
  const open = readOpenReport(codex);
  if (open.status === "closed") return false;
  if (open.hasMainProcess === false) return false;

  const quit = controller.quitCodex ?? quitCodex;
  if (codex.platform === "darwin") {
    controller.step?.("Codex is running; quitting it before patching");
    quit(codex.appRoot);
    assertCodexNotRunning(codex, readOpenReport(codex));
    return true;
  }

  if (codex.platform === "win32") {
    // Windows 版与 mac 版行为对齐：安装时自动终止正在运行的 ChatGPT，
    // 避免用户手动关不干净导致安装失败。
    controller.step?.("ChatGPT is running; terminating it before patching");
    quitWindowsCodex(codex, readOpenReport);
    assertCodexNotRunning(codex, readOpenReport(codex));
    return true;
  }

  throw new Error(formatCodexRunningError(codex, open));
}

/** Windows：taskkill 终止整个进程树，然后轮询等待退出（最长 8 秒）。 */
function quitWindowsCodex(
  codex: CodexInstall,
  readOpenReport: (codex: CodexInstall) => OpenReport,
): void {
  try {
    execFileSync("taskkill.exe", ["/IM", basename(codex.executable), "/T", "/F"], {
      stdio: "ignore",
    });
  } catch {
    // 进程可能刚好已退出，继续轮询确认。
  }
  const startedAt = Date.now();
  while (Date.now() - startedAt < 8_000) {
    const open = readOpenReport(codex);
    if (open.status === "closed" || open.hasMainProcess === false) return;
    sleepSync(500);
  }
}

function sleepSync(ms: number): void {
  // Node 主线程同步等待：SharedArrayBuffer + Atomics.wait，无需额外依赖。
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function formatCodexRunningError(codex: CodexInstall, open: OpenReport): string {
  const status = open.status === "unknown" ? "running" : open.status;
  const pid = open.pid === null ? "" : `\n  PID: ${open.pid}`;
  const openedAt = open.openedAt ?? open.openedAtRaw;
  const opened = openedAt ? `\n  Opened at: ${openedAt}` : "";
  const related = formatRelatedPids(open.relatedPids);
  const stuckCommand =
    codex.platform === "win32" && open.pid !== null
      ? `\nIf it is stuck, run:\n  Stop-Process -Id ${open.pid}\n`
      : "";

  return (
    `[!] Close Codex before patching\n\n` +
    `Codex is currently ${status}:\n` +
    `  ${codex.appName}\n` +
    `  ${codex.appRoot}${pid}${opened}${related}\n\n` +
    `ChatGPT++ cannot safely patch app.asar while ChatGPT is running. ` +
    `Changing the bundle underneath an active process can make lazy-loaded Codex surfaces crash until restart.\n\n` +
    `Quit Codex completely, then rerun this command from Terminal.\n` +
    stuckCommand
  );
}

function formatRelatedPids(pids: number[]): string {
  if (pids.length === 0) return "";
  const shown = pids.slice(0, 12).join(", ");
  const more = pids.length > 12 ? `, +${pids.length - 12} more` : "";
  return `\n  Related PIDs: ${shown}${more}`;
}

function preflightAppClosed(codex: CodexInstall, step: (msg: string) => void): boolean {
  return prepareCodexForPatching(codex, { step });
}

function escapePowerShellSingleQuotedString(value: string): string {
  return value.replace(/'/g, "''");
}

function installWindowsManagedAppLauncher(codex: CodexInstall): { shortcutPaths: string[] } | null {
  if (codex.platform !== "win32") return null;
  if (
    !/\\chatgpt-plusplus\\store-apps\\/i.test(`${codex.appRoot.replace(/\//g, "\\")}\\`) &&
    !/\\codex-plusplus\\store-apps\\/i.test(`${codex.appRoot.replace(/\//g, "\\")}\\`)
  ) {
    return null;
  }

  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return null;

  const shimDir = join(localAppData, "Microsoft", "WindowsApps");
  mkdirSync(shimDir, { recursive: true });
  const commandPath = join(shimDir, "chatgpt-plusplus-codex.cmd");
  writeFileSync(
    commandPath,
    `@echo off\r\nstart "" "${codex.executable}" %*\r\n`,
    "utf8",
  );
  const shortcutPaths = [commandPath];

  const startMenuRoot = process.env.APPDATA
    ? join(process.env.APPDATA, "Microsoft", "Windows", "Start Menu", "Programs")
    : null;
  if (!startMenuRoot) return { shortcutPaths };

  const startMenuShortcut = join(startMenuRoot, "ChatGPT++.lnk");
  if (createWindowsCodexShortcut(startMenuShortcut, codex.executable)) {
    shortcutPaths.push(startMenuShortcut);
  }
  const desktopShortcut = join(homedir(), "Desktop", "ChatGPT++.lnk");
  if (createWindowsCodexShortcut(desktopShortcut, codex.executable)) {
    shortcutPaths.push(desktopShortcut);
  }

  return { shortcutPaths };
}

function createWindowsCodexShortcut(shortcutPath: string, targetPath: string): boolean {
  try {
    mkdirSync(dirname(shortcutPath), { recursive: true });
    const script = [
      `$shortcutPath = '${escapePowerShellSingleQuotedString(shortcutPath)}'`,
      `$targetPath = '${escapePowerShellSingleQuotedString(targetPath)}'`,
      `$workingDirectory = '${escapePowerShellSingleQuotedString(dirname(targetPath))}'`,
      "$shell = New-Object -ComObject WScript.Shell",
      "$shortcut = $shell.CreateShortcut($shortcutPath)",
      "$shortcut.TargetPath = $targetPath",
      "$shortcut.WorkingDirectory = $workingDirectory",
      "$shortcut.IconLocation = \"$targetPath,0\"",
      "$shortcut.Save()",
    ].join("; ");
    execFileSync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
      { stdio: "ignore" },
    );
    return true;
  } catch {
    return false;
  }
}

function preflightSystemTools(platform: string, resign: boolean, hasPlist: boolean): void {
  if (platform !== "darwin") return;
  if (resign) requireCommand("codesign", "macOS codesign is required to re-sign Codex.app after patching.");
  if (hasPlist) requireCommand("plutil", "macOS plutil is required to update Codex.app's Info.plist.");
}

function requireCommand(command: string, message: string): void {
  const result = spawnSync("/bin/sh", ["-c", `command -v ${command}`], {
    stdio: "ignore",
  });
  if (result.status !== 0) {
    throw new Error(`[!] ${command} not installed\n\n${message}\nPaste this error into Codex if you need help.`);
  }
}
