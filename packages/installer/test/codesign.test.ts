import assert from "node:assert/strict";
import test from "node:test";
import { parseCodeSigningIdentities } from "../src/codesign";

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
