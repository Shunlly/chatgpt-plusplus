/**
 * Disk-backed key/value storage for main-process tweaks.
 *
 * Each tweak gets one JSON file under `<userRoot>/storage/<id>.json`.
 * Writes are debounced (50 ms) and atomic (write to <file>.tmp then rename).
 * Reads are eager + cached in-memory; we load on first access.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

export interface DiskStorage {
  get<T>(key: string, defaultValue?: T): T;
  set(key: string, value: unknown): void;
  delete(key: string): void;
  all(): Record<string, unknown>;
  flush(): void;
}

const FLUSH_DELAY_MS = 50;

export function createDiskStorage(rootDir: string, id: string): DiskStorage {
  const dir = join(rootDir, "storage");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${sanitize(id)}.json`);

  let data: Record<string, unknown> = {};
  if (existsSync(file)) {
    try {
      data = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    } catch {
      // Corrupt file — start fresh, but don't clobber the original until we
      // successfully write again. (Move it aside for forensics.)
      try {
        renameSync(file, `${file}.corrupt-${Date.now()}`);
      } catch {}
      data = {};
    }
  }

  let dirty = false;
  let timer: NodeJS.Timeout | null = null;

  const scheduleFlush = () => {
    dirty = true;
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      if (dirty) flush();
    }, FLUSH_DELAY_MS);
  };

  const flush = (): void => {
    if (!dirty) return;
    const tmp = `${file}.tmp`;
    try {
      writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
      renameSync(tmp, file);
      dirty = false;
    } catch (e) {
      // Leave dirty=true so a future flush retries.
      console.error("[chatgpt-plusplus] storage flush failed:", id, e);
    }
  };

  return {
    get: <T>(k: string, d?: T): T =>
      Object.prototype.hasOwnProperty.call(data, k) ? (data[k] as T) : (d as T),
    set(k, v) {
      data[k] = v;
      scheduleFlush();
    },
    delete(k) {
      if (k in data) {
        delete data[k];
        scheduleFlush();
      }
    },
    all: () => ({ ...data }),
    flush,
  };
}

function sanitize(id: string): string {
  // Tweak ids are author-controlled; clamp to a safe filename.
  return id.replace(/[^a-zA-Z0-9._@-]/g, "_");
}
