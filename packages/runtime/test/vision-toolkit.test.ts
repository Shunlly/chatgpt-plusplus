import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = fileURLToPath(new URL(".", import.meta.url));
const tweakDir = resolve(here, "../../../tweaks/vision-toolkit");
const src = readFileSync(resolve(tweakDir, "index.js"), "utf8");
const manifest = JSON.parse(readFileSync(resolve(tweakDir, "manifest.json"), "utf8"));
const mcp = readFileSync(resolve(tweakDir, "mcp-server.mjs"), "utf8");

test("视觉工具箱在 Tweaks 卡片上挂配置按钮，不注册巨大侧栏页", () => {
  assert.match(src, /api\.settings\.register\(\{/);
  assert.match(src, /id: "vision-config"/);
  assert.match(src, /function renderVisionConfigButton\(api, root\)/);
  assert.equal(src.includes("registerPage"), false);
  assert.match(src, /configure: "配置"/);
});

test("视觉配置表单用设置页 token，不用灰底绿按钮", () => {
  assert.match(src, /text-token-text-primary/);
  assert.match(src, /border-token-border/);
  assert.equal(src.includes("#f9f9f9"), false);
  assert.equal(src.includes("#10a37f"), false);
  assert.equal(src.includes("#fff3cd"), false);
  assert.match(src, /保存后重启 ChatGPT 生效/);
});

test("配置表单有测试连接，主进程走 mcp --ping", () => {
  assert.equal(manifest.scope, "both");
  assert.match(src, /测试连接/);
  assert.match(src, /api\.ipc\.invoke\("test-connection"/);
  assert.match(src, /api\.ipc\.handle\("test-connection"/);
  assert.match(mcp, /--ping/);
  assert.match(mcp, /process\.argv\.includes\("--ping"\) \? \{\}/);
});

test("mcp --ping 无 key 立刻失败", () => {
  const r = spawnSync(
    process.execPath,
    [resolve(tweakDir, "mcp-server.mjs"), "--ping"],
    {
      encoding: "utf8",
      timeout: 5000,
      env: { PATH: process.env.PATH, VISION_API_KEY: "YOUR_VISION_API_KEY" },
    },
  );
  const line = (r.stdout || "").trim().split("\n").filter(Boolean).pop() || "";
  const json = JSON.parse(line);
  assert.equal(json.ok, false);
  assert.match(String(json.error), /API Key/);
});

test("mcp --self-check", () => {
  const r = spawnSync(
    process.execPath,
    [resolve(tweakDir, "mcp-server.mjs"), "--self-check"],
    { encoding: "utf8", timeout: 5000 },
  );
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /self-check ok/);
});

test("表单文案跟随 zh/en，描述语言切换会套用 I18N", () => {
  assert.match(src, /const I18N = /);
  assert.match(src, /configure: "配置"/);
  assert.match(src, /configure: "Configure"/);
  assert.match(src, /function detectLang\(\)/);
  assert.match(src, /function applyI18n\(/);
  assert.match(src, /data-i18n="test"/);
  assert.match(src, /#vision-lang"\)\.addEventListener\("change"/);
});

test("mcp --ping 无 key 跟随 VISION_LANG", () => {
  const r = spawnSync(
    process.execPath,
    [resolve(tweakDir, "mcp-server.mjs"), "--ping"],
    {
      encoding: "utf8",
      timeout: 5000,
      env: { PATH: process.env.PATH, VISION_API_KEY: "YOUR_VISION_API_KEY", VISION_LANG: "en" },
    },
  );
  const line = (r.stdout || "").trim().split("\n").filter(Boolean).pop() || "";
  const json = JSON.parse(line);
  assert.equal(json.ok, false);
  assert.equal(json.error, "API key is not set");
});

test("vision_glance 说明跟白名单走，并禁止 view_image", () => {
  assert.match(mcp, /function buildToolInstructions\(enabledModels, selfPath\)/);
  assert.match(mcp, /enabledModels\.join\(" \/ "\)/);
  assert.match(mcp, /view_image/);
  assert.match(mcp, /instructions: TOOL_INSTRUCTIONS/);
});

test("mcp 实现 resources/list 空列表", () => {
  assert.match(mcp, /case "resources\/list"/);
});

test("mcp --glance 缺参数退出 2", () => {
  const r = spawnSync(
    process.execPath,
    [resolve(tweakDir, "mcp-server.mjs"), "--glance"],
    { encoding: "utf8", timeout: 5000, env: { PATH: process.env.PATH } },
  );
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--glance/);
});

test("视觉请求用 fetch，大图走 sips 压缩", () => {
  assert.match(mcp, /await fetch\(/);
  assert.match(mcp, /function shrinkIfNeeded/);
  assert.match(mcp, /sips/);
  assert.equal(mcp.includes("spawn(\"curl\""), false);
});
