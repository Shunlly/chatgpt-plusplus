// 把 loader stub 和打包后的 runtime 拷进 installer/assets/，安装时再解到用户目录。
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..", "..");
const out = resolve(here, "..", "assets");
const runtimeSrc = resolve(root, "packages/runtime/dist");
const runtimeDest = resolve(out, "runtime");

mkdirSync(out, { recursive: true });

for (const name of ["loader.cjs", "bootstrap-user-data.cjs"]) {
  const src = resolve(root, "packages/loader", name);
  if (!existsSync(src)) {
    throw new Error(`[copy-assets] missing ${src}`);
  }
  cpSync(src, resolve(out, name));
  console.log(`[copy-assets] packages/loader/${name} -> assets/${name}`);
}

// 只拷宿主实际加载的 bundle + native，丢掉 tsc 碎文件和 sourcemap。
rmSync(runtimeDest, { recursive: true, force: true });
mkdirSync(runtimeDest, { recursive: true });
for (const name of ["main.js", "preload.js"]) {
  const src = resolve(runtimeSrc, name);
  if (!existsSync(src)) {
    throw new Error(`[copy-assets] missing ${src}（先构建 @chatgpt-plusplus/runtime）`);
  }
  cpSync(src, resolve(runtimeDest, name));
}
const nativeSrc = resolve(runtimeSrc, "native");
if (existsSync(nativeSrc)) {
  cpSync(nativeSrc, resolve(runtimeDest, "native"), { recursive: true });
}
console.log("[copy-assets] packages/runtime/dist/{main,preload,native} -> assets/runtime");
