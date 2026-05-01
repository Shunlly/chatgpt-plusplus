"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_LOG_BYTES = void 0;
exports.appendCappedLog = appendCappedLog;
const node_fs_1 = require("node:fs");
exports.MAX_LOG_BYTES = 10 * 1024 * 1024;
function appendCappedLog(path, line, maxBytes = exports.MAX_LOG_BYTES) {
    const incoming = Buffer.from(line);
    if (incoming.byteLength >= maxBytes) {
        (0, node_fs_1.writeFileSync)(path, incoming.subarray(incoming.byteLength - maxBytes));
        return;
    }
    try {
        if ((0, node_fs_1.existsSync)(path)) {
            const size = (0, node_fs_1.statSync)(path).size;
            const allowedExisting = maxBytes - incoming.byteLength;
            if (size > allowedExisting) {
                const existing = (0, node_fs_1.readFileSync)(path);
                (0, node_fs_1.writeFileSync)(path, existing.subarray(Math.max(0, existing.byteLength - allowedExisting)));
            }
        }
    }
    catch {
        // If trimming fails, still try to append below; logging must be best-effort.
    }
    (0, node_fs_1.appendFileSync)(path, incoming);
}
//# sourceMappingURL=logging.js.map