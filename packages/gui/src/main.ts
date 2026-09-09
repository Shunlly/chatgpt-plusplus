// ChatGPT++ 独立 GUI 主进程：安装状态、安装/修复/卸载、打开 ChatGPT、主题管理。
// CLI 二进制随包放在 Resources/cli/（standalone.json 在同级 Resources，CLI 可自发现资源）。
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

// tweak id 自改名后未变：老用户数据按此 id 存储，改动会导致主题/设置丢失，勿改。
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
function winIsolatedUserDataDir(): string {
  return join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "ChatGPT++");
}

async function openPatchedApp(): Promise<{ ok: boolean; error: string | null }> {
  if (process.platform === "win32") {
    const launched = await launchWindowsChatgptPlusPlus();
    if (launched) return { ok: true, error: null };
    return { ok: false, error: "未找到已补丁的 ChatGPT++，请先点安装。也可以直接点桌面的 ChatGPT++ 快捷方式。" };
  }
  const state = tryReadJson(join(userRoot(), "state.json")) as { appRoot?: string } | null;
  const candidates: string[] = [];
  if (state?.appRoot && existsSync(state.appRoot)) candidates.push(state.appRoot);
  candidates.push("/Applications/ChatGPT.app", "/Applications/Codex.app");
  for (const appPath of candidates) {
    if (!existsSync(appPath)) continue;
    const err = await shell.openPath(appPath);
    if (!err) return { ok: true, error: null };
  }
  return { ok: false, error: "未找到已补丁的 ChatGPT/Codex 应用，请先安装" };
}

function winLauncherStub(): string {
  return join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "chatgpt-plusplus", "bin", "ChatGPT++.exe");
}

