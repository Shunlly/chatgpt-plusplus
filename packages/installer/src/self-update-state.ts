import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { InstallationSource } from "./source-root.js";

export type SelfUpdateChannel = "stable" | "prerelease" | "custom";
export type SelfUpdateStatus = "checking" | "up-to-date" | "updated" | "failed" | "disabled";

export interface SelfUpdateState {
  checkedAt: string;
  completedAt?: string;
  status: SelfUpdateStatus;
  currentVersion: string;
  latestVersion: string | null;
  targetRef: string | null;
  releaseUrl: string | null;
  repo: string;
  channel: SelfUpdateChannel;
  sourceRoot: string;
  installationSource?: InstallationSource;
  error?: string;
}

export function readSelfUpdateState(path: string): SelfUpdateState | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as SelfUpdateState;
  } catch {
    return null;
  }
}

export function writeSelfUpdateState(path: string, state: SelfUpdateState): void {
  writeFileSync(path, JSON.stringify(state, null, 2));
}
