// 渲染进程桥：只暴露主进程封装好的能力。
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("cppp", {
  status: () => ipcRenderer.invoke("status"),
  themes: () => ipcRenderer.invoke("themes"),
  applyTheme: (sel: { type: string; id?: string }) => ipcRenderer.invoke("apply-theme", sel),
  openApp: () => ipcRenderer.invoke("open-app"),
  runCli: (cmd: "install" | "repair" | "uninstall") => ipcRenderer.invoke("run-cli", cmd),
  onCliLog: (cb: (line: string) => void) => {
    const listener = (_e: unknown, line: string) => cb(line);
    ipcRenderer.on("cli-log", listener);
    return () => ipcRenderer.removeListener("cli-log", listener);
  },
});
