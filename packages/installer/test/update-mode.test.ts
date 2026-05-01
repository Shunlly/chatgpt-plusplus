import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  describeUpdateMode,
  isUpdateModeFresh,
  readUpdateMode,
  UPDATE_MODE_MAX_AGE_MS,
  writeUpdateMode,
} from "../src/update-mode";

test("update mode is fresh until the updater grace window expires", () => {
  const now = Date.parse("2026-05-01T12:00:00.000Z");
  assert.equal(
    isUpdateModeFresh(
      {
        enabledAt: new Date(now - UPDATE_MODE_MAX_AGE_MS + 1_000).toISOString(),
        appRoot: "/Applications/Codex.app",
        codexVersion: "26.422.62136",
      },
      now,
    ),
    true,
  );
  assert.equal(
    isUpdateModeFresh(
      {
        enabledAt: new Date(now - UPDATE_MODE_MAX_AGE_MS).toISOString(),
        appRoot: "/Applications/Codex.app",
        codexVersion: "26.422.62136",
      },
      now,
    ),
    false,
  );
});

test("update mode survives notification metadata and reports stale status", () => {
  const root = mkdtempSync(join(tmpdir(), "codexpp-update-mode-"));
  try {
    const file = join(root, "update-mode.json");
    writeUpdateMode(file, {
      enabledAt: "2026-05-01T00:00:00.000Z",
      appRoot: "/Applications/Codex.app",
      codexVersion: "26.422.62136",
      notifiedAt: "2026-05-01T00:01:00.000Z",
    });
    const mode = readUpdateMode(file);
    assert.equal(mode?.notifiedAt, "2026-05-01T00:01:00.000Z");
    assert.match(
      describeUpdateMode(mode!, Date.parse("2026-05-01T07:00:00.000Z")),
      /26\.422\.62136, 7h 0m old stale/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
