import { app, BrowserWindow, ipcMain } from "electron";

const DRAG_CHANNEL = "codexpp:pet-drag-by";

function isPetOverlayWindow(win: Electron.BrowserWindow | null | undefined): boolean {
  if (!win || win.isDestroyed()) return false;
  try {
    return /avatar-overlay/i.test(win.webContents.getURL() || "");
  } catch {
    return false;
  }
}

export function installWindowsPetDrag(log: (msg: string) => void): void {
  if (process.platform !== "win32") return;

  const proto = BrowserWindow.prototype as Electron.BrowserWindow & {
    setIgnoreMouseEvents: (ignore: boolean, opts?: { forward?: boolean }) => void;
  };
  const original = proto.setIgnoreMouseEvents;
  if (typeof original === "function") {
    proto.setIgnoreMouseEvents = function (ignore: boolean, opts?: { forward?: boolean }) {
      if (isPetOverlayWindow(this as unknown as Electron.BrowserWindow)) {
        return original.call(this, true, { forward: true });
      }
      return original.call(this, ignore, opts);
    };
  }

  ipcMain.on(DRAG_CHANNEL, (event, payload: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return;
    const rec = payload && typeof payload === "object" ? payload as { dx?: unknown; dy?: unknown } : {};
    const dx = typeof rec.dx === "number" ? rec.dx : 0;
    const dy = typeof rec.dy === "number" ? rec.dy : 0;
    if (!dx && !dy) return;
    try {
      const [x, y] = win.getPosition();
      win.setPosition(Math.round(x + dx), Math.round(y + dy));
    } catch {}
  });

  app.on("web-contents-created", (_e, wc) => {
    wc.on("did-finish-load", () => {
      const win = BrowserWindow.fromWebContents(wc);
      if (!isPetOverlayWindow(win) || !win) return;
      try { win.setIgnoreMouseEvents(true, { forward: true }); } catch {}
      try { win.setMovable(true); } catch {}
    });
  });

  log("windows pet drag installed");
}

export const PET_DRAG_CHANNEL = DRAG_CHANNEL;
