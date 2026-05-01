import assert from "node:assert/strict";
import test from "node:test";
import {
  isMainProcessTweakScope,
  reloadTweaks,
  setTweakEnabledAndReload,
  type SetTweakEnabledAndReloadDeps,
} from "../src/tweak-lifecycle";

test("isMainProcessTweakScope includes main, both, and omitted scopes", () => {
  assert.equal(isMainProcessTweakScope("main"), true);
  assert.equal(isMainProcessTweakScope("both"), true);
  assert.equal(isMainProcessTweakScope(undefined), true);
});

test("isMainProcessTweakScope excludes renderer-only tweaks", () => {
  assert.equal(isMainProcessTweakScope("renderer"), false);
});

test("reloadTweaks stops, clears, loads, then broadcasts", () => {
  const calls: string[] = [];

  reloadTweaks("manual", deps(calls));

  assert.deepEqual(calls, [
    "log:reloading tweaks (manual)",
    "stopAllMainTweaks",
    "clearTweakModuleCache",
    "loadAllMainTweaks",
    "broadcastReload",
  ]);
});

test("setTweakEnabledAndReload enables a tweak and performs a full reload", () => {
  const calls: string[] = [];

  const result = setTweakEnabledAndReload("com.example.both", true, deps(calls));

  assert.equal(result, true);
  assert.deepEqual(calls, [
    "setTweakEnabled:com.example.both:true",
    "log:tweak com.example.both enabled=true",
    "log:reloading tweaks (enabled-toggle)",
    "stopAllMainTweaks",
    "clearTweakModuleCache",
    "loadAllMainTweaks",
    "broadcastReload",
  ]);
});

test("setTweakEnabledAndReload disables a tweak and performs a full reload", () => {
  const calls: string[] = [];

  setTweakEnabledAndReload("com.example.both", false, deps(calls));

  assert.deepEqual(calls, [
    "setTweakEnabled:com.example.both:false",
    "log:tweak com.example.both enabled=false",
    "log:reloading tweaks (enabled-toggle)",
    "stopAllMainTweaks",
    "clearTweakModuleCache",
    "loadAllMainTweaks",
    "broadcastReload",
  ]);
});

test("setTweakEnabledAndReload coerces truthy and falsy enabled values", () => {
  const truthyCalls: string[] = [];
  const falsyCalls: string[] = [];

  setTweakEnabledAndReload("com.example.truthy", 1, deps(truthyCalls));
  setTweakEnabledAndReload("com.example.falsy", "", deps(falsyCalls));

  assert.equal(truthyCalls[0], "setTweakEnabled:com.example.truthy:true");
  assert.equal(falsyCalls[0], "setTweakEnabled:com.example.falsy:false");
});

test("setTweakEnabledAndReload does not reload if persisting the flag fails", () => {
  const calls: string[] = [];

  assert.throws(
    () =>
      setTweakEnabledAndReload("com.example.fail", true, {
        ...deps(calls),
        setTweakEnabled() {
          calls.push("setTweakEnabled");
          throw new Error("write failed");
        },
      }),
    /write failed/,
  );

  assert.deepEqual(calls, ["setTweakEnabled"]);
});

test("reloadTweaks stops before clearing cache when stop fails", () => {
  const calls: string[] = [];

  assert.throws(
    () =>
      reloadTweaks("manual", {
        ...deps(calls),
        stopAllMainTweaks() {
          calls.push("stopAllMainTweaks");
          throw new Error("stop failed");
        },
      }),
    /stop failed/,
  );

  assert.deepEqual(calls, ["log:reloading tweaks (manual)", "stopAllMainTweaks"]);
});

function deps(calls: string[]): SetTweakEnabledAndReloadDeps {
  return {
    logInfo(message) {
      calls.push(`log:${message}`);
    },
    setTweakEnabled(id, enabled) {
      calls.push(`setTweakEnabled:${id}:${enabled}`);
    },
    stopAllMainTweaks() {
      calls.push("stopAllMainTweaks");
    },
    clearTweakModuleCache() {
      calls.push("clearTweakModuleCache");
    },
    loadAllMainTweaks() {
      calls.push("loadAllMainTweaks");
    },
    broadcastReload() {
      calls.push("broadcastReload");
    },
  };
}
