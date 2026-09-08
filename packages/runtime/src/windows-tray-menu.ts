/** Windows 托盘右键菜单结构，不依赖 Electron 运行时。 */
export type TrayRecentItem = {
  title: string;
  path: string;
};

export type TrayMenuItem = {
  label?: string;
  type?: "separator" | "normal" | "submenu";
  enabled?: boolean;
  click?: () => void;
  submenu?: TrayMenuItem[];
};

export function buildWindowsTrayMenuTemplate(handlers: {
  onOpen: () => void;
  onQuit: () => void;
  onNewChat?: () => void;
  onSendFeedback?: () => void;
  recent?: TrayRecentItem[];
  onOpenRecent?: (path: string) => void;
}): TrayMenuItem[] {
  const recent = handlers.recent ?? [];
  const recentItems: TrayMenuItem[] = recent.length
    ? recent.map((item) => ({
        label: item.title || "未命名会话",
        click: () => handlers.onOpenRecent?.(item.path),
      }))
    : [{ label: "暂无最近会话", enabled: false }];
  if (recent.length >= 8) {
    recentItems.push({ type: "separator" }, { label: "更多", click: handlers.onOpen });
  }
  return [
    { label: "最近", type: "submenu", submenu: recentItems },
    { label: "新对话", click: handlers.onNewChat ?? handlers.onOpen },
    { label: "发送反馈", click: handlers.onSendFeedback ?? handlers.onOpen },
    { type: "separator" },
    { label: "退出", click: handlers.onQuit },
  ];
}
