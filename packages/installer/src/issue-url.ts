// CLI/告警失败页的 GitHub issue URL。刻意不依赖 alerts/debug，避免 --help 拉起 asar。
import { CHATGPT_PLUSPLUS_VERSION } from "./version.js";

const CHATGPT_PLUSPLUS_REPO_URL = "https://github.com/Shunlly/chatgpt-plusplus";

function trimIssueError(errorMessage: string): string {
  const trimmed = errorMessage.trim() || "(empty error message)";
  const maxLength = 4000;
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}\n... truncated ...`;
}

export function buildPatchFailureIssueUrl(errorMessage: string): string {
  const title = "ChatGPT++ failed to patch Codex after update";
  const body = [
    "## Summary",
    "ChatGPT++ could not reapply its patch after Codex updated.",
    "",
    "## Error",
    "```text",
    trimIssueError(errorMessage),
    "```",
    "",
    "## Environment",
    `- Platform: ${process.platform}`,
    `- Arch: ${process.arch}`,
    `- Node: ${process.version}`,
    "",
    "## Debugging context",
    "- Codex app path: ",
    "- Codex version shown in app, if known: ",
    "- Was Codex running during the update? ",
    "- Did rerunning `chatgptplusplus repair` change the result? ",
  ].join("\n");

  const params = new URLSearchParams({ title, body });
  return `${CHATGPT_PLUSPLUS_REPO_URL}/issues/new?${params.toString()}`;
}

export function buildCliFailureIssueUrl(command: string | undefined, errorMessage: string): string {
  const commandLabel = command?.trim() || "(unknown command)";
  const title = `ChatGPT++ ${commandLabel} failed`;
  const body = [
    "## Summary",
    `\`chatgptplusplus ${commandLabel}\` failed.`,
    "",
    "## Command",
    "```text",
    `chatgptplusplus ${commandLabel}`,
    "```",
    "",
    "## Error",
    "```text",
    trimIssueError(errorMessage),
    "```",
    "",
    "## Environment",
    `- ChatGPT++: ${CHATGPT_PLUSPLUS_VERSION}`,
    `- Platform: ${process.platform}`,
    `- Arch: ${process.arch}`,
    `- Node: ${process.version}`,
    "",
    "## Debugging context",
    "- Codex app path, if shown: ",
    "- Install source: ",
    "- Did rerunning the command change the result? ",
    "- Any recent Codex or ChatGPT++ update? ",
  ].join("\n");

  const params = new URLSearchParams({ title, body });
  return `${CHATGPT_PLUSPLUS_REPO_URL}/issues/new?${params.toString()}`;
}
