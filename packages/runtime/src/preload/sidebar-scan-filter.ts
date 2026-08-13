// 侧边栏扫描过滤：只有变化发生在已判定侧边栏区域内、或该区域被替换/移除时
// 才需要全量重扫；聊天区/内容区的每帧 DOM 变化与侧边栏注入无关，直接跳过，
// 避免全量扫描所有 div 卡死主线程。纯函数，独立于 Electron，便于单元测试。
export function mutationsTouchSidebar(
  records: MutationRecord[],
  area: HTMLElement | null,
): boolean {
  if (!area) return true;
  if (!area.isConnected) return true;
  return records.some((r) => {
    const target = r.target;
    return (
      target === area ||
      (typeof area.contains === "function" && area.contains(target as Node))
    );
  });
}
