import { app, BrowserWindow, ipcMain } from "electron";

const DRAG_CHANNEL = "codexpp:pet-drag-by";
const HIT_CHANNEL = "codexpp:pet-hit-test";

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
  const interactive = new WeakMap<Electron.BrowserWindow, boolean>();
  const setPetMouseMode = (win: Electron.BrowserWindow, canReceiveMouse: boolean): void => {
    interactive.set(win, canReceiveMouse);
    try { original.call(win, !canReceiveMouse, { forward: true }); } catch {}
  };

  if (typeof original === "function") {
    proto.setIgnoreMouseEvents = function (ignore: boolean, opts?: { forward?: boolean }) {
      if (isPetOverlayWindow(this as unknown as Electron.BrowserWindow)) {
        const win = this as unknown as Electron.BrowserWindow;
        // Owl 可能再次调用该 API；保持由 preload 命中测试决定的状态，避免整框变成可点击。
        return original.call(win, !(interactive.get(win) === true), { forward: true });
      }
      return original.call(this, ignore, opts);
    };
  }

  ipcMain.on(HIT_CHANNEL, (event, payload: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || !isPetOverlayWindow(win)) return;
    const canReceiveMouse = !!(payload && typeof payload === "object" && (payload as { active?: unknown }).active === true);
    if (interactive.get(win) === canReceiveMouse) return;
    setPetMouseMode(win, canReceiveMouse);
  });

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
      setPetMouseMode(win, false);
      try { win.setMovable(true); } catch {}
    });
  });

  log("windows pet drag installed");
}

export const PET_DRAG_CHANNEL = DRAG_CHANNEL;
export const PET_HIT_CHANNEL = HIT_CHANNEL;
