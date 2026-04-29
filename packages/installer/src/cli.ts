#!/usr/bin/env node
import sade from "sade";
import kleur from "kleur";
import { install } from "./commands/install.js";
import { uninstall } from "./commands/uninstall.js";
import { repair } from "./commands/repair.js";
import { updateCodex } from "./commands/update-codex.js";
import { selfUpdate } from "./commands/self-update.js";
import { status } from "./commands/status.js";
import { doctor } from "./commands/doctor.js";
import { CODEX_PLUSPLUS_VERSION } from "./version.js";

function wrap<T extends (...args: never[]) => unknown | Promise<unknown>>(fn: T): T {
  return ((...args: Parameters<T>) => {
    Promise.resolve()
      .then(() => fn(...args))
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("\n" + kleur.red().bold("✗ codex-plusplus failed"));
        console.error(msg);
        process.exit(1);
      });
  }) as unknown as T;
}

const prog = sade("codex-plusplus")
  .version(CODEX_PLUSPLUS_VERSION)
  .describe("Tweak system for the Codex desktop app");

prog
  .command("install")
  .describe("Patch Codex.app to load the tweak runtime")
  .option("--app", "Path to Codex.app / install dir (auto-detected if omitted)")
  .option("--no-fuse", "Skip Electron fuse flip (only patch asar+plist)")
  .option("--no-resign", "Skip ad-hoc code signing on macOS")
  .option("--no-watcher", "Skip installing the auto-repair watcher")
  .option("--no-default-tweaks", "Skip installing the default bundled tweak set")
  .action(wrap(install));

prog
  .command("uninstall")
  .describe("Restore Codex.app from backup and remove the watcher")
  .option("--app", "Path to Codex.app / install dir")
  .action(wrap(uninstall));

prog
  .command("repair")
  .describe("Re-apply the patch (use after a Sparkle auto-update)")
  .option("--app", "Path to Codex.app / install dir")
  .option("--quiet", "Suppress non-error output")
  .option("--force", "Re-apply even if the patch appears intact")
  .action(wrap(repair));

prog
  .command("update-codex")
  .describe("Restore signed Codex.app so the official updater can run, then reapply Codex++ after restart")
  .option("--app", "Path to Codex.app / install dir")
  .action(wrap(updateCodex));

prog
  .command("update")
  .describe("Update Codex++ from GitHub, rebuild, then repair the app patch")
  .option("--repo", "GitHub repo to download (default: b-nnett/codex-plusplus)")
  .option("--ref", "Git ref to download (default: main)")
  .option("--no-repair", "Update source without running repair")
  .action(wrap(selfUpdate));

prog
  .command("self-update")
  .describe("Alias for update")
  .option("--repo", "GitHub repo to download (default: b-nnett/codex-plusplus)")
  .option("--ref", "Git ref to download (default: main)")
  .option("--no-repair", "Update source without running repair")
  .action(wrap(selfUpdate));

prog
  .command("status")
  .describe("Show patch status, paths, version")
  .action(status);

prog
  .command("doctor")
  .describe("Diagnose common issues (signature, fuses, asar integrity, perms)")
  .action(doctor);

prog.parse(process.argv, {
  unknown: (flag) => {
    console.error(kleur.red(`Unknown flag: ${flag}`));
    process.exit(1);
  },
});
