/**
 * Install a minimal __REACT_DEVTOOLS_GLOBAL_HOOK__. React calls
 * `hook.inject(rendererInternals)` during `createRoot`/`hydrateRoot`. The
 * "internals" object exposes findFiberByHostInstance, which lets us turn a
 * DOM node into a React fiber — necessary for our Settings injector.
 *
 * We don't want to break real React DevTools if the user opens it; we install
 * only if no hook exists yet, and we forward calls to a downstream hook if
 * one is later assigned.
 */
declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: ReactDevtoolsHook;
    __codexpp__?: {
      hook: ReactDevtoolsHook;
      renderers: Map<number, RendererInternals>;
    };
  }
}

interface RendererInternals {
  findFiberByHostInstance?: (n: Node) => unknown;
  version?: string;
  bundleType?: number;
  rendererPackageName?: string;
}

interface ReactDevtoolsHook {
  supportsFiber: true;
  renderers: Map<number, RendererInternals>;
  on(event: string, fn: (...a: unknown[]) => void): void;
  off(event: string, fn: (...a: unknown[]) => void): void;
  emit(event: string, ...a: unknown[]): void;
  inject(renderer: RendererInternals): number;
  onScheduleFiberRoot?(): void;
  onCommitFiberRoot?(): void;
  onCommitFiberUnmount?(): void;
  checkDCE?(): void;
}

export function installReactHook(): void {
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) return;
  const renderers = new Map<number, RendererInternals>();
  let nextId = 1;
  const listeners = new Map<string, Set<(...a: unknown[]) => void>>();

  const hook: ReactDevtoolsHook = {
    supportsFiber: true,
    renderers,
    inject(renderer) {
      const id = nextId++;
      renderers.set(id, renderer);
      // eslint-disable-next-line no-console
      console.debug(
        "[chatgpt-plusplus] React renderer attached:",
        renderer.rendererPackageName,
        renderer.version,
      );
      return id;
    },
    on(event, fn) {
      let s = listeners.get(event);
      if (!s) listeners.set(event, (s = new Set()));
      s.add(fn);
    },
    off(event, fn) {
      listeners.get(event)?.delete(fn);
    },
    emit(event, ...args) {
      listeners.get(event)?.forEach((fn) => fn(...args));
    },
    onCommitFiberRoot() {},
    onCommitFiberUnmount() {},
    onScheduleFiberRoot() {},
    checkDCE() {},
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
export function fiberForNode(node: Node): unknown | null {
  const renderers = window.__codexpp__?.renderers;
  if (renderers) {
    for (const r of renderers.values()) {
      const f = r.findFiberByHostInstance?.(node);
      if (f) return f;
    }
  }
  // Fallback: read the React internal property directly from the DOM node.
  // React stores fibers as a property whose key starts with "__reactFiber".
  for (const k of Object.keys(node)) {
    if (k.startsWith("__reactFiber")) return (node as unknown as Record<string, unknown>)[k];
  }
  return null;
}
