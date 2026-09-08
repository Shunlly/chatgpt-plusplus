import { BrowserWindow, ipcMain } from "electron";
const DRAG_CHANNEL = "codexpp:pet-drag-by";

function isPetDragWindow(win: Electron.BrowserWindow | null | undefined): boolean {
  if (!win || win.isDestroyed()) return false;
  try {
    const url = win.webContents.getURL() || "";
    if (/avatar-overlay/i.test(url)) return true;
  } catch {}
  try {
    if (!win.isAlwaysOnTop()) return false;
    const [w, h] = win.getSize();
    return w > 0 && h > 0 && w <= 480 && h <= 720;
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
      if (ignore && isPetDragWindow(this as unknown as Electron.BrowserWindow)) {
        return original.call(this, false);
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

  const unlock = (): void => {
    try {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!isPetDragWindow(win)) continue;
        try { win.setIgnoreMouseEvents(false); } catch {}
        try { win.setMovable(true); } catch {}
      }
    } catch {}
  };
  try { setTimeout(unlock, 2000); } catch {}
  log("windows pet drag installed");
}

export const PET_DRAG_CHANNEL = DRAG_CHANNEL;
