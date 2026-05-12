import kleur from "kleur";
import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { locateCodex } from "../platform.js";
import { ensureUserPaths } from "../paths.js";
import { readState } from "../state.js";
import { prepareCodeSigning, signCodexApp } from "../codesign.js";
import { uninstallWatcher } from "../watcher.js";
import { chownForTargetUser } from "../ownership.js";
import { cleanupWindowsManagedArtifacts } from "../windows-cleanup.js";

interface Opts {
  app?: string;
}

export async function uninstall(opts: Opts = {}): Promise<void> {
  const paths = ensureUserPaths();
  const state = readState(paths.stateFile);
  const codex = locateCodex(opts.app ?? state?.appRoot);

  const backupAsar = join(paths.backup, "app.asar");
  const backupAsarUnpacked = join(paths.backup, "app.asar.unpacked");
  const backupPlist = codex.metaPath ? join(paths.backup, "Info.plist") : null;
  const backupFramework = join(paths.backup, "Electron Framework");

  if (!existsSync(backupAsar)) {
    console.error(
      kleur.red(`No backup found at ${backupAsar}. Cannot safely uninstall.`),
    );
    process.exit(1);
  }

  let useLocalIdentity = state?.signingMode === "local-identity";
  let preparedSigning: ReturnType<typeof prepareCodeSigning> = null;
  if (codex.platform === "darwin") {
    try {
      preparedSigning = prepareCodeSigning({ useLocalIdentity });
    } catch (e) {
      if (!useLocalIdentity) throw e;
      useLocalIdentity = false;
      console.warn(
        kleur.yellow(
          `Local signing setup failed; falling back to ad-hoc signing.\n${(e as Error).message}`,
        ),
      );
    }
  }

  cpSync(backupAsar, codex.asarPath);
  if (existsSync(backupAsarUnpacked)) {
    cpSync(backupAsarUnpacked, `${codex.asarPath}.unpacked`, { recursive: true });
  }
  if (codex.metaPath && backupPlist && existsSync(backupPlist)) {
    cpSync(backupPlist, codex.metaPath);
  }
  if (existsSync(backupFramework)) {
    cpSync(backupFramework, codex.electronBinary);
  }
  console.log(kleur.green("Restored Codex.app from backup."));

  if (codex.platform === "darwin") {
    signCodexApp(codex.appRoot, { useLocalIdentity, preparedIdentity: preparedSigning });
    console.log(kleur.green("Re-signed restored bundle."));
  }

  uninstallWatcher();
  cleanupWindowsManagedArtifacts();
  console.log(kleur.green("Removed watcher."));

  // Don't delete user tweaks/config — only installer state + runtime.
  cleanupRuntimeAndState(paths);
  console.log(kleur.green("Cleaned up runtime + state."));
  console.log(
    kleur.dim(`Your tweaks remain at ${paths.tweaks} (delete manually if you want).`),
  );
}

export function cleanupRuntimeAndState(paths: Pick<ReturnType<typeof ensureUserPaths>, "runtime" | "stateFile">): void {
  chownForTargetUser(paths.runtime, { recursive: true });

  try {
    rmSync(paths.runtime, { recursive: true, force: true });
  } catch (error) {
    throw cleanupPermissionError(error, paths.runtime, "runtime directory");
  }

  try {
    rmSync(paths.stateFile, { force: true });
  } catch (error) {
    throw cleanupPermissionError(error, paths.stateFile, "state file");
  }
}

function cleanupPermissionError(error: unknown, path: string, label: string): Error {
  if (!isCleanupPermissionError(error)) {
    return error instanceof Error ? error : new Error(String(error));
  }

  return new Error(
    `Cannot remove Codex++ ${label} at ${path}.\n` +
      "This usually means files were left owned by root from a previous sudo install or repair.\n" +
      `Fix ownership with:\n  sudo chown -R "$(id -u)":"$(id -g)" ${shellQuote(path)}\n` +
      "Then run:\n  codexplusplus uninstall",
  );
}

function isCleanupPermissionError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    ((error as NodeJS.ErrnoException).code === "EACCES" ||
      (error as NodeJS.ErrnoException).code === "EPERM" ||
      (error as NodeJS.ErrnoException).code === "ENOTEMPTY")
  );
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
