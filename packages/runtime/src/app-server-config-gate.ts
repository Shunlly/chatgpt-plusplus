import { createRequire } from "node:module";
import type { ChildProcess, spawn as SpawnFn } from "node:child_process";
import { existsSync, readFileSync, statSync, unwatchFile, watchFile, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";

const requireChildProcess = createRequire(__filename);

export function shouldRestartAppServerOnCatalogChange(platformName = process.platform): boolean {
  // Windows 的 Owl 会定期重写 catalog；杀 app-server 会被宿主当成整应用崩溃并拉起。
  return platformName !== "win32";
}

export function isCodexAppServerSpawn(file: unknown, args: unknown): boolean {
  const name = String(file ?? "").replace(/\\/g, "/").split("/").pop()?.toLowerCase() ?? "";
  if (name !== "codex" && name !== "codex.exe") return false;
  const argv = Array.isArray(args) ? args.map((a) => String(a).toLowerCase()) : [];
  if (argv.length === 0) return true;
  return argv.some((a) => a === "app-server" || a.includes("app-server"));
}

export function catalogPathFromToml(toml: string, configDir?: string): string | null {
  const m = toml.match(/^\s*model_catalog_json\s*=\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\S+)/m);
  if (!m) return null;
  let catalogPath = m[1] ?? "";
  if (
    (catalogPath.startsWith('"') && catalogPath.endsWith('"')) ||
    (catalogPath.startsWith("'") && catalogPath.endsWith("'"))
  ) {
    catalogPath = catalogPath.slice(1, -1);
  }
  if (!catalogPath) return null;
  if (configDir && !isAbsolute(catalogPath)) return join(configDir, catalogPath);
  return catalogPath;
}

export function catalogFingerprint(
  toml: string,
  statPath: (p: string) => { mtimeMs: number; size: number } = (p) => statSync(p),
  configDir?: string,
): string | null {
  const catalogPath = catalogPathFromToml(toml, configDir);
  if (!catalogPath) return null;
  let sig = catalogPath;
  try {
    const st = statPath(catalogPath);
    sig += `|${st.mtimeMs}|${st.size}`;
  } catch {
    sig += "|missing";
  }
  return sig;
}

/** 给目录里尚未声明 image 的模型补上图片输入，让 Codex 输入框可以传图。 */
export function enableCatalogImageInput(raw: string): { json: string; changed: number } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { json: raw, changed: 0 };
  }
  const models = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { models?: unknown }).models)
      ? (data as { models: unknown[] }).models
      : null;
  if (!models) return { json: raw, changed: 0 };
  let changed = 0;
  for (const item of models) {
    if (!item || typeof item !== "object") continue;
    const model = item as { input_modalities?: unknown };
    const mods = model.input_modalities;
    if (!Array.isArray(mods)) {
      model.input_modalities = ["text", "image"];
      changed += 1;
      continue;
    }
    if (mods.some((m) => String(m).toLowerCase() === "image")) continue;
    model.input_modalities = [...mods, "image"];
    changed += 1;
  }
  if (!changed) return { json: raw, changed: 0 };
  return { json: `${JSON.stringify(data, null, 2)}\n`, changed };
}

export function patchCatalogImageInput(catalogFile: string, log?: (msg: string) => void): number {
  try {
    if (!existsSync(catalogFile)) return 0;
    const raw = readFileSync(catalogFile, "utf8");
    const next = enableCatalogImageInput(raw);
    if (!next.changed) return 0;
    writeFileSync(catalogFile, next.json);
    log?.(`catalog image input enabled for ${next.changed} model(s)`);
    return next.changed;
  } catch (e) {
    log?.(`catalog image patch skipped: ${e instanceof Error ? e.message : String(e)}`);
    return 0;
  }
}

export function readCatalogFingerprint(configPath: string): string | null {
  try {
    if (!existsSync(configPath)) return null;
    return catalogFingerprint(readFileSync(configPath, "utf8"), statSync, dirname(configPath));
  } catch {
    return null;
  }
}

function patchCatalogFromConfig(configPath: string, log: (msg: string) => void): void {
  try {
    const toml = readFileSync(configPath, "utf8");
    const catalogFile = catalogPathFromToml(toml, dirname(configPath));
    if (catalogFile) patchCatalogImageInput(catalogFile, log);
  } catch (e) {
    log(`catalog image patch skipped: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function waitForConfigSettle(configPath: string, maxMs = 800): void {
  const t0 = Date.now();
  let last = existsSync(configPath) ? statSync(configPath).mtimeMs : 0;
  let stableSince = Date.now();
  while (Date.now() - t0 < maxMs) {
    const now = existsSync(configPath) ? statSync(configPath).mtimeMs : 0;
    if (now !== last) {
      last = now;
      stableSince = Date.now();
    } else if (Date.now() - stableSince >= 200) {
      return;
    }
    sleepSync(50);
  }
}

export function installAppServerConfigGate(opts: {
  configPath: string;
  log?: (msg: string) => void;
}): void {
  const log = opts.log ?? (() => {});
  const childProcess = requireChildProcess("node:child_process") as typeof import("node:child_process");
  const origSpawn = childProcess.spawn.bind(childProcess) as typeof SpawnFn;
  let lastRestartAt = 0;
  const restartOnCatalogChange = shouldRestartAppServerOnCatalogChange();

  const wrapChild = (_file: unknown, _args: unknown, child: ChildProcess): ChildProcess => {
    let fp = readCatalogFingerprint(opts.configPath);
    log(`app-server spawn gated; catalog=${fp ?? "none"}`);

    const maybeRestart = () => {
      const next = readCatalogFingerprint(opts.configPath);
      if (!restartOnCatalogChange || !next || next === fp) return;
      if (child.killed || child.exitCode != null) return;
      const now = Date.now();
      if (now - lastRestartAt < 10_000) return;
      lastRestartAt = now;
      fp = next;
      log(`model_catalog_json changed after app-server start; restarting backend`);
      try {
        child.kill();
      } catch {}
    };

    const configListener = () => {
      patchCatalogFromConfig(opts.configPath, log);
      maybeRestart();
    };
    watchFile(opts.configPath, { interval: 500, persistent: false }, configListener);
    let catalogFile: string | null = null;
    let catalogListener: (() => void) | null = null;
    try {
      catalogFile = catalogPathFromToml(readFileSync(opts.configPath, "utf8"), dirname(opts.configPath));
    } catch {}
    if (catalogFile && catalogFile !== opts.configPath) {
      catalogListener = () => {
        patchCatalogFromConfig(opts.configPath, log);
        maybeRestart();
      };
      watchFile(catalogFile, { interval: 500, persistent: false }, catalogListener);
    }
    child.once("exit", () => {
      try {
        unwatchFile(opts.configPath, configListener);
      } catch {}
      if (catalogFile && catalogFile !== opts.configPath && catalogListener) {
        try {
          unwatchFile(catalogFile, catalogListener);
        } catch {}
      }
    });
    return child;
  };

  function gatedSpawn(this: unknown, ...args: unknown[]): ChildProcess {
    const file = args[0];
    const restArgs = Array.isArray(args[1]) ? args[1] : [];
    const gate = isCodexAppServerSpawn(file, restArgs);
    if (gate) {
      waitForConfigSettle(opts.configPath);
      patchCatalogFromConfig(opts.configPath, log);
    }
    const child = origSpawn(...(args as Parameters<typeof SpawnFn>));
    if (gate) wrapChild(file, restArgs, child);
    return child;
  }

  childProcess.spawn = gatedSpawn as typeof SpawnFn;
}
