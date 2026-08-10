#!/usr/bin/env node
/**
 * 打包脚本：把 installer CLI 编译成单文件二进制（Node SEA），并产出独立 GUI 安装包。
 *
 *   macOS:  dist/installers/ChatGPT++-<version>-macos-<arch>.dmg
 *           （内含 ChatGPT++.app：独立 Electron 图形界面，安装/修复/主题管理）
 *   Windows: dist/installers/ChatGPT++-<version>-win-x64-setup.exe
 *           （NSIS 安装器，安装到 %LOCALAPPDATA%\Programs\ChatGPT++，独立 GUI）
 *
 * 用法：
 *   npm run package            # 当前平台
 *   npm run package:dmg        # macOS（需在 macOS 上运行）
 *   npm run package:exe        # Windows（需安装 NSIS；CI 里由 Windows runner 完成）
 */
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUILD = join(ROOT, ".build", "package");
const OUT = join(ROOT, "dist", "installers");
const PACKAGE_NAME = "chatgpt-plusplus";
const APP_NAME = "ChatGPT++";
const SEA_SENTINEL = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";
const NODE_LTS = "v24.19.0"; // 官方 LTS 运行时；本机 Node 非 24.x 时自动下载用于 SEA

await main();

async function main() {
  const { platform } = parseArgs(process.argv.slice(2));
  if (platform === "darwin" && process.platform !== "darwin") {
    throw new Error("macOS dmg 只能在 macOS 上构建。");
  }
  if (platform === "win32" && process.platform !== "win32") {
    // macOS 无法执行 Windows 的 node.exe，SEA blob 必须在 Windows 上生成；
    // 请用 .github/workflows/release.yml 在 windows-latest runner 上构建。
    throw new Error("Windows exe 只能在 Windows 上构建（请使用 GitHub Actions release 工作流）。");
  }

  run("npm", ["run", "build"], ROOT);
  const cli = await bundleCli();
  const binary = await buildSea(cli, platform);
  // 释放下载的 Node 运行时（约 110MB），SEA 二进制已生成，不再需要
  rmSync(join(BUILD, "node"), { recursive: true, force: true });
  await buildGuiAssets();
  if (platform === "darwin") {
    buildDmg(binary);
    // dmg 已包含 app；删除暂存目录，裸二进制仅 CI 上删除（本地保留便于直接使用）
    rmSync(join(OUT, "dmg"), { recursive: true, force: true });
    if (process.env.CI) rmSync(binary, { force: true });
  } else if (platform === "win32") {
    buildExe(binary);
    rmSync(join(OUT, "nsis"), { recursive: true, force: true });
    if (process.env.CI) rmSync(binary, { force: true });
  }
  console.log(`\n✅ 安装包已生成：${OUT}`);
}

function parseArgs(argv) {
  const platformArg = argv.find((a) => a.startsWith("--platform="));
  const platform = platformArg?.split("=")[1] ?? process.platform;
  if (platform !== "darwin" && platform !== "win32") {
    throw new Error(`不支持的平台: ${platform}（仅支持 darwin/win32）`);
  }
  return { platform };
}

function version() {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  return pkg.version;
}

async function bundleCli() {
  mkdirSync(BUILD, { recursive: true });
  const outfile = join(BUILD, "cli.cjs");
  await build({
    entryPoints: [join(ROOT, "packages", "installer", "dist", "cli.js")],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    external: ["original-fs"], // 仅 Electron 内使用；Node 下走 require("fs") 分支
    outfile,
  });

  // esbuild 的 CJS 输出里 import.meta.url 为空对象，替换为 __filename 推导的 file:// URL。
  let src = readFileSync(outfile, "utf8");
  src = src.replace(/\bimport_meta\d*\.url/g, "import_meta_url");
  const banner = 'const import_meta_url = require("node:url").pathToFileURL(__filename).href;';
  const shebang = src.startsWith("#!") ? src.slice(0, src.indexOf("\n") + 1) : "";
  src = shebang + banner + "\n" + src.slice(shebang.length);
  writeFileSync(outfile, src);
  return outfile;
}

