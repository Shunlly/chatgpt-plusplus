/**
 * Windows 托盘：只保留一个 ChatGPT++ 图标。
 * Owl 自己也会建托盘（常叫 ChatGPT），我们再补一个就会并排出现。
 */
import { Tray, Menu, nativeImage, app, BrowserWindow } from "electron";
import { buildWindowsTrayMenuTemplate, type TrayRecentItem } from "./windows-tray-menu";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { isCompactBrandingWindow } from "./window-branding";
import { killChatgptPlusPlusCompanions, killForeignChatgptProcesses } from "./windows-quit";

export const CHATGPT_PLUSPLUS_TRAY_TOOLTIP = "ChatGPT++";

let tray: Tray | null = null;
let patched = false;

export function showMainWindow(): void {
  const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
  const main = wins.find((w) => !isCompactBrandingWindow(w)) ?? wins[0];
  if (!main) return;
  if (main.isMinimized()) main.restore();
  main.show();
  main.focus();
}

export function quitFromTray(): void {
  try { killChatgptPlusPlusCompanions(process.pid); } catch {}
  try {
    for (const win of BrowserWindow.getAllWindows()) {
      try {
        if (!win.isDestroyed()) win.close();
      } catch {}
    }
  } catch {}
  try {
    app.quit();
  } catch {}
  setTimeout(() => {
    try {
      app.exit(0);
    } catch {}
    process.exit(0);
  }, 800);
}

const requireElectron = createRequire(__filename);

function electronTrayHost(): { Tray: typeof Tray } {
  return requireElectron("electron") as { Tray: typeof Tray };
}

type TrayActions = {
  onNewChat: () => void;
  onSendFeedback: () => void;
  listRecent: () => TrayRecentItem[];
  onOpenRecent: (path: string) => void;
};

let trayActions: TrayActions = {
  onNewChat: showMainWindow,
  onSendFeedback: showMainWindow,
  listRecent: () => [],
  onOpenRecent: () => {},
};

export function setWindowsTrayActions(next: Partial<TrayActions>): void {
  trayActions = { ...trayActions, ...next };
}

function applyTrayChrome(target: Tray): void {
  try { target.setToolTip(CHATGPT_PLUSPLUS_TRAY_TOOLTIP); } catch {}
  try { target.setIgnoreDoubleClickEvents(true); } catch {}
  // Owl 已经挂了完整右键菜单（最近/新对话/反馈/退出），不要覆盖。
  try {
    if (typeof target.listenerCount === "function" && target.listenerCount("right-click") > 0) return;
  } catch {}
  try {
    const menu = Menu.buildFromTemplate(
      buildWindowsTrayMenuTemplate({
        onOpen: showMainWindow,
        onQuit: quitFromTray,
        onNewChat: () => trayActions.onNewChat(),
        onSendFeedback: () => trayActions.onSendFeedback(),
        recent: trayActions.listRecent(),
        onOpenRecent: (path) => trayActions.onOpenRecent(path),
      }),
    );
    target.setContextMenu(menu);
    target.removeAllListeners("click");
    target.removeAllListeners("right-click");
    target.on("click", showMainWindow);
    target.on("right-click", () => {
      try { target.popUpContextMenu(menu); } catch {}
    });
  } catch {}
}

function adoptTray(inst: Tray): void {
  try { inst.setToolTip(CHATGPT_PLUSPLUS_TRAY_TOOLTIP); } catch {}
  const orig = inst.setToolTip.bind(inst);
  inst.setToolTip = () => orig(CHATGPT_PLUSPLUS_TRAY_TOOLTIP);
  if (tray && tray !== inst && !tray.isDestroyed()) {
    setTimeout(() => {
      try { if (!inst.isDestroyed()) inst.destroy(); } catch {}
    }, 0);
    return;
  }
  tray = inst;
}

function patchElectronTray(): void {
  if (patched) return;
  const host = electronTrayHost();
  const Orig = host.Tray as typeof Tray & { __chatgptppPatched?: boolean };
  if (!Orig || Orig.__chatgptppPatched) return;
  function BrandedTray(this: Tray, ...args: unknown[]) {
    const inst = new (Orig as unknown as { new (...a: unknown[]): Tray })(...args);
    adoptTray(inst);
    return inst;
  }
  Object.setPrototypeOf(BrandedTray, Orig);
  Object.setPrototypeOf(BrandedTray.prototype, Orig.prototype);
  (BrandedTray as unknown as { __chatgptppPatched: boolean }).__chatgptppPatched = true;
  host.Tray = BrandedTray as unknown as typeof Tray;
  patched = true;
}

function createFallbackTray(log: (msg: string) => void): void {
  if (tray && !tray.isDestroyed()) return;
  const resources = process.resourcesPath;
  const iconPath = [
    join(resources, "chatgpt-tray-dark.ico"),
    join(resources, "chatgpt-app-dark.ico"),
    join(resources, "icon-chatgpt.ico"),
  ].find((p) => existsSync(p));
  if (!iconPath) {
    log("windows tray fallback skipped: icon not found");
    return;
  }
  const img = nativeImage.createFromPath(iconPath);
  if (img.isEmpty()) {
    log(`windows tray fallback skipped: empty icon ${iconPath}`);
    return;
  }
  const small = img.resize({ width: 16, height: 16 });
  const HostTray = electronTrayHost().Tray;
  tray = new HostTray(small.isEmpty() ? img : small);
  log(`windows tray fallback installed icon=${iconPath}`);
}

export function installWindowsTrayFallback(log: (msg: string) => void): void {
  if (process.platform !== "win32") return;
  try {
    app.on("before-quit", () => {
      try { killChatgptPlusPlusCompanions(process.pid); } catch {}
    });
  } catch {}
  try { patchElectronTray(); } catch (e) {
    log(`windows tray patch skipped: ${e instanceof Error ? e.message : String(e)}`);
  }
  const kickForeign = (): void => {
    try { killForeignChatgptProcesses(process.pid); } catch {}
  };
  try {
    if (app.isReady()) kickForeign();
    else void app.whenReady().then(kickForeign);
  } catch {}
  const start = (): void => {
    try {
      try { killForeignChatgptProcesses(process.pid); } catch {}
      if (!tray || tray.isDestroyed()) createFallbackTray(log);
      if (tray && !tray.isDestroyed()) applyTrayChrome(tray);
    } catch (e) {
      log(`windows tray fallback failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  // Owl 自己的托盘稍后才建；先补丁，晚一点再决定要不要加我们的。
  if (app.isReady()) setTimeout(start, 4000);
  else void app.whenReady().then(() => setTimeout(start, 4000));
}
