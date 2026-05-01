import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const runtimeSource = readFileSync(resolve(repoRoot, "packages/runtime/src/main.ts"), "utf8");
const lifecycleSource = readFileSync(
  resolve(repoRoot, "packages/runtime/src/tweak-lifecycle.ts"),
  "utf8",
);
const bundledRuntime = readFileSync(
  resolve(repoRoot, "packages/installer/assets/runtime/main.js"),
  "utf8",
);

const fullReloadSequence = [
  "stopAllMainTweaks",
  "clearTweakModuleCache",
  "loadAllMainTweaks",
  "broadcastReload",
];

test("source toggle handler delegates enable changes to lifecycle helper", () => {
  const body = extractHandlerBody(runtimeSource, "codexpp:set-tweak-enabled");

  assert.match(body, /return setTweakEnabledAndReload\(id,\s*enabled,\s*tweakLifecycleDeps\)/);
});

test("bundled toggle handler delegates enable changes to lifecycle helper", () => {
  const body = extractHandlerBody(bundledRuntime, "codexpp:set-tweak-enabled");

  assert.match(body, /return setTweakEnabledAndReload\(id,\s*enabled,\s*tweakLifecycleDeps\)/);
});

test("source lifecycle helper normalizes enabled value before persisting", () => {
  const body = extractFunctionBody(lifecycleSource, "setTweakEnabledAndReload");

  assert.match(body, /const normalizedEnabled = !!enabled/);
  assert.match(body, /setTweakEnabled\(id,\s*normalizedEnabled\)/);
  assert.match(body, /enabled=\$\{normalizedEnabled\}/);
});

test("bundled lifecycle helper normalizes enabled value before persisting", () => {
  const body = extractFunctionBody(bundledRuntime, "setTweakEnabledAndReload");

  assert.match(body, /const normalizedEnabled = !!enabled/);
  assert.match(body, /setTweakEnabled\(id,\s*normalizedEnabled\)/);
  assert.match(body, /enabled=\$\{normalizedEnabled\}/);
});

test("source lifecycle helper returns only after reloading", () => {
  const body = extractFunctionBody(lifecycleSource, "setTweakEnabledAndReload");

  assertCallOrder(body, ["reloadTweaks", "return true"]);
});

test("bundled lifecycle helper returns only after reloading", () => {
  const body = extractFunctionBody(bundledRuntime, "setTweakEnabledAndReload");

  assertCallOrder(body, ["reloadTweaks", "return true"]);
});

test("source manual force reload delegates to lifecycle helper", () => {
  const body = extractHandlerBody(runtimeSource, "codexpp:reload-tweaks");

  assertCallOrder(body, ["reloadTweaks", "return "]);
});

test("bundled manual force reload delegates to lifecycle helper", () => {
  const body = extractHandlerBody(bundledRuntime, "codexpp:reload-tweaks");

  assertCallOrder(body, ["reloadTweaks", "return "]);
});

test("source lifecycle reload helper uses the full main reload sequence", () => {
  const body = extractFunctionBody(lifecycleSource, "reloadTweaks");

  assertCallOrder(body, fullReloadSequence);
});

test("bundled lifecycle reload helper uses the full main reload sequence", () => {
  const body = extractFunctionBody(bundledRuntime, "reloadTweaks");

  assertCallOrder(body, fullReloadSequence);
});

test("source filesystem watcher reload delegates to lifecycle helper", () => {
  const body = extractFunctionBody(runtimeSource, "scheduleReload");

  assertCallOrder(body, ["reloadTweaks"]);
});

test("bundled filesystem watcher reload delegates to lifecycle helper", () => {
  const body = extractFunctionBody(bundledRuntime, "scheduleReload");

  assertCallOrder(body, ["reloadTweaks"]);
});

function extractHandlerBody(source: string, channel: string): string {
  const marker = `"${channel}"`;
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `missing IPC handler marker: ${channel}`);

  const arrowIndex = source.indexOf("=>", markerIndex);
  assert.notEqual(arrowIndex, -1, `missing IPC handler arrow: ${channel}`);

  return extractBlockStartingAt(source, source.indexOf("{", arrowIndex));
}

function extractFunctionBody(source: string, name: string): string {
  const marker = `function ${name}`;
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `missing function: ${name}`);

  return extractBlockStartingAt(source, source.indexOf("{", markerIndex));
}

function extractBlockStartingAt(source: string, startBrace: number): string {
  assert.notEqual(startBrace, -1, "missing opening brace");

  let depth = 0;
  for (let i = startBrace; i < source.length; i++) {
    const char = source[i];
    if (char === "{") depth++;
    if (char === "}") depth--;
    if (depth === 0) return source.slice(startBrace + 1, i);
  }

  assert.fail("missing closing brace");
}

function assertCallOrder(body: string, calls: string[]): void {
  let previous = -1;
  for (const call of calls) {
    const needle = call.startsWith("return ") ? call : `${call}(`;
    const current = body.indexOf(needle);
    assert.notEqual(current, -1, `missing ${call}`);
    assert.ok(current > previous, `${call} is out of order`);
    previous = current;
  }
}
