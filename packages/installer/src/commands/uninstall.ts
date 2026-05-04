import kleur from "kleur";
import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { locateCodex } from "../platform.js";
import { ensureUserPaths } from "../paths.js";
import { readState } from "../state.js";
import { prepareCodeSigning, signCodexApp } from "../codesign.js";
import { uninstallWatcher } from "../watcher.js";

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

  const useLocalIdentity = state?.signingMode === "local-identity";
  const preparedSigning = codex.platform === "darwin"
    ? prepareCodeSigning({ useLocalIdentity })
    : null;

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
  console.log(kleur.green("Removed watcher."));

  // Don't delete user tweaks/config — only installer state + runtime.
  rmSync(paths.runtime, { recursive: true, force: true });
  rmSync(paths.stateFile, { force: true });
  console.log(kleur.green("Cleaned up runtime + state."));
  console.log(
    kleur.dim(`Your tweaks remain at ${paths.tweaks} (delete manually if you want).`),
  );
}
