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
      if (isPetDragWindow(this as unknown as Electron.BrowserWindow)) {
        // 透明像素点透，不透明宠物本体把事件转回窗口。整框 ignore=false 会让空白处也能右键。
        return original.call(this, true, { forward: true });
      }
      return original.call(this, ignore, opts);
    };
  }

  const pierce = (win?: Electron.BrowserWindow | null): void => {
    const windows = win ? [win] : BrowserWindow.getAllWindows();
    for (const item of windows) {
      if (!isPetDragWindow(item)) continue;
      try { item.setIgnoreMouseEvents(true, { forward: true }); } catch {}
      try { item.setMovable(true); } catch {}
    }
  };

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
    const arm = (): void => {
      try { pierce(BrowserWindow.fromWebContents(wc)); } catch {}
    };
    wc.on("did-finish-load", arm);
    wc.on("did-navigate", arm);
  });

  try { setTimeout(() => pierce(), 500); } catch {}
  try { setTimeout(() => pierce(), 2000); } catch {}
  log("windows pet drag installed");
}

export const PET_DRAG_CHANNEL = DRAG_CHANNEL;
