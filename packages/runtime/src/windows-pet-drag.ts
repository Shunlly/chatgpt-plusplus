import { app, BrowserWindow, ipcMain } from "electron";

const DRAG_CHANNEL = "codexpp:pet-drag-by";

function isPetDragWindow(win: Electron.BrowserWindow | null | undefined): boolean {
  if (!win || win.isDestroyed()) return false;
  try {
    const url = win.webContents.getURL() || "";
    if (/avatar-overlay|compact-window/i.test(url)) return true;
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
      // Owl 会把宠物窗设成点透，鼠标到不了渲染进程，拖动监听永远不着火。
      if (ignore && isPetDragWindow(this as unknown as Electron.BrowserWindow)) {
        return original.call(this, false);
      }
      return original.call(this, ignore, opts);
    };
  }

  const unlock = (win?: Electron.BrowserWindow | null): void => {
    const windows = win ? [win] : BrowserWindow.getAllWindows();
    for (const item of windows) {
      if (!isPetDragWindow(item)) continue;
      try { item.setIgnoreMouseEvents(false); } catch {}
      try { item.setMovable(true); } catch {}
    }
  };

  ipcMain.on(DRAG_CHANNEL, (event, payload: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return;
    unlock(win);
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
    const arm = (): void => {
      try { unlock(BrowserWindow.fromWebContents(wc)); } catch {}
    };
    wc.on("did-finish-load", arm);
    wc.on("did-navigate", arm);
  });

  try { setTimeout(() => unlock(), 500); } catch {}
  try { setTimeout(() => unlock(), 2000); } catch {}
  log("windows pet drag installed");
}

export const PET_DRAG_CHANNEL = DRAG_CHANNEL;
