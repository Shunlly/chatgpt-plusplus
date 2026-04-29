import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

export interface UpdateMode {
  enabledAt: string;
  appRoot: string;
  codexVersion: string | null;
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
