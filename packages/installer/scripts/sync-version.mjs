// 版本单一事实源：根 package.json 的 version。
// 同步到所有需要手工维护的位置，防止版本漂移。
// 用法：node packages/installer/scripts/sync-version.mjs
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..", "..");
const join = (...p) => resolve(root, ...p);

const version = JSON.parse(readFileSync(join("package.json"), "utf8")).version;

// packages/installer/src/version.ts（构建产物直接内联，运行时不依赖 JSON import）
writeFileSync(
  join("packages", "installer", "src", "version.ts"),
  `// 由 scripts/sync-version.mjs 自动生成，勿手工修改。
export const CHATGPT_PLUSPLUS_VERSION = "${version}";

const SEMVER_RE = /^v?(\\d+)\\.(\\d+)\\.(\\d+)(?:[-+].*)?$/;

export function compareSemver(a: string, b: string): number {
  const av = SEMVER_RE.exec(a);
  const bv = SEMVER_RE.exec(b);
  if (!av || !bv) return a === b ? 0 : 1;
  for (let i = 1; i <= 3; i++) {
    const diff = Number(av[i]) - Number(bv[i]);
    if (diff !== 0) return diff;
  }
  return 0;
}
`,
);

// Formula/chatgptplusplus.rb 的 tag
const formulaPath = join("Formula", "chatgptplusplus.rb");
const formula = readFileSync(formulaPath, "utf8").replace(
  /tag: "v[\d.]+"/,
  `tag: "v${version}"`,
);
writeFileSync(formulaPath, formula);

// scripts/innosetup/installer.iss 的默认 VERSION
const issPath = join("scripts", "innosetup", "installer.iss");
const iss = readFileSync(issPath, "utf8").replace(
  /#define VERSION "[\d.]+"/,
  `#define VERSION "${version}"`,
);
writeFileSync(issPath, iss);

// workspace 内部包版本统一到根版本，避免同一产品出现多套版本号。
const syncedWorkspaces = [];
for (const dir of readdirSync(join("packages"), { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const pkgPath = join("packages", dir.name, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  if (typeof pkg.version === "string" && pkg.version !== version) {
    pkg.version = version;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    syncedWorkspaces.push(dir.name);
  }
}

console.log(
  `已同步版本 ${version} → version.ts / Formula tag / installer.iss` +
    (syncedWorkspaces.length ? ` / workspaces(${syncedWorkspaces.join(",")})` : ""),
);
