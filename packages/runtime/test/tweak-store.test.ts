import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTweakPublishIssueUrl,
  normalizeGitHubRepo,
  normalizeStoreRegistry,
  storeArchiveUrl,
} from "../src/tweak-store";

test("normalizeGitHubRepo accepts common GitHub repo forms", () => {
  assert.equal(normalizeGitHubRepo("b-nnett/codex-plusplus"), "b-nnett/codex-plusplus");
  assert.equal(
    normalizeGitHubRepo("https://github.com/b-nnett/codex-plusplus.git"),
    "b-nnett/codex-plusplus",
  );
  assert.equal(
    normalizeGitHubRepo("git@github.com:b-nnett/codex-plusplus.git"),
    "b-nnett/codex-plusplus",
  );
});

test("normalizeStoreRegistry requires approved full commit shas and sorts by name", () => {
  const registry = normalizeStoreRegistry({
    schemaVersion: 1,
    entries: [
      storeEntry("co.example.low", "Low"),
      storeEntry("co.example.high", "High"),
    ],
  });

  assert.deepEqual(registry.entries.map((entry) => entry.id), ["co.example.high", "co.example.low"]);
  assert.throws(
    () =>
      normalizeStoreRegistry({
        schemaVersion: 1,
        entries: [{ ...storeEntry("co.example.bad", "Bad"), approvedCommitSha: "main" }],
      }),
    /full approved commit SHA/,
  );
});

test("storeArchiveUrl installs from the approved commit archive", () => {
  const entry = storeEntry("co.example.good", "Good");
  assert.equal(
    storeArchiveUrl(entry),
    `https://codeload.github.com/example/good/tar.gz/${entry.approvedCommitSha}`,
  );
});

test("publish issue URL pins the commit admins must review", () => {
  const url = new URL(buildTweakPublishIssueUrl({
    repo: "example/good",
    defaultBranch: "main",
    commitSha: "1234567890abcdef1234567890abcdef12345678",
    commitUrl: "https://github.com/example/good/commit/1234567890abcdef1234567890abcdef12345678",
    manifest: {
      id: "co.example.good",
      name: "Good",
      version: "1.0.0",
      description: "A useful tweak.",
    },
  }));
  assert.equal(url.origin + url.pathname, "https://github.com/b-nnett/codex-plusplus/issues/new");
  assert.equal(url.searchParams.get("title"), "Tweak store review: example/good");
  assert.match(url.searchParams.get("body") ?? "", /1234567890abcdef1234567890abcdef12345678/);
  assert.match(url.searchParams.get("body") ?? "", /Do not approve a different commit/);
  assert.match(url.searchParams.get("body") ?? "", /\.codexpp-store\/screenshots/);
});

function storeEntry(id: string, name: string) {
  const repo = `example/${name.toLowerCase()}`;
  return {
    id,
    repo,
    approvedCommitSha: "1234567890abcdef1234567890abcdef12345678",
    approvedAt: "2026-05-02T00:00:00.000Z",
    approvedBy: "bennett",
    screenshots: [],
    manifest: {
      id,
      name,
      version: "1.0.0",
      githubRepo: repo,
    },
  };
}
