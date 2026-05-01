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
export declare function isMainProcessTweakScope(scope: TweakScope | undefined): boolean;
export declare function reloadTweaks(reason: string, deps: ReloadTweaksDeps): void;
export declare function setTweakEnabledAndReload(id: string, enabled: unknown, deps: SetTweakEnabledAndReloadDeps): true;
