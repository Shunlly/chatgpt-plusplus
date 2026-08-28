import { createRequire } from "node:module";
import type { ChildProcess, spawn as SpawnFn } from "node:child_process";
import { existsSync, readFileSync, statSync, unwatchFile, watchFile } from "node:fs";

const requireChildProcess = createRequire(__filename);

export function isCodexAppServerSpawn(file: unknown, args: unknown): boolean {
  const name = String(file ?? "").replace(/\\/g, "/").split("/").pop()?.toLowerCase() ?? "";
  if (name !== "codex" && name !== "codex.exe") return false;
  const argv = Array.isArray(args) ? args.map((a) => String(a).toLowerCase()) : [];
  if (argv.length === 0) return true;
  return argv.some((a) => a === "app-server" || a.includes("app-server"));
}

export function catalogFingerprint(
  toml: string,
  statPath: (p: string) => { mtimeMs: number; size: number } = (p) => statSync(p),
): string | null {
  const m = toml.match(/^\s*model_catalog_json\s*=\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\S+)/m);
  if (!m) return null;
  let path = m[1] ?? "";
  if (
    (path.startsWith('"') && path.endsWith('"')) ||
    (path.startsWith("'") && path.endsWith("'"))
  ) {
    path = path.slice(1, -1);
  }
  let sig = path;
  try {
    const st = statPath(path);
    sig += `|${st.mtimeMs}|${st.size}`;
  } catch {
    sig += "|missing";
  }
  return sig;
}

export function readCatalogFingerprint(configPath: string): string | null {
  try {
    if (!existsSync(configPath)) return null;
    return catalogFingerprint(readFileSync(configPath, "utf8"));
  } catch {
    return null;
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

  const wrapChild = (_file: unknown, _args: unknown, child: ChildProcess): ChildProcess => {
    let fp = readCatalogFingerprint(opts.configPath);
    log(`app-server spawn gated; catalog=${fp ?? "none"}`);

    const maybeRestart = () => {
      const next = readCatalogFingerprint(opts.configPath);
      if (!next || next === fp) return;
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

    watchFile(opts.configPath, { interval: 500, persistent: false }, maybeRestart);
    child.once("exit", () => {
      try {
        unwatchFile(opts.configPath);
      } catch {}
    });
    return child;
  };

  function gatedSpawn(this: unknown, ...args: unknown[]): ChildProcess {
    const file = args[0];
    const restArgs = Array.isArray(args[1]) ? args[1] : [];
    const gate = isCodexAppServerSpawn(file, restArgs);
    if (gate) waitForConfigSettle(opts.configPath);
    const child = origSpawn(...(args as Parameters<typeof SpawnFn>));
    if (gate) wrapChild(file, restArgs, child);
    return child;
  }

  childProcess.spawn = gatedSpawn as typeof SpawnFn;
}
