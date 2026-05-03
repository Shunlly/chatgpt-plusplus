"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TWEAK_STORE_REVIEW_ISSUE_URL = exports.DEFAULT_TWEAK_STORE_INDEX_URL = void 0;
exports.normalizeGitHubRepo = normalizeGitHubRepo;
exports.normalizeStoreRegistry = normalizeStoreRegistry;
exports.normalizeStoreEntry = normalizeStoreEntry;
exports.storeArchiveUrl = storeArchiveUrl;
exports.buildTweakPublishIssueUrl = buildTweakPublishIssueUrl;
exports.isFullCommitSha = isFullCommitSha;
exports.DEFAULT_TWEAK_STORE_INDEX_URL = "https://b-nnett.github.io/codex-plusplus/store/index.json";
exports.TWEAK_STORE_REVIEW_ISSUE_URL = "https://github.com/b-nnett/codex-plusplus/issues/new";
const GITHUB_REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const FULL_SHA_RE = /^[a-f0-9]{40}$/i;
function normalizeGitHubRepo(input) {
    const raw = input.trim();
    if (!raw)
        throw new Error("GitHub repo is required");
    const ssh = /^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/i.exec(raw);
    if (ssh)
        return normalizeRepoPart(ssh[1]);
    if (/^https?:\/\//i.test(raw)) {
        const url = new URL(raw);
        if (url.hostname !== "github.com")
            throw new Error("Only github.com repositories are supported");
        const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
        if (parts.length < 2)
            throw new Error("GitHub repo URL must include owner and repository");
        return normalizeRepoPart(`${parts[0]}/${parts[1]}`);
    }
    return normalizeRepoPart(raw);
}
function normalizeStoreRegistry(input) {
    const registry = input;
    if (!registry || registry.schemaVersion !== 1 || !Array.isArray(registry.entries)) {
        throw new Error("Unsupported tweak store registry");
    }
    const entries = registry.entries.map(normalizeStoreEntry);
    entries.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
    return {
        schemaVersion: 1,
        generatedAt: typeof registry.generatedAt === "string" ? registry.generatedAt : undefined,
        entries,
    };
}
function normalizeStoreEntry(input) {
    const entry = input;
    if (!entry || typeof entry !== "object")
        throw new Error("Invalid tweak store entry");
    const repo = normalizeGitHubRepo(String(entry.repo ?? entry.manifest?.githubRepo ?? ""));
    const manifest = entry.manifest;
    if (!manifest?.id || !manifest.name || !manifest.version) {
        throw new Error(`Store entry for ${repo} is missing manifest fields`);
    }
    if (normalizeGitHubRepo(manifest.githubRepo) !== repo) {
        throw new Error(`Store entry ${manifest.id} repo does not match manifest githubRepo`);
    }
    if (!isFullCommitSha(String(entry.approvedCommitSha ?? ""))) {
        throw new Error(`Store entry ${manifest.id} must pin a full approved commit SHA`);
    }
    const screenshots = Array.isArray(entry.screenshots)
        ? entry.screenshots.map(normalizeStoreScreenshot)
        : [];
    return {
        id: manifest.id,
        manifest,
        repo,
        approvedCommitSha: String(entry.approvedCommitSha),
        approvedAt: typeof entry.approvedAt === "string" ? entry.approvedAt : "",
        approvedBy: typeof entry.approvedBy === "string" ? entry.approvedBy : "",
        screenshots,
        platforms: normalizeStorePlatforms(entry.platforms),
        releaseUrl: optionalGithubUrl(entry.releaseUrl),
        reviewUrl: optionalGithubUrl(entry.reviewUrl),
    };
}
function storeArchiveUrl(entry) {
    if (!isFullCommitSha(entry.approvedCommitSha)) {
        throw new Error(`Store entry ${entry.id} is not pinned to a full commit SHA`);
    }
    return `https://codeload.github.com/${entry.repo}/tar.gz/${entry.approvedCommitSha}`;
}
function buildTweakPublishIssueUrl(submission) {
    const repo = normalizeGitHubRepo(submission.repo);
    if (!isFullCommitSha(submission.commitSha)) {
        throw new Error("Submission must include the full commit SHA to review");
    }
    const title = `Tweak store review: ${repo}`;
    const body = [
        "## Tweak repo",
        `https://github.com/${repo}`,
        "",
        "## Commit to review",
        submission.commitSha,
        submission.commitUrl,
        "",
        "Do not approve a different commit. If the author pushes changes, ask them to resubmit.",
        "",
        "## Manifest",
        `- id: ${submission.manifest?.id ?? "(not detected)"}`,
        `- name: ${submission.manifest?.name ?? "(not detected)"}`,
        `- version: ${submission.manifest?.version ?? "(not detected)"}`,
        `- description: ${submission.manifest?.description ?? "(not detected)"}`,
        "",
        "## Screenshots",
        "Screenshots must be committed in the repo at the reviewed commit.",
        "Expected location: `.codexpp-store/screenshots/`",
        "Required: 1-3 images, each exactly 1920x1080.",
        "",
        "## Admin checklist",
        "- [ ] manifest.json is valid",
        "- [ ] screenshots exist at the reviewed commit and are exactly 1920x1080",
        "- [ ] source was reviewed at the exact commit above",
        "- [ ] `store/index.json` entry pins `approvedCommitSha` to the exact commit above",
        "- [ ] screenshot URLs in `store/index.json` point at immutable raw URLs for the exact commit above",
    ].join("\n");
    const url = new URL(exports.TWEAK_STORE_REVIEW_ISSUE_URL);
    url.searchParams.set("template", "tweak-store-review.md");
    url.searchParams.set("title", title);
    url.searchParams.set("body", body);
    return url.toString();
}
function isFullCommitSha(value) {
    return FULL_SHA_RE.test(value);
}
function normalizeRepoPart(value) {
    const repo = value.trim().replace(/\.git$/i, "").replace(/^\/+|\/+$/g, "");
    if (!GITHUB_REPO_RE.test(repo))
        throw new Error("GitHub repo must be in owner/repo form");
    return repo;
}
function normalizeStoreScreenshot(input) {
    const shot = input;
    if (!shot || shot.width !== 1920 || shot.height !== 1080 || typeof shot.url !== "string") {
        throw new Error("Store screenshots must be exactly 1920x1080");
    }
    return {
        url: shot.url,
        width: 1920,
        height: 1080,
        alt: typeof shot.alt === "string" ? shot.alt : undefined,
    };
}
function normalizeStorePlatforms(input) {
    if (input === undefined)
        return undefined;
    if (!Array.isArray(input))
        throw new Error("Store entry platforms must be an array");
    const allowed = new Set(["darwin", "win32", "linux"]);
    const platforms = Array.from(new Set(input.map((value) => {
        if (typeof value !== "string" || !allowed.has(value)) {
            throw new Error(`Unsupported store platform: ${String(value)}`);
        }
        return value;
    })));
    return platforms.length > 0 ? platforms : undefined;
}
function optionalGithubUrl(value) {
    if (typeof value !== "string" || !value.trim())
        return undefined;
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "github.com")
        return undefined;
    return url.toString();
}
//# sourceMappingURL=tweak-store.js.map