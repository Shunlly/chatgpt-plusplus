import type { TweakMcpServer } from "@chatgpt-plusplus/sdk";
export declare const MCP_MANAGED_START = "# BEGIN CHATGPT++ MANAGED MCP SERVERS";
export declare const MCP_MANAGED_END = "# END CHATGPT++ MANAGED MCP SERVERS";
/** 旧版标记（v1.0.5 之前），同步时一并清理，避免旧块残留在 Codex 配置里。 */
export declare const LEGACY_MCP_MANAGED_START = "# BEGIN CODEX++ MANAGED MCP SERVERS";
export declare const LEGACY_MCP_MANAGED_END = "# END CODEX++ MANAGED MCP SERVERS";
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
