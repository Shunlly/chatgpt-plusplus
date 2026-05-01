import { execFileSync } from "node:child_process";
import { platform } from "node:os";

const CODEX_BUNDLE_ID = "com.openai.codex";
const CODEX_PLUSPLUS_REPO_URL = "https://github.com/b-nnett/codex-plusplus";

export function showPatchFailedAlert(errorMessage: string): void {
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
    appBundleId: CODEX_BUNDLE_ID,
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
    appBundleId: CODEX_BUNDLE_ID,
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
    appBundleId: CODEX_BUNDLE_ID,
  });

  if (button !== "Restart and Re-Patch") return false;
  quitCodex(appRoot);
  return true;
}

export function openCodex(appRoot: string): void {
  if (platform() !== "darwin") return;
  try {
    execFileSync("open", ["-b", CODEX_BUNDLE_ID], { stdio: "ignore" });
  } catch {
    try {
      execFileSync("open", [appRoot], { stdio: "ignore" });
    } catch {}
  }
  try {
    execFileSync("osascript", ["-e", `tell application id ${appleScriptString(CODEX_BUNDLE_ID)} to activate`], {
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
  appBundleId?: string;
}

function showAlert(opts: AlertOptions): string | null {
  if (platform() !== "darwin") return null;

  if (opts.appBundleId) {
    const appButton = runAlertScript(alertScript(opts, opts.appBundleId), opts);
    if (appButton) return appButton;
  }

  return runAlertScript(alertScript(opts), opts);
}

function alertScript(opts: AlertOptions, appBundleId?: string): string {
  const buttons = opts.buttons ?? ["OK"];
  const defaultButton = opts.defaultButton ?? buttons.at(-1) ?? "OK";
  const displayAlert =
    `display alert alertTitle message alertMessage buttons alertButtons default button ${appleScriptString(defaultButton)}${opts.critical ? " as critical" : ""}${opts.timeoutSeconds ? ` giving up after ${opts.timeoutSeconds}` : ""}`;
  const lines = [
    `set alertTitle to system attribute "CODEXPP_ALERT_TITLE"`,
    `set alertMessage to system attribute "CODEXPP_ALERT_MESSAGE"`,
    `set alertButtons to {${buttons.map(appleScriptString).join(", ")}}`,
  ];
  if (appBundleId) {
    lines.push(
      `tell application id ${appleScriptString(appBundleId)}`,
      `activate`,
      displayAlert,
      `end tell`,
    );
  } else {
    lines.push(displayAlert);
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

function quitAndRestartCodex(appRoot: string): void {
  quitCodex(appRoot);
  openCodex(appRoot);
}

function quitCodex(appRoot: string): void {
  try {
    execFileSync("osascript", ["-e", `tell application id ${appleScriptString(CODEX_BUNDLE_ID)} to quit`], {
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

function openUrl(url: string): void {
  if (platform() !== "darwin") return;
  try {
    execFileSync("open", [url], { stdio: "ignore" });
  } catch {}
}

function appleScriptString(value: string): string {
  return JSON.stringify(value);
}
