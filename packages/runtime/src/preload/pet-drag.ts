import { ipcRenderer } from "electron";
import { isAvatarOverlayWindow } from "./compact-window";

const CHANNEL = "codexpp:pet-drag-by";

export function installPetWindowDrag(): void {
  if (!isAvatarOverlayWindow()) return;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  window.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.ctrlKey) return;
    const target = event.target;
    if (!(target instanceof Element) || target.closest(".no-drag, button, a, input, textarea")) return;
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
