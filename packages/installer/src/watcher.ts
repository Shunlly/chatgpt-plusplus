/**
 * Watcher: a small process scheduled to run at user login that compares the
 * current Codex.app's asar hash against the patched hash we recorded at
 * install. If they don't match, Sparkle has updated Codex over our patch —
 * we either auto-`repair` or surface a notification, depending on user prefs.
 *
 * 各平台实现：
 *   macOS:   ~/Library/LaunchAgents/com.chatgptplusplus.watcher.plist (launchd)
 *   Linux:   ~/.config/systemd/user/chatgpt-plusplus-watcher.service (systemd --user)
 *   Windows: Task Scheduler entry via schtasks.exe
 *
 * watcher 本体就是 `chatgptplusplus repair --quiet`，在应用启动/登录时触发。
 * 最简的跨平台方案是"登录时运行"+ "Codex.app 被修改时运行"（unix 用
 * FSEvents/inotify，macOS 上 launchd 的 WatchPaths 即可）。
 */
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { homedir, platform, userInfo } from "node:os";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chownForTargetUser, targetUserHome, targetUserOwnership } from "./ownership.js";
import { standaloneCliPath } from "./standalone.js";
import { userPaths } from "./paths.js";

export type WatcherKind = "launchd" | "login-item" | "scheduled-task" | "systemd" | "none";

export function installWatcher(appRoot: string): WatcherKind {
  switch (platform()) {
    case "darwin":
      return installLaunchd(appRoot);
    case "linux":
      return installSystemd(appRoot);
    case "win32":
      return installScheduledTask(appRoot);
    default:
      return "none";
  }
}

export function uninstallWatcher(): void {
  switch (platform()) {
    case "darwin":
      return uninstallLaunchd();
    case "linux":
      return uninstallSystemd();
    case "win32":
      return uninstallScheduledTask();
  }
}

const LABEL = "com.chatgptplusplus.watcher";
// 旧项目名的 watcher label，卸载/升级时清理。
const LEGACY_LABEL = "com.codexplusplus.watcher";
// ponytail: 30 分钟轮询兼顾"应用更新后尽快补丁"与低打扰；如需秒级修复可再引入系统级 WatchPaths。
const WATCHER_INTERVAL_SECONDS = 30 * 60;

function launchdPath(): string {
  return join(targetUserHome(), "Library", "LaunchAgents", `${LABEL}.plist`);
}

function launchdLogPath(): string {
  return join(targetUserHome(), "Library", "Logs", "chatgpt-plusplus-watcher.log");
}

function legacyLaunchdPath(): string {
  return join(targetUserHome(), "Library", "LaunchAgents", `${LEGACY_LABEL}.plist`);
}

