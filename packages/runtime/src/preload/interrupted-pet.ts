/**
 * 宠物窗轻量层：列出上次关掉时还在跑的会话。
 * 不能走 tweak 宿主，否则点击会话又会跳不出去。
 */
import { ipcRenderer } from "electron";
import { isAvatarOverlayWindow, isCompactPetWindow } from "./compact-window";
import {
  parseTrayRunning,
  shouldApplyRunning,
  type ThreadRef,
} from "../interrupted-threads";

const HOST_ID = "codexpp-interrupted-pet";
let captureInstalled = false;
let overlayStarted = false;

export function installRunningThreadCapture(): void {
  if (captureInstalled) return;
  captureInstalled = true;
  hookIpcInvoke();
}

export function noteViewMessage(message: unknown): void {
  const running = parseTrayRunning(message);
  if (running == null) return;
  if (!shouldApplyRunning(running, isCompactPetWindow())) return;
  ipcRenderer.send("codexpp:running-threads", running);
}

export function startInterruptedPetOverlay(): void {
  if (overlayStarted || !isCompactPetWindow() || isAvatarOverlayWindow()) return;
  overlayStarted = true;
  const boot = () => {
    void refreshOverlay();
    ipcRenderer.on("codexpp:interrupted-changed", (_e, list: unknown) => {
      renderOverlay(Array.isArray(list) ? list.filter(isThreadRef) : []);
    });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}

function hookIpcInvoke(): void {
  const orig = ipcRenderer.invoke.bind(ipcRenderer);
  const hooked = (channel: string, ...args: unknown[]) => {
    try {
      if (channel === "codex_desktop:message-from-view") noteViewMessage(args[0]);
    } catch {}
    return orig(channel, ...args);
  };
  try {
    (ipcRenderer as { invoke: typeof hooked }).invoke = hooked;
  } catch {
    try {
      Object.defineProperty(ipcRenderer, "invoke", { configurable: true, value: hooked });
    } catch {}
  }
}

async function refreshOverlay(): Promise<void> {
  try {
    const list = await ipcRenderer.invoke("codexpp:list-interrupted-threads");
    renderOverlay(Array.isArray(list) ? list.filter(isThreadRef) : []);
  } catch {
    renderOverlay([]);
  }
}

function renderOverlay(list: ThreadRef[]): void {
  let host = document.getElementById(HOST_ID);
  if (list.length === 0) {
    host?.remove();
    return;
  }
  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    const parent = document.documentElement || document.body;
    if (!parent) return;
    parent.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>${overlayCss()}</style><div class="box"></div>`;
    shadow.querySelector(".box")?.addEventListener("click", onOverlayClick);
  }
  const box = host.shadowRoot?.querySelector(".box");
  if (!box) return;
  const zh = /^zh/i.test(navigator.language || "");
  const untitled = zh ? "未命名会话" : "Untitled";
  const heading = zh ? "中断的会话" : "Interrupted";
  box.innerHTML =
    `<div class="head">${esc(heading)}</div>` +
    list
      .map((t) => {
        const title = esc(t.title || untitled);
        return `<button type="button" class="row" data-open="${esc(t.id)}">
          <span class="title">${title}</span>
          <span class="x" data-dismiss="${esc(t.id)}" title="${zh ? "忽略" : "Dismiss"}">×</span>
        </button>`;
      })
      .join("");
}

function onOverlayClick(event: Event): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const dismiss = target.closest("[data-dismiss]")?.getAttribute("data-dismiss");
  if (dismiss) {
    event.preventDefault();
    event.stopPropagation();
    ipcRenderer.invoke("codexpp:dismiss-interrupted-thread", dismiss).catch(() => {});
    return;
  }
  const open = target.closest("[data-open]")?.getAttribute("data-open");
  if (!open) return;
  event.preventDefault();
  event.stopPropagation();
  ipcRenderer.invoke("codexpp:open-interrupted-thread", open).catch(() => {});
}

function isThreadRef(value: unknown): value is ThreadRef {
  if (!value || typeof value !== "object") return false;
  const rec = value as Record<string, unknown>;
  return typeof rec.id === "string" && typeof rec.path === "string";
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function overlayCss(): string {
  return `
:host {
  position: fixed;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  max-width: calc(100% - 16px);
  z-index: 2147483646;
  pointer-events: none;
  font: 12px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #f4f4f5;
}
.box {
  pointer-events: auto;
  max-width: 280px;
  margin: 0 auto;
  padding: 6px;
  border-radius: 10px;
  background: rgba(24, 24, 27, .86);
  box-shadow: 0 8px 24px rgba(0,0,0,.28);
  backdrop-filter: blur(10px);
}
.head {
  padding: 2px 8px 4px;
  font-size: 11px;
  letter-spacing: .02em;
  opacity: .7;
}
.row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  margin: 0;
  padding: 6px 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-app-region: no-drag;
}
.row:hover { background: rgba(255,255,255,.08); }
.title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.x {
  flex: none;
  width: 18px;
  height: 18px;
  line-height: 16px;
  text-align: center;
  border-radius: 9px;
  opacity: .55;
}
.x:hover { opacity: 1; background: rgba(255,255,255,.12); }
`;
}
