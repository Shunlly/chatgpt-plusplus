/**
 * asar helpers. We don't crack open the binary header ourselves; we use
 * @electron/asar which is well-maintained and matches the format Electron expects.
 *
 * The integrity hash Electron checks is the SHA-256 of the asar **header JSON**
 * (the leading length-prefixed JSON blob), not the entire file. @electron/asar
 * exposes this via `getRawHeader()`.
 */
import asar from "@electron/asar";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, cpSync, existsSync, renameSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface AsarHeaderInfo {
  /** SHA-256 hex of the header JSON bytes Electron hashes. */
  headerHash: string;
  /** The decoded header object (the directory tree). */
  header: unknown;
}

export function readHeaderHash(asarPath: string): AsarHeaderInfo {
  // getRawHeader returns { header, headerString, headerSize }
  const raw = (asar as unknown as {
    getRawHeader: (p: string) => { header: unknown; headerString: string };
  }).getRawHeader(asarPath);
  const hash = createHash("sha256").update(raw.headerString).digest("hex");
  return { headerHash: hash, header: raw.header };
}

/**
 * Extract → mutate via callback → repack. The callback receives a temp dir
 * containing the unpacked asar contents and may modify files in place.
 * Returns the new header hash post-repack.
 *
 * We must preserve the original asar's unpacked-file set EXACTLY: marking a
 * file `unpacked: true` in the header tells Electron to read it from
 * `app.asar.unpacked/` instead of inline. If we accidentally mark a file
 * unpacked that isn't actually present in the .unpacked/ sibling dir,
 * `require` will fail with MODULE_NOT_FOUND.
 */
export async function patchAsar(
  asarPath: string,
  mutate: (extractedDir: string) => Promise<void> | void,
): Promise<AsarHeaderInfo> {
  const work = mkdtempSync(join(tmpdir(), "cxx-asar-"));
  const extractDir = join(work, "src");
  const outAsar = join(work, "app.asar");

  // Snapshot which files were unpacked in the ORIGINAL asar before we touch
  // anything; we'll feed that exact set back to createPackageWithOptions.
  const originalUnpackGlob = collectUnpackGlob(asarPath);

  try {
    asar.extractAll(asarPath, extractDir);
    await mutate(extractDir);

    await asar.createPackageWithOptions(extractDir, outAsar, {
      globOptions: { dot: true },
      ...(originalUnpackGlob ? { unpack: originalUnpackGlob } : {}),
    });

    // Atomic-ish replace: write next to the target, then rename. This prevents
    // a denied write (e.g. macOS App Management TCC) from leaving the bundle
    // without an app.asar. Both the staging file and target must be on the
    // same filesystem for `rename` to be atomic.
    const stagingPath = `${asarPath}.codexpp-new`;
    try {
      cpSync(outAsar, stagingPath);
    } catch (e) {
      throw annotatePermError(e, asarPath);
    }
    try {
      renameSync(stagingPath, asarPath);
    } catch (e) {
      try { unlinkSync(stagingPath); } catch { /* best effort */ }
      throw annotatePermError(e, asarPath);
    }
    return readHeaderHash(asarPath);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/**
 * Walk the existing asar header and produce a brace-expansion glob naming
 * exactly the unpacked files. @electron/asar's `unpackDir` option recursively
 * unpacks entire directories, which promotes package metadata (`package.json`,
 * `LICENSE`, etc.) to unpacked even when those files are not physically present
 * in `.unpacked/`.
 *
 * Why this matters: if the header marks a file `unpacked: true` but the file
 * isn't on disk under `app.asar.unpacked/`, Electron's resolver throws
 * MODULE_NOT_FOUND when something requires the module — exactly the failure
 * mode we hit before this fix.
 */
function collectUnpackGlob(asarPath: string): string | undefined {
  const sibling = `${asarPath}.unpacked`;
  if (!existsSync(sibling)) return undefined;
  const raw = (asar as unknown as {
    getRawHeader: (p: string) => { header: { files?: Record<string, unknown> } };
  }).getRawHeader(asarPath);
  const paths: string[] = [];
  walk(raw.header as Record<string, unknown>, "", paths);
  if (paths.length === 0) return undefined;
  // `unpack` is matched against absolute filenames, so prefix each archive path
  // with `**` to match regardless of the temporary extraction directory.
  const patterns = paths.map((p) => `**${p}`);
  return patterns.length === 1 ? patterns[0] : `{${patterns.join(",")}}`;
}

function walk(node: Record<string, unknown>, prefix: string, out: string[]): void {
  const files = (node as { files?: Record<string, Record<string, unknown>> }).files;
  if (!files) return;
  for (const [name, val] of Object.entries(files)) {
    const p = `${prefix}/${name}`;
    const isDir = !!(val as { files?: unknown }).files;
    if (!isDir && (val as { unpacked?: boolean }).unpacked) out.push(p);
    if (isDir) walk(val, p, out);
  }
}

/** Backup helper: copy `from` to `to` if `to` doesn't already exist. */
export function backupOnce(from: string, to: string): void {
  if (!existsSync(to)) cpSync(from, to, { recursive: true });
}

/** Read a file inside the asar without extracting the whole thing. */
export function readFileInAsar(asarPath: string, relPath: string): Buffer {
  return asar.extractFile(asarPath, relPath) as Buffer;
}

/**
 * Wrap EPERM/EACCES errors writing into an app bundle with an actionable
 * message about macOS App Management permission. Other errors pass through.
 */
function annotatePermError(e: unknown, target: string): Error {
  const err = e as NodeJS.ErrnoException;
  if (err && (err.code === "EPERM" || err.code === "EACCES") && /\/Applications\//.test(target)) {
    const msg =
      `Permission denied writing to ${target}.\n\n` +
      `macOS App Management is blocking modification of /Applications/Codex.app.\n` +
      `Grant permission via:\n` +
      `  System Settings > Privacy & Security > App Management > enable your terminal\n` +
      `(macOS may also have shown a permission prompt - click Allow, then re-run install.)\n\n` +
      `Original error: ${err.message}`;
    const wrapped = new Error(msg);
    (wrapped as NodeJS.ErrnoException).code = err.code;
    return wrapped;
  }
  return err instanceof Error ? err : new Error(String(err));
}
