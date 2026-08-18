// ChatGPT++ 独立 GUI 主进程：安装状态、安装/修复/卸载、打开 ChatGPT、主题管理。
// CLI 二进制随包放在 Resources/cli/（standalone.json 在同级 Resources，CLI 可自发现资源）。
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { spawn, type ChildProcess, execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, copyFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

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

// 自动更新系统 CLI 工具：检测 GUI 内置 CLI 与系统安装的 CLI 版本是否一致，不一致则静默更新。
async function autoUpdateCli(): Promise<void> {
  try {
    const appCli = cliPath();
    if (!existsSync(appCli)) return;

    // 获取 GUI 内置 CLI 版本
    let appVersion: string;
    try {
      appVersion = execSync(`"${appCli}" --version`, { encoding: "utf8" }).trim();
    } catch {
      return; // 内置 CLI 无法运行，跳过
    }

    // 系统 CLI 安装路径（按优先级）
    const home = homedir();
    const systemCliPaths = process.platform === "win32"
      ? [
          join(process.env.LOCALAPPDATA ?? join(home, "AppData", "Local"), "Programs", "ChatGPT++", "chatgpt-plusplus.exe"),
          join(home, ".local", "bin", "chatgpt-plusplus.exe"),
        ]
      : [
          join(home, ".local", "bin", "chatgpt-plusplus"),
          "/usr/local/bin/chatgpt-plusplus",
        ];

    for (const systemCli of systemCliPaths) {
      if (!existsSync(systemCli)) continue;

      // 获取系统 CLI 版本
      let systemVersion: string;
      try {
        systemVersion = execSync(`"${systemCli}" --version`, { encoding: "utf8" }).trim();
      } catch {
        continue; // 系统 CLI 损坏，跳过
      }

      // 版本一致，无需更新
      if (appVersion === systemVersion) continue;

      // 版本不一致，静默更新
      try {
        const dir = join(systemCli, "..");
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

        copyFileSync(appCli, systemCli);
        if (process.platform !== "win32") {
          chmodSync(systemCli, 0o755);
        }

        console.log(`[autoUpdateCli] Updated ${systemCli}: ${systemVersion} → ${appVersion}`);
        break; // 成功更新第一个找到的系统 CLI，停止
      } catch (err) {
        console.warn(`[autoUpdateCli] Failed to update ${systemCli}:`, err);
        // 写入失败（权限问题）不阻塞启动，继续尝试下一个路径
      }
    }
  } catch (err) {
    // 自动更新失败不影响 GUI 启动
    console.warn("[autoUpdateCli] Error:", err);
  }
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
  const candidates: string[] = [];
  if (process.platform === "win32") {
    // Windows 的 state.appRoot 是镜像目录，必须启动目录里的主程序 exe，
    // 直接 openPath 目录只会打开资源管理器窗口（看起来像"又弹了一个安装器"）。
    const root = state?.appRoot;
    if (root && existsSync(root)) {
      const exe = readdirSync(root).find(
        (name) => /\.exe$/i.test(name) && /\b(codex|chatgpt)\b/i.test(name),
      );
      // 只启动主程序 exe；找不到就交给面板报错，绝不打开目录（那会像"又弹了个安装器"）。
      if (exe) candidates.push(join(root, exe));
    }
  } else {
    candidates.push("/Applications/ChatGPT.app", "/Applications/Codex.app");
  }
  for (const appPath of candidates) {
    if (!existsSync(appPath)) continue;
    const err = await shell.openPath(appPath);
    if (!err) return { ok: true, error: null };
  }
  return { ok: false, error: "未找到已补丁的 ChatGPT/Codex 应用，请先安装" };
}

function status() {
  const state = tryReadJson(join(userRoot(), "state.json")) as { version?: string; appRoot?: string } | null;
  const apps =
    process.platform === "win32"
      ? (() => {
          const root = state?.appRoot;
          if (root && existsSync(root)) {
            const exe = readdirSync(root).find(
              (name) => /\.exe$/i.test(name) && /\b(codex|chatgpt)\b/i.test(name),
            );
            if (exe) return [join(root, exe)];
          }
          return [];
        })()
      : ["/Applications/ChatGPT.app", "/Applications/Codex.app"].filter(existsSync);
  return {
    installed: !!state,
    version: state?.version ?? null,
    appRoot: state?.appRoot ?? null,
    apps,
    cliReady: existsSync(cliPath()),
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
      const outFile = join(app.getPath("temp"), `cppp-cli-${stamp}.out.log`);
      const errFile = join(app.getPath("temp"), `cppp-cli-${stamp}.err.log`);
      const esc = (v: string) => v.replace(/'/g, "''");
      const ps = [
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-Command",
        [
          `$p = Start-Process -FilePath '${esc(cli)}' -ArgumentList '${esc(args.join(" "))}'`,
          "-Verb RunAs -Wait -PassThru",
          `-RedirectStandardOutput '${esc(outFile)}' -RedirectStandardError '${esc(errFile)}'`,
          "exit $p.ExitCode",
        ].join(" "),
      ];
      const child = spawn("powershell.exe", ps, { stdio: ["ignore", "pipe", "pipe"] });
      child.stdout?.on("data", (d) => pushLog(win, d.toString()));
      child.stderr?.on("data", (d) => pushLog(win, d.toString()));
      child.on("error", (e) => pushLog(win, String(e)));
      child.on("close", async (code) => {
        for (const f of [outFile, errFile]) {
          try {
            if (existsSync(f)) pushLog(win, readFileSync(f, "utf8"));
          } catch {
            // 读不到重定向文件不阻塞结果返回
          }
        }
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
        for (const f of [outFile, errFile]) {
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

function createSplashWindow(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 400,
    height: 500,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    skipTaskbar: true,
    backgroundColor: "#00000000",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  splash.loadFile(join(__dirname, "splash.html"));
  return splash;
}

function createWindow(splash?: BrowserWindow) {
  const win = new BrowserWindow({
    width: 460,
    height: 700,
    title: "ChatGPT++",
    backgroundColor: "#10131a",
    autoHideMenuBar: true,
    show: false, // 优化：先隐藏，准备好后再显示
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(join(__dirname, "renderer.html"));

  // 优化：窗口准备好后关闭启动画面并显示主窗口
  win.once("ready-to-show", () => {
    if (splash && !splash.isDestroyed()) {
      splash.close();
    }
    win.show();
  });

  win.on("closed", () => {
    if (logWindow === win) logWindow = null;
  });

  return win;
}

app.whenReady().then(async () => {
  // 优化：先显示启动画面，改善用户感知
  const splash = createSplashWindow();

  // 自动更新系统 CLI 工具（如果版本不一致）
  await autoUpdateCli();

  // 已安装：ChatGPT++ 的入口就是补丁后的官方应用主界面，直接打开并退出自身；
  // 未安装（首次使用）：显示引导面板执行安装。
  // --panel：显式打开修复/卸载面板（开始菜单"ChatGPT++ 修复工具"）。
  const panelOnly = process.argv.includes("--panel");
  const state = tryReadJson(join(userRoot(), "state.json")) as { version?: string } | null;
  if (!panelOnly && state) {
    const opened = await openPatchedApp();
    if (opened.ok) {
      if (splash && !splash.isDestroyed()) splash.close();
      app.quit();
      return;
    }
  }
  const win = createWindow(splash);
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
    return runCli([cmd], target);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
