import type { TweakManifest } from "@codex-plusplus/sdk";
export declare const DEFAULT_TWEAK_STORE_INDEX_URL = "https://b-nnett.github.io/codex-plusplus/store/index.json";
export declare const TWEAK_STORE_REVIEW_ISSUE_URL = "https://github.com/b-nnett/codex-plusplus/issues/new";
export interface TweakStoreRegistry {
    schemaVersion: 1;
    generatedAt?: string;
    entries: TweakStoreEntry[];
}
export interface TweakStoreEntry {
    id: string;
    manifest: TweakManifest;
    repo: string;
    approvedCommitSha: string;
    approvedAt: string;
    approvedBy: string;
    screenshots: TweakStoreScreenshot[];
    platforms?: TweakStorePlatform[];
    releaseUrl?: string;
    reviewUrl?: string;
}
export type TweakStorePlatform = "darwin" | "win32" | "linux";
export interface TweakStoreScreenshot {
    url: string;
    width: 1920;
    height: 1080;
    alt?: string;
}
export interface TweakStorePublishSubmission {
    repo: string;
    defaultBranch: string;
    commitSha: string;
    commitUrl: string;
    manifest?: {
        id?: string;
        name?: string;
        version?: string;
        description?: string;
    };
}
export declare function normalizeGitHubRepo(input: string): string;
export declare function normalizeStoreRegistry(input: unknown): TweakStoreRegistry;
export declare function normalizeStoreEntry(input: unknown): TweakStoreEntry;
export declare function storeArchiveUrl(entry: TweakStoreEntry): string;
export declare function buildTweakPublishIssueUrl(submission: TweakStorePublishSubmission): string;
export declare function isFullCommitSha(value: string): boolean;
