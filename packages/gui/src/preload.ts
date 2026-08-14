// 渲染进程桥：只暴露主进程封装好的能力。
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("cppp", {
  status: () => ipcRenderer.invoke("status"),
  themes: () => ipcRenderer.invoke("themes"),
  // 按需取主题预览图（data URL）。主题列表不再内嵌 base64，避免首屏阻塞。
  themeArt: (type: "preset" | "custom", id: string) => ipcRenderer.invoke("theme-art", type, id),
  // 创建自定义主题（拖拽/选择上传图片），返回新主题记录。
  createTheme: (input: { name?: string; dataUrl?: string }) =>
    ipcRenderer.invoke("create-theme", input),
  applyTheme: (sel: { type: string; id?: string }) => ipcRenderer.invoke("apply-theme", sel),
  openApp: () => ipcRenderer.invoke("open-app"),
  runCli: (cmd: "install" | "repair" | "uninstall") => ipcRenderer.invoke("run-cli", cmd),
  onCliLog: (cb: (line: string) => void) => {
    const listener = (_e: unknown, line: string) => cb(line);
    ipcRenderer.on("cli-log", listener);
    return () => ipcRenderer.removeListener("cli-log", listener);
  },
});
