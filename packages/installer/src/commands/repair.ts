import kleur from "kleur";
import { existsSync, readFileSync, statSync } from "node:fs";
import { platform } from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { install, readCodexVersion, stageAssets } from "./install.js";
import { ensureUserPaths } from "../paths.js";
import { readState, writeState } from "../state.js";
import { locateCodex } from "../platform.js";
import { readHeaderHash } from "../asar.js";
import { CODEX_PLUSPLUS_VERSION, compareSemver } from "../version.js";
import { installWatcher } from "../watcher.js";
import { clearUpdateMode, isUpdateModeFresh, readUpdateMode, writeUpdateMode } from "../update-mode.js";
import { findSourceRoot } from "../source-root.js";
import {
  isCodexRunning,
  openCodex,
  promptRestartCodexAfterPatch,
  promptRestartCodexAfterRuntimeUpdate,
  promptRestartCodexToRepatch,
  showCodexUpdateDetectedNotification,
  showUpdateModePausedAlert,
} from "../alerts.js";
import { fileURLToPath } from "node:url";

interface Opts {
  app?: string;
  quiet?: boolean;
  force?: boolean;
}

const here = dirname(fileURLToPath(import.meta.url));
const sourceRoot = findSourceRoot(here);

/**
 * `repair` is essentially `install` rerun, but it preserves the user's
 * config + tweaks (which `install` already does) and refreshes the watcher
 * unless the prior install explicitly had no watcher. We re-derive everything from the
 * current Codex.app on disk; the new asar/plist/framework hashes will
 * differ from those in `state.json` after a Sparkle update, so we just
 * overwrite state.
 */
export async function repair(opts: Opts = {}): Promise<void> {
  const paths = ensureUserPaths();
  const state = readState(paths.stateFile);
  if (!state) {
    if (!opts.quiet) {
      console.warn(
        kleur.yellow("No prior install state found. Running fresh install instead."),
      );
    }
  }

  let settledBeforeHashCheck = false;
  if (state && !opts.force) {
    announceCodexUpdateDetected(paths.updateModeFile, opts.app ?? state.appRoot);
    await waitForMacAppUpdateToSettle(opts.app ?? state.appRoot, opts.quiet);
    settledBeforeHashCheck = true;
    const codex = locateCodex(opts.app ?? state.appRoot);
    const updateMode = readUpdateMode(paths.updateModeFile);
    if (updateMode) {
      const codexVersion = readCodexVersion(codex.metaPath);
      if (codexVersion === updateMode.codexVersion && isUpdateModeFresh(updateMode)) {
        const watcher = refreshWatcher(state.watcher, codex.appRoot, opts.quiet);
        writeState(paths.stateFile, { ...state, watcher, sourceRoot });
        if (!updateMode.notifiedAt) {
          showUpdateModePausedAlert(codex.appRoot, codexVersion);
          writeUpdateMode(paths.updateModeFile, {
            ...updateMode,
            notifiedAt: new Date().toISOString(),
          });
        }
        if (!opts.quiet) {
          console.log(kleur.yellow("Codex update mode is active; leaving signed app unpatched."));
        }
        return;
      }
      if (codexVersion === updateMode.codexVersion && !opts.quiet) {
        console.log(kleur.yellow("Codex update mode is stale; clearing it and repairing Codex++."));
      }
      clearUpdateMode(paths.updateModeFile);
    }
    const { headerHash } = readHeaderHash(codex.asarPath);
    if (headerHash === state.patchedAsarHash) {
      const watcher = refreshWatcher(state.watcher, codex.appRoot, opts.quiet);
      if (compareSemver(CODEX_PLUSPLUS_VERSION, state.version) > 0) {
        if (!isAutoUpdateEnabled(paths.configFile)) {
          if (!opts.quiet) console.log(kleur.yellow("Codex++ auto-update is disabled."));
          return;
        }
        stageAssets(paths.runtime);
        writeState(paths.stateFile, {
          ...state,
          watcher,
          version: CODEX_PLUSPLUS_VERSION,
          sourceRoot,
          runtimeUpdatedAt: new Date().toISOString(),
        });
        if (!opts.quiet) {
          console.log(
            kleur.green(`Updated Codex++ runtime ${state.version} → ${CODEX_PLUSPLUS_VERSION}.`),
          );
        }
        if (isCodexRunning(codex.appRoot)) {
          promptRestartCodexAfterRuntimeUpdate(codex.appRoot, CODEX_PLUSPLUS_VERSION);
        }
        return;
      }
      writeState(paths.stateFile, { ...state, watcher, sourceRoot });
      if (!opts.quiet) console.log(kleur.green("Patch already intact."));
      return;
    }
  }

  if (!settledBeforeHashCheck) {
    await waitForMacAppUpdateToSettle(opts.app ?? state?.appRoot, opts.quiet);
  }

  let codexWasRunning = false;
  let repairedAppRoot: string | null = null;
  let reopenAfterRepair = false;
  try {
    const codex = locateCodex(opts.app ?? state?.appRoot);
    repairedAppRoot = codex.appRoot;
    codexWasRunning = isCodexRunning(codex.appRoot);
    if (codexWasRunning && process.platform === "darwin" && promptRestartCodexToRepatch(codex.appRoot)) {
      reopenAfterRepair = true;
      codexWasRunning = false;
    } else if (codexWasRunning && process.platform === "darwin") {
      if (!opts.quiet) {
        console.log(kleur.yellow("Repair postponed. Codex is still running without the updated Codex++ patch."));
      }
      return;
    }
  } catch {
    // install() will surface the real locate/preflight error below.
  }

  await install({
    app: opts.app ?? state?.appRoot,
    fuse: state?.fuseFlipped ?? true,
    resign: state?.resigned ?? true,
    watcher: state?.watcher === "none" ? false : true,
    watcherKind: state?.watcher,
    quiet: opts.quiet,
  });
  if (reopenAfterRepair && repairedAppRoot) {
    openCodex(repairedAppRoot);
  } else if (codexWasRunning && repairedAppRoot) {
    promptRestartCodexAfterPatch(repairedAppRoot);
  }
  if (!opts.quiet) console.log(kleur.green("✓ Repair complete."));
}

