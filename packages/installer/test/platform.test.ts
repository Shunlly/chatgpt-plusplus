import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { inferCodexChannel, isolateWindowsOwlUserData, isWindowsChatGptAppRoot, locateCodex, pickWindowsManagedMirror, preferredWindowsLaunchExe, resolveLinuxInstall, windowsStoreMirrorPackageName } from "../src/platform";

test("inferCodexChannel detects stable and beta metadata", () => {
  assert.equal(inferCodexChannel("com.openai.codex", "Codex"), "stable");
  assert.equal(inferCodexChannel("com.openai.chatgptpp", "ChatGPT++"), "stable");
  assert.equal(inferCodexChannel("com.openai.codex.beta", "Codex (Beta)"), "beta");
  assert.equal(inferCodexChannel(null, "Codex (Beta)"), "beta");
  assert.equal(inferCodexChannel(null, "ChatGPT"), "stable");
});

test("locateCodex reads beta bundle metadata from override path on macOS", { skip: process.platform !== "darwin" }, () => {
  const root = mkdtempSync(join(tmpdir(), "codexpp-platform-"));
  try {
    const app = join(root, "Codex (Beta).app");
    mkdirSync(join(app, "Contents", "Resources"), { recursive: true });
    mkdirSync(
      join(app, "Contents", "Frameworks", "Electron Framework.framework", "Versions", "A"),
      { recursive: true },
    );
    writeFileSync(join(app, "Contents", "Resources", "app.asar"), "");
    writeFileSync(
      join(app, "Contents", "Info.plist"),
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleDisplayName</key><string>Codex (Beta)</string>
  <key>CFBundleExecutable</key><string>Codex (Beta)</string>
  <key>CFBundleIdentifier</key><string>com.openai.codex.beta</string>
</dict></plist>`,
    );

    const codex = locateCodex(app);
    assert.equal(codex.appName, "Codex (Beta)");
    assert.equal(codex.bundleId, "com.openai.codex.beta");
    assert.equal(codex.channel, "beta");
    assert.equal(codex.executable.endsWith("Contents/MacOS/Codex (Beta)"), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolveLinuxInstall supports am-will codex-app install directory", () => {
  const root = mkdtempSync(join(tmpdir(), "codexpp-platform-"));
  try {
    const app = join(root, "codex-desktop");
    mkdirSync(join(app, "resources"), { recursive: true });
    writeFileSync(join(app, "resources", "app.asar"), "");
    writeFileSync(join(app, "Codex"), "", { mode: 0o755 });

    const codex = resolveLinuxInstall(app);
    const resolvedApp = realpathSync(app);
    assert.ok(codex);
    assert.equal(codex.appRoot, resolvedApp);
    assert.equal(codex.resourcesDir, join(resolvedApp, "resources"));
    assert.equal(codex.executable, join(resolvedApp, "Codex"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolveLinuxInstall accepts a launcher symlink override", { skip: process.platform === "win32" }, () => {
  const root = mkdtempSync(join(tmpdir(), "codexpp-platform-"));
  try {
    const app = join(root, "codex-desktop");
    const bin = join(root, "bin");
    mkdirSync(join(app, "resources"), { recursive: true });
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(app, "resources", "app.asar"), "");
    writeFileSync(join(app, "codex-desktop"), "", { mode: 0o755 });
    symlinkSync(join(app, "codex-desktop"), join(bin, "codex-desktop"));

    const codex = resolveLinuxInstall(join(bin, "codex-desktop"));
    const resolvedApp = realpathSync(app);
    assert.ok(codex);
    assert.equal(codex.appRoot, resolvedApp);
    assert.equal(codex.resourcesDir, join(resolvedApp, "resources"));
    assert.equal(codex.executable, join(resolvedApp, "codex-desktop"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("locateCodex finds the renamed ChatGPT.app bundle on macOS", { skip: process.platform !== "darwin" }, () => {
  const root = mkdtempSync(join(tmpdir(), "codexpp-platform-"));
  try {
    const app = join(root, "ChatGPT.app");
    mkdirSync(join(app, "Contents", "Resources"), { recursive: true });
    mkdirSync(
      join(app, "Contents", "Frameworks", "Electron Framework.framework", "Versions", "A"),
      { recursive: true },
    );
    writeFileSync(join(app, "Contents", "Resources", "app.asar"), "");
    writeFileSync(
      join(app, "Contents", "Info.plist"),
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleDisplayName</key><string>ChatGPT</string>
  <key>CFBundleExecutable</key><string>ChatGPT</string>
  <key>CFBundleIdentifier</key><string>com.openai.codex</string>
</dict></plist>`,
    );

    const codex = locateCodex(app);
    assert.equal(codex.appName, "ChatGPT");
    assert.equal(codex.bundleId, "com.openai.codex");
    assert.equal(codex.channel, "stable");
    assert.equal(codex.executable.endsWith("Contents/MacOS/ChatGPT"), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


test("locateCodex finds the dedicated ChatGPT++ bundle on macOS", { skip: process.platform !== "darwin" }, () => {
  const root = mkdtempSync(join(tmpdir(), "codexpp-platform-"));
  try {
    const app = join(root, "ChatGPT++.app");
    mkdirSync(join(app, "Contents", "Resources"), { recursive: true });
    mkdirSync(
      join(app, "Contents", "Frameworks", "Electron Framework.framework", "Versions", "A"),
      { recursive: true },
    );
    writeFileSync(join(app, "Contents", "Resources", "app.asar"), "");
    writeFileSync(
      join(app, "Contents", "Info.plist"),
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleDisplayName</key><string>ChatGPT++</string>
  <key>CFBundleExecutable</key><string>ChatGPT</string>
  <key>CFBundleIdentifier</key><string>com.openai.chatgptpp</string>
</dict></plist>`,
    );

    const codex = locateCodex(app);
    assert.equal(codex.appName, "ChatGPT++");
    assert.equal(codex.bundleId, "com.openai.chatgptpp");
    assert.equal(codex.channel, "stable");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("isolateWindowsOwlUserData 把 Owl 用户数据目录改成 ChatGPT++", () => {
  const root = mkdtempSync(join(tmpdir(), "codexpp-owl-"));
  try {
    mkdirSync(join(root, "resources"), { recursive: true });
    writeFileSync(
      join(root, "resources", "owl-app.ini"),
      "[Owl]\nUserDataDirectoryName=Codex\nAppVersion=26.901.51231\n",
    );
    assert.equal(isolateWindowsOwlUserData(root), true);
    const ini = readFileSync(join(root, "resources", "owl-app.ini"), "utf8");
    assert.match(ini, /UserDataDirectoryName=ChatGPT\+\+/);
    assert.equal(ini.includes("UserDataDirectoryName=Codex"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("locateCodex Windows 优先使用已有 store-apps 镜像", () => {
  if (process.platform !== "win32") return;
  const local = mkdtempSync(join(tmpdir(), "codexpp-local-"));
  const prev = process.env.LOCALAPPDATA;
  try {
    const app = join(local, "chatgpt-plusplus", "store-apps", "OpenAI.Codex_1_x64__xx", "app");
    mkdirSync(join(app, "resources"), { recursive: true });
    writeFileSync(join(app, "resources", "app.asar"), "x");
    writeFileSync(join(app, "ChatGPT.exe"), "x");
    process.env.LOCALAPPDATA = local;
    const install = locateCodex();
    assert.equal(install.appRoot.toLowerCase(), app.toLowerCase());
  } finally {
    process.env.LOCALAPPDATA = prev;
    rmSync(local, { recursive: true, force: true });
  }
});

test("isWindowsChatGptAppRoot 不把 ChatGPT++ 安装器当成官方应用", () => {
  const root = mkdtempSync(join(tmpdir(), "codexpp-winroot-"));
  try {
    const gui = join(root, "Programs", "ChatGPT++");
    mkdirSync(join(gui, "resources", "app"), { recursive: true });
    writeFileSync(join(gui, "resources", "app", "package.json"), "{}");
    writeFileSync(join(gui, "ChatGPT++.exe"), "x");
    assert.equal(isWindowsChatGptAppRoot(gui), false);

    const mirror = join(root, "chatgpt-plusplus", "store-apps", "OpenAI.Codex_1", "app");
    mkdirSync(join(mirror, "resources"), { recursive: true });
    writeFileSync(join(mirror, "resources", "app.asar"), "x");
    writeFileSync(join(mirror, "ChatGPT.exe"), "x");
    assert.equal(isWindowsChatGptAppRoot(mirror), true);

    const owl = join(root, "owl-app");
    mkdirSync(join(owl, "resources"), { recursive: true });
    writeFileSync(join(owl, "resources", "app.asar"), "x");
    writeFileSync(join(owl, "resources", "owl-app.ini"), "[Owl]\n");
    assert.equal(isWindowsChatGptAppRoot(owl), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("preferredWindowsLaunchExe 优先启动器而不是 ChatGPT.exe", () => {
  const root = mkdtempSync(join(tmpdir(), "codexpp-launch-"));
  const prev = process.env.LOCALAPPDATA;
  try {
    process.env.LOCALAPPDATA = root;
    const app = join(root, "store-apps", "app");
    mkdirSync(app, { recursive: true });
    writeFileSync(join(app, "ChatGPT.exe"), "official");
    writeFileSync(join(app, "ChatGPT++.exe"), "branded");
    assert.equal(preferredWindowsLaunchExe(app), join(app, "ChatGPT++.exe"));

    const stubDir = join(root, "chatgpt-plusplus", "bin");
    mkdirSync(stubDir, { recursive: true });
    const stub = join(stubDir, "ChatGPT++.exe");
    writeFileSync(stub, "stub");
    assert.equal(preferredWindowsLaunchExe(app), stub);
  } finally {
    process.env.LOCALAPPDATA = prev;
    rmSync(root, { recursive: true, force: true });
  }
});

test("pickWindowsManagedMirror 丢掉卸载残留的旧版本", () => {
  const oldApp = "C:/Users/x/AppData/Local/chatgpt-plusplus/store-apps/OpenAI.Codex_26.803.10889.0_x64__xx/app";
  const newApp = "C:/Users/x/AppData/Local/chatgpt-plusplus/store-apps/OpenAI.Codex_26.901.6511.0_x64__xx/app";
  assert.equal(windowsStoreMirrorPackageName(oldApp), "OpenAI.Codex_26.803.10889.0_x64__xx");
  assert.equal(pickWindowsManagedMirror([oldApp, newApp], []), newApp);
  assert.equal(
    pickWindowsManagedMirror([oldApp, newApp], ["OpenAI.Codex_26.901.6511.0_x64__xx"]),
    newApp,
  );
  assert.equal(
    pickWindowsManagedMirror([oldApp], ["OpenAI.Codex_26.901.6511.0_x64__xx"]),
    null,
  );
});