async function buildSea(cli, platform) {
  const isWin = platform === "win32";
  const blob = "sea-prep.blob";
  const config = join(BUILD, "sea-config.json");
  writeFileSync(
    config,
    JSON.stringify({ main: "cli.cjs", output: blob, disableExperimentalSEAWarning: true }),
  );

  // 本机 Node 为 22.x 且平台一致时直接用本机运行时（CI 场景），否则下载官方 LTS。
  const localOk = process.platform === platform && process.versions.node.startsWith("22.");
  const nodeBin = localOk ? process.execPath : await ensureNodeBinary(platform);

  // Node SEA 要求 main/output 相对于 sea-config 所在目录。
  const prevCwd = process.cwd();
  process.chdir(BUILD);
  try {
    run(nodeBin, ["--experimental-sea-config", config], BUILD);
  } finally {
    process.chdir(prevCwd);
  }

  mkdirSync(OUT, { recursive: true });
  const binary = join(OUT, isWin ? `${PACKAGE_NAME}.exe` : PACKAGE_NAME);
  copyFileSync(nodeBin, binary);
  chmodSync(binary, 0o755);

  const postject = join(ROOT, "node_modules", "postject", "dist", "cli.js");
  run(process.execPath, [
    postject,
    binary,
    "NODE_SEA_BLOB",
    join(BUILD, blob),
    "--sentinel-fuse",
    SEA_SENTINEL,
    "--macho-segment-name",
    "NODE_SEA", // macOS 必须注入 NODE_SEA 段，否则 SEA 运行时找不到 blob 直接崩溃
  ], ROOT);

  if (!isWin) {
    run("codesign", ["--force", "--sign", "-", binary], ROOT);
  }
  return binary;
}

/** 下载官方 Node.js LTS 到 .build 缓存并返回可执行文件路径。 */
async function ensureNodeBinary(platform) {
  const isWin = platform === "win32";
  const key = isWin ? "win-x64" : `${process.platform}-${process.arch}`;
  const dir = join(BUILD, "node", NODE_LTS, key);
  const bin = isWin ? join(dir, "node.exe") : join(dir, "bin", "node");
  if (existsSync(bin)) return bin;
  mkdirSync(dir, { recursive: true });

  // 镜像可用环境变量覆盖：国内网络建议 NODE_MIRROR=https://registry.npmmirror.com/-/binary/node
  const base = process.env.NODE_MIRROR ?? "https://nodejs.org/dist";
  if (isWin) {
    const url = `${base}/${NODE_LTS}/node-${NODE_LTS}-win-x64.zip`;
    console.log(`下载 Windows Node.js 运行时：${url}`);
    writeFileSync(join(dir, "node.zip"), Buffer.from(await fetchBytes(url)));
    // Windows 与 macOS 都自带 libarchive tar，可解压 zip；避免依赖 unzip
    run("tar", ["-xf", join(dir, "node.zip"), "-C", dir, "--strip-components=1"], dir);
  } else {
    const url = `${base}/${NODE_LTS}/node-${NODE_LTS}-${key}.tar.gz`;
    console.log(`下载 Node.js 运行时：${url}`);
    writeFileSync(join(dir, "node.tar.gz"), Buffer.from(await fetchBytes(url)));
    run("tar", ["-xzf", join(dir, "node.tar.gz"), "-C", dir, "--strip-components=1"], dir);
  }
  chmodSync(bin, 0o755);
  return bin;
}

async function fetchBytes(url) {
  // 用 curl 下载：Node 原生 fetch 不识别小写 http_proxy（本地代理场景会直连失败）；
  // 失败自动重试 3 次。
  mkdirSync(BUILD, { recursive: true });
  const tmp = join(BUILD, "download.tmp");
  for (let attempt = 1; ; attempt++) {
    const r = spawnSync("curl", ["-fsSL", "--retry", "3", "-o", tmp, url], { encoding: "utf8" });
    if (r.status === 0) return new Uint8Array(readFileSync(tmp));
    if (attempt >= 3) {
      throw new Error(`下载失败 ${url}: ${r.stderr || r.error?.message || `curl 退出码 ${r.status}`}`);
    }
    console.log(`下载中断，第 ${attempt} 次重试…`);
    await new Promise((res) => setTimeout(res, 1500 * attempt));
  }
}

