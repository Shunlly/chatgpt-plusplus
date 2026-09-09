import { ipcRenderer } from "electron";
import { isAvatarOverlayWindow } from "./compact-window";

const CHANNEL = "codexpp:pet-drag-by";

export function isOversizedPetDragRect(width: number, height: number, viewW: number, viewH: number): boolean {
  return width >= viewW - 4 && height >= viewH - 4;
}

export function isLikelyPetDragWindow(): boolean {
  if (isAvatarOverlayWindow()) return true;
  return window.innerWidth <= 480 && window.innerHeight <= 720;
}

/** 只拖宠物本体。铺满窗口的空白框既不能拖，也不该吃鼠标。 */
export function isPetDragHandle(target: EventTarget | null): boolean {
  if (!isLikelyPetDragWindow()) return false;
  if (!(target instanceof Element)) return false;
  if (target === document.documentElement || target === document.body) return false;
  if (target.closest(".no-drag, button, a, input, textarea")) return false;
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
  background: transparent !important;
  pointer-events: none !important;
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
}
[data-avatar-overlay-hit-region] {
  pointer-events: none !important;
  background: transparent !important;
}
[data-avatar-overlay-activity-text],
[data-avatar-overlay-native-surface-id] {
  pointer-events: auto !important;
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
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
