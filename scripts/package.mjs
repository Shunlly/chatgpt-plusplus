#!/usr/bin/env node
/**
 * 打包脚本：把 installer CLI 编译成单文件二进制（Node SEA），并产出安装包。
 *
 *   macOS:  dist/installers/ChatGPT++-<version>-macos-<arch>.dmg
 *           （内含 ChatGPT++.app：双击后自动复制到 /Applications 并打开 Terminal 安装）
 *   Windows: dist/installers/ChatGPT++-<version>-win-x64-setup.exe
 *           （NSIS 安装器，安装到 %LOCALAPPDATA%\Programs\ChatGPT++）
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
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";
import { dirname, join, resolve } from "node:path";
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

  if (isWin) {
    const url = `https://nodejs.org/dist/${NODE_LTS}/node-${NODE_LTS}-win-x64.zip`;
    console.log(`下载 Windows Node.js 运行时：${url}`);
    writeFileSync(join(dir, "node.zip"), Buffer.from(await fetchBytes(url)));
    // Windows 与 macOS 都自带 libarchive tar，可解压 zip；避免依赖 unzip
    run("tar", ["-xf", join(dir, "node.zip"), "-C", dir, "--strip-components=1"], dir);
  } else {
    const url = `https://nodejs.org/dist/${NODE_LTS}/node-${NODE_LTS}-${key}.tar.gz`;
    console.log(`下载 Node.js 运行时：${url}`);
    writeFileSync(join(dir, "node.tar.gz"), Buffer.from(await fetchBytes(url)));
    run("tar", ["-xzf", join(dir, "node.tar.gz"), "-C", dir, "--strip-components=1"], dir);
  }
  chmodSync(bin, 0o755);
  return bin;
}

async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载失败 ${url}: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

function buildDmg(binary) {
  const ver = version();
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  const app = join(OUT, "dmg", `${APP_NAME}.app`);
  const macosDir = join(app, "Contents", "MacOS");
  const resourcesDir = join(app, "Contents", "Resources");
  mkdirSync(macosDir, { recursive: true });
  mkdirSync(resourcesDir, { recursive: true });

  copyFileSync(binary, join(macosDir, PACKAGE_NAME));
  chmodSync(join(macosDir, PACKAGE_NAME), 0o755);
  writeFileSync(join(macosDir, "ChatGPT++"), launcherScript(), { mode: 0o755 });
  writeFileSync(join(resourcesDir, "standalone.json"), JSON.stringify({
    name: PACKAGE_NAME,
    version: ver,
    kind: "standalone",
  }, null, 2));
  cpSync(join(ROOT, "packages", "installer", "assets"), join(resourcesDir, "assets"), { recursive: true });
  writeFileSync(join(app, "Contents", "Info.plist"), infoPlist(ver));

  const stage = join(OUT, "dmg");
  writeFileSync(join(stage, "安装说明.txt"), installNotes(ver));
  try {
    rmSync(join(stage, "Applications"), { force: true });
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

function launcherScript() {
  return `#!/bin/sh
# ChatGPT++ 安装包启动器：从 dmg 卷运行时先复制到 /Applications，再打开 Terminal 执行安装。
set -e
APP_PATH="$(cd "$(dirname "$0")/.." && pwd)"
CLI="$APP_PATH/Contents/MacOS/${PACKAGE_NAME}"

case "$APP_PATH" in
  /Volumes/*)
    DEST="/Applications/${APP_NAME}.app"
    if [ "$APP_PATH" != "$DEST" ]; then
      if [ -e "$DEST" ]; then
        rm -rf "$DEST"
      fi
      if ! cp -R "$APP_PATH" "$DEST" 2>/dev/null; then
        osascript -e "do shell script \\"rm -rf /Applications/${APP_NAME}.app; cp -R '$APP_PATH' /Applications/\\" with administrator privileges"
      fi
      open "$DEST"
      exit 0
    fi
    ;;
esac

osascript <<APPLESCRIPT
tell application "Terminal"
  activate
  do script "clear; '\${CLI}' install; echo; echo '安装完成，可关闭此窗口。'; exec /bin/zsh"
end tell
APPLESCRIPT
`;
}

function infoPlist(version) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>${APP_NAME}</string>
  <key>CFBundleDisplayName</key>
  <string>${APP_NAME}</string>
  <key>CFBundleIdentifier</key>
  <string>com.chatgptplusplus.installer</string>
  <key>CFBundleExecutable</key>
  <string>${APP_NAME}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>${version}</string>
  <key>CFBundleVersion</key>
  <string>${version}</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>LSApplicationCategoryType</key>
  <string>public.app-category.developer-tools</string>
</dict>
</plist>
`;
}

function installNotes(version) {
  return `ChatGPT++ ${version} 安装说明（macOS）
=================================

1. 把 ChatGPT++.app 拖进 Applications 文件夹（或直接双击，它会自动复制）。
2. 双击 ChatGPT++.app，会打开"终端"窗口并自动给 ChatGPT/Codex 应用打补丁。
3. 安装完成后启动 ChatGPT/Codex，在设置里找到 ChatGPT++。

也可以从终端手动使用完整命令：
  /Applications/ChatGPT++.app/Contents/MacOS/chatgpt-plusplus install

卸载：
  /Applications/ChatGPT++.app/Contents/MacOS/chatgpt-plusplus uninstall

注意：本安装包未做 Apple 公证，首次打开若被 Gatekeeper 拦截，请右键 -> 打开。
`;
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
  mkdirSync(stage, { recursive: true });
  copyFileSync(binary, join(stage, `${PACKAGE_NAME}.exe`));
  writeFileSync(join(stage, "standalone.json"), JSON.stringify({
    name: PACKAGE_NAME,
    version: ver,
    kind: "standalone",
  }, null, 2));
  cpSync(join(ROOT, "packages", "installer", "assets"), join(stage, "assets"), { recursive: true });

  const exe = join(OUT, `${APP_NAME}-${ver}-win-x64-setup.exe`);
  rmSync(exe, { force: true });
  // Windows 下 makensis 的 File 指令只可靠解析原生反斜杠路径，macOS 只认正斜杠，
  // 因此路径与分隔符都按平台传入（nsi 里用 ${SEP} 拼接）。
  const isWin = process.platform === "win32";
  const stageArg = isWin ? stage.replace(/\//g, "\\") : stage.replace(/\\/g, "/");
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