function installLaunchd(appRoot: string): WatcherKind {
  if (isRunningFromWatcher()) return "launchd";

  // 清理旧项目名的 LaunchAgent（老用户升级后不再残留）。
  uninstallLegacyLaunchd();

  const plPath = launchdPath();
  mkdirSync(dirname(plPath), { recursive: true });
  const logPath = launchdLogPath();
  mkdirSync(dirname(logPath), { recursive: true });
  // Trigger on login + when Codex.app's asar changes. Run this installed CLI
  // directly so auto-repair does not depend on npm availability. The CLI
  // throttles GitHub release checks, so this interval keeps app repair prompt.
  const repair = xmlEscape(watcherShellScript(logPath));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-c</string>
    <string>${repair}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>${WATCHER_INTERVAL_SECONDS}</integer>
  <key>WatchPaths</key>
  <array>
    <string>${appRoot}/Contents/Resources/app.asar</string>
  </array>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>${logPath}</string>
  <key>StandardErrorPath</key>
  <string>${logPath}</string>
  </dict>
</plist>`;
  writeFileSync(plPath, xml);
  writeFileSync(logPath, "", { flag: "a" });
  chownForTargetUser(plPath);
  chownForTargetUser(logPath);
  if (!bootstrapLaunchd(plPath)) {
    try {
      execLaunchctlForTargetUser(["unload", plPath]);
    } catch {}
    execLaunchctlForTargetUser(["load", plPath]);
  }
  return "launchd";
}

function isRunningFromWatcher(): boolean {
  return (
    process.env.CHATGPT_PLUSPLUS_WATCHER === "1" ||
    process.env.CODEX_PLUSPLUS_WATCHER === "1" ||
    process.env.XPC_SERVICE_NAME === LABEL ||
    process.env.XPC_SERVICE_NAME === LEGACY_LABEL
  );
}

function uninstallLaunchd(): void {
  const plPath = launchdPath();
  if (existsSync(plPath)) {
    bootoutLaunchd(plPath);
    try {
      execLaunchctlForTargetUser(["unload", plPath]);
    } catch {}
    rmSync(plPath, { force: true });
  }
  uninstallLegacyLaunchd();
}

function uninstallLegacyLaunchd(): void {
  const plPath = legacyLaunchdPath();
  if (!existsSync(plPath)) return;
  bootoutLaunchd(plPath);
  try {
    execLaunchctlForTargetUser(["unload", plPath]);
  } catch {}
  rmSync(plPath, { force: true });
}

function bootstrapLaunchd(plPath: string): boolean {
  const domain = launchdGuiDomain();
  if (!domain) return false;
  bootoutLaunchd(plPath);
  try {
    execFileSync("launchctl", ["bootstrap", domain, plPath], { stdio: "ignore" });
    execFileSync("launchctl", ["enable", `${domain}/${LABEL}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function bootoutLaunchd(plPath: string): void {
  const domain = launchdGuiDomain();
  if (!domain) return;
  try {
    execFileSync("launchctl", ["bootout", domain, plPath], { stdio: "ignore" });
  } catch {}
}

function launchdGuiDomain(): string | null {
  const uid = targetUserOwnership()?.uid ?? (typeof process.getuid === "function" ? process.getuid() : userInfo().uid);
  return typeof uid === "number" ? `gui/${uid}` : null;
}

function execLaunchctlForTargetUser(args: string[]): void {
  const owner = targetUserOwnership();
  const currentUid = typeof process.getuid === "function" ? process.getuid() : null;
  if (owner && currentUid === 0 && owner.uid !== 0) {
    execFileSync("launchctl", ["asuser", String(owner.uid), "launchctl", ...args], {
      stdio: "ignore",
    });
    return;
  }
  execFileSync("launchctl", args, { stdio: "ignore" });
}

function installSystemd(appRoot: string): WatcherKind {
  const dir = join(homedir(), ".config", "systemd", "user");
  mkdirSync(dir, { recursive: true });
  const repair = shellSingleQuote(watcherShellScript());
  const unit = `[Unit]
Description=chatgpt-plusplus repair watcher

[Service]
Type=oneshot
ExecStart=/bin/sh -c ${repair}

[Install]
WantedBy=default.target
`;
  // 清理旧项目名的 systemd unit（老用户升级后不再残留）。
  uninstallLegacySystemd();
  writeFileSync(join(dir, "chatgpt-plusplus-watcher.service"), unit);
  writeFileSync(join(dir, "chatgpt-plusplus-watcher.timer"), `[Unit]
Description=chatgpt-plusplus repair watcher interval

[Timer]
OnBootSec=5m
OnUnitActiveSec=${Math.round(WATCHER_INTERVAL_SECONDS / 60)}m
Persistent=true

[Install]
WantedBy=timers.target
`);
  writeFileSync(join(dir, "chatgpt-plusplus-watcher.path"), `[Unit]
Description=chatgpt-plusplus app.asar watcher

[Path]
PathChanged=${appRoot}/resources/app.asar

[Install]
WantedBy=default.target
`);
  try {
    execFileSync("systemctl", ["--user", "daemon-reload"], { stdio: "ignore" });
    execFileSync("systemctl", ["--user", "enable", "chatgpt-plusplus-watcher.service"], {
      stdio: "ignore",
    });
    execFileSync("systemctl", ["--user", "enable", "--now", "chatgpt-plusplus-watcher.timer"], {
      stdio: "ignore",
    });
    execFileSync("systemctl", ["--user", "enable", "--now", "chatgpt-plusplus-watcher.path"], {
      stdio: "ignore",
    });
  } catch {
    /* systemd may not be available */
  }
  return "systemd";
}

function uninstallSystemd(): void {
  uninstallLegacySystemd();
  const dir = join(homedir(), ".config", "systemd", "user");
  const path = join(dir, "chatgpt-plusplus-watcher.service");
  if (!existsSync(path)) return;
  try {
    execFileSync("systemctl", ["--user", "disable", "chatgpt-plusplus-watcher.service"], {
      stdio: "ignore",
    });
    execFileSync("systemctl", ["--user", "disable", "--now", "chatgpt-plusplus-watcher.path"], {
      stdio: "ignore",
    });
    execFileSync("systemctl", ["--user", "disable", "--now", "chatgpt-plusplus-watcher.timer"], {
      stdio: "ignore",
    });
  } catch {}
  rmSync(path, { force: true });
  rmSync(join(dir, "chatgpt-plusplus-watcher.path"), { force: true });
  rmSync(join(dir, "chatgpt-plusplus-watcher.timer"), { force: true });
}

function uninstallLegacySystemd(): void {
  const dir = join(homedir(), ".config", "systemd", "user");
  const legacyNames = ["codex-plusplus-watcher.service", "codex-plusplus-watcher.path", "codex-plusplus-watcher.timer"];
  const existing = legacyNames.filter((name) => existsSync(join(dir, name)));
  if (existing.length === 0) return;
  try {
    execFileSync("systemctl", ["--user", "disable", "codex-plusplus-watcher.service"], {
      stdio: "ignore",
    });
    execFileSync("systemctl", ["--user", "disable", "--now", "codex-plusplus-watcher.path"], {
      stdio: "ignore",
    });
    execFileSync("systemctl", ["--user", "disable", "--now", "codex-plusplus-watcher.timer"], {
      stdio: "ignore",
    });
  } catch {}
  for (const name of legacyNames) {
    rmSync(join(dir, name), { force: true });
  }
}

function installScheduledTask(_appRoot: string): WatcherKind {
  // schtasks.exe creates a logon-trigger task. We pass the watcher command via /TR.
  // 先清理旧项目名的任务（老用户升级后不再残留）。
  for (const name of LEGACY_SCHEDULED_TASK_NAMES) deleteScheduledTask(name);
  const repair = windowsWatcherTaskCommand();
  try {
    deleteScheduledTask("chatgpt-plusplus-watcher-daily");
    execFileSync("schtasks.exe", [
      "/Create",
      "/F",
      "/SC",
      "ONLOGON",
      "/TN",
      "chatgpt-plusplus-watcher",
      "/TR",
      repair,
    ]);
    deleteScheduledTask("chatgpt-plusplus-watcher-hourly");
    deleteScheduledTask("chatgpt-plusplus-watcher-interval");
    execFileSync("schtasks.exe", [
      "/Create",
      "/F",
      "/SC",
      "MINUTE",
      "/MO",
      String(Math.round(WATCHER_INTERVAL_SECONDS / 60)),
      "/TN",
      "chatgpt-plusplus-watcher-interval",
      "/TR",
      repair,
    ]);
    return "scheduled-task";
  } catch {
    return "none";
  }
}

const LEGACY_SCHEDULED_TASK_NAMES = [
  "codex-plusplus-watcher",
  "codex-plusplus-watcher-interval",
  "codex-plusplus-watcher-hourly",
  "codex-plusplus-watcher-daily",
];

function cliShellCommand(command: string, args: string[] = []): string {
  // 独立包优先用持久 CLI（macOS 克隆流程会覆盖安装器 app，旁置文件随克隆消失，
  // 不能依赖 isStandalone() 在安装后期仍为 true）。
  const cli = standaloneCliPath();
  if (cli) {
    return ["CHATGPT_PLUSPLUS_WATCHER=1", shellQuote(cli), command, ...args].join(" ");
  }
  const moduleCli = currentCliPath();
  return [
    "CHATGPT_PLUSPLUS_WATCHER=1",
    shellQuote(process.execPath),
    ...nodeExecArgsForCli(moduleCli).map(shellQuote),
    shellQuote(moduleCli),
    command,
    ...args,
  ].join(" ");
}

export function watcherShellScript(logPath?: string): string {
  const commands = [
    "sleep 3",
    `${cliShellCommand("update", ["--watcher", "--quiet", "--no-repair"])} || true`,
    `${cliShellCommand("repair", ["--watcher", "--quiet"])} || true`,
  ];
  if (logPath) commands.unshift(`: > ${shellSingleQuote(logPath)}`);
  return commands.join("; ");
}

function currentCliPath(): string {
  const cli = standaloneCliPath();
  if (cli) return cli;
  const currentModulePath = fileURLToPath(import.meta.url);
  const extension = currentModulePath.endsWith(".ts") ? ".ts" : ".js";
  return join(dirname(currentModulePath), `cli${extension}`);
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function windowsCommand(command: string, args: string[] = []): string {
  const standaloneCli = standaloneCliPath();
  if (standaloneCli) {
    return [windowsQuote(standaloneCli), command, ...args].join(" ");
  }
  const cli = currentCliPath();
  return [
    windowsQuote(process.execPath),
    ...nodeExecArgsForCli(cli).map(windowsQuote),
    windowsQuote(cli),
    command,
    ...args,
  ].join(" ");
}

function nodeExecArgsForCli(cliPath: string): string[] {
  return cliPath.endsWith(".ts") ? process.execArgv : [];
}

function windowsWatcherTaskCommand(): string {
  // watcher.cmd 放在用户数据目录（已迁移为 chatgpt-plusplus）的 bin 下。
  const scriptPath = join(userPaths().binDir, "watcher.cmd");
  const vbsPath = join(userPaths().binDir, "watcher.vbs");
  mkdirSync(dirname(scriptPath), { recursive: true });
  writeFileSync(
    scriptPath,
    [
      "@echo off",
      "set CHATGPT_PLUSPLUS_WATCHER=1",
      `${windowsCommand("update", ["--watcher", "--quiet", "--no-repair"])}`,
      `${windowsCommand("repair", ["--watcher", "--quiet"])}`,
      "exit /b 0",
      "",
    ].join("\r\n"),
  );
  // schtasks 直接运行 .cmd 会弹黑色窗口抢焦点；改由 wscript 经 VBS 隐藏运行。
  writeFileSync(vbsPath, windowsWatcherVbsContent(scriptPath));
  return `wscript.exe ${windowsQuote(vbsPath)}`;
}

function windowsQuote(value: string): string {
  return `"${value.replace(/"/g, `\\"`)}"`;
}

export function windowsWatcherVbsContent(scriptPath: string): string {
  return `CreateObject("WScript.Shell").Run ${vbsEscape(windowsQuote(scriptPath))}, 0, False`;
}

function vbsEscape(value: string): string {
  return value.replace(/"/g, '""');
}

function uninstallScheduledTask(): void {
  for (const name of LEGACY_SCHEDULED_TASK_NAMES) deleteScheduledTask(name);
  deleteScheduledTask("chatgpt-plusplus-watcher");
  deleteScheduledTask("chatgpt-plusplus-watcher-interval");
  deleteScheduledTask("chatgpt-plusplus-watcher-hourly");
  deleteScheduledTask("chatgpt-plusplus-watcher-daily");
}

function deleteScheduledTask(name: string): void {
  for (const taskName of [name, `\\${name}`]) {
    try {
      execFileSync("schtasks.exe", ["/End", "/TN", taskName], { stdio: "ignore" });
    } catch {}
    try {
      execFileSync("schtasks.exe", ["/Change", "/Disable", "/TN", taskName], { stdio: "ignore" });
    } catch {}
    try {
      execFileSync("schtasks.exe", ["/Delete", "/F", "/TN", taskName], {
        stdio: "ignore",
      });
    } catch {}
  }
}
