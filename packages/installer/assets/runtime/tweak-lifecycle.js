"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMainProcessTweakScope = isMainProcessTweakScope;
exports.reloadTweaks = reloadTweaks;
exports.setTweakEnabledAndReload = setTweakEnabledAndReload;
function isMainProcessTweakScope(scope) {
    return scope !== "renderer";
}
function reloadTweaks(reason, deps) {
    deps.logInfo(`reloading tweaks (${reason})`);
    deps.stopAllMainTweaks();
    deps.clearTweakModuleCache();
    deps.loadAllMainTweaks();
    deps.broadcastReload();
}
function setTweakEnabledAndReload(id, enabled, deps) {
    const normalizedEnabled = !!enabled;
    deps.setTweakEnabled(id, normalizedEnabled);
    deps.logInfo(`tweak ${id} enabled=${normalizedEnabled}`);
    reloadTweaks("enabled-toggle", deps);
    return true;
}
//# sourceMappingURL=tweak-lifecycle.js.map