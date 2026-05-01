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
    title: "Restart Codex to load Codex++",
    message:
      "Codex is open without Codex++ because it was updated before the patch was reapplied.\n\n" +
      "Codex++ has patched the app on disk. Restart Codex now to load it.",
    buttons: ["Later", "Quit and Restart Codex"],
    defaultButton: "Quit and Restart Codex",
  });

  if (button !== "Quit and Restart Codex") return;
  quitAndRestartCodex(appRoot);
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
}

function showAlert(opts: AlertOptions): string | null {
  if (platform() !== "darwin") return null;

  const buttons = opts.buttons ?? ["OK"];
  const defaultButton = opts.defaultButton ?? buttons.at(-1) ?? "OK";
  const script = [
    `set alertTitle to system attribute "CODEXPP_ALERT_TITLE"`,
    `set alertMessage to system attribute "CODEXPP_ALERT_MESSAGE"`,
    `set alertButtons to {${buttons.map(appleScriptString).join(", ")}}`,
    `display alert alertTitle message alertMessage buttons alertButtons default button ${appleScriptString(defaultButton)}${opts.critical ? " as critical" : ""}`,
  ].join("\n");

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
    return out.match(/button returned:(.*)$/)?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

function quitAndRestartCodex(appRoot: string): void {
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

  try {
    execFileSync("open", [appRoot], { stdio: "ignore" });
  } catch {}
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
