import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

export const WINDOWS_CODEX_CONTEXT_MENU_KEYS = [
  "HKCU:\\Software\\Classes\\Directory\\shell\\OpenProjectInCodex",
  "HKCU:\\Software\\Classes\\Directory\\Background\\shell\\OpenProjectInCodex",
];

export function cleanupWindowsManagedArtifacts(): void {
  if (platform() !== "win32") return;

  const script = buildWindowsManagedCleanupScript({
    localAppData: process.env.LOCALAPPDATA,
    appData: process.env.APPDATA,
    home: homedir(),
  });

  try {
    execFileSync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
      { stdio: "ignore" },
    );
  } catch {
    // Best-effort cleanup. Uninstall should still restore Codex even if a
    // shortcut or registry key is locked by Windows Explorer.
  }
}

export function buildWindowsManagedCleanupScript(input: {
  localAppData?: string;
  appData?: string;
  home: string;
}): string {
  const cleanupPaths = [
    input.localAppData ? join(input.localAppData, "Microsoft", "WindowsApps", "codex-plusplus-codex.cmd") : null,
    input.localAppData ? join(input.localAppData, "codex-plusplus", "store-apps") : null,
    input.appData ? join(input.appData, "Microsoft", "Windows", "Start Menu", "Programs", "Codex++.lnk") : null,
    join(input.home, "Desktop", "Codex++.lnk"),
  ].filter((path): path is string => path !== null);

  return [
    "$ErrorActionPreference = 'SilentlyContinue'",
    "$managedPattern = '\\codex-plusplus\\store-apps\\'",
    "$contextKeys = @(",
    ...WINDOWS_CODEX_CONTEXT_MENU_KEYS.map((key) => `  '${escapePowerShellSingleQuotedString(key)}'`),
    ")",
    "foreach ($key in $contextKeys) {",
    "  $commandKey = Join-Path $key 'command'",
    "  $command = $null",
    "  if (Test-Path -LiteralPath $commandKey) {",
    "    try { $command = (Get-Item -LiteralPath $commandKey).GetValue('') } catch {}",
    "  }",
    "  if ($command -and $command.ToString().ToLowerInvariant().Contains($managedPattern)) {",
    "    Remove-Item -LiteralPath $key -Recurse -Force",
    "  }",
    "}",
    "$cleanupPaths = @(",
    ...cleanupPaths.map((path) => `  '${escapePowerShellSingleQuotedString(path)}'`),
    ")",
    "foreach ($path in $cleanupPaths) {",
    "  if (Test-Path -LiteralPath $path) {",
    "    Remove-Item -LiteralPath $path -Recurse -Force",
    "  }",
    "}",
  ].join("\n");
}

function escapePowerShellSingleQuotedString(value: string): string {
  return value.replace(/'/g, "''");
}
