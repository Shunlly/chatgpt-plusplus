// Dream Skin 换肤 tweak 的自检：manifest 合法性、随包资源完整性、
// payload 组装后能被 JS 解析（防止占位符替换遗漏导致运行期语法错误）。
import assert from "node:assert/strict";
import { test } from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { validateTweakManifest } from "@chatgpt-plusplus/sdk";

const here = fileURLToPath(new URL(".", import.meta.url));
const tweakRoot = resolve(here, "../../../tweaks/dream-skin");
const require = createRequire(import.meta.url);

const PLACEHOLDERS = [
  "__DREAM_SKIN_CSS_JSON__",
  "__DREAM_SKIN_ART_JSON__",
  "__DREAM_SKIN_THEME_JSON__",
  "__DREAM_SKIN_VERSION_JSON__",
  "__DREAM_SKIN_STYLE_REVISION_JSON__",
];

test("dream-skin manifest 合法", () => {
  const manifest = JSON.parse(readFileSync(join(tweakRoot, "manifest.json"), "utf8"));
  const result = validateTweakManifest(manifest);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(manifest.scope, "renderer");
});

test("dream-skin 入口导出 start/stop，且顶层不依赖浏览器全局", () => {
  const mod = require(join(tweakRoot, "index.js"));
  assert.equal(typeof mod.start, "function");
  assert.equal(typeof mod.stop, "function");
});

test("dream-skin 随包资源完整且图片不超 1 MiB 资源上限", () => {
  const css = readFileSync(join(tweakRoot, "assets/dream-skin.css"), "utf8");
  const template = readFileSync(join(tweakRoot, "assets/renderer-inject.js"), "utf8");
  assert.ok(css.length > 0);
  assert.ok(template.length > 0);
  for (const placeholder of PLACEHOLDERS) {
    assert.ok(template.includes(placeholder), `缺失占位符 ${placeholder}`);
  }
  const presetDirs = readdirSync(join(tweakRoot, "presets")).filter((name) =>
    statSync(join(tweakRoot, "presets", name)).isDirectory(),
  );
  assert.ok(presetDirs.length >= 1, "至少需要一个预设");
  for (const dir of presetDirs) {
    const themePath = join(tweakRoot, "presets", dir, "theme.json");
    const theme = JSON.parse(readFileSync(themePath, "utf8"));
    assert.equal(theme.id, dir);
    const imagePath = join(tweakRoot, "presets", dir, theme.image || "background.jpg");
    const size = statSync(imagePath).size;
    assert.ok(size > 0 && size <= 1024 * 1024, `${dir} 图片 ${size} 超出 1 MiB 资源上限`);
  }
});

test("dream-skin 新版首页识别会清除欢迎区白色面板", () => {
  const css = readFileSync(join(tweakRoot, "assets/dream-skin.css"), "utf8");
  const template = readFileSync(join(tweakRoot, "assets/renderer-inject.js"), "utf8");
  assert.match(template, /getElementsByClassName\("group\/home-suggestions"\)\[0\] \|\| null/);
  assert.match(template, /shellMain\.classList\.toggle\("dream-skin-home-shell", Boolean\(home\)\)/);
  assert.match(css, /main\[data-app-shell-main-surface\]\.dream-skin-home-shell\s*\{\s*background: transparent !important;/);
});

test("dream-skin payload 组装后可被 JS 解析（无占位符残留）", () => {
  const css = readFileSync(join(tweakRoot, "assets/dream-skin.css"), "utf8");
  const template = readFileSync(join(tweakRoot, "assets/renderer-inject.js"), "utf8");
  const presetDir = readdirSync(join(tweakRoot, "presets")).find((name) =>
    statSync(join(tweakRoot, "presets", name)).isDirectory(),
  );
  const theme = JSON.parse(
    readFileSync(join(tweakRoot, "presets", presetDir, "theme.json"), "utf8"),
  );
  const art = readFileSync(
    join(tweakRoot, "presets", presetDir, theme.image || "background.jpg"),
  );
  const artUrl = `data:image/jpeg;base64,${art.toString("base64")}`;
  const payload = template
    .replace("__DREAM_SKIN_CSS_JSON__", JSON.stringify(css))
    .replace("__DREAM_SKIN_ART_JSON__", JSON.stringify(artUrl))
    .replace("__DREAM_SKIN_THEME_JSON__", JSON.stringify(theme))
    .replace("__DREAM_SKIN_VERSION_JSON__", JSON.stringify("1.0.0"))
    .replace("__DREAM_SKIN_STYLE_REVISION_JSON__", JSON.stringify("test"));
  assert.ok(!payload.includes("__DREAM_SKIN_"), "占位符未全部替换");
  // 只做语法解析，不执行：Node 里没有 document/window，执行会失败。
  new Function(payload);
});
