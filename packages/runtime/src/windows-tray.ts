/**
 * Windows 托盘：商店镜像没有 MSIX 包身份，官方 NotifyIcon 经常不出现。
 * 用 Electron Tray 补一个可见的 ChatGPT++ 托盘图标，并提供右键菜单。
 */
import { Tray, Menu, nativeImage, app, BrowserWindow } from "electron";
import { buildWindowsTrayMenuTemplate } from "./windows-tray-menu";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { isCompactBrandingWindow } from "./window-branding";

let tray: Tray | null = null;

export function showMainWindow(): void {
  const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
  const main = wins.find((w) => !isCompactBrandingWindow(w)) ?? wins[0];
  if (!main) return;
  if (main.isMinimized()) main.restore();
  main.show();
  main.focus();
}

export function quitFromTray(): void {
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
  }, 1500);
}

export function installWindowsTrayFallback(log: (msg: string) => void): void {
  if (process.platform !== "win32") return;
  const start = (): void => {
    try {
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
      tray = new Tray(small.isEmpty() ? img : small);
      tray.setToolTip("ChatGPT++");
      tray.setIgnoreDoubleClickEvents(true);
      const menu = Menu.buildFromTemplate(
        buildWindowsTrayMenuTemplate({
          onOpen: showMainWindow,
          onQuit: quitFromTray,
        }),
      );
      tray.setContextMenu(menu);
      tray.on("click", showMainWindow);
      tray.on("right-click", () => {
        try {
          tray?.popUpContextMenu(menu);
        } catch {}
      });
      log(`windows tray fallback installed icon=${iconPath}`);
    } catch (e) {
      log(`windows tray fallback failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  if (app.isReady()) setTimeout(start, 2000);
  else void app.whenReady().then(() => setTimeout(start, 2000));
}
