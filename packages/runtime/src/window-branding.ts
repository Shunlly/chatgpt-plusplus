/**
 * 把官方 26.825 起被改成 ChatGPT 的窗口标题/任务栏标识，改回 ChatGPT++。
 * 不依赖 Electron 类型，方便单测和 preload 共用。
 */

export const CHATGPT_PLUSPLUS_WINDOW_TITLE = "ChatGPT++";
export const CHATGPT_PLUSPLUS_APP_USER_MODEL_ID = "com.chatgpt-plusplus.app";

export function brandedWindowTitle(title: string): string | null {
  const t = String(title ?? "").trim();
  if (!t || /^chatgpt$/i.test(t) || /^codex$/i.test(t) || /^chatgpt desktop$/i.test(t)) {
    return CHATGPT_PLUSPLUS_WINDOW_TITLE;
  }
  if (/chatgpt\+\+/i.test(t)) return null;
  const suffix = t.match(/\s+[\u2014\u2013-]\s+(chatgpt|codex)$/i);
  if (suffix) {
    return `${t.slice(0, suffix.index).trimEnd()} \u2014 ${CHATGPT_PLUSPLUS_WINDOW_TITLE}`;
  }
  return null;
}

type BrandableWindow = {
  isDestroyed(): boolean;
  getTitle(): string;
  setTitle(title: string): void;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  webContents?: { getURL?: () => string };
};

type BrandableWebContents = {
  on(event: string, listener: (...args: unknown[]) => void): unknown;
};

export function isCompactBrandingWindow(win: BrandableWindow | null | undefined): boolean {
  if (!win) return false;
  try {
    const url = win.webContents?.getURL?.() ?? "";
    return new URL(url).searchParams.has("initialRoute");
  } catch {
    return false;
  }
}

export function installWindowBranding(opts: {
  app: {
    setAppUserModelId?: (id: string) => void;
    isReady?: () => boolean;
    whenReady?: () => Promise<unknown>;
    on(event: string, listener: (...args: unknown[]) => void): unknown;
  };
  BrowserWindow: {
    fromWebContents(wc: unknown): BrandableWindow | null;
    getAllWindows(): BrandableWindow[];
  };
  log?: (msg: string) => void;
}): void {
  const log = opts.log ?? (() => {});
  try {
    opts.app.setAppUserModelId?.(CHATGPT_PLUSPLUS_APP_USER_MODEL_ID);
  } catch (e) {
    log(`setAppUserModelId skipped: ${e instanceof Error ? e.message : String(e)}`);
  }

  const branded = new WeakSet<object>();

  const applyTitle = (win: BrandableWindow | null | undefined): void => {
    if (!win || win.isDestroyed() || isCompactBrandingWindow(win)) return;
    const next = brandedWindowTitle(win.getTitle());
    if (!next || win.getTitle() === next) return;
    try {
      win.setTitle(next);
    } catch {}
  };

  const brandWindow = (win: BrandableWindow | null | undefined): void => {
    if (!win || win.isDestroyed() || branded.has(win)) return;
    branded.add(win);
    applyTitle(win);
    win.on("page-title-updated", (...args: unknown[]) => {
      const event = args[0] as { preventDefault?: () => void } | undefined;
      const title = typeof args[1] === "string" ? args[1] : win.getTitle();
      const next = brandedWindowTitle(title);
      if (!next) return;
      try { event?.preventDefault?.(); } catch {}
      try { if (!win.isDestroyed()) win.setTitle(next); } catch {}
    });
  };

  const brandWebContents = (wc: BrandableWebContents): void => {
    try {
      brandWindow(opts.BrowserWindow.fromWebContents(wc));
      wc.on("page-title-updated", (...args: unknown[]) => {
        const event = args[0] as { preventDefault?: () => void } | undefined;
        const title = typeof args[1] === "string" ? args[1] : "";
        const next = brandedWindowTitle(title);
        if (!next) return;
        try { event?.preventDefault?.(); } catch {}
        const win = opts.BrowserWindow.fromWebContents(wc);
        try {
          if (win && !win.isDestroyed() && !isCompactBrandingWindow(win)) win.setTitle(next);
        } catch {}
      });
    } catch {}
  };

  const brandExisting = (): void => {
    try {
      for (const win of opts.BrowserWindow.getAllWindows()) brandWindow(win);
    } catch {}
  };

  opts.app.on("web-contents-created", (...args: unknown[]) => {
    const wc = args[1] as BrandableWebContents | undefined;
    if (wc) brandWebContents(wc);
  });
  brandExisting();
  if (opts.app.isReady?.()) brandExisting();
  else void opts.app.whenReady?.().then(() => brandExisting());
  log(`window branding installed title=${CHATGPT_PLUSPLUS_WINDOW_TITLE}`);
}

