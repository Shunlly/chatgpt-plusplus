import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

export const UPDATE_MODE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export interface UpdateMode {
  enabledAt: string;
  appRoot: string;
  codexVersion: string | null;
  notifiedAt?: string;
  patchingNotifiedAt?: string;
}

export function readUpdateMode(path: string): UpdateMode | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as UpdateMode;
  } catch {
    return null;
  }
}

export function writeUpdateMode(path: string, mode: UpdateMode): void {
  writeFileSync(path, JSON.stringify(mode, null, 2));
}

export function clearUpdateMode(path: string): void {
  rmSync(path, { force: true });
}

export function isUpdateModeFresh(mode: UpdateMode, now = Date.now()): boolean {
  const enabledAt = Date.parse(mode.enabledAt);
  if (!Number.isFinite(enabledAt)) return false;
  return now - enabledAt < UPDATE_MODE_MAX_AGE_MS;
}

export function describeUpdateMode(mode: UpdateMode, now = Date.now()): string {
  const ageMs = Math.max(0, now - (Date.parse(mode.enabledAt) || now));
  const ageMinutes = Math.floor(ageMs / 60_000);
  const age =
    ageMinutes < 60
      ? `${ageMinutes}m`
      : `${Math.floor(ageMinutes / 60)}h ${ageMinutes % 60}m`;
  const version = mode.codexVersion ?? "unknown Codex version";
  const stale = isUpdateModeFresh(mode, now) ? "" : " stale";
  return `paused for official Codex updater (${version}, ${age} old${stale})`;
}
