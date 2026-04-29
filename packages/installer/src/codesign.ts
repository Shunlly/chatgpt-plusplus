/**
 * Ad-hoc code signing on macOS. After we mutate Info.plist or the
 * Electron Framework binary, the original signature is invalid. Re-signing
 * with the ad-hoc identity (`-`) makes Gatekeeper accept it on the
 * developer's own machine.
 *
 * `codesign --deep` does NOT recurse into `app.asar.unpacked` (it's not a
 * standard bundle layout), so native modules like `better-sqlite3.node` keep
 * their original Developer ID signature. Once the parent app is ad-hoc, the
 * dyld loader's Library Validation rejects the team-id mismatch and the
 * native module fails to load. We work around this by walking
 * `app.asar.unpacked` ourselves and re-signing every Mach-O file ad-hoc
 * before signing the main bundle.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { platform } from "node:os";

const MACHO_MAGICS = new Set([
  0xfeedface, // 32-bit
  0xfeedfacf, // 64-bit
  0xcafebabe, // fat
  0xcffaedfe, // 64-bit LE
  0xcefaedfe, // 32-bit LE
]);

export function adHocSign(appRoot: string): void {
  if (platform() !== "darwin") return;

  // Step 1: pre-sign every Mach-O file under app.asar.unpacked. We do this
  // before the bundle-level pass because once the framework is ad-hoc, every
  // load must agree.
  const resources = join(appRoot, "Contents", "Resources");
  for (const candidate of [
    join(resources, "app.asar.unpacked"),
  ]) {
    try {
      walkAndSign(candidate);
    } catch {
      // Directory may not exist; ignore.
    }
  }

  // Step 2: sign the bundle itself with --deep (covers Frameworks, Helpers).
  execFileSync(
    "codesign",
    ["--force", "--deep", "--sign", "-", appRoot],
    { stdio: "inherit" },
  );
}

function walkAndSign(root: string): void {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = join(root, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walkAndSign(full);
      continue;
    }
    if (!st.isFile()) continue;
    if (!isMachO(full)) continue;
    try {
      execFileSync(
        "codesign",
        ["--force", "--sign", "-", "--preserve-metadata=entitlements,flags", full],
        { stdio: "ignore" },
      );
    } catch {
      // Some files (e.g., already-signed dSYMs) may refuse; not fatal.
    }
  }
}

function isMachO(path: string): boolean {
  try {
    const fd = readFileSync(path, { flag: "r" }).subarray(0, 4);
    if (fd.length < 4) return false;
    const magic = fd.readUInt32BE(0);
    return MACHO_MAGICS.has(magic);
  } catch {
    return false;
  }
}

export function verifySignature(appRoot: string): { ok: boolean; output: string } {
  if (platform() !== "darwin") return { ok: true, output: "(not macOS)" };
  try {
    const out = execFileSync("codesign", ["--verify", "--deep", "--strict", appRoot], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, output: out };
  } catch (e) {
    const err = e as { stderr?: Buffer | string };
    return { ok: false, output: String(err.stderr ?? e) };
  }
}

export interface SignatureInfo {
  ok: boolean;
  adHoc: boolean;
  teamIdentifier: string | null;
  authority: string[];
  output: string;
}

export function signatureInfo(appRoot: string): SignatureInfo {
  if (platform() !== "darwin") {
    return { ok: true, adHoc: false, teamIdentifier: null, authority: [], output: "(not macOS)" };
  }
  const result = spawnSync("codesign", ["-dv", "--verbose=4", appRoot], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const info = parseSignatureInfo(output);
  return { ...info, ok: result.status === 0, output };
}

function parseSignatureInfo(output: string): SignatureInfo {
  const team = /^TeamIdentifier=(.*)$/m.exec(output)?.[1]?.trim() ?? null;
  const authority = [...output.matchAll(/^Authority=(.*)$/gm)].map((m) => m[1].trim());
  return {
    ok: true,
    adHoc: /Signature=adhoc/.test(output) || team === "not set",
    teamIdentifier: team === "not set" ? null : team,
    authority,
    output,
  };
}

/** Remove the macOS quarantine xattr so the modified app launches without prompt. */
export function clearQuarantine(appRoot: string): void {
  if (platform() !== "darwin") return;
  try {
    execFileSync("xattr", ["-dr", "com.apple.quarantine", appRoot], { stdio: "ignore" });
  } catch {
    /* no-op if not set */
  }
}