function buildDmg(binary) {
  const ver = version();
  const arch = process.arch === "arm64" ? "arm64" : "x64";

  const stage = join(OUT, "dmg");
  rmSync(stage, { recursive: true, force: true });
  const app = join(stage, `${APP_NAME}.app`);

  // DMG 直接打包“补丁后的完整应用”：安装完双击就是增强版 ChatGPT 主界面，
  // 不需要再经过安装引导（用户明确要求开箱即用）。
  const patched = ensurePatchedApp();
  cpSync(patched, app, { recursive: true, verbatimSymlinks: true });
  // 副本内附带修复/卸载入口（CLI + 旁置资源），避免重新打补丁还要找安装包。
  stageRepairCli(app, binary, ver);
  // --deep 递归签名嵌套的 Helper 等子 app（符号链接已 verbatim 保留，不再报 unsealed）
  run("codesign", ["--force", "--deep", "--sign", "-", app], ROOT);

  writeFileSync(join(stage, "安装说明.txt"), installNotes(ver));
  try {
    const link = spawnSync("ln", ["-s", "/Applications", join(stage, "Applications")], { encoding: "utf8" });
    if (link.status !== 0) throw new Error(link.stderr || "创建 Applications 软链接失败");
  } catch {
    // 文件系统不支持软链接时忽略（DMG 里拖拽安装需要软链接，一般都会成功）
  }

  const dmg = join(OUT, `${APP_NAME}-${ver}-macos-${arch}.dmg`);
  rmSync(dmg, { force: true });
  run("hdiutil", [
    "create",
    "-volname",
    `${APP_NAME} ${ver}`,
    "-srcfolder",
    stage,
    "-ov",
    "-format",
    "UDZO",
    dmg,
  ], ROOT);
  console.log(`✅ DMG 已生成：${dmg}`);
}

// 已补丁副本的判定：独立 bundle id + 独立启动器（ChatGPT.bin）+ 打补丁后的 app.asar。
function isPatchedCopy(appRoot) {
  try {
    const plist = readFileSync(join(appRoot, "Contents", "Info.plist"), "utf8");
    return (
      plist.includes("com.openai.chatgptpp") &&
      existsSync(join(appRoot, "Contents", "MacOS", "ChatGPT.bin")) &&
      existsSync(join(appRoot, "Contents", "Resources", "app.asar"))
    );
  } catch {
    return false;
  }
}

// 定位补丁副本；不存在时用官方 ChatGPT.app 现打一份（install 产物即 DMG 内容）。
function ensurePatchedApp() {
  const candidates = [
    join(homedir(), "Applications", "ChatGPT++.app"),
    "/Applications/ChatGPT++.app",
  ];
  const existing = candidates.find(isPatchedCopy);
  if (existing) return existing;
  console.log("未找到已补丁的 ChatGPT++.app，正在用官方 ChatGPT.app 生成补丁副本…");
  run(process.execPath, [join(ROOT, "bin", "chatgptplusplus.js"), "install"], ROOT);
  const patched = candidates.find(isPatchedCopy);
  if (!patched) {
    throw new Error(
      `补丁副本生成失败（${candidates.join(" / ")}）。请确认已安装官方 ChatGPT.app 并检查上方错误日志。`,
    );
  }
  return patched;
}

// 往补丁副本里塞：CLI 二进制、standalone.json、assets、tweaks（修复/卸载入口）。
function stageRepairCli(appOrDir, binary, ver) {
  const resourcesDir = join(appOrDir, "Contents", "Resources");
  const cliDir = join(resourcesDir, "cli");
  mkdirSync(cliDir, { recursive: true });
  copyFileSync(binary, join(cliDir, PACKAGE_NAME));
  chmodSync(join(cliDir, PACKAGE_NAME), 0o755);
  for (const dir of [resourcesDir, cliDir]) {
    writeFileSync(join(dir, "standalone.json"), JSON.stringify({
      name: PACKAGE_NAME,
      version: ver,
      kind: "standalone",
    }, null, 2));
  }
  cpSync(join(ROOT, "packages", "installer", "assets"), join(resourcesDir, "assets"), { recursive: true });
  cpSync(join(ROOT, "tweaks"), join(resourcesDir, "tweaks"), { recursive: true });
}

// 已解压的 Electron 模板目录（node_modules/electron/dist）。
function electronTemplate() {
  const dist = join(ROOT, "node_modules", "electron", "dist");
  const probe = process.platform === "darwin" ? join(dist, "Electron.app") : join(dist, "electron.exe");
  if (!existsSync(probe)) {
    throw new Error(`未找到 Electron 模板：${dist}。请先执行：node node_modules/electron/install.js`);
  }
  return dist;
}

