import { ipcRenderer } from "electron";
import { isAvatarOverlayWindow } from "./compact-window";

const CHANNEL = "codexpp:pet-drag-by";

export function isOversizedPetDragRect(width: number, height: number, viewW: number, viewH: number): boolean {
  // 宠物小窗几乎被本体铺满，整窗都该能拖；只拒绝大浮层里的铺满空白层。
  if (viewW <= 480 && viewH <= 720) return false;
  return width >= viewW - 4 && height >= viewH - 4;
}

export function isLikelyPetDragWindow(): boolean {
  if (isAvatarOverlayWindow()) return true;
  return window.innerWidth <= 480 && window.innerHeight <= 720;
}

/** 小窗整窗可拖；大浮层只拖本体。 */
export function isPetDragHandle(target: EventTarget | null): boolean {
  if (!isLikelyPetDragWindow()) return false;
  if (!(target instanceof Element)) return false;
  if (target.closest(".no-drag, button, a, input, textarea")) return false;
  if (window.innerWidth <= 480 && window.innerHeight <= 720) return true;
  if (target === document.documentElement || target === document.body) return false;
  const rect = target.getBoundingClientRect();
  if (isOversizedPetDragRect(rect.width, rect.height, window.innerWidth, window.innerHeight)) return false;
  return true;
}

function installCrispPetText(): void {
  const mount = (): void => {
    if (document.getElementById("codexpp-pet-crisp-text")) return;
    const parent = document.head || document.documentElement;
    if (!parent) return;
    const style = document.createElement("style");
    style.id = "codexpp-pet-crisp-text";
    style.textContent = `
html, body {
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
}
[data-avatar-overlay-activity-text],
[data-avatar-overlay-hit-region],
[data-avatar-overlay-native-surface-id] {
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
  -webkit-app-region: drag;
}
button, a, input, textarea, .no-drag {
  -webkit-app-region: no-drag;
}
`;
    parent.appendChild(style);
  };
  if (document.head || document.documentElement) mount();
  else document.addEventListener("DOMContentLoaded", mount, { once: true });
}

export function installPetWindowDrag(): void {
  installCrispPetText();
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  window.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.ctrlKey) return;
    if (!isPetDragHandle(event.target)) return;
    dragging = true;
    lastX = event.screenX;
    lastY = event.screenY;
    try { event.currentTarget === window && (event.target as Element).setPointerCapture?.(event.pointerId); } catch {}
  }, true);
  window.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const dx = event.screenX - lastX;
    const dy = event.screenY - lastY;
    if (!dx && !dy) return;
    lastX = event.screenX;
    lastY = event.screenY;
    try { ipcRenderer.send(CHANNEL, { dx, dy }); } catch {}
  }, true);
  const stop = (): void => { dragging = false; };
  window.addEventListener("pointerup", stop, true);
  window.addEventListener("pointercancel", stop, true);
}
