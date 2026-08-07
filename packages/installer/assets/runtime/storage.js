"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDiskStorage = createDiskStorage;
/**
 * Disk-backed key/value storage for main-process tweaks.
 *
 * Each tweak gets one JSON file under `<userRoot>/storage/<id>.json`.
 * Writes are debounced (50 ms) and atomic (write to <file>.tmp then rename).
 * Reads are eager + cached in-memory; we load on first access.
 */
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const FLUSH_DELAY_MS = 50;
function createDiskStorage(rootDir, id) {
    const dir = (0, node_path_1.join)(rootDir, "storage");
    (0, node_fs_1.mkdirSync)(dir, { recursive: true });
    const file = (0, node_path_1.join)(dir, `${sanitize(id)}.json`);
    let data = {};
    if ((0, node_fs_1.existsSync)(file)) {
        try {
            data = JSON.parse((0, node_fs_1.readFileSync)(file, "utf8"));
        }
        catch {
            // Corrupt file — start fresh, but don't clobber the original until we
            // successfully write again. (Move it aside for forensics.)
            try {
                (0, node_fs_1.renameSync)(file, `${file}.corrupt-${Date.now()}`);
            }
            catch { }
            data = {};
        }
    }
    let dirty = false;
    let timer = null;
    const scheduleFlush = () => {
        dirty = true;
        if (timer)
            return;
        timer = setTimeout(() => {
            timer = null;
            if (dirty)
                flush();
        }, FLUSH_DELAY_MS);
    };
    const flush = () => {
        if (!dirty)
            return;
        const tmp = `${file}.tmp`;
        try {
            (0, node_fs_1.writeFileSync)(tmp, JSON.stringify(data, null, 2), "utf8");
            (0, node_fs_1.renameSync)(tmp, file);
            dirty = false;
        }
        catch (e) {
            // Leave dirty=true so a future flush retries.
            console.error("[chatgpt-plusplus] storage flush failed:", id, e);
        }
    };
    return {
        get: (k, d) => Object.prototype.hasOwnProperty.call(data, k) ? data[k] : d,
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
function sanitize(id) {
    // Tweak ids are author-controlled; clamp to a safe filename.
    return id.replace(/[^a-zA-Z0-9._@-]/g, "_");
}
//# sourceMappingURL=storage.js.map