// 往独立 GUI app 里放：app 代码（main/preload/页面）、CLI 二进制、tweaks、standalone.json。
function stageGuiResources(appOrDir, binary, ver) {
  const resourcesDir =
    process.platform === "darwin" ? join(appOrDir, "Contents", "Resources") : join(appOrDir, "resources");
  // GUI 代码（main.js/preload.js/renderer.html）
  const appDir = join(resourcesDir, "app");
  cpSync(join(ROOT, "packages", "gui", "dist"), appDir, { recursive: true });
  writeFileSync(join(appDir, "package.json"), JSON.stringify({
    name: "chatgpt-plusplus-gui",
    main: "main.js",
    version: ver,
  }, null, 2));
  // CLI 放 resources/cli/：standaloneRoot 探测 dirname(exec)/../Resources 命中
  const cliDir = join(resourcesDir, "cli");
  mkdirSync(cliDir, { recursive: true });
  const cliName = process.platform === "win32" ? `${PACKAGE_NAME}.exe` : PACKAGE_NAME;
  copyFileSync(binary, join(cliDir, cliName));
  chmodSync(join(cliDir, cliName), 0o755);
  // macOS 探测 dirname(exec)/../Resources；Windows 探测可执行文件同目录，两边都要有
  for (const dir of [resourcesDir, cliDir]) {
    writeFileSync(join(dir, "standalone.json"), JSON.stringify({
      name: PACKAGE_NAME,
      version: ver,
      kind: "standalone",
    }, null, 2));
  }
  cpSync(join(ROOT, "packages", "installer", "assets"), join(resourcesDir, "assets"), { recursive: true });
  cpSync(join(ROOT, "tweaks"), join(resourcesDir, "tweaks"), { recursive: true });
}

function installNotes(version) {
  return `ChatGPT++ ${version} 安装说明（macOS）
=================================

1. 把 ChatGPT++.app 拖进 Applications 文件夹（或直接双击，它会自动复制）。
2. 打开即用：双击 ChatGPT++.app 直接打开增强版 ChatGPT 主界面，
   主题等特征已内置，无需任何额外安装步骤。
3. 官方 ChatGPT 出新版本后，下载新版安装包覆盖即可同步更新。

卸载：
  在终端执行：
  /Applications/ChatGPT++.app/Contents/Resources/cli/chatgpt-plusplus uninstall

修复 / 重新打补丁：
  /Applications/ChatGPT++.app/Contents/Resources/cli/chatgpt-plusplus install

注意：本安装包未做 Apple 公证。若打开提示“已损坏，无法打开”，
请在终端执行后重试：
  xattr -dr com.apple.quarantine "/Applications/ChatGPT++.app"
或者右键 ChatGPT++.app -> 打开。
`;
}

// 编译独立 GUI（Electron）：main + preload + 页面。
async function buildGuiAssets() {
  const gui = join(ROOT, "packages", "gui");
  const outDir = join(gui, "dist");
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  await build({
    entryPoints: [join(gui, "src", "main.ts"), join(gui, "src", "preload.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    external: ["electron"],
    outdir: outDir,
  });
  cpSync(join(gui, "src", "renderer.html"), join(outDir, "renderer.html"));
  console.log("✅ GUI 已编译：", outDir);
}

function buildExe(binary) {
  const ver = version();
  // 只做 PATH 探测，兼容 Windows（choco install nsis）与 macOS（brew install nsis）
  const which = spawnSync(process.platform === "win32" ? "where" : "which", ["makensis"], { encoding: "utf8" });
  if (which.status !== 0) {
    throw new Error("未找到 makensis（NSIS）。macOS: brew install nsis；Windows: choco install nsis -y");
  }

  const stage = join(OUT, "nsis");
  rmSync(stage, { recursive: true, force: true });
  // Windows 模板：dist/ 平铺（electron.exe + resources/ + dll），复制后改名 ChatGPT++.exe
  const winDir = join(stage, `${APP_NAME}-win32-x64`);
  cpSync(electronTemplate(), winDir, { recursive: true });
  renameSync(join(winDir, "electron.exe"), join(winDir, `${APP_NAME}.exe`));

  stageGuiResources(winDir, binary, ver);

  const exe = join(OUT, `${APP_NAME}-${ver}-win-x64-setup.exe`);
  rmSync(exe, { force: true });
  // Windows 下 makensis 的 File 指令只可靠解析原生反斜杠路径，macOS 只认正斜杠，
  // 因此路径与分隔符都按平台传入（nsi 里用 ${SEP} 拼接）。
  const isWin = process.platform === "win32";
  const stageArg = isWin ? winDir.replace(/\//g, "\\") : winDir.replace(/\\/g, "/");
  const exeArg = exe.replace(/\\/g, "/");
  run("makensis", [
    `-DVERSION=${ver}`,
    `-DSTAGEDIR=${stageArg}`,
    `-DSEP=${isWin ? "\\" : "/"}`,
    `-DOUTFILE=${exeArg}`,
    join(ROOT, "scripts", "nsis", "installer.nsi"),
  ], ROOT);
  console.log(`✅ EXE 安装器已生成：${exe}`);
}

function run(command, args, cwd) {
  console.log(`$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    const detail = result.error ? `: ${result.error.message}` : `（退出码 ${result.status}）`;
    throw new Error(`${command} 执行失败${detail}`);
  }
}
