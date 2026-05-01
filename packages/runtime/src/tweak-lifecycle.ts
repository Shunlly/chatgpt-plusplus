export type TweakScope = "renderer" | "main" | "both";

export interface ReloadTweaksDeps {
  logInfo(message: string): void;
  stopAllMainTweaks(): void;
  clearTweakModuleCache(): void;
  loadAllMainTweaks(): void;
  broadcastReload(): void;
}

export interface SetTweakEnabledAndReloadDeps extends ReloadTweaksDeps {
  setTweakEnabled(id: string, enabled: boolean): void;
}

export function isMainProcessTweakScope(scope: TweakScope | undefined): boolean {
  return scope !== "renderer";
}

export function reloadTweaks(reason: string, deps: ReloadTweaksDeps): void {
  deps.logInfo(`reloading tweaks (${reason})`);
  deps.stopAllMainTweaks();
  deps.clearTweakModuleCache();
  deps.loadAllMainTweaks();
  deps.broadcastReload();
}

export function setTweakEnabledAndReload(
  id: string,
  enabled: unknown,
  deps: SetTweakEnabledAndReloadDeps,
): true {
  const normalizedEnabled = !!enabled;
  deps.setTweakEnabled(id, normalizedEnabled);
  deps.logInfo(`tweak ${id} enabled=${normalizedEnabled}`);
  reloadTweaks("enabled-toggle", deps);
  return true;
}
