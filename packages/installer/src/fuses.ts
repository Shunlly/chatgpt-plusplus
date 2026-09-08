/**
 * Electron fuse flipping.
 *
 * Fuses are a 1-byte-per-fuse array stored in the Electron Framework binary,
 * preceded by a known sentinel string. We locate the sentinel, advance past
 * the [version, count] header, and rewrite the byte for the fuse we care about.
 *
 * Layout (schema v1):
 *   <sentinel:32 bytes ASCII> <version:u8 = 0x01> <count:u8> <fuse_state:u8>{count}
 * Fuse state bytes are ASCII '0' (off), '1' (on), '2' (removed), '3' (inherit).
 *
 * Reference: https://github.com/electron/fuses
 */
import { readFileSync, writeFileSync, statSync, chmodSync } from "node:fs";

const SENTINEL = Buffer.from("dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX", "ascii");

/** Index of each fuse, in order, for Electron 41 (FuseV1Options). */
export const FuseV1 = {
  RunAsNode: 0,
  EnableCookieEncryption: 1,
  EnableNodeOptionsEnvironmentVariable: 2,
  EnableNodeCliInspectArguments: 3,
  EnableEmbeddedAsarIntegrityValidation: 4,
  OnlyLoadAppFromAsar: 5,
  LoadBrowserProcessSpecificV8Snapshot: 6,
  GrantFileProtocolExtraPrivileges: 7,
  /** Some Electron versions add this 9th fuse. We touch it cautiously. */
  ResetAdHocDarwinSignature: 8,
} as const;

export type FuseName = keyof typeof FuseV1;
export type FuseValue = "off" | "on" | "removed" | "inherit";

const VAL_TO_BYTE: Record<FuseValue, number> = {
  off: 0x30,
  on: 0x31,
  removed: 0x32,
  inherit: 0x33,
};
const BYTE_TO_VAL: Record<number, FuseValue> = {
  0x30: "off",
  0x31: "on",
  0x32: "removed",
  0x33: "inherit",
};

export interface FuseSnapshot {
  schemaVersion: number;
  count: number;
  fuses: FuseValue[];
  /** Absolute byte offset of the fuse-state region within the file. */
  offset: number;
}

export function hasElectronFuses(binaryPath: string): boolean {
  try {
    return readFileSync(binaryPath).includes(SENTINEL);
  } catch {
    return false;
  }
}

export function readFuses(binaryPath: string): FuseSnapshot {
  const buf = readFileSync(binaryPath);
  const sentIdx = buf.indexOf(SENTINEL);
  if (sentIdx < 0) {
    throw new Error(
      `Fuse sentinel not found in ${binaryPath}. Is this an Electron binary?`,
    );
  }
  const headerStart = sentIdx + SENTINEL.length;
  const schemaVersion = buf[headerStart];
  const count = buf[headerStart + 1];
  const fuseStart = headerStart + 2;

  if (schemaVersion !== 1) {
    throw new Error(`Unsupported fuse schema version: ${schemaVersion}`);
  }
  if (count < 1 || count > 32) {
    throw new Error(`Implausible fuse count: ${count}`);
  }

  const fuses: FuseValue[] = [];
  for (let i = 0; i < count; i++) {
    const b = buf[fuseStart + i];
    const v = BYTE_TO_VAL[b];
    if (!v) throw new Error(`Unknown fuse byte 0x${b.toString(16)} at index ${i}`);
    fuses.push(v);
  }
  return { schemaVersion, count, fuses, offset: fuseStart };
}

export function writeFuse(
  binaryPath: string,
  fuse: FuseName,
  value: FuseValue,
): { from: FuseValue; to: FuseValue } {
  const idx = FuseV1[fuse];
  const snap = readFuses(binaryPath);
  if (idx >= snap.count) {
    throw new Error(
      `Fuse "${fuse}" (index ${idx}) is beyond this binary's fuse count (${snap.count}).`,
    );
  }
  const from = snap.fuses[idx];
  if (from === value) return { from, to: value };

  // Edit the file in place. We read+write the whole thing because Electron
  // Framework is ~150MB and the fuse byte may be in a code-signed region —
  // either way we'll re-sign afterwards.
  const buf = readFileSync(binaryPath);
  buf[snap.offset + idx] = VAL_TO_BYTE[value];
  // Preserve mode (executable bit).
  const mode = statSync(binaryPath).mode;
  writeFileSync(binaryPath, buf);
  if (mode) {
    // node fs.writeFileSync doesn't preserve mode; fix it.
    chmodSync(binaryPath, mode);
  }
  return { from, to: value };
}
