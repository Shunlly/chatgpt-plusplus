import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import test from "node:test";
import { createPkcs12Password, isInsideCodeSigningRoot, parseCodeSigningIdentities } from "../src/codesign";

test("parseCodeSigningIdentities extracts valid code signing identities", () => {
  const identities = parseCodeSigningIdentities(`
  1) ABCDEF1234567890ABCDEF1234567890ABCDEF12 "Codex++ Local Signing"
  2) 0123456789abcdef0123456789abcdef01234567 "Apple Development: Example"
     2 valid identities found
`);

  assert.deepEqual(identities, [
    {
      hash: "ABCDEF1234567890ABCDEF1234567890ABCDEF12",
      name: "Codex++ Local Signing",
    },
    {
      hash: "0123456789abcdef0123456789abcdef01234567",
      name: "Apple Development: Example",
    },
  ]);
});

test("isInsideCodeSigningRoot rejects sibling and parent traversal paths", () => {
  const root = resolve("tmp", "codexpp-sign-root");

  assert.equal(isInsideCodeSigningRoot(root, join(root, "native.node")), true);
  assert.equal(isInsideCodeSigningRoot(root, join(root, "nested", "native.node")), true);
  assert.equal(isInsideCodeSigningRoot(root, join(root, "..", "outside.node")), false);
  assert.equal(isInsideCodeSigningRoot(root, join(`${root}-sibling`, "native.node")), false);
});

test("createPkcs12Password returns a non-empty command-safe password", () => {
  const password = createPkcs12Password();

  assert.match(password, /^[A-Za-z0-9_-]+$/);
  assert.ok(password.length >= 32);
});
