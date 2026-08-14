// 编译 GUI：esbuild 打包 main.ts / preload.ts / renderer.ts，拷贝页面。
import { build } from "esbuild";
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const OUT = join(ROOT, "dist");
mkdirSync(OUT, { recursive: true });

for (const [entry, outfile] of [["main.ts", "main.js"], ["preload.ts", "preload.js"]]) {
  await build({
    entryPoints: [join(SRC, entry)],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    external: ["electron"],
    outfile: join(OUT, outfile),
  });
}

// 渲染进程逻辑（主题页）：打包为浏览器 IIFE，renderer.html 通过 <script src="./renderer.js"> 引入。
await build({
  entryPoints: [join(SRC, "renderer.ts")],
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "chrome120",
  outfile: join(OUT, "renderer.js"),
});
cpSync(join(SRC, "renderer.html"), join(OUT, "renderer.html"));
console.log("GUI 已编译：", OUT);
