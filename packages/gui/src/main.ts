// ChatGPT++ 独立 GUI 主进程：安装状态、安装/修复/卸载、打开 ChatGPT、主题管理。
// CLI 二进制随包放在 Resources/cli/（standalone.json 在同级 Resources，CLI 可自发现资源）。
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const TWEAK_ID = "com.codexplusplus.dream-skin";

function userRoot(): string {
  const home = homedir();
  return process.platform === "darwin"
    ? join(home, "Library", "Application Support", "chatgpt-plusplus")
    : join(process.env.APPDATA ?? join(home, "AppData", "Roaming"), "chatgpt-plusplus");
}
const tweakDir = () => join(userRoot(), "tweaks", TWEAK_ID);
const tweakDataDir = () => join(userRoot(), "tweak-data", TWEAK_ID);

function cliPath(): string {
  return join(process.resourcesPath, "cli", process.platform === "win32" ? "chatgpt-plusplus.exe" : "chatgpt-plusplus");
}

function tryReadJson(file: string): unknown | null {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

// 打开补丁后的官方应用主界面（ChatGPT++ 是增强层，入口即 ChatGPT/Codex 本体）。
async function openPatchedApp(): Promise<{ ok: boolean; error: string | null }> {
  const state = tryReadJson(join(userRoot(), "state.json")) as { appRoot?: string } | null;
  const candidates =
    process.platform === "win32"
      ? [state?.appRoot].filter((p): p is string => !!p && existsSync(p))
      : ["/Applications/ChatGPT.app", "/Applications/Codex.app"].filter(existsSync);
  for (const appPath of candidates) {
    const err = await shell.openPath(appPath);
    if (!err) return { ok: true, error: null };
  }
  return { ok: false, error: "未找到已补丁的 ChatGPT/Codex 应用，请先安装" };
}

function status() {
  const state = tryReadJson(join(userRoot(), "state.json")) as { version?: string; appRoot?: string } | null;
  const apps = ["/Applications/ChatGPT.app", "/Applications/Codex.app"].filter(existsSync);
  return {
    installed: !!state,
    version: state?.version ?? null,
    appRoot: state?.appRoot ?? null,
    apps,
    cliReady: existsSync(cliPath()),
  };
}

// 主题列表：预设（tweak 包内）+ 自定义（tweak-data）+ 当前选择（磁盘桥接文件）。
function themes() {
  const presets: { id: string; name: string; art: string | null }[] = [];
  const presetRoot = join(tweakDir(), "presets");
  if (existsSync(presetRoot)) {
    for (const id of readdirSync(presetRoot)) {
      try {
        const theme = JSON.parse(readFileSync(join(presetRoot, id, "theme.json"), "utf8"));
        const artFile = join(presetRoot, id, "background.jpg");
        const art = existsSync(artFile) ? "data:image/jpeg;base64," + readFileSync(artFile).toString("base64") : null;
        presets.push({ id, name: theme.name ?? id, art });
      } catch {
        // 单个预设损坏不影响其它主题
      }
    }
  }
  const custom: { id: string; name: string; art: string | null }[] = [];
  const index = tryReadJson(join(tweakDataDir(), "custom", "index.json")) as { id: string; name?: string }[] | null;
  if (Array.isArray(index)) {
    for (const rec of index) {
      const recFile = join(tweakDataDir(), "custom", `${rec.id}.json`);
      const data = tryReadJson(recFile) as { name?: string; artUrl?: string } | null;
      custom.push({ id: rec.id, name: data?.name ?? rec.name ?? rec.id, art: data?.artUrl ?? null });
    }
  }
  const selection = tryReadJson(join(tweakDataDir(), "selection.json")) as { type?: string; id?: string } | null;
  return { presets, custom, selection };
}

function applyTheme(sel: { type: string; id?: string }): { ok: boolean; error?: string } {
  try {
    mkdirSync(tweakDataDir(), { recursive: true });
    writeFileSync(join(tweakDataDir(), "selection.json"), JSON.stringify(sel), "utf8");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

let logWindow: BrowserWindow | null = null;
function runCli(args: string[], win: BrowserWindow): Promise<{ code: number | null }> {
  return new Promise((resolve) => {
    const push = (data: Buffer) => {
      if (!win.isDestroyed()) win.webContents.send("cli-log", data.toString().trimEnd());
    };
    // Windows 上打补丁需要管理员权限（官方应用在 WindowsApps 受保护），
    // 通过 PowerShell Start-Process -Verb RunAs 触发 UAC 提权执行。
    if (process.platform === "win32" && args[0] !== "uninstall") {
      const cli = cliPath().replace(/'/g, "''");
      const argsPart = args.map((a) => a.replace(/'/g, "''")).join(" ");
      const ps = [
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-Command",
        `$p = Start-Process -FilePath '${cli}' -ArgumentList '${argsPart}' -Verb RunAs -Wait -PassThru; exit $p.ExitCode`,
      ];
      const child = spawn("powershell.exe", ps, { stdio: ["ignore", "pipe", "pipe"] });
      child.stdout?.on("data", push);
      child.stderr?.on("data", push);
      child.on("error", (e) => push(Buffer.from(String(e))));
      child.on("close", (code) => resolve({ code }));
      return;
    }
    const child: ChildProcess = spawn(cliPath(), args, { stdio: ["ignore", "pipe", "pipe"] });
    child.stdout?.on("data", push);
    child.stderr?.on("data", push);
    child.on("error", (e) => push(Buffer.from(String(e))));
    child.on("close", (code) => resolve({ code }));
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 460,
    height: 700,
    title: "ChatGPT++",
    backgroundColor: "#10131a",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(join(__dirname, "renderer.html"));
  win.on("closed", () => {
    if (logWindow === win) logWindow = null;
  });
  return win;
}

app.whenReady().then(async () => {
  // 已安装：ChatGPT++ 的入口就是补丁后的官方应用主界面，直接打开并退出自身；
  // 未安装（首次使用）：显示引导面板执行安装。
  const state = tryReadJson(join(userRoot(), "state.json")) as { version?: string } | null;
  if (state) {
    const opened = await openPatchedApp();
    if (opened.ok) {
      app.quit();
      return;
    }
  }
  const win = createWindow();
  logWindow = win;
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  ipcMain.handle("status", () => status());
  ipcMain.handle("themes", () => themes());
  ipcMain.handle("apply-theme", (_e, sel: { type: string; id?: string }) => applyTheme(sel));
  ipcMain.handle("open-app", () => openPatchedApp());
  ipcMain.handle("run-cli", async (_e, cmd: "install" | "repair" | "uninstall") => {
    const target = logWindow ?? win;
    return runCli([cmd], target);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
