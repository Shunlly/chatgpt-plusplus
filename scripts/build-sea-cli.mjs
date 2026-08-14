// 构建单文件 SEA CLI（复刻 scripts/package.mjs 的 bundleCli + buildSea，
// 不产出 dmg/exe）。用于把修复后的 CLI 部署到本机持久副本。
import {
  chmodSync,
  copyFileSync,
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
const BUILD = join(ROOT, ".build", "sea-cli");
const OUT = join(BUILD, "chatgpt-plusplus");
const SEA_SENTINEL = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";
const NODE_LTS = "v24.19.0";

const run = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

rmSync(BUILD, { recursive: true, force: true });
mkdirSync(BUILD, { recursive: true });

// 1) esbuild 打包 CLI
const cli = join(BUILD, "cli.cjs");
await build({
  entryPoints: [join(ROOT, "packages", "installer", "dist", "cli.js")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["original-fs"],
  outfile: cli,
});
let src = readFileSync(cli, "utf8");
src = src.replace(/\bimport_meta\d*\.url/g, "import_meta_url");
const banner = 'const import_meta_url = require("node:url").pathToFileURL(__filename).href;';
const shebang = src.startsWith("#!") ? src.slice(0, src.indexOf("\n") + 1) : "";
src = shebang + banner + "\n" + src.slice(shebang.length);
writeFileSync(cli, src);

// 2) SEA blob（本机 node 26 不满足 22.x 条件，下载官方 LTS 24）
const config = join(BUILD, "sea-config.json");
writeFileSync(config, JSON.stringify({ main: "cli.cjs", output: "sea-prep.blob", disableExperimentalSEAWarning: true }));
const nodeDir = join(BUILD, "node", NODE_LTS, `${process.platform}-${process.arch}`);
const nodeBin = join(nodeDir, "bin", "node");
if (!existsSync(nodeBin)) {
  const url = `https://nodejs.org/dist/${NODE_LTS}/node-${NODE_LTS}-${process.platform}-${process.arch}.tar.gz`;
  console.log("下载 Node.js LTS:", url);
  const tmp = join(BUILD, "node.tar.gz");
  run("curl", ["-fsSL", "--retry", "3", "-o", tmp, url], ROOT);
  mkdirSync(nodeDir, { recursive: true });
  run("tar", ["-xzf", tmp, "-C", nodeDir, "--strip-components=1"], ROOT);
  chmodSync(nodeBin, 0o755);
  rmSync(tmp, { force: true });
}
run(nodeBin, ["--experimental-sea-config", config], BUILD);
copyFileSync(nodeBin, OUT);
chmodSync(OUT, 0o755);
run(process.execPath, [
  join(ROOT, "node_modules", "postject", "dist", "cli.js"),
  OUT,
  "NODE_SEA_BLOB",
  join(BUILD, "sea-prep.blob"),
  "--sentinel-fuse",
  SEA_SENTINEL,
  "--macho-segment-name",
  "NODE_SEA",
], ROOT);
run("codesign", ["--force", "--sign", "-", OUT], ROOT);
console.log("SEA CLI 已生成：", OUT);
