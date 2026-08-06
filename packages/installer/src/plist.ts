/**
 * Plist read/write. We use the `plist` package (XML plist) for the
 * common case (Electron writes Info.plist as XML). If we ever encounter a
 * binary plist we shell out to `plutil -convert xml1` on macOS.
 */
import { readFileSync, writeFileSync } from "node:fs";
import plist from "plist";
import { execFileSync } from "node:child_process";
import { platform } from "node:os";

export type Plist = Record<string, unknown>;

export function readPlist(path: string): Plist {
  let raw = readFileSync(path);
  // bplist00 magic. Convert to stdout only, never in place, so scanning
  // unrelated .app bundles cannot mutate their Info.plist (which would
  // invalidate the app's code signature).
  if (raw[0] === 0x62 && raw[1] === 0x70 && raw[2] === 0x6c) {
    if (platform() !== "darwin") {
      throw new Error(`Binary plist at ${path}; need macOS plutil to convert.`);
    }
    raw = execFileSync("plutil", ["-convert", "xml1", "-o", "-", path]);
  }
  return plist.parse(raw.toString("utf8")) as Plist;
}

export function writePlist(path: string, value: Plist): void {
  const xml = plist.build(value as plist.PlistValue);
  writeFileSync(path, xml, "utf8");
}
