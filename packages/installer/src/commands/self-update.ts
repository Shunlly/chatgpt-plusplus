import kleur from "kleur";
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, rmSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { spawnSync } from "node:child_process";
import { extract as extractTar } from "tar";

interface Opts {
  repo?: string;
  ref?: string;
  repair?: boolean;
}

const here = dirname(fileURLToPath(import.meta.url));

export async function selfUpdate(opts: Opts = {}): Promise<void> {
  const repo = opts.repo ?? process.env.CODEX_PLUSPLUS_REPO ?? "b-nnett/codex-plusplus";
  const ref = opts.ref ?? process.env.CODEX_PLUSPLUS_REF ?? "main";
  const sourceRoot = resolve(here, "..", "..", "..");
  const parent = dirname(sourceRoot);
  const work = mkdtempSync(join(tmpdir(), "codexpp-update-"));
  const archive = join(work, "source.tar.gz");
  const next = join(work, "source");

  try {
    console.log(`Downloading codex-plusplus from https://github.com/${repo} (${ref})...`);
    await download(`https://codeload.github.com/${repo}/tar.gz/${ref}`, archive);
    mkdirSync(next, { recursive: true });
    await extractTar({ file: archive, cwd: next, strip: 1 });

    installDependencies(next);
    run("npm", ["run", "build"], next);

    const previous = `${sourceRoot}.previous`;
    rmSync(previous, { recursive: true, force: true });
    if (existsSync(sourceRoot)) renameSync(sourceRoot, previous);
    renameSync(next, sourceRoot);
    console.log(kleur.green(`Updated codex-plusplus source at ${sourceRoot}`));

    if (opts.repair !== false) {
      const cli = join(sourceRoot, "packages", "installer", "dist", "cli.js");
      run(process.execPath, [cli, "repair"], parent);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

async function download(url: string, target: string): Promise<void> {
  const res = await fetch(url, {
    headers: { "User-Agent": "codex-plusplus-self-update" },
  });
  if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  await pipeline(res.body, createWriteStream(target));
}

function installDependencies(cwd: string): void {
  if (existsSync(join(cwd, "package-lock.json"))) {
    const ci = runMaybe("npm", ["ci", "--workspaces", "--include-workspace-root", "--ignore-scripts"], cwd);
    if (ci === 0) return;
    console.warn(kleur.yellow("npm ci failed; regenerating lockfile for downloaded source."));
    rmSync(join(cwd, "package-lock.json"), { force: true });
  }
  run("npm", ["install", "--workspaces", "--include-workspace-root", "--ignore-scripts"], cwd);
}

function run(command: string, args: string[], cwd: string): void {
  const status = runMaybe(command, args, cwd);
  if (status !== 0) throw new Error(`${command} ${args.join(" ")} failed with exit code ${status}`);
}

function runMaybe(command: string, args: string[], cwd: string): number {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return result.status ?? 1;
}
