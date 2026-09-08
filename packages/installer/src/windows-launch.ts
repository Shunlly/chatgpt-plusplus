/**
 * Windows 启动器：不要让快捷方式直接 ShellExecute 商店镜像里的 ChatGPT++.exe。
 * 那份 exe 带 MSIX 包身份，资源管理器会顺带激活官方 ChatGPT。
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const WINDOWS_PLUSPLUS_AUMID = "com.chatgpt-plusplus.app";

export function isManagedStoreAppsPath(path: string): boolean {
  return /\\chatgpt-plusplus\\store-apps\\/i.test(path.replace(/\//g, "\\"));
}

export function isStaleManagedChatGptShortcutTarget(target: string): boolean {
  const t = target.replace(/\//g, "\\");
  return isManagedStoreAppsPath(t) && /\\chatgpt\.exe$/i.test(t);
}

export function windowsOwlProcessArgs(userDataDir: string): string[] {
  return [
    `--user-data-dir=${userDataDir}`,
    `--app-user-model-id=${WINDOWS_PLUSPLUS_AUMID}`,
  ];
}

export function windowsLauncherDir(localAppData: string): string {
  return join(localAppData, "chatgpt-plusplus", "bin");
}

export function windowsLauncherExe(localAppData: string): string {
  return join(windowsLauncherDir(localAppData), "ChatGPT++.exe");
}

export function writeWindowsLaunchConfig(opts: {
  launcherDir: string;
  owlExe: string;
  userDataDir: string;
}): string {
  mkdirSync(opts.launcherDir, { recursive: true });
  const configPath = join(opts.launcherDir, "launch.json");
  writeFileSync(
    configPath,
    JSON.stringify({ exe: opts.owlExe, userDataDir: opts.userDataDir }, null, 2),
    "utf8",
  );
  return configPath;
}

export function installWindowsLaunchStub(opts: {
  assetsDir: string;
  localAppData: string;
  owlExe: string;
  userDataDir: string;
}): string | null {
  const src = join(opts.assetsDir, "win", "chatgptpp-launch.exe");
  if (!existsSync(src) || !existsSync(opts.owlExe)) return null;
  const dir = windowsLauncherDir(opts.localAppData);
  mkdirSync(dir, { recursive: true });
  const dest = windowsLauncherExe(opts.localAppData);
  copyFileSync(src, dest);
  writeWindowsLaunchConfig({ launcherDir: dir, owlExe: opts.owlExe, userDataDir: opts.userDataDir });
  return dest;
}

export function staleManagedChatGptShortcutCandidates(input: {
  appData?: string;
  home: string;
}): string[] {
  const paths: string[] = [join(input.home, "Desktop", "ChatGPT.lnk")];
  if (input.appData) {
    paths.push(join(input.appData, "Microsoft", "Windows", "Start Menu", "Programs", "ChatGPT.lnk"));
  }
  return paths;
}
