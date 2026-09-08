/** 宠物/迷你窗（compact-window）克隆主界面，不能跑 tweak，否则点击会话无法跳转。 */
export function isCompactPetWindow(
  locationLike: { href: string; search: string } = location,
  root: { classList: { contains(name: string): boolean } } | null = document.documentElement,
  body: { classList: { contains(name: string): boolean } } | null = document.body,
): boolean {
  if (root?.classList.contains("compact-window")) return true;
  if (body?.classList.contains("compact-window")) return true;
  // 主窗口也可能短暂 about:blank，不能当宠物窗；浮层带 initialRoute。
  try {
    return new URLSearchParams(locationLike.search || "").has("initialRoute");
  } catch {
    return false;
  }
}

/** 桌面宠物 / 活动槽，走 Owl 原生 startDrag，不能当迷你会话窗处理。 */
export function isAvatarOverlayWindow(
  locationLike: { href: string; search: string } = location,
): boolean {
  const href = locationLike.href || "";
  if (/avatar-overlay/i.test(href)) return true;
  try {
    const route = new URLSearchParams(locationLike.search || "").get("initialRoute") || "";
    return /avatar-overlay/i.test(route);
  } catch {
    return false;
  }
}

/** 宠物活动槽 / 徽章的独立 HTML，不是会话页。跑 tweak 会把整应用卡死。 */
export function isAvatarOverlaySurface(
  locationLike: { href: string; search: string } = location,
): boolean {
  return isAvatarOverlayWindow(locationLike);
}

export function shouldSkipTweaks(
  locationLike: { href: string; search: string } = location,
  root: { classList: { contains(name: string): boolean } } | null = document.documentElement,
  body: { classList: { contains(name: string): boolean } } | null = document.body,
): boolean {
  return isCompactPetWindow(locationLike, root, body) || isAvatarOverlaySurface(locationLike);
}
