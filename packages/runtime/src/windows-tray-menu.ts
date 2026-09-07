/** Windows 托盘右键菜单结构，不依赖 Electron 运行时。 */
export function buildWindowsTrayMenuTemplate(handlers: {
  onOpen: () => void;
  onQuit: () => void;
}): Array<{ label?: string; type?: "separator"; click?: () => void }> {
  return [
    { label: "打开 ChatGPT++", click: handlers.onOpen },
    { type: "separator" },
    { label: "退出 ChatGPT++", click: handlers.onQuit },
  ];
}