function spawnDetached(exe: string, args: string[] = []): boolean {
  try {
    if (!exe || !existsSync(exe)) return false;
    const child = spawn(exe, args, {
      detached: true,
      stdio: "ignore",
      cwd: dirname(exe),
      windowsHide: false,
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

function winLaunchArgs(userDataDir?: string): string[] {
  return [
    `--user-data-dir=${userDataDir || winIsolatedUserDataDir()}`,
    "--app-user-model-id=com.chatgpt-plusplus.app",
  ];
}

/** Windows 只打开 ChatGPT++ 启动器/ChatGPT++.exe，避免再拉起一份官方 ChatGPT。 */
async function launchWindowsChatgptPlusPlus(): Promise<boolean> {
  const stub = winLauncherStub();
  if (spawnDetached(stub)) return true;
  try {
    const err = await shell.openPath(stub);
    if (!err) return true;
  } catch {}
  const desktop = join(homedir(), "Desktop", "ChatGPT++.lnk");
  if (existsSync(desktop)) {
    try {
      const err = await shell.openPath(desktop);
      if (!err) return true;
    } catch {}
  }
  const startMenu = join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "Microsoft", "Windows", "Start Menu", "Programs", "ChatGPT++.lnk");
  if (existsSync(startMenu)) {
    try {
      const err = await shell.openPath(startMenu);
      if (!err) return true;
    } catch {}
  }
  const launchFile = join(dirname(stub), "launch.json");
  const cfg = tryReadJson(launchFile) as { exe?: string; userDataDir?: string } | null;
  if (cfg?.exe && /chatgpt\+\+\.exe$/i.test(cfg.exe) && spawnDetached(cfg.exe, winLaunchArgs(cfg.userDataDir))) return true;
  const state = tryReadJson(join(userRoot(), "state.json")) as { appRoot?: string } | null;
  const root = state?.appRoot;
  if (root) {
    const branded = join(root, "ChatGPT++.exe");
    if (spawnDetached(branded, winLaunchArgs())) return true;
  }
  return false;
}

function winPatchedReady(): boolean {
  if (process.platform !== "win32") return false;
  const stub = winLauncherStub();
  return existsSync(stub) || existsSync(join(dirname(stub), "launch.json"));
}

function status() {
  const state = tryReadJson(join(userRoot(), "state.json")) as { version?: string; appRoot?: string } | null;
  const stubReady = winPatchedReady();
  const apps =
    process.platform === "win32"
      ? (() => {
          const stub = winLauncherStub();
          if (existsSync(stub)) return [stub];
          const root = state?.appRoot;
          if (root) {
            for (const name of ["ChatGPT++.exe", "ChatGPT.exe", "Codex.exe"]) {
              const exe = join(root, name);
              if (existsSync(exe)) return [exe];
            }
          }
          return [];
        })()
      : ["/Applications/ChatGPT.app", "/Applications/Codex.app"].filter(existsSync);
  return {
    installed: !!state || stubReady,
    version: state?.version ?? null,
    appRoot: state?.appRoot ?? null,
    apps,
    cliReady: existsSync(cliPath()),
    canUninstall: !!state || stubReady || existsSync(userRoot()),
  };
}

// 主题列表：预设（tweak 包内）+ 自定义（tweak-data）+ 当前选择（磁盘桥接文件）。
// 预览图改为按需提供（theme-art IPC）：列表只回名称/类型/id，
// base64 图片在渲染进程滚动到卡片附近时才读取，首屏不再一次性解码全部主题图。
function themes() {
  const presets: { id: string; name: string }[] = [];
  const presetRoot = join(tweakDir(), "presets");
  if (existsSync(presetRoot)) {
    for (const id of readdirSync(presetRoot)) {
      try {
        const theme = JSON.parse(readFileSync(join(presetRoot, id, "theme.json"), "utf8"));
        presets.push({ id, name: theme.name ?? id });
      } catch {
        // 单个预设损坏不影响其它主题
      }
    }
  }
  const custom: { id: string; name: string }[] = [];
  const index = tryReadJson(join(tweakDataDir(), "custom", "index.json")) as { id: string; name?: string }[] | null;
  if (Array.isArray(index)) {
    for (const rec of index) {
      const recFile = join(tweakDataDir(), "custom", `${rec.id}.json`);
      const data = tryReadJson(recFile) as { name?: string } | null;
      custom.push({ id: rec.id, name: data?.name ?? rec.name ?? rec.id });
    }
  }
  const selection = tryReadJson(join(tweakDataDir(), "selection.json")) as { type?: string; id?: string } | null;
  return { presets, custom, selection };
}

/** 主题 id 只允许安全字符集，防止路径遍历（id 会拼进文件路径）。 */
function isSafeThemeId(id: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(id);
}

function themeArtPath(type: string, id: string): string | null {
  if (!isSafeThemeId(id)) return null;
  if (type === "preset") {
    const file = join(tweakDir(), "presets", id, "background.jpg");
    return existsSync(file) ? file : null;
  }
  if (type === "custom") {
    const file = join(tweakDataDir(), "custom", `${id}.json`);
    return existsSync(file) ? file : null;
  }
  return null;
}

// 主题图按需读取（主进程侧）：预设读 background.jpg，自定义读记录里的 artUrl。
function themeArt(type: string, id: string): string | null {
  const file = themeArtPath(type, id);
  if (!file) return null;
  try {
    if (type === "preset") {
      return "data:image/jpeg;base64," + readFileSync(file).toString("base64");
    }
    const rec = tryReadJson(file) as { artUrl?: string } | null;
    return typeof rec?.artUrl === "string" ? rec.artUrl : null;
  } catch {
    return null;
  }
}

// 自定义主题上限：base64 图片数据最大 8MB（约 6MB 原始图片），防大图撑爆内存。
const THEME_ART_MAX_BASE64_CHARS = 8 * 1024 * 1024;

function createTheme(input: { name?: string; dataUrl?: string }): {
  ok: boolean;
  id?: string;
  name?: string;
  error?: string;
} {
  const name = (input.name ?? "").trim().slice(0, 60) || "未命名主题";
  const dataUrl = input.dataUrl ?? "";
  if (!/^data:image\/(?:png|jpe?g|webp|gif);base64,/.test(dataUrl)) {
    return { ok: false, error: "仅支持图片文件（PNG/JPEG/WebP/GIF）" };
  }
  const comma = dataUrl.indexOf(",");
  const body = comma >= 0 ? dataUrl.slice(comma + 1) : "";
  if (body.length > THEME_ART_MAX_BASE64_CHARS) {
    return { ok: false, error: "图片过大（上限约 6MB），请压缩后重试" };
  }
  try {
    const customDir = join(tweakDataDir(), "custom");
    mkdirSync(customDir, { recursive: true });
    const id = `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const rec = { name, artUrl: dataUrl, theme: null, createdAt: new Date().toISOString() };
    writeFileSync(join(customDir, `${id}.json`), JSON.stringify(rec), "utf8");
    const indexFile = join(customDir, "index.json");
    const existing = tryReadJson(indexFile);
    const index = Array.isArray(existing) ? existing : [];
    index.push({ id, name });
    writeFileSync(indexFile, JSON.stringify(index), "utf8");
    return { ok: true, id, name };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
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
function pushLog(win: BrowserWindow, text: string): void {
  if (!win.isDestroyed() && text) win.webContents.send("cli-log", text.trimEnd());
}
function runCli(args: string[], win: BrowserWindow): Promise<{ code: number | null }> {
  return new Promise((resolve) => {
    // Windows 上打补丁需要管理员权限（官方应用在 WindowsApps 受保护），
    // 通过 PowerShell Start-Process -Verb RunAs 触发 UAC 提权执行。
    // 提权进程是独立会话，stdout/stderr 不会回传，必须重定向到临时文件，
    // 结束后再读回并显示——否则用户只看到"退出码 1"看不到失败原因。
    if (process.platform === "win32" && args[0] !== "uninstall") {
      const cli = cliPath();
      const stamp = Date.now();
      const tmp = app.getPath("temp");
      const outFile = join(tmp, `cppp-cli-${stamp}.out.log`);
      const errFile = join(tmp, `cppp-cli-${stamp}.err.log`);
      const scriptFile = join(tmp, `cppp-cli-${stamp}.ps1`);
      const esc = (v: string) => v.replace(/'/g, "''");
      const argList = args.map((a) => `'${esc(a)}'`).join(", ");
      // -Verb RunAs 与 -RedirectStandard* 不能写在同一条 Start-Process 上，否则会 AmbiguousParameterSet。
      // 先写临时脚本，提权后再跑；脚本内部才重定向 CLI 输出。
      writeFileSync(
        scriptFile,
        [
          "$ErrorActionPreference = 'Continue'",
          `$p = Start-Process -FilePath '${esc(cli)}' -ArgumentList @(${argList}) -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput '${esc(outFile)}' -RedirectStandardError '${esc(errFile)}'`,
          "if ($null -eq $p) { exit 1 }",
          "exit $p.ExitCode",
        ].join("\r\n"),
        "utf8",
      );
      const ps = [
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-Command",
        `$p = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','${esc(scriptFile)}') -Verb RunAs -Wait -PassThru; if ($null -eq $p) { exit 1223 }; exit $p.ExitCode`,
      ];
      const child = spawn("powershell.exe", ps, { stdio: ["ignore", "pipe", "pipe"] });
      child.stdout?.on("data", (d) => pushLog(win, d.toString()));
      child.stderr?.on("data", (d) => pushLog(win, d.toString()));
      child.on("error", (e) => pushLog(win, String(e)));
      child.on("close", async (code) => {
        try {
          if (existsSync(outFile)) pushLog(win, readFileSync(outFile, "utf8"));
        } catch {}
        try {
          if (existsSync(errFile)) {
            const errText = readFileSync(errFile, "utf8").trim()
              .split(/\r?\n/)
              .filter((line) => !/fuse (flip failed|sentinel)|Is this an Electron binary/i.test(line))
              .join("\n")
              .trim();
            if (errText) pushLog(win, (code === 0 ? "[警告]\n" : "[错误]\n") + errText);
          }
        } catch {}
        if (code !== 0) {
          // CLI 失败时会写 <userRoot>/log/installer.log，把它尾部带出来定位根因。
          try {
            const logFile = join(userRoot(), "log", "installer.log");
            if (existsSync(logFile)) {
              const text = readFileSync(logFile, "utf8").trim().split("\n").slice(-60).join("\n");
              if (text) pushLog(win, "\n--- installer.log 末尾 ---\n" + text);
            }
          } catch {
            // 日志不可读不阻塞
          }
        }
        for (const f of [outFile, errFile, scriptFile]) {
          try { rmSync(f, { force: true }); } catch { /* 忽略 */ }
        }
        resolve({ code });
      });
      return;
    }
    const child: ChildProcess = spawn(cliPath(), args, { stdio: ["ignore", "pipe", "pipe"] });
    child.stdout?.on("data", (d) => pushLog(win, d.toString()));
    child.stderr?.on("data", (d) => pushLog(win, d.toString()));
    child.on("error", (e) => pushLog(win, String(e)));
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
    show: false,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(join(__dirname, "renderer.html"));
  win.once("ready-to-show", () => win.show());

  win.on("closed", () => {
    if (logWindow === win) logWindow = null;
  });

  return win;
}

app.whenReady().then(async () => {
  // 已安装：直接打开补丁后的官方应用并退出。
  // 未安装：显示引导面板。--panel 打开修复/卸载面板。
  const panelOnly = process.argv.includes("--panel");
  const state = tryReadJson(join(userRoot(), "state.json")) as { version?: string } | null;
  if (!panelOnly && (state || winPatchedReady())) {
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
  ipcMain.handle("theme-art", (_e, type: string, id: string) => themeArt(type, id));
  ipcMain.handle("create-theme", (_e, input: { name?: string; dataUrl?: string }) => createTheme(input));
  ipcMain.handle("apply-theme", (_e, sel: { type: string; id?: string }) => applyTheme(sel));
  ipcMain.handle("open-app", () => openPatchedApp());
  ipcMain.handle("run-cli", async (_e, cmd: "install" | "repair" | "uninstall") => {
    const target = logWindow ?? win;
    const args: string[] = [cmd];
    if ((cmd === "install" || cmd === "repair") && process.platform === "win32") {
      const st = tryReadJson(join(userRoot(), "state.json")) as { appRoot?: string } | null;
      if (st?.appRoot && existsSync(st.appRoot)) args.push("--app", st.appRoot);
      if (cmd === "install") args.push("--fresh");
    }
    return runCli(args, target);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
