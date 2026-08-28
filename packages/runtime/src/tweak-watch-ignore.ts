/** 热重载监视忽略规则。Windows 路径是反斜杠，不能写死 `/node_modules/`。 */
export function shouldIgnoreTweakWatchPath(p: string): boolean {
  const n = p.replace(/\\/g, "/");
  if (/(^|\/)(?:node_modules|\.git)(?:\/|$)/.test(n)) return true;
  if (/(?:^|\/)(?:Thumbs\.db|\.DS_Store)$/i.test(n)) return true;
  // 读主题图会触发 Windows 杀毒/atime，再被当成变更 → 整包热重载卡死。
  if (/\.(?:jpe?g|png|webp|gif|ico|icns|woff2?|mp4)$/i.test(n)) return true;
  return false;
}

export const TWEAK_RELOAD_DEBOUNCE_MS = process.platform === "win32" ? 1500 : 250;
