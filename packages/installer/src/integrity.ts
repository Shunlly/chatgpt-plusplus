/**
 * Read/write the ElectronAsarIntegrity entry inside Info.plist (macOS).
 * Windows Owl/Electron 把哈希写进主程序 PE（ChatGPT.exe），见 replaceWindowsEmbeddedAsarHash。
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { readPlist, writePlist } from "./plist.js";
import type { CodexInstall } from "./platform.js";

export interface IntegrityEntry {
  algorithm: "SHA256";
  hash: string;
}

export function getIntegrity(install: CodexInstall): IntegrityEntry | null {
  if (install.platform !== "darwin" || !install.metaPath) return null;
  const pl = readPlist(install.metaPath);
  const block = pl["ElectronAsarIntegrity"] as Record<string, IntegrityEntry> | undefined;
  if (!block) return null;
  return block["Resources/app.asar"] ?? null;
}

export function setIntegrity(install: CodexInstall, hash: string): void {
  if (install.platform !== "darwin" || !install.metaPath) return;
  const pl = readPlist(install.metaPath);
  const existing = (pl["ElectronAsarIntegrity"] as Record<string, IntegrityEntry>) ?? {};
  existing["Resources/app.asar"] = { algorithm: "SHA256", hash };
  pl["ElectronAsarIntegrity"] = existing;
  writePlist(install.metaPath, pl);
}

const SHA256_HEX = /^[0-9a-f]{64}$/i;

/**
 * Windows Owl 把 app.asar 的 SHA256 嵌进 ChatGPT.exe。
 * 打补丁后若不替换，启动会 FATAL: Integrity check failed for asar archive。
 */
export function replaceWindowsEmbeddedAsarHash(exePath: string, oldHash: string, newHash: string): number {
  if (!existsSync(exePath)) return 0;
  if (!SHA256_HEX.test(oldHash) || !SHA256_HEX.test(newHash)) {
    throw new Error(`asar integrity hash must be 64 hex chars, got old=${oldHash} new=${newHash}`);
  }
  if (oldHash.toLowerCase() === newHash.toLowerCase()) return 0;
  const buf = readFileSync(exePath);
  const oldBuf = Buffer.from(oldHash, "ascii");
  const newBuf = Buffer.from(newHash, "ascii");
  let count = 0;
  let idx = 0;
  while ((idx = buf.indexOf(oldBuf, idx)) !== -1) {
    newBuf.copy(buf, idx);
    count += 1;
    idx += newBuf.length;
  }
  if (count > 0) writeFileSync(exePath, buf);
  return count;
}
