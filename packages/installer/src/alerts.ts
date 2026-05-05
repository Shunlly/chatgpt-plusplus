import { execFileSync } from "node:child_process";
import { platform } from "node:os";
import { dirname, join } from "node:path";
import { chmodSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { readPlist } from "./plist.js";
import { CODEX_PLUSPLUS_VERSION } from "./version.js";
import { ensureUserPaths } from "./paths.js";

const CODEX_BUNDLE_ID = "com.openai.codex";
const CODEX_PLUSPLUS_REPO_URL = "https://github.com/b-nnett/codex-plusplus";
const TERMINAL_REPAIR_THROTTLE_MS = 10 * 60 * 1000;

export function showPatchFailedAlert(errorMessage: string): void {
  if (isMacAppManagementError(errorMessage)) {
    showAppManagementPatchFailedAlert(errorMessage);
    return;
  }

  const button = showAlert({
    title: "Codex++ could not patch Codex",
    message:
      "Codex was updated, but Codex++ could not reapply itself automatically.\n\n" +
      `${errorMessage}\n\n` +
      "Run codexplusplus repair from Terminal after Codex finishes updating, or report this failure on GitHub.",
    buttons: ["Dismiss", "Report on GitHub"],
    defaultButton: "Dismiss",
    critical: true,
  });

  if (button === "Report on GitHub") {
    openUrl(buildPatchFailureIssueUrl(errorMessage));
  }
}

function showAppManagementPatchFailedAlert(errorMessage: string): void {
  const watcher = isWatcherContext();
  const launchedTerminalRepair = watcher ? tryOpenTerminalRepair() : false;
  const button = showAlert({
    title: watcher ? "Codex++ needs Terminal to finish repair" : "Codex++ needs app repair",
    message:
      (watcher
        ? "Codex was updated, but the background watcher could not modify the app directly.\n\n"
        : "Codex was updated, but macOS blocked this repair command from modifying the app.\n\n") +
      (launchedTerminalRepair
        ? "Codex++ opened Terminal to finish the repair. Let that command complete.\n\n"
        : "") +
      "If the repair is not already running, open Terminal and run:\n\n" +
      "codexplusplus repair\n\n" +
      "Codex will stay unpatched until that command completes.",
    buttons: ["Dismiss", "Run Repair in Terminal", "Report on GitHub"],
    defaultButton: launchedTerminalRepair ? "Dismiss" : "Run Repair in Terminal",
    critical: true,
  });

  if (button === "Run Repair in Terminal") {
    tryOpenTerminalRepair(true);
  } else if (button === "Report on GitHub") {
    openUrl(buildPatchFailureIssueUrl(errorMessage));
  }
}

export function showUpdateModePausedAlert(appRoot: string, codexVersion: string | null): void {
  if (platform() !== "darwin") return;

  showAlert({
    title: "Codex++ is waiting for Codex to update",
    message:
      "Codex++ is paused while Codex installs its update.\n\n" +
      `Current Codex: ${codexVersion ?? "unknown"}\n\n` +
      "After the update finishes, Codex++ will patch itself again.",
    buttons: ["OK"],
    defaultButton: "OK",
    timeoutSeconds: 20,
    iconPath: codexIconPath(appRoot),
  });
}

export function showCodexUpdateDetectedNotification(): void {
  if (platform() !== "darwin") return;

  showNotification({
    title: "Codex update detected",
    message: "Codex++ is checking the app, then it will patch itself.",
  });
}

export function promptRestartCodexAfterPatch(appRoot: string): void {
  if (platform() !== "darwin") return;

  const button = showAlert({
    title: "Codex++ needs to restart Codex",
    message:
      "Codex++ re-patched Codex on disk, but the open Codex window is still running the old app code.\n\n" +
      "Restart Codex now to finish loading Codex++.",
    buttons: ["Later", "Quit and Restart Codex"],
    defaultButton: "Quit and Restart Codex",
    timeoutSeconds: 120,
    iconPath: codexIconPath(appRoot),
  });

  if (button !== "Quit and Restart Codex") return;
  quitAndRestartCodex(appRoot);
}

export function promptRestartCodexAfterRuntimeUpdate(appRoot: string, version: string): void {
  if (platform() !== "darwin") return;

  const button = showAlert({
    title: "Codex++ needs to restart Codex",
    message:
      `Codex++ updated its runtime to v${version}, but the open Codex window is still running the previous Codex++ code.\n\n` +
      "Restart Codex now to load the updated Codex++ runtime.",
    buttons: ["Later", "Quit and Restart Codex"],
    defaultButton: "Quit and Restart Codex",
    timeoutSeconds: 120,
    iconPath: codexIconPath(appRoot),
  });

  if (button !== "Quit and Restart Codex") return;
  quitAndRestartCodex(appRoot);
}

export function promptRestartCodexToRepatch(appRoot: string): boolean {
  if (platform() !== "darwin") return true;

  const button = showAlert({
    title: "Codex++ needs to restart Codex",
    message:
      "Codex is running without the latest Codex++ patch.\n\n" +
      "Codex++ needs to quit Codex, re-patch the app, then reopen it.",
    buttons: ["Later", "Restart and Re-Patch"],
    defaultButton: "Restart and Re-Patch",
    timeoutSeconds: 120,
    iconPath: codexIconPath(appRoot),
  });

  if (button !== "Restart and Re-Patch") return false;
  quitCodex(appRoot);
  return true;
}

export function openCodex(appRoot: string): void {
  if (platform() !== "darwin") return;
  const bundleId = codexBundleId(appRoot);
  try {
    execFileSync("open", ["-b", bundleId], { stdio: "ignore" });
  } catch {
    try {
      execFileSync("open", [appRoot], { stdio: "ignore" });
    } catch {}
  }
  try {
    execFileSync("osascript", ["-e", `tell application id ${appleScriptString(bundleId)} to activate`], {
      stdio: "ignore",
    });
  } catch {}
}

export function isCodexRunning(appRoot: string): boolean {
  try {
    execFileSync("pgrep", ["-f", `${appRoot}/Contents`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

interface AlertOptions {
  title: string;
  message: string;
  buttons?: string[];
  defaultButton?: string;
  critical?: boolean;
  timeoutSeconds?: number;
  iconPath?: string;
}

function showAlert(opts: AlertOptions): string | null {
  if (platform() !== "darwin") return null;

  return runAlertScript(alertScript(opts), opts);
}

function showNotification(opts: Pick<AlertOptions, "title" | "message">): void {
  try {
    execFileSync(
      "osascript",
      [
        "-e",
        `display notification ${appleScriptString(opts.message)} with title ${appleScriptString(opts.title)}`,
      ],
      { stdio: "ignore" },
    );
  } catch {}
}

function alertScript(opts: AlertOptions): string {
  const buttons = opts.buttons ?? ["OK"];
  const defaultButton = opts.defaultButton ?? buttons.at(-1) ?? "OK";
  const lines = [
    `set alertTitle to system attribute "CODEXPP_ALERT_TITLE"`,
    `set alertMessage to system attribute "CODEXPP_ALERT_MESSAGE"`,
    `set alertButtons to {${buttons.map(appleScriptString).join(", ")}}`,
  ];
  if (opts.iconPath) {
    lines.push(
      `display dialog alertMessage with title alertTitle buttons alertButtons default button ${appleScriptString(defaultButton)} with icon POSIX file ${appleScriptString(opts.iconPath)}${opts.timeoutSeconds ? ` giving up after ${opts.timeoutSeconds}` : ""}`,
    );
  } else {
    lines.push(
      `display alert alertTitle message alertMessage buttons alertButtons default button ${appleScriptString(defaultButton)}${opts.critical ? " as critical" : ""}${opts.timeoutSeconds ? ` giving up after ${opts.timeoutSeconds}` : ""}`,
    );
  }
  return lines.join("\n");
}

function runAlertScript(script: string, opts: AlertOptions): string | null {
  try {
    const out = execFileSync("osascript", ["-e", script], {
      encoding: "utf8",
      env: {
        ...process.env,
        CODEXPP_ALERT_TITLE: opts.title,
        CODEXPP_ALERT_MESSAGE: opts.message,
      },
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return parseAlertButton(out);
  } catch {
    return null;
  }
}

function parseAlertButton(output: string): string | null {
  if (/gave up:true/.test(output)) return null;
  return output.match(/button returned:([^,\n]+)/)?.[1]?.trim() ?? null;
}

function codexIconPath(appRoot: string): string {
  return join(appRoot, "Contents", "Resources", "electron.icns");
}

function quitAndRestartCodex(appRoot: string): void {
  quitCodex(appRoot);
  openCodex(appRoot);
}

function quitCodex(appRoot: string): void {
  try {
    execFileSync("osascript", ["-e", `tell application id ${appleScriptString(codexBundleId(appRoot))} to quit`], {
      stdio: "ignore",
    });
  } catch {}

  const started = Date.now();
  while (Date.now() - started < 10_000 && isCodexRunning(appRoot)) {
    try {
      execFileSync("sleep", ["0.5"], { stdio: "ignore" });
    } catch {
      break;
    }
  }
}

export function buildPatchFailureIssueUrl(errorMessage: string): string {
  const title = "Codex++ failed to patch Codex after update";
  const body = [
    "## What happened",
    "Codex++ could not reapply its patch after Codex updated.",
    "",
    "## Error",
    "```text",
    errorMessage.trim() || "(empty error message)",
    "```",
    "",
    "## Environment",
    `- Platform: ${process.platform}`,
    `- Arch: ${process.arch}`,
    `- Node: ${process.version}`,
  ].join("\n");

  const params = new URLSearchParams({ title, body });
  return `${CODEX_PLUSPLUS_REPO_URL}/issues/new?${params.toString()}`;
}

export function buildCliFailureIssueUrl(command: string | undefined, errorMessage: string): string {
  const commandLabel = command?.trim() || "(unknown command)";
  const title = `Codex++ ${commandLabel} failed`;
  const body = [
    "## What happened",
    `The \`codexplusplus ${commandLabel}\` command failed.`,
    "",
    "## Error",
    "```text",
    trimIssueError(errorMessage),
    "```",
    "",
    "## Environment",
    `- Codex++: ${CODEX_PLUSPLUS_VERSION}`,
    `- Platform: ${process.platform}`,
    `- Arch: ${process.arch}`,
    `- Node: ${process.version}`,
  ].join("\n");

  const params = new URLSearchParams({ title, body });
  return `${CODEX_PLUSPLUS_REPO_URL}/issues/new?${params.toString()}`;
}

function trimIssueError(errorMessage: string): string {
  const trimmed = errorMessage.trim() || "(empty error message)";
  const maxLength = 4000;
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}\n... truncated ...`;
}

export function isMacAppManagementError(errorMessage: string): boolean {
  return /macOS App Management is blocking modification/.test(errorMessage);
}

function isWatcherContext(): boolean {
  return process.env.CODEX_PLUSPLUS_WATCHER === "1" || process.env.XPC_SERVICE_NAME === "com.codexplusplus.watcher";
}

function tryOpenTerminalRepair(force = false): boolean {
  if (platform() !== "darwin") return false;
  try {
    const paths = ensureUserPaths();
    const marker = join(paths.root, "terminal-repair-launched.json");
    if (!force && recentlyTouched(marker, TERMINAL_REPAIR_THROTTLE_MS)) return false;
    const commandPath = join(paths.binDir, "repair-from-terminal.command");
    mkdirSync(dirname(commandPath), { recursive: true });
    writeFileSync(commandPath, terminalRepairScript(), { mode: 0o755 });
    chmodSync(commandPath, 0o755);
    writeFileSync(marker, JSON.stringify({ launchedAt: new Date().toISOString() }, null, 2));
    execFileSync("open", ["-a", "Terminal", commandPath], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function recentlyTouched(path: string, maxAgeMs: number): boolean {
  try {
    return Date.now() - statSync(path).mtimeMs < maxAgeMs;
  } catch {
    return false;
  }
}

function terminalRepairScript(): string {
  const cli = process.argv[1] ?? "codexplusplus";
  const execArgs = cli.endsWith(".ts") ? process.execArgv : [];
  const repairCommand = [
    shellQuote(process.execPath),
    ...execArgs.map(shellQuote),
    shellQuote(cli),
    "repair",
    "--force",
  ].join(" ");
  return [
    "#!/bin/zsh",
    "clear",
    "echo 'Codex++ is finishing the app repair from Terminal.'",
    "echo ''",
    repairCommand,
    "status=$?",
    "echo ''",
    "if [ \"$status\" -eq 0 ]; then",
    "  echo 'Codex++ repair complete. You can close this window.'",
    "else",
    "  echo \"Codex++ repair failed with exit code $status.\"",
    "  echo 'If macOS asked for permission, click Allow and run: codexplusplus repair'",
    "fi",
    "exit \"$status\"",
    "",
  ].join("\n");
}

function openUrl(url: string): void {
  if (platform() !== "darwin") return;
  try {
    execFileSync("open", [url], { stdio: "ignore" });
  } catch {}
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function codexBundleId(appRoot: string): string {
  const info = join(appRoot, "Contents", "Info.plist");
  if (!existsSync(info)) return CODEX_BUNDLE_ID;
  try {
    const plist = readPlist(info);
    return typeof plist.CFBundleIdentifier === "string" ? plist.CFBundleIdentifier : CODEX_BUNDLE_ID;
  } catch {
    return CODEX_BUNDLE_ID;
  }
}

function appleScriptString(value: string): string {
  return JSON.stringify(value);
}