function announceCodexUpdateDetected(updateModeFile: string, appRoot: string): void {
  const updateMode = readUpdateMode(updateModeFile);
  if (!updateMode || updateMode.patchingNotifiedAt) return;

  try {
    const codex = locateCodex(appRoot);
    const codexVersion = readCodexVersion(codex.metaPath);
    if (!codexVersion || codexVersion === updateMode.codexVersion) return;
    showCodexUpdateDetectedNotification();
    writeUpdateMode(updateModeFile, {
      ...updateMode,
      patchingNotifiedAt: new Date().toISOString(),
    });
  } catch {
    // The app bundle may be mid-update. The settle wait below handles that path.
  }
}

function isAutoUpdateEnabled(configFile: string): boolean {
  if (!existsSync(configFile)) return true;
  try {
    const config = JSON.parse(readFileSync(configFile, "utf8")) as {
      codexPlusPlus?: { autoUpdate?: boolean };
    };
    return config.codexPlusPlus?.autoUpdate !== false;
  } catch {
    return true;
  }
}

async function waitForMacAppUpdateToSettle(appRoot: string | undefined, quiet?: boolean): Promise<void> {
  if (platform() !== "darwin" || !appRoot) return;

  const paths = [
    join(appRoot, "Contents", "Info.plist"),
    join(appRoot, "Contents", "Resources", "app.asar"),
    join(
      appRoot,
      "Contents",
      "Frameworks",
      "Electron Framework.framework",
      "Versions",
      "A",
      "Electron Framework",
    ),
  ];

  let previous = bundleSnapshot(paths);
  let stableSamples = 0;
  let announced = previous.includes(":missing:");
  const started = Date.now();
  const timeoutMs = 120_000;
  if (announced && !quiet) {
    console.log(kleur.dim("Waiting for Codex.app update files to appear..."));
  }

  while (Date.now() - started < timeoutMs) {
    await delay(2_000);
    const snapshot = bundleSnapshot(paths);
    if (!snapshot.includes(":missing:") && snapshot === previous) {
      stableSamples += 1;
      if (stableSamples >= 3) return;
    } else {
      stableSamples = 0;
      previous = snapshot;
      if (!quiet && !announced) {
        console.log(kleur.dim("Waiting for Codex.app update files to settle..."));
        announced = true;
      }
    }
  }
  throw new Error("Codex.app still appears to be updating; retry repair after the update finishes.");
}

function bundleSnapshot(paths: string[]): string {
  return paths
    .map((p) => {
      try {
        const st = statSync(p);
        return `${p}:${st.size}:${st.mtimeMs}`;
      } catch {
        return `${p}:missing:0`;
      }
    })
    .join("|");
}

function refreshWatcher(
  previous: NonNullable<ReturnType<typeof readState>>["watcher"],
  appRoot: string,
  quiet?: boolean,
): NonNullable<ReturnType<typeof readState>>["watcher"] {
  if (previous === "none") return previous;
  try {
    return installWatcher(appRoot);
  } catch (e) {
    if (!quiet) console.warn(kleur.yellow(`Watcher refresh failed: ${(e as Error).message}`));
    return previous;
  }
}
