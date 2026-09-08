/** 退出 ChatGPT++ 时，把同一套商店镜像里的 ChatGPT.exe / Codex 一并关掉。 */
import { execFileSync } from "node:child_process";

export function shouldQuitCompanionProcess(input: {
  pid: number;
  selfPid: number;
  name?: string | null;
  path?: string | null;
  command?: string | null;
}): boolean {
  if (!input.pid || input.pid === input.selfPid) return false;
  const name = String(input.name ?? "").toLowerCase();
  if (name === "node.exe" || name === "powershell.exe" || name === "pwsh.exe" || name === "cmd.exe") {
    return false;
  }
  const blob = `${input.path ?? ""} ${input.command ?? ""}`.toLowerCase().replace(/\//g, "\\");
  if (!blob.includes("\\chatgpt-plusplus\\")) return false;
  return (
    name === "chatgpt.exe" ||
    name === "chatgpt++.exe" ||
    name === "codex.exe" ||
    blob.includes("chatgpt.exe") ||
    blob.includes("chatgpt++.exe") ||
    blob.includes("\\codex.exe") ||
    blob.includes("crashpad")
  );
}

export function shouldQuitForeignChatgptProcess(input: {
  pid: number;
  selfPid: number;
  name?: string | null;
  path?: string | null;
  command?: string | null;
}): boolean {
  if (!input.pid || input.pid === input.selfPid) return false;
  const name = String(input.name ?? "").toLowerCase();
  if (name !== "chatgpt.exe" && name !== "codex.exe") return false;
  const path = String(input.path ?? "").toLowerCase().replace(/\//g, "\\");
  const command = String(input.command ?? "").toLowerCase().replace(/\//g, "\\");
  if (`${path} ${command}`.includes("\\chatgpt-plusplus\\")) return false;
  if (!path.trim()) return true;
  return path.includes("\\windowsapps\\");
}

export function parseCompanionProcessLines(output: string, selfPid: number): number[] {
  const pids: number[] = [];
  for (const line of output.split(/\r?\n/)) {
    const parts = line.split("\t");
    if (parts.length < 2) continue;
    const pid = Number(parts[0]);
    const name = parts[1] ?? "";
    const path = parts[2] ?? "";
    const command = parts[3] ?? "";
    if (shouldQuitCompanionProcess({ pid, selfPid, name, path, command })) pids.push(pid);
  }
  return pids;
}

export function killChatgptPlusPlusCompanions(selfPid = process.pid): number[] {
  if (process.platform !== "win32") return [];
  let output = "";
  try {
    output = listChatgptProcessTable();
  } catch {
    return [];
  }
  return killPids(parseCompanionProcessLines(output, selfPid));
}

function listChatgptProcessTable(): string {
  return execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      "Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^(ChatGPT|ChatGPT\\+\\+|codex)\\.exe$' } | ForEach-Object { '{0}`t{1}`t{2}`t{3}' -f $_.ProcessId, $_.Name, $_.ExecutablePath, $_.CommandLine }",
    ],
    { encoding: "utf8", timeout: 8000, windowsHide: true },
  );
}

function killPids(pids: number[]): number[] {
  for (const pid of pids) {
    try {
      execFileSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore",
        timeout: 5000,
        windowsHide: true,
      });
    } catch {}
  }
  return pids;
}

export function killForeignChatgptProcesses(selfPid = process.pid): number[] {
  if (process.platform !== "win32") return [];
  let output = "";
  try {
    output = listChatgptProcessTable();
  } catch {
    return [];
  }
  const pids: number[] = [];
  for (const line of output.split(/\r?\n/)) {
    const parts = line.split("\t");
    if (parts.length < 2) continue;
    const pid = Number(parts[0]);
    if (shouldQuitForeignChatgptProcess({
      pid,
      selfPid,
      name: parts[1] ?? "",
      path: parts[2] ?? "",
      command: parts[3] ?? "",
    })) pids.push(pid);
  }
  return killPids(pids);
}
