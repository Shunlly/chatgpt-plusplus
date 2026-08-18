#!/usr/bin/env node
// 性能优化：仅导入启动必需的模块，命令处理函数延迟加载
import sade from "sade";
import kleur from "kleur";
import { CHATGPT_PLUSPLUS_VERSION } from "./version.js";
import { buildCliFailureIssueUrl } from "./alerts.js";
import { appendInstallerError, capKnownLogFiles } from "./logging.js";

interface InstallCliOpts {
  app?: string;
  fuse?: boolean;
  resign?: boolean;
  local?: boolean;
  localSigning?: boolean;
  "local-signing"?: boolean;
  watcher?: boolean;
  verbose?: boolean;
}

interface RepairCliOpts {
  app?: string;
  quiet?: boolean;
  force?: boolean;
  local?: boolean;
  localSigning?: boolean;
  "local-signing"?: boolean;
  watcher?: boolean;
}

function wrap<T extends (...args: never[]) => unknown | Promise<unknown>>(fn: T): T {
  return ((...args: Parameters<T>) => {
    Promise.resolve()
      .then(() => fn(...args))
      .catch(async (e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        const command = process.argv[2];
        // 错误同时打到 stdout：NSIS 安装器用 nsExec::ExecToLog 只显示 stdout，
        // 只写 stderr 会让安装详情看不到失败原因。
        const lines = [
          "\n✗ chatgpt-plusplus failed",
          msg,
          "",
          "If the message above does not explain how to fix it, please report this on GitHub:",
          buildCliFailureIssueUrl(command, msg),
        ];
        const out = kleur.red().bold(lines[0]) + "\n" + lines.slice(1).join("\n");
        console.log(out);
        console.error(out);
        appendInstallerError(`command=${process.argv.slice(2).join(" ")} error=${msg}`);
        await maybeShowPatchFailedAlert(msg);
        process.exit(1);
      });
  }) as unknown as T;
}

async function runInstall(opts: InstallCliOpts): Promise<void> {
  const { install } = await import("./commands/install.js");
  return install({
    ...opts,
    localSigning: resolveLocalSigning(opts),
  });
}

async function runUninstall(opts: never): Promise<void> {
  const { uninstall } = await import("./commands/uninstall.js");
  return uninstall(opts);
}

async function runRepair(opts: RepairCliOpts): Promise<void> {
  const { repair } = await import("./commands/repair.js");
  return repair({
    ...opts,
    localSigning: resolveLocalSigning(opts),
  });
}

async function runUpdateCodex(opts: never): Promise<void> {
  const { updateCodex } = await import("./commands/update-codex.js");
  return updateCodex(opts);
}

async function runSelfUpdate(opts: never): Promise<void> {
  const { selfUpdate } = await import("./commands/self-update.js");
  return selfUpdate(opts);
}

async function runStatus(): Promise<void> {
  const { status } = await import("./commands/status.js");
  return status();
}

async function runDebug(opts: never): Promise<void> {
  const { debug } = await import("./commands/debug.js");
  return debug(opts);
}

async function runBrowserUi(opts: never): Promise<void> {
  const { browserUi } = await import("./commands/browser-ui.js");
  return browserUi(opts);
}

async function runDoctor(): Promise<void> {
  const { doctor } = await import("./commands/doctor.js");
  return doctor();
}

async function runSafeMode(opts: never): Promise<void> {
  const { safeMode } = await import("./commands/safe-mode.js");
  return safeMode(opts);
}

function resolveLocalSigning(opts: {
  local?: boolean;
  localSigning?: boolean;
  "local-signing"?: boolean;
}): boolean | undefined {
  if (opts.local === false || opts.localSigning === false || opts["local-signing"] === false) {
    return false;
  }
  return opts.localSigning ?? opts["local-signing"] ?? opts.local;
}

async function runCreateTweak(target: string, opts: never): Promise<void> {
  const { createTweak } = await import("./commands/create-tweak.js");
  return createTweak(target, opts);
}

async function runValidateTweak(target?: string): Promise<void> {
  const { validateTweak } = await import("./commands/validate-tweak.js");
  return validateTweak(target);
}

async function runDevTweak(target: string | undefined, opts: never): Promise<void> {
  const { devTweak } = await import("./commands/dev-tweak.js");
  return devTweak(target, opts);
}

async function maybeShowPatchFailedAlert(message: string): Promise<void> {
  const command = process.argv[2];
  if (command !== "repair") return;
  const { showPatchFailedAlert } = await import("./alerts.js");
  showPatchFailedAlert(message);
}

const prog = sade("chatgpt-plusplus")
  .version(CHATGPT_PLUSPLUS_VERSION)
  .describe("Tweak system for the ChatGPT desktop app");

capKnownLogFiles();

