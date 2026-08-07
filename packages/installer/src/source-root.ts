import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export function findSourceRoot(start: string): string {
  let dir = resolve(start);
  for (let i = 0; i < 10; i++) {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { workspaces?: unknown };
        if (Array.isArray(pkg.workspaces)) return dir;
      } catch {}
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(start, "..", "..", "..", "..");
}

export type InstallationSourceKind =
  | "github-source"
  | "homebrew"
  | "local-dev"
  | "source-archive"
  | "standalone-package"
  | "unknown";

export interface InstallationSource {
  kind: InstallationSourceKind;
  label: string;
  detail: string;
}

export function describeInstallationSource(sourceRoot: string | null | undefined): InstallationSource {
  if (!sourceRoot) {
    return {
      kind: "unknown",
      label: "Unknown",
      detail: "ChatGPT++ source location is not recorded yet. Run chatgptplusplus install or repair.",
    };
  }

  const normalized = sourceRoot.replace(/\\/g, "/");
  if (existsSync(join(sourceRoot, "standalone.json"))) {
    return { kind: "standalone-package", label: "Standalone 安装包", detail: sourceRoot };
  }
  if (/\/(?:Homebrew|homebrew)\/Cellar\/(?:chatgptplusplus|codexplusplus)\//.test(normalized)) {
    return { kind: "homebrew", label: "Homebrew", detail: sourceRoot };
  }
  if (existsSync(join(sourceRoot, ".git"))) {
    return { kind: "local-dev", label: "Local development checkout", detail: sourceRoot };
  }
  if (
    normalized.endsWith("/.chatgpt-plusplus/source") ||
    normalized.includes("/.chatgpt-plusplus/source/") ||
    // 兼容旧项目名路径（老用户升级前的安装位置）。
    normalized.endsWith("/.codex-plusplus/source") ||
    normalized.includes("/.codex-plusplus/source/")
  ) {
    return { kind: "github-source", label: "GitHub source installer", detail: sourceRoot };
  }
  if (existsSync(join(sourceRoot, "package.json"))) {
    return { kind: "source-archive", label: "Source archive", detail: sourceRoot };
  }
  return { kind: "unknown", label: "Unknown", detail: sourceRoot };
}
