import kleur from "kleur";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { installWatcher } from "../watcher.js";
import { ensureUserPaths } from "../paths.js";
import { locateCodex } from "../platform.js";
import { readState } from "../state.js";
import { signatureInfo, verifySignature } from "../codesign.js";
import { compareSemver } from "../version.js";
import { readCodexVersion } from "./install.js";
import { writeUpdateMode } from "../update-mode.js";
import { isCodexRunning } from "../alerts.js";

interface Opts {
  app?: string;
}

interface SignedAppCandidate {
  path: string;
  version: string | null;
  source: "pristine-backup" | "sparkle-cache";
}

export async function updateCodex(opts: Opts = {}): Promise<void> {
  const paths = ensureUserPaths();
  const state = readState(paths.stateFile);
  if (!state) {
    throw new Error("No prior install state found. Run `codex-plusplus install` first.");
  }

  const codex = locateCodex(opts.app ?? state.appRoot);
  if (codex.platform !== "darwin") {
    throw new Error("codex-plusplus update-codex is only needed on macOS/Sparkle installs.");
  }

  const candidate = selectSignedAppCandidate(paths.backup, state.codexVersion);
  if (!candidate) {
    throw new Error(
      `No signed Codex.app backup or Sparkle-cached update was found.\n\n` +
        `Run the official Codex updater once, then rerun this command. If it downloads ` +
        `the update before failing, codex-plusplus can recover from Sparkle's cache.`,
    );
  }

  console.log(
    `Using ${candidate.source === "sparkle-cache" ? "Sparkle cached update" : "signed backup"}: ` +
      kleur.cyan(candidate.path),
  );
  if (candidate.version) console.log(`  Codex version: ${kleur.cyan(candidate.version)}`);

  writeUpdateMode(paths.updateModeFile, {
    enabledAt: new Date().toISOString(),
    appRoot: codex.appRoot,
    codexVersion: state.codexVersion,
  });

  installWatcher(codex.appRoot);
  const wasRunning = isCodexRunning(codex.appRoot);
  if (wasRunning) {
    console.log(kleur.yellow("Codex is running; the signed app will be restored for the next restart."));
  }

  const parked = join(paths.backup, `Codex.app.patched-${timestamp()}`);
  rmSync(parked, { recursive: true, force: true });
  console.log(`Moving patched app aside: ${kleur.cyan(parked)}`);
  execFileSync("mv", [codex.appRoot, parked], { stdio: "inherit" });

  console.log("Restoring signed Codex.app...");
  execFileSync("ditto", [candidate.path, codex.appRoot], { stdio: "inherit" });
  try {
    execFileSync("xattr", ["-dr", "com.apple.quarantine", codex.appRoot], { stdio: "ignore" });
  } catch {}

  const verify = verifySignature(codex.appRoot);
  if (!verify.ok) throw new Error(`Restored Codex.app signature is invalid:\n${verify.output}`);

  console.log(kleur.green("Signed Codex.app restored."));
  if (candidate.version && state.codexVersion && compareSemver(candidate.version, state.codexVersion) > 0) {
    console.log(kleur.dim("Codex++ will reapply after the updated app launches/restarts."));
  } else {
    console.log(kleur.dim("Run the official Codex updater now. Codex++ will reapply after the updated app restarts."));
  }
  if (wasRunning) {
    console.log(kleur.yellow("Quit and reopen Codex to continue with the signed app."));
  } else {
    execFileSync("open", [codex.appRoot], { stdio: "ignore" });
  }
}

function selectSignedAppCandidate(backupDir: string, currentVersion: string | null): SignedAppCandidate | null {
  const candidates = [
    ...findSparkleCachedApps(),
    signedCandidate(join(backupDir, "Codex.app"), "pristine-backup"),
  ].filter((c): c is SignedAppCandidate => c !== null);

  candidates.sort((a, b) => compareVersions(b.version, a.version));
  return (
    candidates.find((c) => c.version && currentVersion && compareSemver(c.version, currentVersion) > 0) ??
    candidates.find((c) => c.source === "pristine-backup") ??
    candidates[0] ??
    null
  );
}

function findSparkleCachedApps(): SignedAppCandidate[] {
  const root = join(homedir(), "Library", "Caches", "com.openai.codex", "org.sparkle-project.Sparkle");
  const out: SignedAppCandidate[] = [];
  walk(root, (path) => {
    if (basename(path) !== "Codex.app") return;
    const candidate = signedCandidate(path, "sparkle-cache");
    if (candidate) out.push(candidate);
  });
  return out;
}

function signedCandidate(path: string, source: SignedAppCandidate["source"]): SignedAppCandidate | null {
  if (!existsSync(path)) return null;
  const sig = signatureInfo(path);
  if (!sig.ok || sig.adHoc || !sig.teamIdentifier) return null;
  return {
    path,
    version: readCodexVersion(join(path, "Contents", "Info.plist")),
    source,
  };
}

function walk(root: string, visit: (path: string) => void): void {
  let names: string[];
  try {
    names = readdirSync(root);
  } catch {
    return;
  }
  for (const name of names) {
    const full = join(root, name);
    visit(full);
    if (name.endsWith(".app")) continue;
    walk(full, visit);
  }
}

function compareVersions(a: string | null, b: string | null): number {
  if (a && b) return compareSemver(a, b);
  if (a) return 1;
  if (b) return -1;
  return 0;
}

function timestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "");
}
