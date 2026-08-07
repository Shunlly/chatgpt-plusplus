"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installReactHook = installReactHook;
exports.fiberForNode = fiberForNode;
function installReactHook() {
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__)
        return;
    const renderers = new Map();
    let nextId = 1;
    const listeners = new Map();
    const hook = {
        supportsFiber: true,
        renderers,
        inject(renderer) {
            const id = nextId++;
            renderers.set(id, renderer);
            // eslint-disable-next-line no-console
            console.debug("[chatgpt-plusplus] React renderer attached:", renderer.rendererPackageName, renderer.version);
            return id;
        },
        on(event, fn) {
            let s = listeners.get(event);
            if (!s)
                listeners.set(event, (s = new Set()));
            s.add(fn);
        },
        off(event, fn) {
            listeners.get(event)?.delete(fn);
        },
        emit(event, ...args) {
            listeners.get(event)?.forEach((fn) => fn(...args));
        },
        onCommitFiberRoot() { },
        onCommitFiberUnmount() { },
        onScheduleFiberRoot() { },
        checkDCE() { },
    };
    Object.defineProperty(window, "__REACT_DEVTOOLS_GLOBAL_HOOK__", {
        configurable: true,
        enumerable: false,
        writable: true, // allow real DevTools to overwrite if user installs it
        value: hook,
    });
    window.__codexpp__ = { hook, renderers };
}
/** Resolve the React fiber for a DOM node, if any renderer has one. */
function fiberForNode(node) {
    const renderers = window.__codexpp__?.renderers;
    if (renderers) {
        for (const r of renderers.values()) {
            const f = r.findFiberByHostInstance?.(node);
            if (f)
                return f;
        }
    }
    // Fallback: read the React internal property directly from the DOM node.
    // React stores fibers as a property whose key starts with "__reactFiber".
    for (const k of Object.keys(node)) {
        if (k.startsWith("__reactFiber"))
            return node[k];
    }
    return null;
}
//# sourceMappingURL=react-hook.js.map