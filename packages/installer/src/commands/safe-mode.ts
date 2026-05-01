import kleur from "kleur";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureUserPaths } from "../paths.js";

interface SafeModeOpts {
  on?: boolean;
  off?: boolean;
  status?: boolean;
}

interface CodexPlusPlusConfig {
  codexPlusPlus?: {
    autoUpdate?: boolean;
    safeMode?: boolean;
    updateCheck?: unknown;
  };
  tweaks?: Record<string, { enabled?: boolean }>;
  tweakUpdateChecks?: Record<string, unknown>;
}

export function safeMode(opts: SafeModeOpts = {}): void {
  const paths = ensureUserPaths();
  const config = readConfig(paths.configFile);
  const explicitActions = [opts.on === true, opts.off === true, opts.status === true].filter(Boolean).length;

  if (explicitActions > 1) {
    throw new Error("Choose only one of --on, --off, or --status");
  }

  if (opts.status === true) {
    printStatus(config.codexPlusPlus?.safeMode === true);
    return;
  }

  const enabled = opts.off === true ? false : true;
  config.codexPlusPlus ??= {};
  config.codexPlusPlus.safeMode = enabled;
  writeConfig(paths.configFile, config);
  touchRuntimeReload(paths.tweaks);

  printStatus(enabled);
  if (enabled) {
    console.log(kleur.dim("All tweaks are disabled until safe mode is turned off."));
  } else {
    console.log(kleur.dim("Existing per-tweak enabled flags are preserved."));
  }
  console.log(kleur.dim("If Codex is already running, use Force Reload or restart if changes do not apply immediately."));
}

function readConfig(configFile: string): CodexPlusPlusConfig {
  if (!existsSync(configFile)) return {};
  try {
    return JSON.parse(readFileSync(configFile, "utf8")) as CodexPlusPlusConfig;
  } catch {
    return {};
  }
}

function writeConfig(configFile: string, config: CodexPlusPlusConfig): void {
  writeFileSync(configFile, JSON.stringify(config, null, 2) + "\n", "utf8");
}

function touchRuntimeReload(tweaksDir: string): void {
  mkdirSync(tweaksDir, { recursive: true });
  writeFileSync(join(tweaksDir, ".codexpp-safe-mode-reload"), String(Date.now()), "utf8");
}

function printStatus(enabled: boolean): void {
  const label = enabled ? kleur.yellow("enabled") : kleur.green("disabled");
  console.log(`Codex++ safe mode: ${label}`);
}