prog
  .command("install")
  .describe("Patch ChatGPT.app to load the tweak runtime")
  .option("--app", "Path to ChatGPT.app / install dir (auto-detected if omitted)")
  .option("--fuse", "Flip Electron's embedded asar integrity fuse", true)
  .option("--resign", "Code sign ChatGPT.app on macOS", true)
  .option("--local", "Use a stable local signing identity on macOS")
  .option("--local-signing", "Alias for --local")
  .option("--watcher", "Install the auto-repair watcher", true)
  .option("--verbose", "Show low-level patching details")
  .action(wrap(runInstall));

prog
  .command("uninstall")
  .describe("Restore ChatGPT.app from backup and remove the watcher")
  .option("--app", "Path to Codex.app / install dir")
  .option("--purge", "Delete tweaks, config, logs, backups, and ChatGPT++ user data")
  .action(wrap(runUninstall));

prog
  .command("repair")
  .describe("Re-apply the patch (use after a Sparkle auto-update)")
  .option("--app", "Path to Codex.app / install dir")
  .option("--quiet", "Suppress non-error output")
  .option("--force", "Re-apply even if the patch appears intact")
  .option("--local", "Use a stable local signing identity on macOS")
  .option("--local-signing", "Alias for --local")
  .option("--watcher", "Run from the auto-repair watcher")
  .action(wrap(runRepair));

prog
  .command("update-codex")
  .describe("Restore signed ChatGPT.app so the official updater can run, then reapply ChatGPT++ after restart")
  .option("--app", "Path to Codex.app / install dir")
  .action(wrap(runUpdateCodex));

prog
  .command("update")
  .describe("Update ChatGPT++ from the latest GitHub release, rebuild, then repair the app patch")
  .option("--repo", "GitHub repo to download (default: Shunlly/chatgpt-plusplus)")
  .option("--ref", "Git ref to download (default: latest GitHub release)")
  .option("--repair", "Run repair after updating", true)
  .option("--quiet", "Suppress non-error output")
  .option("--watcher", "Run in watcher mode and respect automatic refresh settings")
  .option("--force", "Download and rebuild even if the selected release is already installed")
  .action(wrap(runSelfUpdate));

prog
  .command("self-update")
  .describe("Alias for update")
  .option("--repo", "GitHub repo to download (default: Shunlly/chatgpt-plusplus)")
  .option("--ref", "Git ref to download (default: latest GitHub release)")
  .option("--repair", "Run repair after updating", true)
  .option("--quiet", "Suppress non-error output")
  .option("--watcher", "Run in watcher mode and respect automatic refresh settings")
  .option("--force", "Download and rebuild even if the selected release is already installed")
  .action(wrap(runSelfUpdate));

prog
  .command("status")
  .describe("Show patch status, paths, version")
  .action(wrap(runStatus));

prog
  .command("debug")
  .describe("Show Codex install, runtime, data paths, and open state")
  .option("--app", "Path to Codex.app / install dir")
  .action(wrap(runDebug));

prog
  .command("browser")
  .describe("Open the ChatGPT React UI in a browser tab backed by a hidden ChatGPT host")
  .option("--app", "Path to Codex.app / install dir")
  .option("--port", "Local browser UI port", 8765)
  .option("--open", "Open the browser tab after launch", true)
  .option("--keep-window", "Leave the Codex desktop window visible")
  .action(wrap(runBrowserUi));

prog
  .command("doctor")
  .describe("Diagnose common issues (signature, fuses, asar integrity, perms)")
  .action(wrap(runDoctor));

prog
  .command("create-tweak <target>")
  .describe("Scaffold a new local tweak")
  .option("--id", "Manifest id, e.g. com.you.my-tweak")
  .option("--name", "Human-readable tweak name")
  .option("--repo", "GitHub repo in owner/repo form")
  .option("--scope", "renderer, main, or both")
  .option("--force", "Write into an existing empty directory")
  .action(wrap(runCreateTweak));

prog
  .command("validate-tweak [target]")
  .describe("Validate a tweak manifest and entry point")
  .action(wrap(runValidateTweak));

prog
  .command("dev [target]")
  .describe("Link a tweak into the ChatGPT++ tweaks directory for local development")
  .option("--name", "Override linked directory name; defaults to manifest id")
  .option("--replace", "Replace an existing symlink at the target tweak id")
  .option("--no-watch", "Link once and exit instead of watching for changes")
  .action(wrap(runDevTweak));

prog
  .command("safe-mode")
  .describe("Temporarily disable all tweaks without deleting them. Leave safe mode with: chatgptplusplus safe-mode --off")
  .option("--on", "Enable safe mode (default)")
  .option("--off", "Disable safe mode and return to normal tweak loading")
  .option("--status", "Print current safe mode status")
  .action(wrap(runSafeMode));

const argv = process.argv.length <= 2 ? [...process.argv, "--help"] : process.argv;

prog.parse(argv, {
  unknown: (flag) => {
    console.error(kleur.red(`Unknown flag: ${flag}`));
    process.exit(1);
  },
});
