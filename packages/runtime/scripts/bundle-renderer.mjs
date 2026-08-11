/**
 * Bundles both the renderer-side preload AND the main-process entry into
 * single files. Both run inside Codex.app's runtime — we don't want to ship
 * a node_modules tree, so we bundle deps in. `electron` and Node built-ins
 * stay external because they're provided by the host.
 */
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
// 版本号取自仓库根 package.json，随发版同步，避免运行时/安装器硬编码旧版本。
const repoRoot = resolve(here, "..", "..", "..");
const CHATGPT_PLUSPLUS_VERSION = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8")).version;

await build({
  entryPoints: [resolve(root, "src/preload/index.ts")],
  bundle: true,
  outfile: resolve(root, "dist/preload.js"),
  platform: "browser",
  target: "es2022",
  format: "cjs",
  external: ["electron"],
  sourcemap: "inline",
  minify: false,
  logLevel: "info",
});

await build({
  entryPoints: [resolve(root, "src/main.ts")],
  define: { __CHATGPT_PLUSPLUS_VERSION__: JSON.stringify(CHATGPT_PLUSPLUS_VERSION) },
  bundle: true,
  outfile: resolve(root, "dist/main.js"),
  platform: "node",
  target: "node20",
  format: "cjs",
  external: ["electron"],
  sourcemap: "inline",
  minify: false,
  logLevel: "info",
  // chokidar uses dynamic native fsevents on macOS via optional dep; let
  // esbuild treat any failure to resolve as an empty module so we degrade
  // gracefully to polling on platforms without it. (chokidar v4 already
  // handles missing fsevents internally — this is just future-proofing.)
});

console.log("[bundle] preload + main bundled");
