import type { TweakMcpServer } from "@codex-plusplus/sdk";
export declare const MCP_MANAGED_START = "# BEGIN CODEX++ MANAGED MCP SERVERS";
export declare const MCP_MANAGED_END = "# END CODEX++ MANAGED MCP SERVERS";
export interface McpSyncTweak {
    dir: string;
    manifest: {
        id: string;
        mcp?: TweakMcpServer;
    };
}
export interface BuiltManagedMcpBlock {
    block: string;
    serverNames: string[];
    skippedServerNames: string[];
}
export interface ManagedMcpSyncResult extends BuiltManagedMcpBlock {
    changed: boolean;
}
export declare function syncManagedMcpServers({ configPath, tweaks, }: {
    configPath: string;
    tweaks: McpSyncTweak[];
}): ManagedMcpSyncResult;
export declare function buildManagedMcpBlock(tweaks: McpSyncTweak[], existingToml?: string): BuiltManagedMcpBlock;
export declare function mergeManagedMcpBlock(currentToml: string, managedBlock: string): string;
export declare function stripManagedMcpBlock(toml: string): string;
export declare function mcpServerNameFromTweakId(id: string): string;
